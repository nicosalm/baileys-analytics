import { app, Timer, InvocationContext } from '@azure/functions';
import axios from 'axios';
import { OWNERREZ_API } from '@baileys/constants';
import { query, transaction, DbResult } from './services/database';
import { syncPropertyTags, syncBookingTags } from './services/tagSync';

type PropertySyncState =
  | { status: 'success'; synced: number }
  | { status: 'error'; error: string }

type BookingSyncState =
  | { status: 'success'; synced: number; charges: number }
  | { status: 'error'; error: string }

type SyncState = {
  properties: PropertySyncState
  bookings: BookingSyncState
  startedAt: Date
  completedAt: Date
  duration: number
}

type TenantWithToken = {
  tenantId: string
  token: string
}

type OwnerRezTag = {
  id: number
  name: string
  color?: string
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
  bedrooms: number
  bathrooms: number
  max_guests: number
  latitude?: number
  longitude?: number
  thumbnail_url?: string
  public_url?: string
  tags?: string[] | OwnerRezTag[]
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

type PropertyMapping = Map<string, string>
type TagMapping = Map<string, OwnerRezTag>

const getActiveTenantsWithTokens = async (): Promise<DbResult<TenantWithToken[]>> => {
  const result = await query<{ tenant_id: string; access_token: string }>(
    `SELECT t.id as tenant_id, ot.access_token
     FROM tenants t
     JOIN oauth_tokens ot ON t.id = ot.tenant_id
     WHERE ot.expires_at > CURRENT_TIMESTAMP`
  )

  if (result.success && result.data.length > 0) {
    return {
      success: true,
      data: result.data.map(r => ({ tenantId: r.tenant_id, token: r.access_token }))
    }
  }

  // Fallback to PAT if no OAuth tokens (for manual setup/dev)
  const pat = process.env.OWNERREZ_PAT
  if (pat) {
    const tenantsResult = await query<{ id: string }>(
      'SELECT id FROM tenants LIMIT 10'
    )

    if (tenantsResult.success && tenantsResult.data.length > 0) {
      return {
        success: true,
        data: tenantsResult.data.map(r => ({ tenantId: r.id, token: pat }))
      }
    }
  }

  return { success: false, error: 'No tenants with valid tokens found' }
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

const fetchProperties = async (token: string): Promise<DbResult<OwnerRezProperty[]>> => {
  try {
    const authConfig = buildAuthHeaders(token)

    const response = await axios.get(`${OWNERREZ_API.BASE_URL}/properties`, {
      ...authConfig,
      params: { active: true, include_tags: true }
    })
    return { success: true, data: response.data.items || [] }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch properties'
    }
  }
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
      property.bedrooms,
      property.bathrooms,
      property.max_guests,
      property.latitude,
      property.longitude,
      property.thumbnail_url,
      property.public_url,
      property.active
    ]
  )

  if (!result.success) return result

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
  token: string,
  tenantId: string
): Promise<PropertySyncState> => {
  const tagDefsResult = await fetchAllTagDefinitions(token)
  const tagDefinitions = tagDefsResult.success ? tagDefsResult.data : new Map()

  const fetchResult = await fetchProperties(token)
  if (!fetchResult.success) {
    return { status: 'error', error: fetchResult.error }
  }

  const results = await Promise.all(
    fetchResult.data.map(property => upsertProperty(property, tenantId, tagDefinitions))
  )

  const synced = results.filter(r => r.success).length
  const errors = results.filter(r => !r.success)

  return errors.length > 0
    ? { status: 'error', error: `Synced ${synced} properties, but ${errors.length} failed` }
    : { status: 'success', synced }
}

const getPropertyMapping = async (tenantId: string): Promise<DbResult<PropertyMapping>> => {
  const result = await query<{ ownerrez_id: string; id: string }>(
    'SELECT id, ownerrez_id FROM properties WHERE tenant_id = $1',
    [tenantId]
  )

  if (!result.success) return result

  const mapping = new Map(result.data.map(p => [p.ownerrez_id, p.id]))
  return { success: true, data: mapping }
}

const determineBookingDateRange = async (tenantId: string): Promise<{ from: string; to: string; isHistorical: boolean }> => {
  const result = await query<{ oldest_booking: string | null }>(
    'SELECT MIN(arrival) as oldest_booking FROM bookings WHERE tenant_id = $1',
    [tenantId]
  )

  const hasBookings = result.success && result.data[0].oldest_booking
  const now = Date.now()

  return hasBookings
    ? {
        from: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0],
        isHistorical: false
      }
    : {
        from: '2010-01-01', // Fetch ALL historical data on first sync
        to: new Date().toISOString().split('T')[0],
        isHistorical: true
      }
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

