import { app, Timer, InvocationContext } from '@azure/functions';
import { query } from './services/database';
import { formatDateISO, subDays } from './utils/dates';
import {
  getTenantToken,
  syncProperties,
  syncBookings
} from './services/syncService';

async function getActiveTenantsWithTokens() {
  const result = await query<{ tenant_id: string; access_token: string }>(
    `SELECT t.id as tenant_id, ot.access_token
     FROM tenants t
     JOIN oauth_tokens ot ON t.id = ot.tenant_id
     WHERE ot.expires_at > CURRENT_TIMESTAMP`
  )

  if (result.success && result.data.length > 0) {
    return result.data.map(r => ({
      tenantId: r.tenant_id,
      token: r.access_token
    }))
  }

  // Fallback to PAT for dev
  const pat = process.env.OWNERREZ_PAT
  if (pat) {
    const tenantsResult = await query<{ id: string }>('SELECT id FROM tenants LIMIT 10')
    if (tenantsResult.success) {
      return tenantsResult.data.map(r => ({
        tenantId: r.id,
        token: pat
      }))
    }
  }

  return []
}

async function determineBookingDateRange(tenantId: string) {
  const result = await query<{ oldest_booking: string | null }>(
    'SELECT MIN(arrival) as oldest_booking FROM bookings WHERE tenant_id = $1',
    [tenantId]
  )

  const hasBookings = result.success && result.data[0].oldest_booking
  const now = Date.now()

  return hasBookings
    ? {
        // Recent sync - last 30 days
        from: formatDateISO(subDays(new Date(), 30)),
        to: formatDateISO(new Date()),
        isHistorical: false
      }
    : {
        // Initial sync - all historical data
        from: '2010-01-01',
        to: formatDateISO(new Date()),
        isHistorical: true
      }
}

export async function autoSync(
  myTimer: Timer,
  context: InvocationContext
): Promise<void> {
  context.log('Auto-sync started at:', new Date().toISOString())

  const tenants = await getActiveTenantsWithTokens()
  if (tenants.length === 0) {
    context.log('No tenants with valid tokens found')
    return
  }

  context.log(`Found ${tenants.length} tenants to sync`)

  const results = await Promise.allSettled(
    tenants.map(async ({ tenantId, token }) => {
      try {
        const dateRange = await determineBookingDateRange(tenantId)
        context.log(`Tenant ${tenantId}: ${dateRange.isHistorical ? 'Initial' : 'Recent'} sync`)

        const startedAt = new Date()

        const propertiesResult = await syncProperties(token, tenantId, context)
        const bookingsResult = await syncBookings(token, tenantId, dateRange, context)

        const duration = new Date().getTime() - startedAt.getTime()

        context.log(`Tenant ${tenantId} completed:`, {
          properties: propertiesResult.status === 'success' ? `${propertiesResult.synced} synced` : 'failed',
          bookings: bookingsResult.status === 'success'
            ? `${bookingsResult.synced}/${bookingsResult.totalFetched} synced`
            : 'failed',
          duration: `${duration}ms`
        })

        return { tenantId, success: true }
      } catch (error) {
        context.error(`Failed to sync tenant ${tenantId}:`, error)
        throw error
      }
    })
  )

  const successful = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length

  context.log(`Auto-sync completed: ${successful} successful, ${failed} failed`)
}

app.timer('auto-sync', {
  schedule: '0 0 */12 * * *',
  handler: autoSync
})
