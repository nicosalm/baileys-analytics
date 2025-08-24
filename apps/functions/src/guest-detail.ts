import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { calculateNights, safeDivide } from '@baileys/utils';
import { query, DbResult } from './services/database';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';
import { createSuccessResponse, createErrorResponse, createNotFoundResponse, requireTenant } from './utils/httpResponses';
import { buildGuestFilter } from './utils/queryBuilders';
import { parseNumericField, parseIntField, createGuestId, parseGuestId } from './utils/dataTransformers';

type GuestDetail = {
  guest: GuestInfo
  bookings: readonly BookingInfo[]
  properties: readonly PropertyStayInfo[]
  spendingTrend: readonly SpendingTrend[]
  tags: readonly TagInfo[]
  paymentMethods: readonly PaymentMethod[]
}

type GuestInfo = {
  id: string
  name: string
  email?: string
  phone?: string
  firstVisit: string
  lastVisit: string
  totalSpent: number
  bookingCount: number
  canceledCount: number
  avgNightlyRate: number
  avgStayLength: number
  totalNights: number
  favoriteProperty?: FavoriteProperty
}

type FavoriteProperty = {
  id: string
  name: string
  bookingCount: number
}

type BookingInfo = {
  id: string
  propertyId: string
  propertyName: string
  arrival: string
  departure: string
  nights: number
  totalAmount: number
  status: string
  platform?: string
}

type PropertyStayInfo = {
  propertyId: string
  propertyName: string
  bookingCount: number
  totalSpent: number
  avgNightlyRate: number
  lastStay: string
}

type SpendingTrend = {
  month: string
  amount: number
  bookings: number
}

type TagInfo = {
  id: string
  name: string
  color?: string
}

type PaymentMethod = {
  method: string
  count: number
  total: number
}

type GuestIdentifier = {
  name: string
  email: string
}

const parseGuestIdentifier = (guestId: string): GuestIdentifier => {
  const { name, email } = parseGuestId(guestId)
  return { name, email: email || '' }
}

const fetchGuestSummary = async (
  tenantId: string,
  guest: GuestIdentifier
): Promise<DbResult<{
  guest_name: string
  guest_email: string
  guest_phone: string
  first_visit: string
  last_visit: string
  total_spent: string
  booking_count: string
  canceled_count: string
  total_nights: string
}>> => {
  const result = await query<{
    guest_name: string
    guest_email: string
    guest_phone: string
    first_visit: string
    last_visit: string
    total_spent: string
    booking_count: string
    canceled_count: string
    total_nights: string
  }>(
    `SELECT
      guest_name,
      MAX(guest_email) as guest_email,
      MAX(guest_phone) as guest_phone,
      MIN(arrival) as first_visit,
      MAX(arrival) as last_visit,
      SUM(CASE WHEN status != 'canceled' THEN total_amount ELSE 0 END) as total_spent,
      COUNT(CASE WHEN status != 'canceled' THEN 1 END) as booking_count,
      COUNT(CASE WHEN status = 'canceled' THEN 1 END) as canceled_count,
      SUM(CASE WHEN status != 'canceled' THEN departure - arrival ELSE 0 END) as total_nights
    FROM bookings
    WHERE tenant_id = $1
      AND guest_name = $2
      ${buildGuestFilter(3)}
    GROUP BY guest_name`,
    [tenantId, guest.name, guest.email]
  )

  if (!result.success || result.data.length === 0) {
    return { success: false, error: 'Guest not found' }
  }

  return { success: true, data: result.data[0] }
}

const fetchFavoriteProperty = async (
  tenantId: string,
  guest: GuestIdentifier
): Promise<DbResult<FavoriteProperty | null>> => {
  const result = await query<{
    property_id: string
    property_name: string
    booking_count: string
  }>(
    `SELECT
      p.id as property_id,
      p.name as property_name,
      COUNT(*) as booking_count
    FROM bookings b
    JOIN properties p ON b.property_id = p.id
    WHERE b.tenant_id = $1
      AND b.guest_name = $2
      ${buildGuestFilter(3)}
      AND b.status != 'canceled'
    GROUP BY p.id, p.name
    ORDER BY booking_count DESC, MAX(b.arrival) DESC
    LIMIT 1`,
    [tenantId, guest.name, guest.email]
  )

  if (!result.success || result.data.length === 0) {
    return { success: true, data: null }
  }

  const favorite = result.data[0]
  return {
    success: true,
    data: {
      id: favorite.property_id,
      name: favorite.property_name,
      bookingCount: parseIntField(favorite.booking_count)
    }
  }
}

