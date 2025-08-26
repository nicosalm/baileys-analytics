import axios from 'axios';
import { OWNERREZ_API } from '@baileys/constants';
import { query, transaction, DbResult } from './database';
import { bulkSyncPropertyTags, bulkSyncBookingTags } from './tagSync';
import { InvocationContext } from '@azure/functions';
import { batchProcess, retryWithBackoff, apiLimiter, dbLimiter } from '../utils/concurrency';

// ============= TYPES =============
export type OwnerRezTag = {
  id: number
  name: string
  color?: string
}

export type OwnerRezProperty = {
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

export type OwnerRezBooking = {
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
    email?: string
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
    position: number
  }>
  tags?: string[] | OwnerRezTag[]
}

export type PropertySyncResult = {
  status: 'success' | 'error'
  synced?: number
  error?: string
}

export type BookingSyncResult = {
  status: 'success' | 'error'
  synced?: number
  charges?: number
  totalFetched?: number
  error?: string
}

export type TagMapping = Map<string, OwnerRezTag>
export type PropertyMapping = Map<string, string>

// ============= AUTH & CREDENTIALS =============
export const getTenantToken = async (tenantId: string): Promise<DbResult<string>> => {
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

export const buildAuthHeaders = (token: string) => {
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

// ============= TAG DEFINITIONS =============
export const fetchAllTagDefinitions = async (token: string): Promise<DbResult<TagMapping>> => {
  return retryWithBackoff<DbResult<TagMapping>>(
    async () => {
      const authConfig = buildAuthHeaders(token)
      const tagMap = new Map<string, OwnerRezTag>()
      let offset = 0
      const limit = 100

      while (true) {
        const response = await apiLimiter(() =>
          axios.get(`${OWNERREZ_API.BASE_URL}/tagdefinitions`, {
            ...authConfig,
            params: { active: true, limit, offset }
          })
        )

        const tags = response.data.items || []
        tags.forEach((tag: any) => {
          tagMap.set(tag.name, {
            id: tag.id,
            name: tag.name,
            color: tag.color
          })
        })

        if (!response.data.next_page_url || tags.length < limit) break
        offset += limit
      }

      return { success: true as const, data: tagMap }
    },
    {
      maxRetries: 3,
      initialDelay: 1000,
      factor: 2
    }
  ).catch(error => ({
    success: false as const,
    error: error instanceof Error ? error.message : 'Failed to fetch tag definitions'
  }))
}

const convertTags = (
  tags: string[] | OwnerRezTag[] | undefined,
  tagDefinitions: TagMapping
): OwnerRezTag[] => {
  if (!tags || tags.length === 0) return []
  if (typeof tags[0] === 'object') return tags as OwnerRezTag[]
  return (tags as string[])
    .map(tagName => tagDefinitions.get(tagName))
    .filter((tag): tag is OwnerRezTag => tag !== undefined)
}

// ============= PROPERTIES =============
export const fetchProperties = async (token: string): Promise<DbResult<OwnerRezProperty[]>> => {
  return retryWithBackoff<DbResult<OwnerRezProperty[]>>(
    async () => {
      const authConfig = buildAuthHeaders(token)
      const response = await apiLimiter(() => 
        axios.get(`${OWNERREZ_API.BASE_URL}/properties`, {
          ...authConfig,
          params: { active: true, include_tags: true }
        })
      )
      return { success: true as const, data: response.data.items || [] }
    },
    {
      maxRetries: 3,
      initialDelay: 1000,
      factor: 2
    }
  ).catch(error => ({
    success: false as const,
    error: error instanceof Error ? error.message : 'Failed to fetch properties'
  }))
}

export const getPropertyMapping = async (tenantId: string): Promise<DbResult<PropertyMapping>> => {
  const result = await query<{ ownerrez_id: string; id: string }>(
    'SELECT id, ownerrez_id FROM properties WHERE tenant_id = $1',
    [tenantId]
  )
  if (!result.success) return result
  const mapping = new Map(result.data.map(p => [p.ownerrez_id, p.id]))
  return { success: true, data: mapping }
}

const upsertProperty = async (
  property: OwnerRezProperty,
  tenantId: string
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
      address = EXCLUDED.address,
      city = EXCLUDED.city,
      state = EXCLUDED.state,
      postal_code = EXCLUDED.postal_code,
      bedrooms = EXCLUDED.bedrooms,
      bathrooms = EXCLUDED.bathrooms,
      max_guests = EXCLUDED.max_guests,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      thumbnail_url = EXCLUDED.thumbnail_url,
      public_url = EXCLUDED.public_url,
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
      property.active
    ]
  )

  return result.success && result.data.length > 0
    ? { success: true, data: result.data[0].id }
    : { success: false, error: 'Failed to upsert property' }
}

