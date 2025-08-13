import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import axios from 'axios';
import { OWNERREZ_API } from '@baileys/constants';
import { query } from './services/database';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';
import { formatDateISO, getYear } from './utils/dates';

type ValidationResult = {
  source: string
  totalBookings: number
  totalRevenue: number
  totalTax: number
  avgNightlyRate: number
  totalNights: number
  bookings: Array<{
    id: string
    propertyName?: string
    arrival: string
    departure: string
    totalAmount: number
    taxes: number
    guest: string
    status: string
  }>
}

type ComparisonResult = {
  ownerrez: ValidationResult
  database: ValidationResult
  discrepancies: {
    revenueDiff: number
    bookingCountDiff: number
    taxDiff: number
    missingBookings: string[]
    extraBookings: string[]
    amountMismatches: Array<{
      bookingId: string
      ownerrezAmount: number
      dbAmount: number
      difference: number
    }>
  }
}

const getOwnerRezData = async (
  token: string,
  propertyIds: string[],
  fromDate: string,
  toDate: string
): Promise<ValidationResult> => {
  const authConfig = !token.startsWith('ey')
    ? {
        headers: { 'Accept': 'application/json' },
        auth: { username: 'martina@***REMOVED***', password: token }
      }
    : {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      }

  // Fetch bookings in batches
  const allBookings: any[] = []
  const batchSize = 50

  for (let i = 0; i < propertyIds.length; i += batchSize) {
    const batch = propertyIds.slice(i, i + batchSize)
    const response = await axios.get(`${OWNERREZ_API.BASE_URL}/bookings`, {
      ...authConfig,
      params: {
        property_ids: batch.join(','),
        from: fromDate,
        to: toDate,
        include_charges: true,
        include_guest: true,
        limit: 500
      }
    })
    allBookings.push(...(response.data.items || []))
  }

  // Filter out blocks - they're not real bookings
  const actualBookings = allBookings.filter(booking =>
    !booking.is_block && booking.type !== 'block'
  )

  // Calculate totals from OwnerRez data
  let totalRevenue = 0
  let totalTax = 0
  let totalNights = 0
  const bookings: ValidationResult['bookings'] = []

  for (const booking of actualBookings) {
    if (booking.status === 'canceled') continue

    const taxes = booking.charges?.filter((c: any) => c.type === 'tax')
      .reduce((sum: number, c: any) => sum + c.amount, 0) || 0

    // Fix: Check if total_amount exists before adding
    const bookingAmount = booking.total_amount || 0
    totalRevenue += bookingAmount
    totalTax += taxes

    const arrival = new Date(booking.arrival)
    const departure = new Date(booking.departure)
    const nights = Math.floor((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24))
    totalNights += nights

    bookings.push({
      id: booking.id.toString(),
      arrival: booking.arrival,
      departure: booking.departure,
      totalAmount: bookingAmount,
      taxes,
      guest: booking.guest ? `${booking.guest.first_name} ${booking.guest.last_name}` : 'Unknown',
      status: booking.status
    })
  }

  return {
    source: 'OwnerRez API',
    totalBookings: bookings.length,
    totalRevenue,
    totalTax,
    avgNightlyRate: totalNights > 0 ? totalRevenue / totalNights : 0,
    totalNights,
    bookings
  }
}