const fetchGuestBookings = async (
  tenantId: string,
  guest: GuestIdentifier
): Promise<DbResult<readonly BookingInfo[]>> => {
  const result = await query<{
    id: string
    property_id: string
    property_name: string
    arrival: string
    departure: string
    total_amount: string
    status: string
    platform: string
  }>(
    `SELECT
      b.id,
      b.property_id,
      p.name as property_name,
      b.arrival,
      b.departure,
      b.total_amount,
      b.status,
      b.platform
    FROM bookings b
    JOIN properties p ON b.property_id = p.id
    WHERE b.tenant_id = $1
      AND b.guest_name = $2
      ${buildGuestFilter(3)}
    ORDER BY b.arrival DESC`,
    [tenantId, guest.name, guest.email]
  )

  if (!result.success) {
    return { success: false, error: result.error }
  }

  const bookings = result.data.map(b => ({
    id: b.id,
    propertyId: b.property_id,
    propertyName: b.property_name,
    arrival: b.arrival,
    departure: b.departure,
    nights: calculateNights(b.arrival, b.departure),
    totalAmount: parseNumericField(b.total_amount),
    status: b.status,
    platform: b.platform || undefined
  }))

  return { success: true, data: bookings }
}

const fetchPropertyStays = async (
  tenantId: string,
  guest: GuestIdentifier
): Promise<DbResult<readonly PropertyStayInfo[]>> => {
  const result = await query<{
    property_id: string
    property_name: string
    booking_count: string
    total_spent: string
    total_nights: string
    last_stay: string
  }>(
    `SELECT
      p.id as property_id,
      p.name as property_name,
      COUNT(*) as booking_count,
      SUM(b.total_amount) as total_spent,
      SUM(b.departure - b.arrival) as total_nights,
      MAX(b.arrival) as last_stay
    FROM bookings b
    JOIN properties p ON b.property_id = p.id
    WHERE b.tenant_id = $1
      AND b.guest_name = $2
      ${buildGuestFilter(3)}
      AND b.status != 'canceled'
    GROUP BY p.id, p.name
    ORDER BY booking_count DESC, last_stay DESC`,
    [tenantId, guest.name, guest.email]
  )

  if (!result.success) {
    return { success: false, error: result.error }
  }

  const properties = result.data.map(p => ({
    propertyId: p.property_id,
    propertyName: p.property_name,
    bookingCount: parseIntField(p.booking_count),
    totalSpent: parseNumericField(p.total_spent),
    avgNightlyRate: safeDivide(parseNumericField(p.total_spent), parseIntField(p.total_nights)),
    lastStay: p.last_stay
  }))

  return { success: true, data: properties }
}

const fetchSpendingTrend = async (
  tenantId: string,
  guest: GuestIdentifier
): Promise<DbResult<readonly SpendingTrend[]>> => {
  const result = await query<{
    month: string
    amount: string
    bookings: string
  }>(
    `SELECT
      TO_CHAR(arrival, 'YYYY-MM') as month,
      SUM(total_amount) as amount,
      COUNT(*) as bookings
    FROM bookings
    WHERE tenant_id = $1
      AND guest_name = $2
      ${buildGuestFilter(3)}
      AND status != 'canceled'
      AND arrival >= CURRENT_DATE - INTERVAL '2 years'
    GROUP BY TO_CHAR(arrival, 'YYYY-MM')
    ORDER BY month`,
    [tenantId, guest.name, guest.email]
  )

  if (!result.success) {
    return { success: false, error: result.error }
  }

  const trends = result.data.map(t => ({
    month: t.month,
    amount: parseNumericField(t.amount),
    bookings: parseIntField(t.bookings)
  }))

  return { success: true, data: trends }
}

const fetchGuestTags = async (
  tenantId: string,
  guest: GuestIdentifier
): Promise<DbResult<readonly TagInfo[]>> => {
  const result = await query<{
    tag_id: string
    tag_name: string
    tag_color: string
  }>(
    `SELECT DISTINCT
      t.id as tag_id,
      t.name as tag_name,
      t.color as tag_color
    FROM bookings b
    JOIN booking_tags bt ON b.id = bt.booking_id
    JOIN tags t ON bt.tag_id = t.id
    WHERE b.tenant_id = $1
      AND b.guest_name = $2
      ${buildGuestFilter(3)}
    ORDER BY t.name`,
    [tenantId, guest.name, guest.email]
  )

  if (!result.success) {
    return { success: false, error: result.error }
  }

  const tags = result.data.map(t => ({
    id: t.tag_id,
    name: t.tag_name,
    color: t.tag_color || undefined
  }))

  return { success: true, data: tags }
}

