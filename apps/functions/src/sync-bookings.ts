import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';
import { getTenantToken, getPropertyMapping, syncBookings } from './services/syncService';

export async function syncBookingsHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') return handleOptions()

  const authCheck = await requireAuth(request)
  if (!authCheck.authenticated) return authCheck.response

  const { auth } = authCheck.request
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

    // Parse date range (default to 4 years)
    const dateRange = {
      from: request.query.get('from') ||
        new Date(Date.now() - 1460 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      to: request.query.get('to') ||
        new Date().toISOString().split('T')[0]
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
