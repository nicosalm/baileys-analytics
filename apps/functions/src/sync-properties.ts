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

type SyncResult = {
  propertiesSynced: number
  tenantId: string
}

const getTenantToken = async (tenantId: string): Promise<DbResult<string>> => {
  const result = await query<{ access_token: string }>(
    'SELECT access_token FROM oauth_tokens WHERE tenant_id = $1',
    [tenantId]
  )

  if (result.success && result.data.length > 0) {
    return { success: true, data: result.data[0].access_token }
  }

  // Fallback to PAT if no OAuth token (for manual setup/dev)
  const pat = process.env.OWNERREZ_PAT
  if (pat) {
    return { success: true, data: pat }
  }

  return { success: false, error: 'No OAuth token or PAT found. Please reconnect OwnerRez.' }
}

const fetchProperties = async (token: string): Promise<DbResult<OwnerRezProperty[]>> => {
  try {
    const isPAT = !token.startsWith('ey') // OAuth tokens usually start with 'ey' (JWT)

    const headers = isPAT
      ? { 'Accept': 'application/json' }
      : {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }

    const auth = isPAT
      ? { username: 'martina@***REMOVED***', password: token }
      : undefined

    const response = await axios.get(`${OWNERREZ_API.BASE_URL}/properties`, {
      headers,
      auth,
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
  properties: OwnerRezProperty[],
  tenantId: string
): Promise<SyncResult> => {
  const results = await Promise.all(
    properties.map(property => syncSingleProperty(property, tenantId))
  )

  const syncedCount = results.filter(r => r.success).length

  return {
    propertiesSynced: syncedCount,
    tenantId
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

  try {
    const tokenResult = await getTenantToken(auth.tenantId)
    if (!tokenResult.success) {
      return {
        status: 403,
        headers: corsHeaders(),
        jsonBody: { error: tokenResult.error }
      }
    }

    const propertiesResult = await fetchProperties(tokenResult.data)
    if (!propertiesResult.success) {
      return {
        status: 500,
        headers: corsHeaders(),
        jsonBody: { status: 'error', error: propertiesResult.error }
      }
    }

    context.log(`Found ${propertiesResult.data.length} properties to sync`)

    const syncResult = await syncAllProperties(propertiesResult.data, auth.tenantId)

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: {
        status: 'success',
        ...syncResult
      }
    }

  } catch (error) {
    return handleSyncError(error, context)
  }
}

app.http('sync-properties', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: syncProperties
})