const fetchPaymentMethods = async (
  tenantId: string,
  guest: GuestIdentifier
): Promise<DbResult<readonly PaymentMethod[]>> => {
  const result = await query<{
    method: string
    count: string
    total: string
  }>(
    `WITH payment_data AS (
      SELECT
        CASE
          WHEN b.platform ILIKE '%airbnb%' THEN 'Airbnb'
          WHEN b.platform ILIKE '%vrbo%' THEN 'VRBO'
          WHEN b.platform ILIKE '%booking%' THEN 'Booking.com'
          WHEN EXISTS (
            SELECT 1 FROM booking_tags bt
            JOIN tags t ON bt.tag_id = t.id
            WHERE bt.booking_id = b.id
            AND (t.name ILIKE '%credit%' OR t.name ILIKE '%card%')
          ) THEN 'Credit Card'
          WHEN EXISTS (
            SELECT 1 FROM booking_tags bt
            JOIN tags t ON bt.tag_id = t.id
            WHERE bt.booking_id = b.id
            AND (t.name ILIKE '%ach%' OR t.name ILIKE '%bank%' OR t.name ILIKE '%transfer%')
          ) THEN 'ACH/Bank Transfer'
          ELSE 'Other'
        END as method,
        b.total_amount
      FROM bookings b
      WHERE b.tenant_id = $1
        AND b.guest_name = $2
        ${buildGuestFilter(3)}
        AND b.status != 'canceled'
    )
    SELECT
      method,
      COUNT(*)::text as count,
      SUM(total_amount)::text as total
    FROM payment_data
    GROUP BY method
    ORDER BY total DESC`,
    [tenantId, guest.name, guest.email]
  )

  if (!result.success) {
    return { success: false, error: result.error }
  }

  const methods = result.data.map(m => ({
    method: m.method,
    count: parseIntField(m.count),
    total: parseNumericField(m.total)
  }))

  return { success: true, data: methods }
}

const buildGuestInfo = (
  guestId: string,
  summary: {
    guest_name: string
    guest_email: string
    guest_phone: string
    first_visit: string
    last_visit: string
    total_spent: string
    booking_count: string
    canceled_count: string
    total_nights: string
  },
  favoriteProperty: FavoriteProperty | null
): GuestInfo => {
  const totalSpent = parseNumericField(summary.total_spent)
  const bookingCount = parseIntField(summary.booking_count)
  const totalNights = parseIntField(summary.total_nights)

  return {
    id: guestId,
    name: summary.guest_name,
    email: summary.guest_email || undefined,
    phone: summary.guest_phone || undefined,
    firstVisit: summary.first_visit,
    lastVisit: summary.last_visit,
    totalSpent,
    bookingCount,
    canceledCount: parseIntField(summary.canceled_count),
    avgNightlyRate: safeDivide(totalSpent, totalNights),
    avgStayLength: safeDivide(totalNights, bookingCount),
    totalNights,
    favoriteProperty: favoriteProperty || undefined
  }
}

const fetchGuestDetail = async (
  tenantId: string,
  guestId: string
): Promise<DbResult<GuestDetail>> => {
  const guest = parseGuestIdentifier(guestId)

  const [
    summaryResult,
    favoriteResult,
    bookingsResult,
    propertiesResult,
    spendingResult,
    tagsResult,
    paymentResult
  ] = await Promise.all([
    fetchGuestSummary(tenantId, guest),
    fetchFavoriteProperty(tenantId, guest),
    fetchGuestBookings(tenantId, guest),
    fetchPropertyStays(tenantId, guest),
    fetchSpendingTrend(tenantId, guest),
    fetchGuestTags(tenantId, guest),
    fetchPaymentMethods(tenantId, guest)
  ])

  if (!summaryResult.success) {
    return { success: false, error: summaryResult.error }
  }

  const guestInfo = buildGuestInfo(
    guestId,
    summaryResult.data,
    favoriteResult.success ? favoriteResult.data : null
  )

  return {
    success: true,
    data: {
      guest: guestInfo,
      bookings: bookingsResult.success ? bookingsResult.data : [],
      properties: propertiesResult.success ? propertiesResult.data : [],
      spendingTrend: spendingResult.success ? spendingResult.data : [],
      tags: tagsResult.success ? tagsResult.data : [],
      paymentMethods: paymentResult.success ? paymentResult.data : []
    }
  }
}

export async function getGuestDetail(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') {
    return handleOptions()
  }

  const authCheck = await requireAuth(request)
  if (!authCheck.authenticated) {
    return authCheck.response
  }

  const { auth } = authCheck.request

  const tenantCheck = requireTenant(auth.tenantId)
  if (tenantCheck) {
    return tenantCheck
  }

  const guestId = request.params.guestId
  if (!guestId) {
    return createErrorResponse('Guest ID is required', 400)
  }
  const result = await fetchGuestDetail(auth.tenantId!, guestId)

  if (!result.success) {
    return createNotFoundResponse(result.error)
  }

  return createSuccessResponse(result.data)
}

app.http('guest-detail', {
  methods: ['GET', 'OPTIONS'],
  route: 'guest/{guestId}/detail',
  authLevel: 'anonymous',
  handler: getGuestDetail
})