const upsertBooking = async (
  booking: OwnerRezBooking,
  propertyId: string,
  tenantId: string,
  tagDefinitions: TagMapping
): Promise<DbResult<{ bookingId: string; chargeCount: number }>> => {
  return transaction(async (client) => {
    const result = await client.query(
      `INSERT INTO bookings (
        tenant_id, property_id, ownerrez_booking_id,
        arrival, departure, adults, children, infants, pets,
        guest_name, total_amount, status, platform,
        booked_utc, canceled_utc
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (tenant_id, ownerrez_booking_id) DO UPDATE SET
        status = EXCLUDED.status,
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
        booking.total_amount,
        booking.status,
        booking.listing_site,
        booking.booked_utc,
        booking.canceled_utc
      ]
    )

    const bookingId = result.rows[0].id

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

    if (booking.tags) {
      const tagObjects = convertTags(booking.tags, tagDefinitions)
      if (tagObjects.length > 0) {
        await syncBookingTags(bookingId, tagObjects, tenantId)
      }
    }

    return { bookingId, chargeCount }
  })
}

const syncBookings = async (
  token: string,
  tenantId: string
): Promise<BookingSyncState> => {
  const tagDefsResult = await fetchAllTagDefinitions(token)
  const tagDefinitions = tagDefsResult.success ? tagDefsResult.data : new Map()

  const mappingResult = await getPropertyMapping(tenantId)
  if (!mappingResult.success) {
    return { status: 'error', error: 'Failed to get property mapping' }
  }

  const propertyIds = Array.from(mappingResult.data.keys())
  const dateRange = await determineBookingDateRange(tenantId)

  const bookingsResult = await fetchAllBookings(token, propertyIds, dateRange)
  if (!bookingsResult.success) {
    return { status: 'error', error: bookingsResult.error }
  }

  const validBookings = bookingsResult.data.filter(b =>
    mappingResult.data.has(b.property_id.toString())
  )

  const results = await Promise.all(
    validBookings.map(booking =>
      upsertBooking(
        booking,
        mappingResult.data.get(booking.property_id.toString())!,
        tenantId,
        tagDefinitions
      )
    )
  )

  const successful = results.filter(r => r.success)
  const totalCharges = successful.reduce(
    (sum, r) => sum + (r.success ? r.data.chargeCount : 0),
    0
  )

  return {
    status: 'success',
    synced: successful.length,
    charges: totalCharges
  }
}

const syncTenant = async (tenant: TenantWithToken): Promise<SyncState> => {
  const startedAt = new Date()

  const properties = await syncProperties(tenant.token, tenant.tenantId)
  const bookings = await syncBookings(tenant.token, tenant.tenantId)

  const completedAt = new Date()

  return {
    properties,
    bookings,
    startedAt,
    completedAt,
    duration: completedAt.getTime() - startedAt.getTime()
  }
}

export const performSync = async (
  token: string,
  tenantId: string
): Promise<SyncState> => {
  return syncTenant({ token, tenantId })
}

export async function autoSync(
  myTimer: Timer,
  context: InvocationContext
): Promise<void> {
  context.log('Auto-sync started at:', new Date().toISOString())

  const tenantsResult = await getActiveTenantsWithTokens()

  if (!tenantsResult.success || tenantsResult.data.length === 0) {
    context.log('No tenants with valid OAuth tokens found')
    return
  }

  const syncResults = await Promise.allSettled(
    tenantsResult.data.map(async (tenant) => {
      try {
        const result = await syncTenant(tenant)
        context.log(`Tenant ${tenant.tenantId} sync completed:`, {
          properties: result.properties,
          bookings: result.bookings,
          duration: `${result.duration}ms`
        })
        return { tenantId: tenant.tenantId, result }
      } catch (error) {
        context.error(`Failed to sync tenant ${tenant.tenantId}:`, error)
        throw error
      }
    })
  )

  const successful = syncResults.filter(r => r.status === 'fulfilled').length
  const failed = syncResults.filter(r => r.status === 'rejected').length

  context.log(`Auto-sync completed: ${successful} successful, ${failed} failed`)
}

app.timer('auto-sync', {
  schedule: '0 0 */12 * * *',
  handler: autoSync
})
