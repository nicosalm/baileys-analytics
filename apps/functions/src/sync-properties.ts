import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import axios from 'axios';
import { OWNERREZ_API } from '@baileys/constants';
import { query, DbResult } from './services/database';
import { syncPropertyTags, bulkSyncPropertyTags } from './services/tagSync';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';
import { createErrorResponse, createSuccessResponse, requireTenant } from './utils/httpResponses';
import { parseNumericField, parseIntField } from './utils/dataTransformers';

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
  tags?: string[] | OwnerRezTag[] // Can be either strings or objects
}

type SyncResult =
  | { status: 'success'; propertiesSynced: number; tenantId: string }
  | { status: 'error'; error: string }

type TenantCredentials = {
  tenantId: string
  token: string
}

type TagMapping = ReadonlyMap<string, OwnerRezTag>

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
  bedrooms: parseIntField(property.bedrooms),
  bathrooms: parseNumericField(property.bathrooms),
  max_guests: parseIntField(property.max_guests),
  latitude: parseNumericField(property.latitude),
  longitude: parseNumericField(property.longitude),
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

const convertPropertyTags = (
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

const syncAllProperties = async (
  properties: readonly OwnerRezProperty[],
  tenantId: string,
  tagDefinitions: TagMapping
): Promise<{ propertiesSynced: number }> => {
  // First, upsert all properties
  const syncResults: Array<{ result: DbResult<string>, property: OwnerRezProperty }> = []

  for (const property of properties) {
    const result = await upsertProperty(property, tenantId)
    syncResults.push({ result, property })
  }

  // Collect all properties with tags for bulk sync
  const propertyTagsMap = new Map<string, OwnerRezTag[]>()

  for (const { result, property } of syncResults) {
    if (result.success && property.tags) {
      const tagObjects = convertPropertyTags(property.tags, tagDefinitions)
      if (tagObjects.length > 0) {
        propertyTagsMap.set(result.data, tagObjects)
      }
    }
  }

  // Bulk sync all tags at once
  if (propertyTagsMap.size > 0) {
    await bulkSyncPropertyTags(propertyTagsMap, tenantId)
  }

  return {
    propertiesSynced: syncResults.filter(({ result }) => result.success).length
  }
}

const performSync = async (credentials: TenantCredentials): Promise<SyncResult> => {
  // Fetch tag definitions first
  const tagDefsResult = await fetchAllTagDefinitions(credentials.token)
  if (!tagDefsResult.success) {
  }
  const tagDefinitions = tagDefsResult.success ? tagDefsResult.data : new Map()

  const propertiesResult = await fetchProperties(credentials.token)

  if (!propertiesResult.success) {
    return { status: 'error', error: propertiesResult.error }
  }

  const syncResult = await syncAllProperties(propertiesResult.data, credentials.tenantId, tagDefinitions)

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

  const tenantValidation = requireTenant(auth.tenantId);
  if (tenantValidation) {
    return tenantValidation;
  }

  const credentialsResult = await getTenantCredentials(auth.tenantId!)
  if (!credentialsResult.success) {
    return createErrorResponse(credentialsResult.error, 403);
  }

  context.log('Syncing properties for tenant:', auth.tenantId)

  const syncResult = await performSync(credentialsResult.data)

  if (syncResult.status === 'error') {
    if (axios.isAxiosError(syncResult.error)) {
      context.error('OwnerRez API error:', syncResult.error)
    }

    return createErrorResponse(syncResult.error);
  }

  context.log(`Synced ${syncResult.propertiesSynced} properties`)

  return createSuccessResponse(syncResult);
}

app.http('sync-properties', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: syncProperties
})
