import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { query } from './services/database';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';

export async function syncStatus(
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

  if (!auth.tenantId) {
    return {
      status: 403,
      headers: corsHeaders(),
      jsonBody: {
        error: 'OwnerRez connection required',
        code: 'NO_OWNERREZ_CONNECTION'
      }
    };
  }

  try {
    // Get last sync times
    const result = await query<{
      last_property_sync: string | null;
      last_booking_sync: string | null;
      property_count: string;
      booking_count: string;
    }>(
      `SELECT
        (SELECT MAX(updated_at) FROM properties WHERE tenant_id = $1) as last_property_sync,
        (SELECT MAX(updated_at) FROM bookings WHERE tenant_id = $1) as last_booking_sync,
        (SELECT COUNT(*) FROM properties WHERE tenant_id = $1) as property_count,
        (SELECT COUNT(*) FROM bookings WHERE tenant_id = $1 AND status != 'canceled') as booking_count`,
      [auth.tenantId]
    );

    if (!result.success || result.data.length === 0) {
      throw new Error('Failed to get sync status');
    }

    const status = result.data[0];

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: {
        lastPropertySync: status.last_property_sync,
        lastBookingSync: status.last_booking_sync,
        propertyCount: parseInt(status.property_count),
        bookingCount: parseInt(status.booking_count),
        nextScheduledSync: null // Timer triggers don't work locally
      }
    };
  } catch (error) {
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: {
        error: error instanceof Error ? error.message : 'Failed to get sync status'
      }
    };
  }
}

app.http('sync-status', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: syncStatus
});
