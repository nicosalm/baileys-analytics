import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import axios from 'axios';
import { OWNERREZ_API } from '@baileys/constants';
import { query, transaction, DbResult } from './services/database';
import { syncBookingTags, syncPropertyTags } from './services/tagSync';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';

type SyncType = 'recent' | 'historical'

type SyncRequest = {
  type: SyncType
  fromDate?: string
  toDate?: string
}

type BookingSyncResult = {
  bookingsFound: number
  bookingsSynced: number
  chargesSynced: number
  dateRange: { from: string; to: string }
}

type PropertySyncResult = {
  propertiesSynced: number
}

type FullSyncResult = {
  properties: { status: 'success'; synced: number } | { status: 'error'; error: string }
  bookings: { status: 'success'; synced: number; charges: number } | { status: 'error'; error: string }
  startedAt: Date
  completedAt: Date
  duration: number
}

type TenantToken = {
  tenantId: string
  token: string
}

type PropertyMapping = Map<string, string>
type TagMapping = Map<string, OwnerRezTag>

type OwnerRezTag = {
  id: number
  name: string
  color?: string
}

type OwnerRezBooking = {
  id: number
  property_id: number
  arrival: string
  departure: string
  adults?: number
  children?: number
  infants?: number
  pets?: number
  guest?: {
    first_name: string
    last_name: string
  }
  total_amount: number
  status: string
  listing_site?: string
  platform_reservation_number?: string
  booked_utc: string
  canceled_utc?: string
  charges?: Array<{
    type: string
    description: string
    amount: number
    is_taxable: boolean
    tax_id?: number
    position: number
  }>
  tags?: string[] | OwnerRezTag[]
}

type OwnerRezProperty = {
  id: number
  name: string
  active: boolean
  address?: {
    street1?: string
    city?: string
    state?: string
    postal_code?: string
  }
  bedrooms?: number
  bathrooms?: number
  max_guests?: number
  latitude?: number
  longitude?: number
  thumbnail_url?: string
  public_url?: string
  tags?: string[] | OwnerRezTag[]
}

const getTenantToken = async (tenantId: string): Promise<DbResult<string>> => {
  const result = await query<{ access_token: string }>(
    'SELECT access_token FROM oauth_tokens WHERE tenant_id = $1',
    [tenantId]
  )

  if (result.success && result.data.length > 0) {
    return { success: true, data: result.data[0].access_token }
  }

  const pat = process.env.OWNERREZ_PAT
  if (pat) {
    return { success: true, data: pat }
  }

  return { success: false, error: 'No OAuth token or PAT found' }
}

const buildAuthHeaders = (token: string) => {
  const isPAT = !token.startsWith('ey')

  return isPAT
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
}

const fetchAllTagDefinitions = async (token: string): Promise<DbResult<TagMapping>> => {
  try {
    const authConfig = buildAuthHeaders(token)
    const tagMap = new Map<string, OwnerRezTag>()
    let offset = 0
    const limit = 100

    while (true) {
      const response = await axios.get(`${OWNERREZ_API.BASE_URL}/tagdefinitions`, {
        ...authConfig,
        params: {
          active: true,
          limit,
          offset
        }
      })

      const tags = response.data.items || []
      tags.forEach((tag: any) => {
        tagMap.set(tag.name, {
          id: tag.id,
          name: tag.name,
          color: tag.color
        })
      })

      if (!response.data.next_page_url || tags.length < limit) {
        break
      }
      offset += limit
    }

    return { success: true, data: tagMap }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch tag definitions'
    }
  }
}

const getPropertyMapping = async (tenantId: string): Promise<DbResult<PropertyMapping>> => {
  const result = await query<{ ownerrez_id: string; id: string }>(
    'SELECT id, ownerrez_id FROM properties WHERE tenant_id = $1',
    [tenantId]
  )

  if (!result.success) {
    return result
  }

  const mapping = new Map(
    result.data.map(row => [row.ownerrez_id, row.id])
  )

  return { success: true, data: mapping }
}

