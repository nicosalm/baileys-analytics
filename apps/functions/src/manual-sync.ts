import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth, handleOptions } from './middleware/auth';
import {
  getTenantToken,
  syncProperties,
  syncBookings
} from './services/syncService';
import { syncAllGuestDetailsInBulk } from './sync-all-guest-details';
import { formatDateISO } from './utils/dates';
import { createSuccessResponse, createErrorResponse, requireTenant } from './utils/httpResponses';

export async function manualSync(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') return handleOptions()

  const authCheck = await requireAuth(request)
  if (!authCheck.authenticated) return authCheck.response

  const { auth } = authCheck.request
  const tenantValidation = requireTenant(auth.tenantId)
  if (tenantValidation) {
    return tenantValidation
  }
  
  const tenantId = auth.tenantId!

  const tokenResult = await getTenantToken(tenantId)
  if (!tokenResult.success) {
    return createErrorResponse(tokenResult.error, 403)
  }

  const type = request.query.get('type') === 'historical' ? 'historical' : 'recent'
  const now = new Date()

  const dateRange = {
    from: request.query.get('from') || (
      type === 'historical'
        ? formatDateISO(new Date(now.getTime() - 1460 * 24 * 60 * 60 * 1000)) // 4 years
        : formatDateISO(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000))  // 30 days
    ),
    to: request.query.get('to') || formatDateISO(now)
  }

  try {
    context.log(`Starting ${type} sync for tenant ${tenantId}`, dateRange)

    if (type === 'historical') {
      const result = await syncBookings(tokenResult.data, tenantId, dateRange, context)

      if (result.status === 'success') {
        context.log(`Historical sync completed: ${result.synced} bookings synced`)
        
        context.log('Starting bulk guest contact sync...')
        const guestResult = await syncAllGuestDetailsInBulk(
          tokenResult.data,
          tenantId,
          context
        )
        context.log(`Guest sync completed: ${guestResult.updated} of ${guestResult.total} guests updated`)
        
        return createSuccessResponse({
          type: 'historical',
          bookingsFound: result.totalFetched!,
          bookingsSynced: result.synced!,
          chargesSynced: result.charges!,
          guestsUpdated: guestResult.updated,
          dateRange
        })
      } else {
        return createErrorResponse(result.error || 'Sync failed')
      }
    } else {
      // Recent sync - properties and bookings
      const startedAt = new Date()

      const propertiesResult = await syncProperties(tokenResult.data, tenantId, context)
      const bookingsResult = await syncBookings(tokenResult.data, tenantId, dateRange, context)

      const completedAt = new Date()

      return createSuccessResponse({
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
      })
    }
  } catch (error) {
    context.error('Manual sync error:', error)
    return createErrorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
}

app.http('manual-sync', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: manualSync
})
