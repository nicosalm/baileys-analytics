import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import axios from 'axios';
import { OWNERREZ_API } from '@baileys/constants';
import { query, transaction, DbResult } from './services/database';
import { syncBookingTags, bulkSyncBookingTags } from './services/tagSync';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';

type BookingCharge = {
  amount: number
  description: string
  type: string
  is_taxable: boolean
  tax_id?: number
  position: number
}

type OwnerRezGuest = {
  id: number
  first_name: string
  last_name: string
  email?: string  // Added email field
}

type OwnerRezTag = {
  id: number
  name: string
  color?: string
}

type OwnerRezBooking = {
  id: number
  property_id: number
  guest_id: number
  arrival: string
  departure: string
  adults: number
  children: number
  infants: number
  pets: number
  status: string
  total_amount: number
  charges?: BookingCharge[]
  guest?: OwnerRezGuest
  listing_site?: string
  platform_reservation_number?: string
  booked_utc: string
  canceled_utc?: string
  tags?: string[] | OwnerRezTag[] // Can be either strings or objects
}

type SyncResult =
  | { status: 'success'; bookingsSynced: number; chargesSynced: number }
  | { status: 'error'; error: string }

type PropertyMapping = ReadonlyMap<string, string>
type TagMapping = ReadonlyMap<string, OwnerRezTag>

type DateRange = {
  from: string
  to: string
}

type TenantCredentials = {
  tenantId: string
  token: string
}

const getTenantCredentials = async (tenantId: string): Promise<DbResult<TenantCredentials>> => {
  const result = await query<{ access_token: string }>(
    'SELECT access_token FROM oauth_tokens WHERE tenant_id = $1',
    [tenantId]
  )

  if (result.success && result.data.length > 0) {
    return { success: true, data: { tenantId, token: result.data[0].access_token } }
  }

  const pat = process.env.OWNERREZ_PAT
  if (pat) {
    return { success: true, data: { tenantId, token: pat } }
  }

  return { success: false, error: 'No OAuth token or PAT found' }
}

const getPropertyMapping = async (tenantId: string): Promise<DbResult<PropertyMapping>> => {
  const result = await query<{ ownerrez_id: string; id: string }>(
    'SELECT id, ownerrez_id FROM properties WHERE tenant_id = $1',
    [tenantId]
  )

  if (!result.success) return result

  const mapping = new Map(result.data.map(row => [row.ownerrez_id, row.id]))
  return { success: true, data: mapping }
}

const parseBookingDates = (from?: string, to?: string): DateRange => ({
  from: from || new Date(Date.now() - 1460 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 4 years
  to: to || new Date().toISOString().split('T')[0]
})

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

    // Paginate through all tag definitions
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

      // Check if there are more pages
      if (!response.data.next_page_url || tags.length < limit) {
        break
      }
      offset += limit
    }

    return { success: true, data: tagMap }
  } catch (error) {
    return {
      success: false,
      error: axios.isAxiosError(error)
        ? `Failed to fetch tag definitions: ${error.response?.status}`
        : 'Failed to fetch tag definitions'
    }
  }
}

const fetchBookingsBatch = async (
  token: string,
  propertyIds: readonly string[],
  dateRange: DateRange
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
      error: axios.isAxiosError(error)
        ? `API Error: ${error.response?.status} ${error.response?.statusText}`
        : 'Failed to fetch bookings'
    }
  }
}

const chunkArray = <T>(array: readonly T[], size: number): T[][] =>
  Array.from(
    { length: Math.ceil(array.length / size) },
    (_, i) => array.slice(i * size, (i + 1) * size)
  )

