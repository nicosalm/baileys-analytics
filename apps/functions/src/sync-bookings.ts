import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { corsHeaders, handleOptions } from './middleware/auth';
import { requireAuthWithValidation } from './middleware/validation';
import { getTenantToken, getPropertyMapping, syncBookings } from './services/syncService';
import { syncRequestSchema } from '@baileys/shared-types';
import { getDefaultDateRange } from './utils/dates';

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
  
  if (!auth.tenantId) {
    return {
      status: 403,
      headers: corsHeaders(),
      jsonBody: { error: 'OwnerRez connection required', code: 'NO_OWNERREZ_CONNECTION' }
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

    // Use validated query params with date-fns helper
    const defaultRange = getDefaultDateRange('long')
    const dateRange = {
      from: validated?.query?.from || defaultRange.from,
      to: validated?.query?.to || defaultRange.to
    }

    context.log(`Syncing bookings for tenant ${auth.tenantId}`, dateRange)

    const result = await syncBookings(tokenResult.data, auth.tenantId, dateRange, context)

    return {
      status: result.status === 'error' ? 500 : 200,
      headers: corsHeaders(),
      jsonBody: result.status === 'success'
        ? {
            status: 'success',
            bookingsSynced: result.synced!,
            chargesSynced: result.charges!,
            totalBookingsFetched: result.totalFetched!
          }
        : { status: 'error', error: result.error }
    }
  } catch (error) {
    context.error('Sync failed:', error)
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: { status: 'error', error: 'Sync failed' }
    }
  }
}

app.http('sync-bookings', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: syncBookingsHandler
})
