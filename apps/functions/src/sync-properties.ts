import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import axios from 'axios';
import { OWNERREZ_API } from '@baileys/constants';
import { query, DbResult } from './services/database';
import { syncPropertyTags } from './services/tagSync';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';

type OwnerRezAddress = {
  street1?: string
  city?: string
  state?: string
  postal_code?: string
}

type OwnerRezTag = {
  id: number
  name: string
  color?: string
}

type OwnerRezProperty = {
  id: number
  name: string
  address?: OwnerRezAddress
  bedrooms?: number
  bathrooms?: number
  max_guests?: number
  latitude?: number
  longitude?: number
  thumbnail_url?: string
  public_url?: string
  active?: boolean
  tags?: OwnerRezTag[]
}

type SyncResult =
  | { status: 'success'; propertiesSynced: number; tenantId: string }
  | { status: 'error'; error: string }

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

  return { success: false, error: 'No OAuth token or PAT found. Please reconnect OwnerRez.' }
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
      error: axios.isAxiosError(error)
        ? `API Error: ${error.response?.status} ${error.response?.statusText}`
        : 'Failed to fetch properties'
    }
  }
}

const createPropertyRecord = (property: OwnerRezProperty, tenantId: string) => ({
  tenant_id: tenantId,
  ownerrez_id: property.id.toString(),
  name: property.name,
  address: property.address?.street1 || '',
  city: property.address?.city || '',
  state: property.address?.state || '',
  postal_code: property.address?.postal_code || '',
  bedrooms: property.bedrooms || 0,
  bathrooms: property.bathrooms || 0,
  max_guests: property.max_guests || 0,
  latitude: property.latitude,
  longitude: property.longitude,
  thumbnail_url: property.thumbnail_url,
  public_url: property.public_url,
  active: property.active !== false
})

const upsertProperty = async (
  property: OwnerRezProperty,
  tenantId: string
): Promise<DbResult<string>> => {
  const record = createPropertyRecord(property, tenantId)

  const result = await query<{ id: string }>(
    `INSERT INTO properties (
      tenant_id, ownerrez_id, name, address, city, state, postal_code,
      bedrooms, bathrooms, max_guests, latitude, longitude,
      thumbnail_url, public_url, active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    ON CONFLICT (tenant_id, ownerrez_id) DO UPDATE SET
      name = EXCLUDED.name,
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
      active = EXCLUDED.active,
      updated_at = CURRENT_TIMESTAMP
    RETURNING id`,
    Object.values(record)
  )

  return result.success && result.data.length > 0
    ? { success: true, data: result.data[0].id }
    : { success: false, error: `Failed to sync property ${property.name}` }
}

const syncSingleProperty = async (
  property: OwnerRezProperty,
  tenantId: string
): Promise<DbResult<void>> => {
  const result = await upsertProperty(property, tenantId)
  if (!result.success) return result

  if (property.tags) {
    await syncPropertyTags(result.data, property.tags, tenantId)
  }

  return { success: true, data: undefined }
}

const syncAllProperties = async (
  properties: readonly OwnerRezProperty[],
  tenantId: string
): Promise<{ propertiesSynced: number }> => {
  const results = await Promise.all(
    properties.map(property => syncSingleProperty(property, tenantId))
  )

  return {
    propertiesSynced: results.filter(r => r.success).length
  }
}

const performSync = async (credentials: TenantCredentials): Promise<SyncResult> => {
  const propertiesResult = await fetchProperties(credentials.token)

  if (!propertiesResult.success) {
    return { status: 'error', error: propertiesResult.error }
  }

  const syncResult = await syncAllProperties(propertiesResult.data, credentials.tenantId)

  return {
    status: 'success',
    propertiesSynced: syncResult.propertiesSynced,
    tenantId: credentials.tenantId
  }
}

export async function syncProperties(
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

  const credentialsResult = await getTenantCredentials(auth.tenantId)
  if (!credentialsResult.success) {
    return {
      status: 403,
      headers: corsHeaders(),
      jsonBody: { error: credentialsResult.error }
    }
  }

  context.log('Syncing properties for tenant:', auth.tenantId)

  const syncResult = await performSync(credentialsResult.data)

  if (syncResult.status === 'error') {
    if (axios.isAxiosError(syncResult.error)) {
      context.error('OwnerRez API error:', syncResult.error)
    }

    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: syncResult
    }
  }

  context.log(`Synced ${syncResult.propertiesSynced} properties`)

  return {
    status: 200,
    headers: corsHeaders(),
    jsonBody: syncResult
  }
}

app.http('sync-properties', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: syncProperties
})