export const syncProperties = async (
  token: string,
  tenantId: string,
  context?: InvocationContext
): Promise<PropertySyncResult> => {
  const tagDefsResult = await fetchAllTagDefinitions(token)
  const tagDefinitions = tagDefsResult.success ? tagDefsResult.data : new Map()

  const fetchResult = await fetchProperties(token)
  if (!fetchResult.success) {
    return { status: 'error', error: fetchResult.error }
  }

  context?.log(`Syncing ${fetchResult.data.length} properties for tenant ${tenantId}`)

  // Use batchProcess for parallel property upserting with controlled concurrency
  const syncResults = await batchProcess(
    fetchResult.data,
    async (property) => {
      const result = await dbLimiter(() => upsertProperty(property, tenantId))
      return { result, property }
    },
    {
      concurrency: 5, // Process 5 properties in parallel
      onProgress: (completed, total) => {
        if (completed % 10 === 0) {
          context?.log(`Property sync progress: ${completed}/${total}`)
        }
      }
    }
  )

  // Bulk sync tags
  const propertyTagsMap = new Map<string, OwnerRezTag[]>()
  for (const { result, property } of syncResults) {
    if (result.success && property.tags) {
      const tagObjects = convertTags(property.tags, tagDefinitions)
      if (tagObjects.length > 0) {
        propertyTagsMap.set(result.data, tagObjects)
      }
    }
  }

  if (propertyTagsMap.size > 0) {
    await bulkSyncPropertyTags(propertyTagsMap, tenantId)
  }

  const synced = syncResults.filter(r => r.result.success).length
  return { status: 'success', synced }
}

// ============= BOOKINGS =============
const fetchBookingsBatch = async (
  token: string,
  propertyIds: string[],
  dateRange: { from: string; to: string },
  context?: InvocationContext
): Promise<DbResult<OwnerRezBooking[]>> => {
  const allBookings: OwnerRezBooking[] = []
  let offset = 0
  const limit = 100
  let pageCount = 0
  let continueLoop = true

  context?.log(`Fetching bookings for properties: ${propertyIds.join(',')}`)

  while (continueLoop) {
    try {
      const authConfig = buildAuthHeaders(token)
      const response = await retryWithBackoff(
        async () => apiLimiter(() =>
          axios.get(`${OWNERREZ_API.BASE_URL}/bookings`, {
            ...authConfig,
            params: {
              property_ids: propertyIds.join(','),
              from: dateRange.from,
              to: dateRange.to,
              include_charges: true,
              include_guest: true,
              include_tags: true,
              limit,
              offset
            }
          })
        ),
        {
          maxRetries: 3,
          initialDelay: 1000,
          factor: 2
        }
      )

      const items = response.data.items || []
      const nextPageUrl = response.data.next_page_url

      if (items.length === 0) {
        continueLoop = false
      } else {
        allBookings.push(...items)
        pageCount++

        if (nextPageUrl) {
          offset += limit
        } else {
          continueLoop = false
        }
      }
    } catch (error) {
      if (allBookings.length > 0) {
        return { success: true, data: allBookings }
      }
      return {
        success: false,
        error: axios.isAxiosError(error)
          ? `API Error: ${error.response?.status}`
          : 'Failed to fetch bookings'
      }
    }
  }

  context?.log(`Fetched ${pageCount} pages, ${allBookings.length} bookings`)
  return { success: true, data: allBookings }
}

