import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { query } from './services/database'
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth'

// GET /api/property-platforms
export async function getPropertyPlatforms(
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
  const propertyId = request.query.get('propertyId')

  try {
    let platformsQuery = `
      SELECT DISTINCT platform 
      FROM bookings 
      WHERE tenant_id = $1 
        AND platform IS NOT NULL
        AND platform != ''
    `
    const params: any[] = [auth.tenantId]

    if (propertyId) {
      platformsQuery += ` AND property_id = $2`
      params.push(propertyId)
    }

    platformsQuery += ` ORDER BY platform`

    const result = await query(platformsQuery, params)

    if (!result.success) {
      throw new Error('Failed to fetch platforms')
    }

    // Extract just the platform names
    const platforms = result.data.map((row: any) => row.platform)

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: {
        status: 'success',
        data: platforms
      }
    }
  } catch (error) {
    context.error('Error fetching property platforms:', error)
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: { status: 'error', error: 'Failed to fetch platforms' }
    }
  }
}

app.http('property-platforms', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: getPropertyPlatforms
})