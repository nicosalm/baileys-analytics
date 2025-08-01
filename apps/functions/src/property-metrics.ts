import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { query } from './services/database';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';

type PropertyMetrics = {
  propertyId: string;
  propertyName: string;
  revenue: number;
  bookings: number;
  occupancyRate: number;
  avgNightlyRate: number;
  avgStayLength: number;
}

export async function getPropertyMetrics(
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

    const result = await query<{
      property_id: string;
      property_name: string;
      total_revenue: string;
      booking_count: string;
      total_nights: string;
      available_nights: string;
    }>(
      `WITH date_range AS (
        SELECT
          $2::date as start_date,
          $3::date as end_date,
          ($3::date - $2::date + 1) as total_days
      ),
      property_bookings AS (
        SELECT
          p.id as property_id,
          p.name as property_name,
          COUNT(DISTINCT b.id) as booking_count,
          COALESCE(SUM(b.total_amount), 0) as total_revenue,
          COALESCE(SUM(
            CASE
              WHEN b.arrival <= $3 AND b.departure >= $2 THEN
                LEAST(b.departure, $3::date) - GREATEST(b.arrival, $2::date)
              ELSE 0
            END
          ), 0) as total_nights
        FROM properties p
        LEFT JOIN bookings b ON p.id = b.property_id
          AND b.tenant_id = $1
          AND b.arrival <= $3
          AND b.departure >= $2
          AND b.status != 'canceled'
          ${tagIds.length > 0 ? `AND EXISTS (
            SELECT 1 FROM booking_tags bt
            WHERE bt.booking_id = b.id
            AND bt.tag_id = ANY($4::uuid[])
          )` : ''}
        WHERE p.tenant_id = $1 AND p.active = true
        GROUP BY p.id, p.name
      )
      SELECT
        pb.property_id,
        pb.property_name,
        pb.total_revenue::text,
        pb.booking_count::text,
        pb.total_nights::text,
        dr.total_days::text as available_nights
      FROM property_bookings pb
      CROSS JOIN date_range dr
      ORDER BY pb.total_revenue DESC`,
      tagIds.length > 0
        ? [auth.tenantId, fromDate, toDate, tagIds]
        : [auth.tenantId, fromDate, toDate]
    );

    if (!result.success) {
      throw new Error('Failed to fetch property metrics');
    }

    const metrics: PropertyMetrics[] = result.data.map(row => {
      const revenue = parseFloat(row.total_revenue);
      const bookings = parseInt(row.booking_count);
      const nights = parseInt(row.total_nights);
      const availableNights = parseInt(row.available_nights);

      return {
        propertyId: row.property_id,
        propertyName: row.property_name,
        revenue,
        bookings,
        occupancyRate: availableNights > 0 ? nights / availableNights : 0,
        avgNightlyRate: nights > 0 ? revenue / nights : 0,
        avgStayLength: bookings > 0 ? nights / bookings : 0
      };
    });

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: metrics
    };
  } catch (error) {
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: {
        error: error instanceof Error ? error.message : 'Failed to fetch property metrics'
      }
    };
  }
}

app.http('property-metrics', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: getPropertyMetrics
});
