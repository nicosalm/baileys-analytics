import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { query } from './services/database';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';

export async function getOccupancy(
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

    // Calculate total available nights
    const daysInRange = Math.ceil((new Date(toDate).getTime() - new Date(fromDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const propertyCountResult = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM properties WHERE tenant_id = $1 AND active = true',
      [auth.tenantId]
    );

    if (!propertyCountResult.success) {
      throw new Error('Failed to get property count');
    }

    const propertyCount = parseInt(propertyCountResult.data[0].count);
    const totalAvailableNights = daysInRange * propertyCount;

    // Get overall occupancy
    const overallResult = await query<{
      booked_nights: string;
    }>(
      `SELECT
        COALESCE(SUM(
          CASE
            WHEN arrival <= $3 AND departure >= $2 THEN
              LEAST(departure, $3::date) - GREATEST(arrival, $2::date)
            ELSE 0
          END
        ), 0) as booked_nights
      FROM bookings
      WHERE tenant_id = $1
        AND arrival <= $3
        AND departure >= $2
        AND status != 'canceled'
        ${tagIds.length > 0 ? `AND EXISTS (
          SELECT 1 FROM booking_tags bt
          WHERE bt.booking_id = bookings.id
          AND bt.tag_id = ANY($4::uuid[])
        )` : ''}`,
      tagIds.length > 0
        ? [auth.tenantId, fromDate, toDate, tagIds]
        : [auth.tenantId, fromDate, toDate]
    );

    if (!overallResult.success) {
      throw new Error('Failed to get overall occupancy');
    }

    const bookedNights = parseInt(overallResult.data[0].booked_nights);
    const overallOccupancy = totalAvailableNights > 0 ? bookedNights / totalAvailableNights : 0;

    // Get occupancy by property
    const byPropertyResult = await query<{
      property_id: string;
      property_name: string;
      booked_nights: string;
      property_days: string;
    }>(
      `WITH date_range AS (
        SELECT
          $2::date as start_date,
          $3::date as end_date,
          ($3::date - $2::date + 1) as total_days
      )
      SELECT
        p.id as property_id,
        p.name as property_name,
        COALESCE(SUM(
          CASE
            WHEN b.arrival <= $3 AND b.departure >= $2 THEN
              LEAST(b.departure, $3::date) - GREATEST(b.arrival, $2::date)
            ELSE 0
          END
        ), 0) as booked_nights,
        (SELECT total_days FROM date_range) as property_days
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
      ORDER BY p.name`,
      tagIds.length > 0
        ? [auth.tenantId, fromDate, toDate, tagIds]
        : [auth.tenantId, fromDate, toDate]
    );

    // Get occupancy by month
    const byMonthResult = await query<{
      month: string;
      booked_nights: string;
      days_in_month: string;
    }>(
      `WITH months AS (
        SELECT DISTINCT
          TO_CHAR(date_series.date, 'YYYY-MM') as month,
          COUNT(*) OVER (PARTITION BY TO_CHAR(date_series.date, 'YYYY-MM')) as days_in_month
        FROM generate_series($2::date, $3::date, '1 day'::interval) as date_series(date)
      ),
      monthly_bookings AS (
        SELECT
          TO_CHAR(calendar_date, 'YYYY-MM') as month,
          COUNT(DISTINCT b.id || '-' || calendar_date) as booked_property_nights
        FROM generate_series($2::date, $3::date, '1 day'::interval) as calendar_date
        JOIN bookings b ON b.tenant_id = $1
          AND b.status != 'canceled'
          AND calendar_date >= b.arrival
          AND calendar_date < b.departure
          ${tagIds.length > 0 ? `AND EXISTS (
            SELECT 1 FROM booking_tags bt
            WHERE bt.booking_id = b.id
            AND bt.tag_id = ANY($4::uuid[])
          )` : ''}
        GROUP BY TO_CHAR(calendar_date, 'YYYY-MM')
      )
      SELECT
        m.month,
        COALESCE(mb.booked_property_nights, 0)::text as booked_nights,
        (m.days_in_month * (SELECT COUNT(*) FROM properties WHERE tenant_id = $1 AND active = true))::text as days_in_month
      FROM months m
      LEFT JOIN monthly_bookings mb ON m.month = mb.month
      GROUP BY m.month, m.days_in_month, mb.booked_property_nights
      ORDER BY m.month`,
      tagIds.length > 0
        ? [auth.tenantId, fromDate, toDate, tagIds]
        : [auth.tenantId, fromDate, toDate]
    );

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: {
        overall: overallOccupancy,
        byProperty: byPropertyResult.success ? byPropertyResult.data.map(row => ({
          propertyId: row.property_id,
          propertyName: row.property_name,
          rate: parseInt(row.property_days) > 0 ? parseInt(row.booked_nights) / parseInt(row.property_days) : 0
        })) : [],
        byMonth: byMonthResult.success ? byMonthResult.data.map(row => ({
          month: row.month,
          rate: parseInt(row.days_in_month) > 0
            ? parseInt(row.booked_nights) / parseInt(row.days_in_month)
            : 0
        })) : [],
        bookedNights,
        availableNights: totalAvailableNights
      }
    };
  } catch (error) {
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: {
        error: error instanceof Error ? error.message : 'Failed to fetch occupancy data'
      }
    };
  }
}

app.http('occupancy', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: getOccupancy
});
