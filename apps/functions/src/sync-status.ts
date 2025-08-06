import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { query } from './services/database';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';

type SyncStatus = {
  lastPropertySync: string | null
  lastBookingSync: string | null
  propertyCount: number
  bookingCount: number
  nextScheduledSync: string | null
  initialSync: {
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | null
    startedAt: string | null
    completedAt: string | null
    totalItems: number | null
    processedItems: number | null
    errorMessage: string | null
    progressPercentage: number
  }
  isDataReady: boolean
}

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
    // Get last sync times and counts
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

    // Check for initial sync progress
    const syncProgressResult = await query<{
      status: string;
      started_at: string;
      completed_at: string | null;
      total_items: string | null;
      processed_items: string | null;
      error_message: string | null;
    }>(
      `SELECT
        status,
        started_at,
        completed_at,
        total_items,
        processed_items,
        error_message
       FROM sync_progress
       WHERE tenant_id = $1 AND sync_type = 'initial'
       ORDER BY started_at DESC
       LIMIT 1`,
      [auth.tenantId]
    );

    let initialSyncStatus: SyncStatus['initialSync'] = {
      status: null,
      startedAt: null,
      completedAt: null,
      totalItems: null,
      processedItems: null,
      errorMessage: null,
      progressPercentage: 0
    };

    if (syncProgressResult.success && syncProgressResult.data.length > 0) {
      const progress = syncProgressResult.data[0];
      const totalItems = progress.total_items ? parseInt(progress.total_items) : null;
      const processedItems = progress.processed_items ? parseInt(progress.processed_items) : null;

      initialSyncStatus = {
        status: progress.status as any,
        startedAt: progress.started_at,
        completedAt: progress.completed_at,
        totalItems,
        processedItems,
        errorMessage: progress.error_message,
        progressPercentage: totalItems && processedItems
          ? Math.round((processedItems / totalItems) * 100)
          : 0
      };
    }

    // Calculate next scheduled sync (12 hours from last sync)
    let nextScheduledSync = null;
    const lastSync = status.last_booking_sync || status.last_property_sync;
    if (lastSync) {
      const lastSyncDate = new Date(lastSync);
      const nextSync = new Date(lastSyncDate.getTime() + 12 * 60 * 60 * 1000);
      nextScheduledSync = nextSync.toISOString();
    }

    // Determine if data is ready for use
    const propertyCount = parseInt(status.property_count);
    const bookingCount = parseInt(status.booking_count);
    const hasData = propertyCount > 0 || bookingCount > 0;
    const isInitialSyncComplete = !initialSyncStatus.status ||
                                  initialSyncStatus.status === 'completed';
    const isDataReady = hasData || isInitialSyncComplete;

    const response: SyncStatus = {
      lastPropertySync: status.last_property_sync,
      lastBookingSync: status.last_booking_sync,
      propertyCount,
      bookingCount,
      nextScheduledSync,
      initialSync: initialSyncStatus,
      isDataReady
    };

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: response
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