export const fetchAllBookings = async (
  token: string,
  propertyIds: string[],
  dateRange: { from: string; to: string },
  context?: InvocationContext
): Promise<DbResult<OwnerRezBooking[]>> => {
  // Chunk properties into batches of 50
  const chunkSize = 50
  const batches = Array.from(
    { length: Math.ceil(propertyIds.length / chunkSize) },
    (_, i) => propertyIds.slice(i * chunkSize, (i + 1) * chunkSize)
  )

  const results = await Promise.all(
    batches.map(batch => fetchBookingsBatch(token, batch, dateRange, context))
  )

  const failures = results.filter(r => !r.success)
  if (failures.length > 0) {
    return { success: false, error: failures[0].error }
  }

  const allBookings = results.flatMap(r => r.success ? r.data : [])
  context?.log(`Total bookings fetched: ${allBookings.length}`)
  return { success: true, data: allBookings }
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
        guest_name, guest_email, guest_phone, total_amount, status, platform,
        platform_reservation_number, booked_utc, canceled_utc
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
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
        guest_phone = EXCLUDED.guest_phone,
        total_amount = EXCLUDED.total_amount,
        status = EXCLUDED.status,
        platform = EXCLUDED.platform,
        platform_reservation_number = EXCLUDED.platform_reservation_number,
        canceled_utc = EXCLUDED.canceled_utc,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id`,
      [
        tenantId, propertyId, booking.id.toString(),
        booking.arrival, booking.departure,
        booking.adults || 0, booking.children || 0,
        booking.infants || 0, booking.pets || 0,
        booking.guest ? `${booking.guest.first_name} ${booking.guest.last_name}` : null,
        booking.guest?.email || null,
        null,
        booking.total_amount, booking.status,
        booking.listing_site, booking.platform_reservation_number,
        booking.booked_utc, booking.canceled_utc
      ]
    )

    const bookingId = result.rows[0].id

    // Handle charges
    await client.query('DELETE FROM booking_charges WHERE booking_id = $1', [bookingId])
    let chargeCount = 0
    if (booking.charges) {
      for (const charge of booking.charges) {
        await client.query(
          `INSERT INTO booking_charges (
            booking_id, type, description, amount, is_taxable, position
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [bookingId, charge.type, charge.description, charge.amount, charge.is_taxable, charge.position]
        )
        chargeCount++
      }
    }

    return { bookingId, chargeCount }
  })
}

export const syncBookings = async (
  token: string,
  tenantId: string,
  dateRange: { from: string; to: string },
  context?: InvocationContext
): Promise<BookingSyncResult> => {
  const tagDefsResult = await fetchAllTagDefinitions(token)
  const tagDefinitions = tagDefsResult.success ? tagDefsResult.data : new Map()

  const mappingResult = await getPropertyMapping(tenantId)
  if (!mappingResult.success) {
    return { status: 'error', error: 'No properties found' }
  }

  const propertyIds = Array.from(mappingResult.data.keys())
  const bookingsResult = await fetchAllBookings(token, propertyIds, dateRange, context)

  if (!bookingsResult.success) {
    return { status: 'error', error: bookingsResult.error }
  }

  const validBookings = bookingsResult.data.filter(b =>
    mappingResult.data.has(b.property_id.toString())
  )

  // Process bookings with controlled concurrency
  const allResults = await batchProcess(
    validBookings,
    async (booking) => {
      const propertyId = mappingResult.data.get(booking.property_id.toString())!
      const result = await dbLimiter(() => upsertBooking(booking, propertyId, tenantId))
      return { result, booking }
    },
    {
      concurrency: 10, // Process 10 bookings in parallel
      batchSize: 100, // Process in batches of 100
      onProgress: (completed, total) => {
        if (completed % 50 === 0) {
          context?.log(`Booking sync progress: ${completed}/${total}`)
        }
      }
    }
  )

  // Bulk sync tags
  const bookingTagsMap = new Map<string, OwnerRezTag[]>()
  for (const { result, booking } of allResults) {
    if (result.success && booking.tags) {
      const tagObjects = convertTags(booking.tags, tagDefinitions)
      if (tagObjects.length > 0) {
        bookingTagsMap.set(result.data.bookingId, tagObjects)
      }
    }
  }

  if (bookingTagsMap.size > 0) {
    await bulkSyncBookingTags(bookingTagsMap, tenantId)
  }

  const successful = allResults.filter(({ result }) => result.success)
  const totalCharges = successful.reduce(
    (sum, { result }) => sum + (result.success ? result.data.chargeCount : 0),
    0
  )

  return {
    status: 'success',
    synced: successful.length,
    charges: totalCharges,
    totalFetched: bookingsResult.data.length
  }
}
