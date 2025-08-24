import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth, handleOptions } from './middleware/auth';
import { createErrorResponse, createSuccessResponse, requireTenant } from './utils/httpResponses';
import { getActiveSeasons, buildBookingFilters } from './services/seasonService';
import {
  parseOccupancyQueryParams,
  getOccupancyData,
  type OccupancyData
} from './services/occupancyService';


export async function getOccupancy(
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

  const tenantError = requireTenant(auth.tenantId)
  if (tenantError) {
    return tenantError
  }

  const params = parseOccupancyQueryParams(request, auth.tenantId!)
  
  // Get active seasons for filtering
  const seasons = await getActiveSeasons(auth.tenantId!)
  const bookingFilters = buildBookingFilters(seasons, 'b')
  
  const result = await getOccupancyData(params, bookingFilters)

  if (!result.success) {
    return createErrorResponse(result.error || 'Failed to get occupancy data')
  }

  return createSuccessResponse(result.data)
}

app.http('occupancy', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: getOccupancy
})