const fetchBookingsBatch = async (
  token: string,
  propertyIds: string[],
  dateRange: { from: string; to: string }
): Promise<DbResult<OwnerRezBooking[]>> => {
  try {
    const authConfig = buildAuthHeaders(token)

    const response = await axios.get(`${OWNERREZ_API.BASE_URL}/bookings`, {
      ...authConfig,
      params: {
        property_ids: propertyIds.join(','),
        from: dateRange.from,
        to: dateRange.to,
        include_charges: true,
        include_guest: true,
        include_tags: true,
        limit: 500
      }
    })

    return { success: true, data: response.data.items || [] }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch bookings'
    }
  }
}

const fetchAllBookings = async (
  token: string,
  propertyIds: string[],
  dateRange: { from: string; to: string }
): Promise<DbResult<OwnerRezBooking[]>> => {
  const batchSize = 50
  const batches = Array.from(
    { length: Math.ceil(propertyIds.length / batchSize) },
    (_, i) => propertyIds.slice(i * batchSize, (i + 1) * batchSize)
  )

  const results = await Promise.all(
    batches.map(batch => fetchBookingsBatch(token, batch, dateRange))
  )

  const failures = results.filter(r => !r.success)
  if (failures.length > 0) {
    return { success: false, error: failures[0].error }
  }

  const allBookings = results.flatMap(r => r.success ? r.data : [])
  return { success: true, data: allBookings }
}

const convertTags = (
  tags: string[] | OwnerRezTag[] | undefined,
  tagDefinitions: TagMapping
): OwnerRezTag[] => {
  if (!tags || tags.length === 0) return []

  if (typeof tags[0] === 'object') {
    return tags as OwnerRezTag[]
  }

  return (tags as string[])
    .map(tagName => tagDefinitions.get(tagName))
    .filter((tag): tag is OwnerRezTag => tag !== undefined)
}

