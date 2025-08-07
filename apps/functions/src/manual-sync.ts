import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';
import {
  getTenantToken,
  syncProperties,
  syncBookings
} from './services/syncService';

export async function manualSync(
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

  const tokenResult = await getTenantToken(auth.tenantId)
  if (!tokenResult.success) {
    return {
      status: 403,
      headers: corsHeaders(),
      jsonBody: { error: tokenResult.error }
    }
  }

  const type = request.query.get('type') === 'historical' ? 'historical' : 'recent'
  const now = new Date()

  const dateRange = {
    from: request.query.get('from') || (
      type === 'historical'
        ? new Date(now.getTime() - 1460 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 4 years
        : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]  // 30 days
    ),
    to: request.query.get('to') || now.toISOString().split('T')[0]
  }

  try {
    context.log(`Starting ${type} sync for tenant ${auth.tenantId}`, dateRange)

    if (type === 'historical') {
      // Historical sync - bookings only
      const result = await syncBookings(tokenResult.data, auth.tenantId, dateRange, context)

      if (result.status === 'success') {
        context.log(`Historical sync completed: ${result.synced} bookings synced out of ${result.totalFetched} fetched`)
        return {
          status: 200,
          headers: corsHeaders(),
          jsonBody: {
            type: 'historical',
            bookingsFound: result.totalFetched!,
            bookingsSynced: result.synced!,
            chargesSynced: result.charges!,
            dateRange
          }
        }
      } else {
        return {
          status: 500,
          headers: corsHeaders(),
          jsonBody: { error: result.error }
        }
      }
    } else {
      // Recent sync - properties and bookings
      const startedAt = new Date()

      const propertiesResult = await syncProperties(tokenResult.data, auth.tenantId, context)
      const bookingsResult = await syncBookings(tokenResult.data, auth.tenantId, dateRange, context)

      const completedAt = new Date()

      return {
        status: 200,
        headers: corsHeaders(),
        jsonBody: {
          properties: propertiesResult,
          bookings: bookingsResult.status === 'success'
            ? {
                status: 'success',
                synced: bookingsResult.synced!,
                charges: bookingsResult.charges!,
                totalFetched: bookingsResult.totalFetched!
              }
            : bookingsResult,
          startedAt,
          completedAt,
          duration: completedAt.getTime() - startedAt.getTime()
        }
      }
    }
  } catch (error) {
    context.error('Manual sync error:', error)
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: { error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
}

app.http('manual-sync', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: manualSync
})
