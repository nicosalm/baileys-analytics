import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { query } from './services/database';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';

export async function getRevenue(
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
    const fromDate = request.query.get('from') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const toDate = request.query.get('to') || new Date().toISOString().split('T')[0];
    const tagIds = request.query.get('tags')?.split(',').filter(Boolean) || [];

    // Get overall revenue metrics
    const summaryResult = await query<{
      gross_revenue: string;
      total_taxes: string;
      total_fees: string;
    }>(
      `SELECT
        COALESCE(SUM(b.total_amount), 0) as gross_revenue,
        COALESCE(SUM(CASE WHEN bc.type = 'tax' THEN bc.amount ELSE 0 END), 0) as total_taxes,
        COALESCE(SUM(CASE WHEN bc.type = 'fee' THEN bc.amount ELSE 0 END), 0) as total_fees
      FROM bookings b
      LEFT JOIN booking_charges bc ON b.id = bc.booking_id
      WHERE b.tenant_id = $1
        AND b.arrival >= $2
        AND b.arrival <= $3
        AND b.status != 'canceled'
        ${tagIds.length > 0 ? `AND EXISTS (
          SELECT 1 FROM booking_tags bt
          WHERE bt.booking_id = b.id
          AND bt.tag_id = ANY($4::uuid[])
        )` : ''}`,
      tagIds.length > 0
        ? [auth.tenantId, fromDate, toDate, tagIds]
        : [auth.tenantId, fromDate, toDate]
    );

    if (!summaryResult.success) {
      throw new Error('Failed to fetch revenue summary');
    }

    // Get revenue by source
    const bySourceResult = await query<{
      platform: string;
      revenue: string;
    }>(
      `SELECT
        COALESCE(platform, 'Direct') as platform,
        SUM(total_amount) as revenue
      FROM bookings
      WHERE tenant_id = $1
        AND arrival >= $2
        AND arrival <= $3
        AND status != 'canceled'
        ${tagIds.length > 0 ? `AND EXISTS (
          SELECT 1 FROM booking_tags bt
          WHERE bt.booking_id = bookings.id
          AND bt.tag_id = ANY($4::uuid[])
        )` : ''}
      GROUP BY platform
      ORDER BY revenue DESC`,
      tagIds.length > 0
        ? [auth.tenantId, fromDate, toDate, tagIds]
        : [auth.tenantId, fromDate, toDate]
    );

    // Get revenue by month
    const byMonthResult = await query<{
      month: string;
      revenue: string;
    }>(
      `SELECT
        TO_CHAR(arrival, 'YYYY-MM') as month,
        SUM(total_amount) as revenue
      FROM bookings
      WHERE tenant_id = $1
        AND arrival >= $2
        AND arrival <= $3
        AND status != 'canceled'
        ${tagIds.length > 0 ? `AND EXISTS (
          SELECT 1 FROM booking_tags bt
          WHERE bt.booking_id = bookings.id
          AND bt.tag_id = ANY($4::uuid[])
        )` : ''}
      GROUP BY TO_CHAR(arrival, 'YYYY-MM')
      ORDER BY month`,
      tagIds.length > 0
        ? [auth.tenantId, fromDate, toDate, tagIds]
        : [auth.tenantId, fromDate, toDate]
    );

    const summary = summaryResult.data[0];
    const gross = parseFloat(summary.gross_revenue);
    const taxes = parseFloat(summary.total_taxes);
    const fees = parseFloat(summary.total_fees);

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: {
        gross,
        net: gross - taxes - fees,
        taxes,
        fees,
        bySource: (bySourceResult.success ? bySourceResult.data : []).map(row => ({
          source: row.platform,
          amount: parseFloat(row.revenue)
        })),
        byMonth: (byMonthResult.success ? byMonthResult.data : []).map(row => ({
          month: row.month,
          amount: parseFloat(row.revenue)
        }))
      }
    };
  } catch (error) {
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: {
        error: error instanceof Error ? error.message : 'Failed to fetch revenue data'
      }
    };
  }
}

app.http('revenue', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: getRevenue
});