const syncBookingCharges = async (
  bookingId: string,
  charges: OwnerRezBooking['charges']
): Promise<DbResult<number>> => {
  if (!charges || charges.length === 0) {
    return { success: true, data: 0 }
  }

  return transaction(async (client) => {
    await client.query('DELETE FROM booking_charges WHERE booking_id = $1', [bookingId])

    let count = 0
    for (const charge of charges) {
      await client.query(
        `INSERT INTO booking_charges (
          booking_id, type, description, amount,
          is_taxable, tax_id, position
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          bookingId,
          charge.type,
          charge.description,
          charge.amount,
          charge.is_taxable,
          charge.tax_id?.toString() ?? null,
          charge.position
        ]
      )
      count++
    }

    return count
  })
}

const upsertBooking = async (
  booking: OwnerRezBooking,
  propertyId: string,
  tenantId: string
): Promise<DbResult<{ bookingId: string; chargeCount: number }>> => {
  return transaction(async (client) => {
    const result = await client.query(
      `INSERT INTO bookings (
        tenant_id, property_id, ownerrez_booking_id,
        arrival, departure, adults, children, infants, pets,
        guest_name, guest_email, total_amount, status,
        platform, platform_reservation_number,
        booked_utc, canceled_utc
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (tenant_id, ownerrez_booking_id) DO UPDATE SET
        property_id = EXCLUDED.property_id,
        arrival = EXCLUDED.arrival,
        departure = EXCLUDED.departure,
        adults = EXCLUDED.adults,
        children = EXCLUDED.children,
        infants = EXCLUDED.infants,
        pets = EXCLUDED.pets,
        guest_name = EXCLUDED.guest_name,
        guest_email = EXCLUDED.guest_email,
        total_amount = EXCLUDED.total_amount,
        status = EXCLUDED.status,
        platform = EXCLUDED.platform,
        platform_reservation_number = EXCLUDED.platform_reservation_number,
        booked_utc = EXCLUDED.booked_utc,
        canceled_utc = EXCLUDED.canceled_utc,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id`,
      [
        tenantId,
        propertyId,
        booking.id.toString(),
        booking.arrival,
        booking.departure,
        booking.adults || 0,
        booking.children || 0,
        booking.infants || 0,
        booking.pets || 0,
        booking.guest ? `${booking.guest.first_name} ${booking.guest.last_name}` : null,
        null,
        booking.total_amount,
        booking.status,
        booking.listing_site,
        booking.platform_reservation_number,
        booking.booked_utc,
        booking.canceled_utc
      ]
    )

    const bookingId = result.rows[0].id
    const chargeCount = booking.charges?.length ?? 0

    return { bookingId, chargeCount }
  })
}

const syncSingleBooking = async (
  booking: OwnerRezBooking,
  propertyMapping: PropertyMapping,
  tenantId: string,
  tagDefinitions: TagMapping
): Promise<DbResult<{ chargeCount: number }>> => {
  const propertyId = propertyMapping.get(booking.property_id.toString())
  if (!propertyId) {
    return { success: false, error: `Property not found: ${booking.property_id}` }
  }

  const bookingResult = await upsertBooking(booking, propertyId, tenantId)
  if (!bookingResult.success) {
    return bookingResult
  }

  const chargesResult = await syncBookingCharges(
    bookingResult.data.bookingId,
    booking.charges
  )

  if (booking.tags) {
    const tagObjects = convertTags(booking.tags, tagDefinitions)
    if (tagObjects.length > 0) {
      await syncBookingTags(bookingResult.data.bookingId, tagObjects, tenantId)
    }
  }

  return {
    success: true,
    data: { chargeCount: chargesResult.success ? chargesResult.data : 0 }
  }
}

const syncBookings = async (
  bookings: OwnerRezBooking[],
  propertyMapping: PropertyMapping,
  tenantId: string,
  tagDefinitions: TagMapping
): Promise<BookingSyncResult> => {
  const results = await Promise.all(
    bookings.map(booking => syncSingleBooking(booking, propertyMapping, tenantId, tagDefinitions))
  )

  const successful = results.filter(r => r.success)
  const chargesSynced = successful.reduce(
    (sum, r) => sum + (r.success ? r.data.chargeCount : 0),
    0
  )

  return {
    bookingsFound: bookings.length,
    bookingsSynced: successful.length,
    chargesSynced,
    dateRange: { from: '', to: '' }
  }
}

const fetchProperties = async (token: string): Promise<DbResult<OwnerRezProperty[]>> => {
  try {
    const authConfig = buildAuthHeaders(token)

    const response = await axios.get(`${OWNERREZ_API.BASE_URL}/properties`, {
      ...authConfig,
      params: {
        active: true,
        include_tags: true
      }
    })

    return { success: true, data: response.data.items || [] }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch properties'
    }
  }
}

const upsertProperty = async (
  property: OwnerRezProperty,
  tenantId: string,
  tagDefinitions: TagMapping
): Promise<DbResult<string>> => {
  const result = await query<{ id: string }>(
    `INSERT INTO properties (
      tenant_id, ownerrez_id, name, address, city, state, postal_code,
      bedrooms, bathrooms, max_guests, latitude, longitude,
      thumbnail_url, public_url, active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    ON CONFLICT (tenant_id, ownerrez_id) DO UPDATE SET
      name = EXCLUDED.name,
      active = EXCLUDED.active,
      updated_at = CURRENT_TIMESTAMP
    RETURNING id`,
    [
      tenantId,
      property.id.toString(),
      property.name,
      property.address?.street1 || '',
      property.address?.city || '',
      property.address?.state || '',
      property.address?.postal_code || '',
      property.bedrooms || 0,
      property.bathrooms || 0,
      property.max_guests || 0,
      property.latitude,
      property.longitude,
      property.thumbnail_url,
      property.public_url,
      property.active !== false
    ]
  )

  if (!result.success) {
    return result
  }

  const propertyId = result.data[0].id

  if (property.tags) {
    const tagObjects = convertTags(property.tags, tagDefinitions)
    if (tagObjects.length > 0) {
      await syncPropertyTags(propertyId, tagObjects, tenantId)
    }
  }

  return { success: true, data: propertyId }
}

const syncProperties = async (
  properties: OwnerRezProperty[],
  tenantId: string,
  tagDefinitions: TagMapping
): Promise<PropertySyncResult> => {
  const results = await Promise.all(
    properties.map(property => upsertProperty(property, tenantId, tagDefinitions))
  )

  const successful = results.filter(r => r.success)

  return {
    propertiesSynced: successful.length
  }
}

const performHistoricalSync = async (
  { tenantId, token }: TenantToken,
  dateRange: { from: string; to: string }
): Promise<DbResult<BookingSyncResult>> => {
  const tagDefsResult = await fetchAllTagDefinitions(token)
  const tagDefinitions = tagDefsResult.success ? tagDefsResult.data : new Map()

  const mappingResult = await getPropertyMapping(tenantId)
  if (!mappingResult.success) {
    return mappingResult
  }

  const propertyIds = Array.from(mappingResult.data.keys())
  if (propertyIds.length === 0) {
    return { success: false, error: 'No properties found' }
  }

  const bookingsResult = await fetchAllBookings(token, propertyIds, dateRange)
  if (!bookingsResult.success) {
    return bookingsResult
  }

  const syncResult = await syncBookings(
    bookingsResult.data,
    mappingResult.data,
    tenantId,
    tagDefinitions
  )

  return {
    success: true,
    data: { ...syncResult, dateRange }
  }
}

const performFullSync = async (
  { tenantId, token }: TenantToken,
  dateRange: { from: string; to: string }
): Promise<FullSyncResult> => {
  const startedAt = new Date()

  const tagDefsResult = await fetchAllTagDefinitions(token)
  const tagDefinitions = tagDefsResult.success ? tagDefsResult.data : new Map()

  const propertiesResult = await fetchProperties(token)
  const propertiesSyncResult = propertiesResult.success
    ? await syncProperties(propertiesResult.data, tenantId, tagDefinitions)
    : { propertiesSynced: 0 }

  const bookingSyncResult = await performHistoricalSync({ tenantId, token }, dateRange)

  const completedAt = new Date()

  return {
    properties: propertiesResult.success
      ? { status: 'success', synced: propertiesSyncResult.propertiesSynced }
      : { status: 'error', error: propertiesResult.error },
    bookings: bookingSyncResult.success
      ? { status: 'success', synced: bookingSyncResult.data.bookingsSynced, charges: bookingSyncResult.data.chargesSynced }
      : { status: 'error', error: bookingSyncResult.error },
    startedAt,
    completedAt,
    duration: completedAt.getTime() - startedAt.getTime()
  }
}

const parseSyncRequest = (request: HttpRequest): SyncRequest => {
  const type = request.query.get('type') === 'historical' ? 'historical' : 'recent'
  const now = new Date()

  const defaults = {
    recent: {
      from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      to: now.toISOString().split('T')[0]
    },
    historical: {
      from: new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      to: now.toISOString().split('T')[0]
    }
  }

  return {
    type,
    fromDate: request.query.get('from') || defaults[type].from,
    toDate: request.query.get('to') || defaults[type].to
  }
}

export async function manualSync(
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

  const tokenResult = await getTenantToken(auth.tenantId)
  if (!tokenResult.success) {
    return {
      status: 403,
      headers: corsHeaders(),
      jsonBody: { error: tokenResult.error }
    }
  }

  const syncRequest = parseSyncRequest(request)
  const dateRange = { from: syncRequest.fromDate!, to: syncRequest.toDate! }
  const tenantToken = { tenantId: auth.tenantId, token: tokenResult.data }

  try {
    if (syncRequest.type === 'historical') {
      const result = await performHistoricalSync(tenantToken, dateRange)
      return {
        status: 200,
        headers: corsHeaders(),
        jsonBody: result.success
          ? { type: 'historical', ...result.data }
          : { error: result.error }
      }
    } else {
      const result = await performFullSync(tenantToken, dateRange)
      return {
        status: 200,
        headers: corsHeaders(),
        jsonBody: result
      }
    }
  } catch (error) {
    context.error('Manual sync error:', error)
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

app.http('manual-sync', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: manualSync
})