const getDatabaseData = async (
  tenantId: string,
  fromDate: string,
  toDate: string
): Promise<ValidationResult> => {
  const result = await query<{
    ownerrez_booking_id: string
    property_name: string
    arrival: string
    departure: string
    total_amount: string
    total_tax: string
    guest_name: string
    status: string
    nights: string
  }>(
    `SELECT
      b.ownerrez_booking_id,
      p.name as property_name,
      b.arrival::text,
      b.departure::text,
      b.total_amount::text,
      COALESCE(SUM(CASE WHEN bc.type = 'tax' THEN bc.amount ELSE 0 END), 0)::text as total_tax,
      b.guest_name,
      b.status,
      (b.departure - b.arrival)::text as nights
    FROM bookings b
    JOIN properties p ON b.property_id = p.id
    LEFT JOIN booking_charges bc ON b.id = bc.booking_id
    WHERE b.tenant_id = $1
      AND b.arrival >= $2
      AND b.arrival <= $3
      AND b.status != 'canceled'
    GROUP BY b.id, b.ownerrez_booking_id, p.name, b.arrival, b.departure,
             b.total_amount, b.guest_name, b.status
    ORDER BY b.arrival`,
    [tenantId, fromDate, toDate]
  )

  if (!result.success) {
    throw new Error('Failed to fetch database data')
  }

  const bookings = result.data.map(row => ({
    id: row.ownerrez_booking_id,
    propertyName: row.property_name,
    arrival: row.arrival,
    departure: row.departure,
    totalAmount: parseFloat(row.total_amount),
    taxes: parseFloat(row.total_tax),
    guest: row.guest_name,
    status: row.status
  }))

  const totalRevenue = bookings.reduce((sum, b) => sum + b.totalAmount, 0)
  const totalTax = bookings.reduce((sum, b) => sum + b.taxes, 0)
  const totalNights = result.data.reduce((sum, row) => sum + parseInt(row.nights), 0)

  return {
    source: 'Database',
    totalBookings: bookings.length,
    totalRevenue,
    totalTax,
    avgNightlyRate: totalNights > 0 ? totalRevenue / totalNights : 0,
    totalNights,
    bookings
  }
}

const compareResults = (
  ownerrez: ValidationResult,
  database: ValidationResult
): ComparisonResult['discrepancies'] => {
  const ownerrezIds = new Set(ownerrez.bookings.map(b => b.id))
  const dbIds = new Set(database.bookings.map(b => b.id))

  const missingBookings = [...ownerrezIds].filter(id => !dbIds.has(id))
  const extraBookings = [...dbIds].filter(id => !ownerrezIds.has(id))

  const amountMismatches: ComparisonResult['discrepancies']['amountMismatches'] = []

  // Compare amounts for matching bookings
  for (const orBooking of ownerrez.bookings) {
    const dbBooking = database.bookings.find(b => b.id === orBooking.id)
    if (dbBooking) {
      const diff = Math.abs(orBooking.totalAmount - dbBooking.totalAmount)
      if (diff > 0.01) { // Allow for small rounding differences
        amountMismatches.push({
          bookingId: orBooking.id,
          ownerrezAmount: orBooking.totalAmount,
          dbAmount: dbBooking.totalAmount,
          difference: diff
        })
      }
    }
  }

  return {
    revenueDiff: Math.abs(ownerrez.totalRevenue - database.totalRevenue),
    bookingCountDiff: Math.abs(ownerrez.totalBookings - database.totalBookings),
    taxDiff: Math.abs(ownerrez.totalTax - database.totalTax),
    missingBookings,
    extraBookings,
    amountMismatches
  }
}