const fetchAllBookings = async (
  token: string,
  propertyIds: readonly string[],
  dateRange: DateRange
): Promise<DbResult<OwnerRezBooking[]>> => {
  const batches = chunkArray(propertyIds, 50)
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

// Updated to include email
const buildGuestName = (guest?: OwnerRezGuest): string | null =>
  guest ? `${guest.first_name} ${guest.last_name}` : null

// New function to extract guest email
const buildGuestEmail = (guest?: OwnerRezGuest): string | null =>
  guest?.email || null

const createBookingRecord = (
  booking: OwnerRezBooking,
  propertyId: string,
  tenantId: string
) => ({
  tenant_id: tenantId,
  property_id: propertyId,
  ownerrez_booking_id: booking.id.toString(),
  arrival: booking.arrival,
  departure: booking.departure,
  adults: booking.adults || 0,
  children: booking.children || 0,
  infants: booking.infants || 0,
  pets: booking.pets || 0,
  guest_name: buildGuestName(booking.guest),
  guest_email: buildGuestEmail(booking.guest), // Now captures email
  total_amount: booking.total_amount,
  status: booking.status,
  platform: booking.listing_site,
  platform_reservation_number: booking.platform_reservation_number,
  booked_utc: booking.booked_utc,
  canceled_utc: booking.canceled_utc
})

const createChargeRecords = (bookingId: string, charges: BookingCharge[] = []) =>
  charges.map(charge => ({
    booking_id: bookingId,
    type: charge.type,
    description: charge.description,
    amount: charge.amount,
    is_taxable: charge.is_taxable,
    tax_id: charge.tax_id?.toString() ?? null,
    position: charge.position
  }))

const upsertBooking = async (
  booking: OwnerRezBooking,
  propertyId: string,
  tenantId: string
): Promise<DbResult<string>> => {
  const bookingRecord = createBookingRecord(booking, propertyId, tenantId)

  const result = await query<{ id: string }>(
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
    Object.values(bookingRecord)
  )

  return result.success && result.data.length > 0
    ? { success: true, data: result.data[0].id }
    : { success: false, error: 'Failed to upsert booking' }
}

const syncBookingCharges = async (
  bookingId: string,
  charges?: BookingCharge[]
): Promise<DbResult<number>> => {
  if (!charges || charges.length === 0) {
    return { success: true, data: 0 }
  }

  return transaction(async (client) => {
    await client.query('DELETE FROM booking_charges WHERE booking_id = $1', [bookingId])

    const chargeRecords = createChargeRecords(bookingId, charges)

    for (const charge of chargeRecords) {
      await client.query(
        `INSERT INTO booking_charges (
          booking_id, type, description, amount,
          is_taxable, tax_id, position
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        Object.values(charge)
      )
    }

    return charges.length
  })
}

const convertBookingTags = (
  tags: string[] | OwnerRezTag[] | undefined,
  tagDefinitions: TagMapping
): OwnerRezTag[] => {
  if (!tags || tags.length === 0) return []

  // If already objects, return as is
  if (typeof tags[0] === 'object') {
    return tags as OwnerRezTag[]
  }

  // Convert strings to objects using definitions
  return (tags as string[])
    .map(tagName => tagDefinitions.get(tagName))
    .filter((tag): tag is OwnerRezTag => tag !== undefined)
}

const syncSingleBooking = async (
  booking: OwnerRezBooking,
  propertyId: string,
  tenantId: string,
  tagDefinitions: TagMapping
): Promise<DbResult<{ chargeCount: number; bookingId: string }>> => {
  const bookingResult = await upsertBooking(booking, propertyId, tenantId)
  if (!bookingResult.success) return bookingResult

  const chargesResult = await syncBookingCharges(bookingResult.data, booking.charges)

  // Tags are now handled in bulk by processBookingBatch

  return {
    success: true,
    data: {
      chargeCount: chargesResult.success ? chargesResult.data : 0,
      bookingId: bookingResult.data
    }
  }
}

const processBookingBatch = async (
  bookings: readonly OwnerRezBooking[],
  propertyMapping: PropertyMapping,
  tenantId: string,
  tagDefinitions: TagMapping
): Promise<readonly DbResult<{ chargeCount: number }>[]> => {
  const validBookings = bookings.filter(b =>
    b && typeof b.property_id === 'number' && propertyMapping.has(b.property_id.toString())
  )

  // First, sync all bookings and charges
  const syncResults: Array<{ result: DbResult<{ chargeCount: number; bookingId: string }>, booking: OwnerRezBooking }> = []

  for (const booking of validBookings) {
    const result = await syncSingleBooking(
      booking,
      propertyMapping.get(booking.property_id.toString())!,
      tenantId,
      tagDefinitions
    )
    syncResults.push({ result, booking })
  }

  // Then, collect all bookings with tags for bulk sync
  const bookingTagsMap = new Map<string, OwnerRezTag[]>()

  for (const { result, booking } of syncResults) {
    if (result.success && booking.tags) {
      const tagObjects = convertBookingTags(booking.tags, tagDefinitions)
      if (tagObjects.length > 0) {
        bookingTagsMap.set(result.data.bookingId, tagObjects)
      }
    }
  }

  // Bulk sync all tags at once
  if (bookingTagsMap.size > 0) {
    await bulkSyncBookingTags(bookingTagsMap, tenantId)
  }

  return syncResults.map(({ result }) => ({
    success: result.success,
    data: result.success ? { chargeCount: result.data.chargeCount } : undefined,
    error: result.success ? undefined : result.error
  }) as DbResult<{ chargeCount: number }>)
}

const aggregateSyncResults = (
  results: readonly DbResult<{ chargeCount: number }>[]
): { bookingsSynced: number; chargesSynced: number } => {
  const successful = results.filter(r => r.success)
  const totalCharges = successful.reduce(
    (sum, r) => sum + (r.success ? r.data.chargeCount : 0),
    0
  )

  return {
    bookingsSynced: successful.length,
    chargesSynced: totalCharges
  }
}

const performSync = async (
  credentials: TenantCredentials,
  propertyMapping: PropertyMapping,
  dateRange: DateRange
): Promise<SyncResult> => {
  // Fetch tag definitions first
  const tagDefsResult = await fetchAllTagDefinitions(credentials.token)
  if (!tagDefsResult.success) {
    console.log('Warning: Failed to fetch tag definitions:', tagDefsResult.error)
  }
  const tagDefinitions = tagDefsResult.success ? tagDefsResult.data : new Map()

  const propertyIds = Array.from(propertyMapping.keys())

  if (propertyIds.length === 0) {
    return {
      status: 'error',
      error: 'No properties found. Please run sync-properties first.'
    }
  }

  const bookingsResult = await fetchAllBookings(
    credentials.token,
    propertyIds,
    dateRange
  )

  if (!bookingsResult.success) {
    return { status: 'error', error: bookingsResult.error }
  }

  const results = await processBookingBatch(
    bookingsResult.data,
    propertyMapping,
    credentials.tenantId,
    tagDefinitions
  )

  const summary = aggregateSyncResults(results)

  return {
    status: 'success',
    ...summary
  }
}

const handleSyncError = (
  error: unknown,
  context: InvocationContext
): HttpResponseInit => {
  if (axios.isAxiosError(error)) {
    context.error('OwnerRez API error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    })
  }

  const errorMessage = error instanceof Error ? error.message : 'Unknown error'
  context.error('Sync failed:', error)

  return {
    status: 500,
    headers: corsHeaders(),
    jsonBody: {
      status: 'error',
      error: errorMessage
    }
  }
}

export async function syncBookings(
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
    const credentialsResult = await getTenantCredentials(auth.tenantId)
    if (!credentialsResult.success) {
      return {
        status: 403,
        headers: corsHeaders(),
        jsonBody: { error: credentialsResult.error }
      }
    }

    const mappingResult = await getPropertyMapping(auth.tenantId)
    if (!mappingResult.success) {
      return {
        status: 500,
        headers: corsHeaders(),
        jsonBody: { status: 'error', error: mappingResult.error }
      }
    }

    const dateRange = parseBookingDates(
      request.query.get('from') || undefined,
      request.query.get('to') || undefined
    )

    context.log('Syncing bookings:', {
      ...dateRange,
      propertyCount: mappingResult.data.size
    })

    const syncResult = await performSync(
      credentialsResult.data,
      mappingResult.data,
      dateRange
    )

    return {
      status: syncResult.status === 'error' ? 500 : 200,
      headers: corsHeaders(),
      jsonBody: syncResult
    }

  } catch (error) {
    return handleSyncError(error, context)
  }
}

app.http('sync-bookings', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: syncBookings
})
