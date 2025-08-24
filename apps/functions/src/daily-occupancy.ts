import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth, handleOptions } from './middleware/auth';
import { createErrorResponse, createSuccessResponse, requireTenant } from './utils/httpResponses';
import {
  parseOccupancyQueryParams,
  getDailyOccupancyData,
  type DailyOccupancy
} from './services/occupancyService';


export async function getDailyOccupancy(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') {
    return handleOptions();
  }

  const authCheck = await requireAuth(request);
  if (!authCheck.authenticated) {
    return authCheck.response;
  }

  const { auth } = authCheck.request;

  const tenantError = requireTenant(auth.tenantId);
  if (tenantError) {
    return tenantError;
  }

  const params = parseOccupancyQueryParams(request, auth.tenantId!);
  
  const result = await getDailyOccupancyData(params);

  if (!result.success) {
    return createErrorResponse(result.error || 'Failed to fetch daily occupancy');
  }

  return createSuccessResponse(result.data);
}

app.http('occupancy-daily', {
  methods: ['GET', 'OPTIONS'],
  route: 'occupancy/daily',
  authLevel: 'anonymous',
  handler: getDailyOccupancy
});