export async function validateData(
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

  if (!auth.tenantId) {
    return {
      status: 403,
      headers: corsHeaders(),
      jsonBody: {
        error: 'OwnerRez connection required',
        code: 'NO_OWNERREZ_CONNECTION'
      }
    }
  }

  try {
    const fromDate = request.query.get('from') || formatDateISO(new Date(getYear(new Date()), 0, 1))
    const toDate = request.query.get('to') || formatDateISO(new Date())

    // Get OAuth token
    const tokenResult = await query<{ access_token: string }>(
      'SELECT access_token FROM oauth_tokens WHERE tenant_id = $1',
      [auth.tenantId]
    )

    const token = tokenResult.success && tokenResult.data.length > 0
      ? tokenResult.data[0].access_token
      : process.env.OWNERREZ_PAT

    if (!token) {
      return {
        status: 403,
        headers: corsHeaders(),
        jsonBody: { error: 'No OwnerRez token available' }
      }
    }

    // Get property IDs
    const propertyResult = await query<{ ownerrez_id: string }>(
      'SELECT ownerrez_id FROM properties WHERE tenant_id = $1 AND active = true',
      [auth.tenantId]
    )

    if (!propertyResult.success || propertyResult.data.length === 0) {
      return {
        status: 404,
        headers: corsHeaders(),
        jsonBody: { error: 'No properties found' }
      }
    }

    const propertyIds = propertyResult.data.map(p => p.ownerrez_id)

    // Fetch and compare data
    const [ownerrezData, databaseData] = await Promise.all([
      getOwnerRezData(token, propertyIds, fromDate, toDate),
      getDatabaseData(auth.tenantId, fromDate, toDate)
    ])

    const discrepancies = compareResults(ownerrezData, databaseData)

    const result: ComparisonResult = {
      ownerrez: ownerrezData,
      database: databaseData,
      discrepancies
    }

    // Log any significant discrepancies
    if (discrepancies.revenueDiff > 1 || discrepancies.bookingCountDiff > 0) {
      context.warn('Data validation found discrepancies:', {
        revenueDiff: discrepancies.revenueDiff,
        bookingCountDiff: discrepancies.bookingCountDiff,
        taxDiff: discrepancies.taxDiff
      })
    }

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: result
    }
  } catch (error) {
    context.error('Validation error:', error)
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: {
        error: error instanceof Error ? error.message : 'Validation failed'
      }
    }
  }
}

// Also create a simpler endpoint to just check calculation methods
export async function validateCalculations(
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

  try {
    const sampleBookingId = request.query.get('bookingId')

    if (!sampleBookingId) {
      return {
        status: 400,
        headers: corsHeaders(),
        jsonBody: { error: 'bookingId parameter required' }
      }
    }

    // Get detailed calculation breakdown for a single booking
    const result = await query<{
      ownerrez_booking_id: string
      total_amount: string
      charge_type: string
      charge_amount: string
      charge_description: string
      nights: string
      property_name: string
    }>(
      `SELECT
        b.ownerrez_booking_id,
        b.total_amount::text,
        bc.type as charge_type,
        bc.amount::text as charge_amount,
        bc.description as charge_description,
        (b.departure - b.arrival)::text as nights,
        p.name as property_name
      FROM bookings b
      JOIN properties p ON b.property_id = p.id
      LEFT JOIN booking_charges bc ON b.id = bc.booking_id
      WHERE b.tenant_id = $1 AND b.ownerrez_booking_id = $2
      ORDER BY bc.position`,
      [auth.tenantId, sampleBookingId]
    )

    if (!result.success || result.data.length === 0) {
      return {
        status: 404,
        headers: corsHeaders(),
        jsonBody: { error: 'Booking not found' }
      }
    }

    // Build calculation breakdown
    const booking = result.data[0]
    const charges = result.data.map(row => ({
      type: row.charge_type,
      amount: parseFloat(row.charge_amount || '0'),
      description: row.charge_description
    })).filter(c => c.type)

    const totalFromCharges = charges.reduce((sum, c) => sum + c.amount, 0)
    const taxes = charges.filter(c => c.type === 'tax').reduce((sum, c) => sum + c.amount, 0)
    const nights = parseInt(booking.nights)
    const avgNightlyRate = nights > 0 ? parseFloat(booking.total_amount) / nights : 0

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: {
        bookingId: booking.ownerrez_booking_id,
        propertyName: booking.property_name,
        totalAmount: parseFloat(booking.total_amount),
        totalFromCharges,
        discrepancy: Math.abs(parseFloat(booking.total_amount) - totalFromCharges),
        taxes,
        nights,
        avgNightlyRate,
        charges,
        calculations: {
          effectiveTaxRate: parseFloat(booking.total_amount) > 0
            ? (taxes / parseFloat(booking.total_amount)) * 100
            : 0,
          netRevenue: parseFloat(booking.total_amount) - taxes
        }
      }
    }
  } catch (error) {
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: {
        error: error instanceof Error ? error.message : 'Calculation validation failed'
      }
    }
  }
}

app.http('validate-data', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: validateData
})

app.http('validate-calculations', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: validateCalculations
})
