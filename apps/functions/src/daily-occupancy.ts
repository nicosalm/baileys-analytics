import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { query } from './services/database';
import { formatDateISO, getYear } from './utils/dates';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';

type DailyOccupancy = {
  date: string
  occupancyRate: number
  bookedProperties: number
  totalProperties: number
}

export async function getDailyOccupancy(
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
    const fromDate = request.query.get('from') || formatDateISO(new Date(getYear(new Date()), 0, 1));
    const toDate = request.query.get('to') || formatDateISO(new Date());
    const tagIds = request.query.get('tags')?.split(',').filter(Boolean) || [];

    const tagFilter = tagIds.length > 0
      ? `AND EXISTS (
          SELECT 1 FROM booking_tags bt
          WHERE bt.booking_id = b.id
          AND bt.tag_id = ANY($4::uuid[])
        )`
      : '';

    const queryParams = tagIds.length > 0
      ? [auth.tenantId, fromDate, toDate, tagIds]
      : [auth.tenantId, fromDate, toDate];

    const result = await query<{
      date: string;
      booked_properties: string;
      total_properties: string;
    }>(
      `WITH property_first_bookings AS (
        -- Get first booking for each property to determine availability
        SELECT
          p.id as property_id,
          MIN(b.arrival) as first_booking_date
        FROM properties p
        LEFT JOIN bookings b ON p.id = b.property_id
          AND b.tenant_id = p.tenant_id
          AND b.status != 'canceled'
        WHERE p.tenant_id = $1
          AND p.active = true
        GROUP BY p.id
      ),
      date_series AS (
        -- Generate all dates in the range
        SELECT generate_series(
          $2::date,
          LEAST($3::date, CURRENT_DATE),
          '1 day'::interval
        )::date as date
      ),
      daily_bookings AS (
        -- Count properties booked for each day
        SELECT
          ds.date,
          COUNT(DISTINCT b.property_id) as booked_properties
        FROM date_series ds
        LEFT JOIN bookings b ON b.tenant_id = $1
          AND b.status != 'canceled'
          AND ds.date >= b.arrival
          AND ds.date < b.departure
          ${tagFilter}
        GROUP BY ds.date
      ),
      daily_availability AS (
        -- Count properties available for each day
        SELECT
          ds.date,
          COUNT(DISTINCT pfb.property_id) as total_properties
        FROM date_series ds
        CROSS JOIN property_first_bookings pfb
        WHERE ds.date >= COALESCE(pfb.first_booking_date, $2::date)
        GROUP BY ds.date
      )
      SELECT
        TO_CHAR(da.date, 'YYYY-MM-DD') as date,
        COALESCE(db.booked_properties, 0)::text as booked_properties,
        da.total_properties::text as total_properties
      FROM daily_availability da
      LEFT JOIN daily_bookings db ON da.date = db.date
      ORDER BY da.date`,
      queryParams
    );

    if (!result.success) {
      throw new Error('Failed to fetch daily occupancy');
    }

    const dailyOccupancy: DailyOccupancy[] = result.data.map(row => ({
      date: row.date,
      occupancyRate: parseInt(row.total_properties) > 0
        ? parseInt(row.booked_properties) / parseInt(row.total_properties)
        : 0,
      bookedProperties: parseInt(row.booked_properties),
      totalProperties: parseInt(row.total_properties)
    }));

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: dailyOccupancy
    };
  } catch (error) {
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: {
        error: error instanceof Error ? error.message : 'Failed to fetch daily occupancy'
      }
    };
  }
}

app.http('occupancy-daily', {
  methods: ['GET', 'OPTIONS'],
  route: 'occupancy/daily',
  authLevel: 'anonymous',
  handler: getDailyOccupancy
});
