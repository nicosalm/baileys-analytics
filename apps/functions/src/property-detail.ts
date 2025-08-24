import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { query } from './services/database';
import { calculateNights, safeDivide } from '@baileys/utils';
import { formatDateISO, getYear, getDaysInMonth, differenceInDays } from './utils/dates';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';
import { getActiveSeasons, buildBookingFilters } from './services/seasonService';
import { createSuccessResponse, createErrorResponse, createNotFoundResponse, requireTenant } from './utils/httpResponses';
import { buildDateRangeFilter, buildTagFilter, normalizePlatformSQL } from './utils/queryBuilders';
import { parseNumericField, parseIntField, createGuestId } from './utils/dataTransformers';

export async function getPropertyDetail(
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
  
  // Type assertion after validation
  const tenantId = auth.tenantId!

  try {
    const propertyId = request.params.propertyId;
    const fromDate = request.query.get('from') || formatDateISO(new Date(getYear(new Date()), 0, 1));
    const toDate = request.query.get('to') || formatDateISO(new Date());
    const tagIds = request.query.get('tags')?.split(',').filter(Boolean) || [];
    
    // Get active seasons for filtering
    const seasons = await getActiveSeasons(tenantId);
    const bookingFilters = buildBookingFilters(seasons, 'b');
    
    // Get property info
    const propertyResult = await query<{
      id: string;
      name: string;
      address: string;
      city: string;
      state: string;
      bedrooms: number;
      bathrooms: number;
      max_guests: number;
    }>(
      `SELECT id, name, address, city, state, bedrooms, bathrooms, max_guests
       FROM properties
       WHERE id = $1 AND tenant_id = $2`,
      [propertyId, tenantId]
    );

    if (!propertyResult.success || propertyResult.data.length === 0) {
      return createNotFoundResponse('Property not found');
    }

    const property = propertyResult.data[0];

    // Build tag filter for queries
    const tagFilter = tagIds.length > 0 ? buildTagFilter(4) : '';
    
    const queryParams = tagIds.length > 0
      ? [propertyId, fromDate, toDate, tagIds]
      : [propertyId, fromDate, toDate];

    // Get metrics
    const metricsResult = await query<{
      total_revenue: string;
      total_bookings: string;
      total_nights: string;
      avg_nightly_rate: string;
    }>(
      `SELECT
        COALESCE(SUM(b.total_amount), 0) as total_revenue,
        COUNT(DISTINCT b.id) as total_bookings,
        COALESCE(SUM(
          CASE
            WHEN b.arrival <= $3 AND b.departure >= $2 THEN
              LEAST(b.departure::date, $3::date, CURRENT_DATE) - GREATEST(b.arrival::date, $2::date)
            ELSE 0
          END
        ), 0) as total_nights,
        CASE
          WHEN COUNT(DISTINCT b.id) > 0 THEN
            SUM(b.total_amount) / NULLIF(SUM(
              CASE
                WHEN b.arrival <= $3 AND b.departure >= $2 THEN
                  LEAST(b.departure::date, $3::date, CURRENT_DATE) - GREATEST(b.arrival::date, $2::date)
                ELSE 0
              END
            ), 0)
          ELSE 0
        END as avg_nightly_rate
      FROM bookings b
      WHERE b.property_id = $1
        AND b.arrival <= $3
        AND b.departure >= $2
        AND b.status != 'canceled'
        ${tagFilter}
        ${bookingFilters || ''}`,
      queryParams
    );

    // Get monthly data within the date range
    const monthlyResult = await query<{
      month: string;
      revenue: string;
      bookings: string;
      nights: string;
    }>(
      `WITH months AS (
        SELECT generate_series(
          DATE_TRUNC('month', $2::date),
          DATE_TRUNC('month', $3::date),
          '1 month'::interval
        )::date as month_start
      )
      SELECT
        TO_CHAR(m.month_start, 'YYYY-MM') as month,
        COALESCE(SUM(
          CASE
            WHEN b.arrival <= DATE_TRUNC('month', m.month_start + INTERVAL '1 month' - INTERVAL '1 day')::date
              AND b.departure >= m.month_start THEN
              b.total_amount
            ELSE 0
          END
        ), 0) as revenue,
        COUNT(DISTINCT CASE
          WHEN b.arrival <= DATE_TRUNC('month', m.month_start + INTERVAL '1 month' - INTERVAL '1 day')::date
            AND b.departure >= m.month_start THEN
            b.id
          ELSE NULL
        END) as bookings,
        COALESCE(SUM(
          CASE
            WHEN b.arrival <= DATE_TRUNC('month', m.month_start + INTERVAL '1 month' - INTERVAL '1 day')::date
              AND b.departure >= m.month_start THEN
              LEAST(b.departure::date, DATE_TRUNC('month', m.month_start + INTERVAL '1 month' - INTERVAL '1 day')::date, $3::date, CURRENT_DATE) -
              GREATEST(b.arrival::date, m.month_start, $2::date)
            ELSE 0
          END
        ), 0) as nights
      FROM months m
      LEFT JOIN bookings b ON b.property_id = $1
        AND b.status != 'canceled'
        AND b.arrival <= DATE_TRUNC('month', m.month_start + INTERVAL '1 month' - INTERVAL '1 day')::date
        AND b.departure >= m.month_start
        ${tagFilter ? `AND EXISTS (
          SELECT 1 FROM booking_tags bt
          WHERE bt.booking_id = b.id
          AND bt.tag_id = ANY($4::uuid[])
        )` : ''}
        ${bookingFilters || ''}
      GROUP BY m.month_start
      ORDER BY month`,
      queryParams
    );

    // Calculate occupancy for monthly data
    const monthlyData = monthlyResult.success ? monthlyResult.data.map(row => {
      const [year, month] = row.month.split('-');
      const daysInMonthCount = getDaysInMonth(new Date(parseInt(year), parseInt(month) - 1, 1));
      const occupancy = safeDivide(parseIntField(row.nights), daysInMonthCount) * 100;

      return {
        month: row.month,
        revenue: parseNumericField(row.revenue),
        bookings: parseIntField(row.bookings),
        occupancy: Math.min(occupancy, 100)
      };
    }) : [];

    // Get revenue by platform
    const platformResult = await query<{
      platform: string;
      revenue: string;
      bookings: string;
    }>(
      `SELECT
        ${normalizePlatformSQL('b.platform')} as platform,
        COALESCE(SUM(b.total_amount), 0) as revenue,
        COUNT(DISTINCT b.id) as bookings
       FROM bookings b
       WHERE b.property_id = $1
         AND b.arrival >= $2
         AND b.arrival <= $3
         AND b.status != 'canceled'
         ${tagFilter}
         ${bookingFilters || ''}
       GROUP BY ${normalizePlatformSQL('b.platform')}
       ORDER BY revenue DESC`,
      queryParams
    );

    // Get guest statistics
    const guestStatsResult = await query<{
      total_guests: string;
      repeat_guests: string;
    }>(
      `WITH guest_bookings AS (
        SELECT 
          LOWER(TRIM(b.guest_name)) as normalized_name,
          COALESCE(LOWER(TRIM(b.guest_email)), '') as normalized_email,
          COUNT(*) as booking_count
        FROM bookings b
        WHERE b.property_id = $1
          AND b.arrival >= $2
          AND b.arrival <= $3
          AND b.status != 'canceled'
          ${tagFilter}
          ${bookingFilters || ''}
        GROUP BY LOWER(TRIM(b.guest_name)), COALESCE(LOWER(TRIM(b.guest_email)), '')
      )
      SELECT
        COUNT(DISTINCT (normalized_name, normalized_email)) as total_guests,
        COUNT(DISTINCT CASE 
          WHEN booking_count > 1 
          THEN (normalized_name, normalized_email) 
        END) as repeat_guests
      FROM guest_bookings`,
      queryParams
    );

    // Get recent bookings within the date range
    const bookingsResult = await query<{
      id: string;
      guest_name: string;
      guest_email: string;
      arrival: string;
      departure: string;
      total_amount: string;
      status: string;
    }>(
      `SELECT id, guest_name, guest_email, arrival, departure, total_amount, status
       FROM bookings b
       WHERE property_id = $1
         AND ((arrival >= $2 AND arrival <= $3) OR 
              (departure >= $2 AND departure <= $3) OR
              (arrival <= $2 AND departure >= $3))
         AND status != 'canceled'
         ${tagFilter}
         ${bookingFilters || ''}
       ORDER BY arrival DESC
       LIMIT 20`,
      queryParams
    );

    if (!metricsResult.success) {
      throw new Error('Failed to fetch metrics');
    }

    const metrics = metricsResult.data[0];
    // Calculate total days the same way as property-metrics: (endDate - startDate + 1)
    const startDate = new Date(fromDate);
    const endDate = new Date(toDate);
    const currentDate = new Date();
    const effectiveEndDate = endDate > currentDate ? currentDate : endDate;
    const totalDays = differenceInDays(effectiveEndDate, startDate) + 1;
    const occupancyRate = safeDivide(parseIntField(metrics.total_nights), totalDays);

    const guestStats = guestStatsResult.success && guestStatsResult.data[0] ? {
      totalGuests: parseIntField(guestStatsResult.data[0].total_guests),
      repeatGuests: parseIntField(guestStatsResult.data[0].repeat_guests),
      returnRate: parseIntField(guestStatsResult.data[0].total_guests) > 0 
        ? (parseIntField(guestStatsResult.data[0].repeat_guests) / parseIntField(guestStatsResult.data[0].total_guests)) * 100
        : 0
    } : {
      totalGuests: 0,
      repeatGuests: 0,
      returnRate: 0
    };

    return createSuccessResponse({
        property: {
          id: property.id,
          name: property.name,
          address: `${property.address}, ${property.city}, ${property.state}`,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          maxGuests: property.max_guests
        },
        metrics: {
          totalRevenue: parseNumericField(metrics.total_revenue),
          totalBookings: parseIntField(metrics.total_bookings),
          totalNights: parseIntField(metrics.total_nights),
          avgNightlyRate: parseNumericField(metrics.avg_nightly_rate),
          avgStayLength: parseIntField(metrics.total_bookings) > 0 ? parseIntField(metrics.total_nights) / parseIntField(metrics.total_bookings) : 0,
          occupancyRate,
          totalDays
        },
        monthlyData,
        revenueByPlatform: platformResult.success ? platformResult.data.map(p => ({
          platform: p.platform,
          revenue: parseNumericField(p.revenue),
          bookings: parseIntField(p.bookings)
        })) : [],
        guestStats,
        recentBookings: bookingsResult.success ? bookingsResult.data.map(b => ({
          id: b.id,
          guestId: createGuestId(b.guest_name, b.guest_email),
          guestName: b.guest_name,
          guestEmail: b.guest_email,
          arrival: b.arrival,
          departure: b.departure,
          totalAmount: parseNumericField(b.total_amount),
          status: b.status
        })) : []
      });
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to fetch property detail'
    );
  }
}

app.http('property-detail', {
  methods: ['GET', 'OPTIONS'],
  route: 'property/{propertyId}/detail',
  authLevel: 'anonymous',
  handler: getPropertyDetail
});
