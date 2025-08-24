import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { corsHeaders, handleOptions } from './middleware/auth';
import { requireAuthWithValidation } from './middleware/validation';
import { getTenantToken, getPropertyMapping, syncBookings } from './services/syncService';
import { syncRequestSchema } from '@baileys/shared-types';
import { getDefaultDateRange } from './utils/dates';
import { createErrorResponse, createSuccessResponse, requireTenant } from './utils/httpResponses';

export async function syncBookingsHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') return handleOptions()

  // Use Zod validation with auth
  const authCheck = await requireAuthWithValidation(request, {
    query: syncRequestSchema
  })
  
  if (!authCheck.authenticated || !authCheck.valid) {
    return authCheck.response
  }

  const { auth, validated } = authCheck.request
  
  const tenantValidation = requireTenant(auth.tenantId);
  if (tenantValidation) {
    return tenantValidation;
  }
  
  // Type assertion after validation
  const tenantId = auth.tenantId!

  try {
    const tokenResult = await getTenantToken(tenantId)
    if (!tokenResult.success) {
      return createErrorResponse(tokenResult.error, 403);
    }

    // Use validated query params with date-fns helper
    const defaultRange = getDefaultDateRange('long')
    const dateRange = {
      from: validated?.query?.from || defaultRange.from,
      to: validated?.query?.to || defaultRange.to
    }

    context.log(`Syncing bookings for tenant ${tenantId}`, dateRange)

    const result = await syncBookings(tokenResult.data, tenantId, dateRange, context)

    if (result.status === 'error') {
      return createErrorResponse(result.error || 'Sync failed');
    }

    return createSuccessResponse({
      status: 'success',
      bookingsSynced: result.synced!,
      chargesSynced: result.charges!,
      totalBookingsFetched: result.totalFetched!
    });
  } catch (error) {
    context.error('Sync failed:', error)
    return createErrorResponse('Sync failed');
  }
}

app.http('sync-bookings', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: syncBookingsHandler
})
