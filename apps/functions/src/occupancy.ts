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
  
  // Fetch current period data
  const currentResult = await getOccupancyData(params, bookingFilters)

  if (!currentResult.success) {
    return createErrorResponse(currentResult.error || 'Failed to get occupancy data')
  }

  // If comparison dates are provided, fetch previous period data
  if (params.comparisonFrom && params.comparisonTo) {
    const previousResult = await getOccupancyData(
      params, 
      bookingFilters,
      params.comparisonFrom,
      params.comparisonTo
    )
    
    if (!previousResult.success) {
      // If comparison fails, still return current data
      return createSuccessResponse(currentResult.data)
    }
    
    // Return both current and previous data
    return createSuccessResponse({
      current: currentResult.data,
      previous: previousResult.data
    })
  }

  // No comparison requested, return current data only
  return createSuccessResponse(currentResult.data)
}

app.http('occupancy', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: getOccupancy
})
