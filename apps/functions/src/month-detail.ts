import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth, handleOptions } from './middleware/auth';
import { formatDateISO } from './utils/dates';
import { getActiveSeasons, buildBookingFilters } from './services/seasonService';
import { createSuccessResponse, createErrorResponse, requireTenant } from './utils/httpResponses';
import { parseNumericField, parseIntField } from './utils/dataTransformers';
import { getBookingSummary, getPropertyBookingSummary, getBookingsInDateRange, transformSummaryToAPI, transformPropertySummaryToAPI, transformBookingToAPI } from './services/bookingService';
import { query } from './services/database';

export async function getMonthDetail(
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

  const tenantError = requireTenant(auth.tenantId);
  if (tenantError) {
    return tenantError;
  }

  try {
    // Support both month/year format and from/to date range format
    const from = request.query.get('from');
    const to = request.query.get('to');
    const year = request.query.get('year');
    const month = request.query.get('month');
    
    let startDate: string;
    let endDate: string;
    
    if (from && to) {
      // Date range format (for daily/weekly views)
      startDate = from;
      endDate = to;
    } else if (year && month) {
      // Legacy month/year format
      startDate = `${year}-${month.padStart(2, '0')}-01`;
      endDate = formatDateISO(new Date(parseInt(year), parseInt(month), 0));
    } else {
      return createErrorResponse('Either from/to dates or year/month are required', 400);
    }
    
    // Get active seasons for filtering
    const seasons = await getActiveSeasons(auth.tenantId!);
    const bookingFilters = buildBookingFilters(seasons, 'b');

    // Calculate occupancy for the period
    const occupancyQuery = `
      WITH property_availability AS (
        SELECT COUNT(DISTINCT p.id) as property_count
        FROM properties p
        WHERE p.tenant_id = $1 AND p.active = true
      ),
      booked_nights AS (
        SELECT 
          COUNT(DISTINCT (b.property_id, booking_date::date)) as occupied_nights
        FROM bookings b
        CROSS JOIN generate_series(
          GREATEST(b.arrival::date, $2::date),
          LEAST(b.departure::date - interval '1 day', $3::date),
          interval '1 day'
        ) AS booking_date
        WHERE b.tenant_id = $1
          AND b.status != 'canceled'
          AND b.arrival <= $3::date
          AND b.departure > $2::date
          ${bookingFilters || ''}
      ),
      total_possible AS (
        SELECT 
          property_count * ($3::date - $2::date + 1) as total_nights
        FROM property_availability
      )
      SELECT 
        COALESCE(bn.occupied_nights::numeric / NULLIF(tp.total_nights, 0), 0) as occupancy_rate
      FROM booked_nights bn, total_possible tp
    `;

    // Get bookings that ARRIVE in the period (not just overlap)
    const periodBookingsQuery = `
      SELECT
        COALESCE(SUM(b.total_amount), 0) as total_revenue,
        COUNT(DISTINCT b.id) as total_bookings,
        AVG(b.total_amount / NULLIF(b.departure::date - b.arrival::date, 0)) as avg_nightly_rate
      FROM bookings b
      WHERE b.tenant_id = $1
        AND b.arrival >= $2::date
        AND b.arrival <= $3::date
        AND b.status != 'canceled'
        ${bookingFilters || ''}
    `;

    // Get all data in parallel
    const [occupancyResult, periodBookingsResult, byPropertyResult, bookingsResult] = await Promise.all([
      query(occupancyQuery, [auth.tenantId!, startDate, endDate]),
      query(periodBookingsQuery, [auth.tenantId!, startDate, endDate]),
      getPropertyBookingSummary(auth.tenantId!, startDate, endDate, bookingFilters || ''),
      getBookingsInDateRange(auth.tenantId!, startDate, endDate, bookingFilters || '')
    ]);

    if (!periodBookingsResult.success || !occupancyResult.success) {
      throw new Error('Failed to fetch summary');
    }

    const periodData = periodBookingsResult.data[0];
    const occupancyData = occupancyResult.data[0];
    const propertiesData = byPropertyResult.success ? transformPropertySummaryToAPI(byPropertyResult.data) : [];
    const bookingsData = bookingsResult.success ? bookingsResult.data.map(transformBookingToAPI) : [];

    // Parse the numeric values
    const totalRevenue = parseFloat(periodData?.total_revenue || '0');
    const totalBookings = parseInt(periodData?.total_bookings || '0');
    const avgNightlyRate = parseFloat(periodData?.avg_nightly_rate || '0');
    const occupancyRate = parseFloat(occupancyData?.occupancy_rate || '0');

    return createSuccessResponse({
      metrics: {
        revenue: totalRevenue,
        bookings: totalBookings,
        occupancyRate: occupancyRate,
        avgNightlyRate: avgNightlyRate
      },
      summary: {
        totalRevenue,
        totalBookings,
        avgNightlyRate,
        totalTax: 0, // Could calculate if needed
        netRevenue: totalRevenue // Simplified for now
      },
      topProperties: propertiesData.map(p => ({
        ...p,
        occupancyRate: 0 // Would need per-property calculation
      })),
      byProperty: propertiesData,
      bookings: bookingsData
    });
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to fetch month detail'
    );
  }
}

app.http('month-detail', {
  methods: ['GET', 'OPTIONS'],
  route: 'month-detail',
  authLevel: 'anonymous',
  handler: getMonthDetail
});
