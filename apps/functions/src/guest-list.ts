import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { safeDivide } from '@baileys/utils';
import { query } from './services/database';
import { corsHeaders, handleOptions } from './middleware/auth';
import { requireAuthWithValidation } from './middleware/validation';
import { guestsQuerySchema } from '@baileys/shared-types';
import { getActiveSeasons, buildBookingFilters } from './services/seasonService';
import { createSuccessResponse, createErrorResponse, requireTenant } from './utils/httpResponses';
import { buildDateRangeFilter, buildTagFilter, normalizePlatformSQL } from './utils/queryBuilders';
import { parseNumericField, parseIntField, createGuestId } from './utils/dataTransformers';

type GuestMetrics = {
  totalGuests: number;
  repeatGuests: number;
  repeatRate: number;
  avgStayLength: number;
  avgSpend: number;
  totalRevenue: number;
  topSpenders: Array<{
    id: string;
    name: string;
    email?: string;
    totalSpent: number;
    bookingCount: number;
    avgNightlyRate: number;
    periodSpent: number;
    periodBookings: number;
  }>;
  guestsBySource: Array<{
    source: string;
    count: number;
    revenue: number;
  }>;
  tagDistribution: Array<{
    id: string;
    name: string;
    color?: string;
    count: number;
  }>;
};

type GuestListItem = {
  id: string;
  name: string;
  email?: string;
  firstVisit: string;
  lastVisit: string;
  bookingCount: number;
  totalSpent: number;
  avgNightlyRate: number;
  properties: string[];
  tags: Array<{
    id: string;
    name: string;
    color?: string;
  }>;
  // Period-specific data
  periodBookings: number;
  periodSpent: number;
};

type PaginatedResponse = {
  metrics: GuestMetrics;
  guests: GuestListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasMore: boolean;
  };
};

export async function getGuests(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') {
    return handleOptions();
  }

  const authCheck = await requireAuthWithValidation(request, {
    query: guestsQuerySchema
  });
  
  if (!authCheck.authenticated || !authCheck.valid) {
    return authCheck.response;
  }

  const { auth, validated } = authCheck.request;

  const tenantCheck = requireTenant(auth.tenantId)
  if (tenantCheck) {
    return tenantCheck
  }

  try {
    // Get active seasons for filtering
    const seasons = await getActiveSeasons(auth.tenantId);
    const bookingFilters = buildBookingFilters(seasons, 'b');
    
    // Use validated query parameters
    const startDate = validated?.query?.from;
    const endDate = validated?.query?.to;
    const tagIds = validated?.query?.tags || [];
    const page = validated?.query?.page || 1;
    const pageSize = validated?.query?.pageSize || 50;
    const offset = (page - 1) * pageSize;

    let dateFilter = '';
    const queryParams: any[] = [auth.tenantId];
    let paramIndex = 2;

    if (startDate && endDate) {
      dateFilter = buildDateRangeFilter('arrival', paramIndex);
      queryParams.push(startDate, endDate);
      paramIndex += 2;
    }
    
    // Apply season filtering
    if (bookingFilters) {
      dateFilter += ` ${bookingFilters}`;
    }

    let tagFilter = '';
    if (tagIds.length > 0) {
      tagFilter = buildTagFilter(paramIndex);
      queryParams.push(tagIds);
      paramIndex += 1;
    }

    // Get metrics for the selected period
    const metricsResult = await query<{
      total_guests: string;
      repeat_guests: string;
      avg_stay_length: string;
      avg_spend: string;
      total_revenue: string;
    }>(
      `WITH guest_stats AS (
        SELECT
          b.guest_name,
          b.guest_email,
          COUNT(*) as booking_count,
          SUM(b.total_amount) as total_spent,
          SUM(b.departure - b.arrival) as total_nights,
          MIN(b.arrival) as first_visit,
          MAX(b.arrival) as last_visit
        FROM bookings b
        WHERE b.tenant_id = $1
          AND b.status != 'canceled'
          ${dateFilter}
          ${tagFilter}
        GROUP BY b.guest_name, b.guest_email
      )
      SELECT
        COUNT(DISTINCT (guest_name, COALESCE(guest_email, ''))) as total_guests,
        COUNT(DISTINCT CASE WHEN booking_count > 1 THEN (guest_name, COALESCE(guest_email, '')) END) as repeat_guests,
        AVG(total_nights::float / booking_count) as avg_stay_length,
        AVG(total_spent) as avg_spend,
        SUM(total_spent) as total_revenue
      FROM guest_stats`,
      queryParams
    );

    if (!metricsResult.success || metricsResult.data.length === 0) {
      return createErrorResponse('Failed to fetch guest metrics', 500);
    }

    const metrics = metricsResult.data[0];
    const totalGuests = parseIntField(metrics.total_guests);
    const repeatGuests = parseIntField(metrics.repeat_guests);

    // Get top spenders with period-specific data
    const topSpendersResult = await query<{
      guest_name: string;
      guest_email: string;
      total_spent: string;
      booking_count: string;
      avg_nightly_rate: string;
      period_spent: string;
      period_bookings: string;
    }>(
      `WITH guest_period AS (
        -- Get period-specific data
        SELECT 
          b.guest_name,
          b.guest_email,
          SUM(b.total_amount) as period_spent,
          COUNT(*) as period_bookings
        FROM bookings b
        WHERE b.tenant_id = $1
          AND b.status != 'canceled'
          ${dateFilter}
          ${tagFilter}
        GROUP BY b.guest_name, b.guest_email
      ),
      guest_all_time AS (
        -- Get all-time data for the same guests
        SELECT
          b.guest_name,
          b.guest_email,
          SUM(b.total_amount) as total_spent,
          COUNT(*) as booking_count,
          SUM(b.total_amount) / NULLIF(SUM(b.departure - b.arrival), 0) as avg_nightly_rate
        FROM bookings b
        WHERE b.tenant_id = $1
          AND b.status != 'canceled'
          AND EXISTS (
            SELECT 1 FROM guest_period gp 
            WHERE b.guest_name = gp.guest_name 
            AND COALESCE(b.guest_email, '') = COALESCE(gp.guest_email, '')
          )
        GROUP BY b.guest_name, b.guest_email
      )
      SELECT
        gp.guest_name,
        gp.guest_email,
        gat.total_spent,
        gat.booking_count,
        gat.avg_nightly_rate,
        gp.period_spent,
        gp.period_bookings
      FROM guest_period gp
      JOIN guest_all_time gat ON gp.guest_name = gat.guest_name
        AND COALESCE(gp.guest_email, '') = COALESCE(gat.guest_email, '')
      ORDER BY gp.period_spent DESC
      LIMIT 20`,
      queryParams
    );

    // Get guests by source for the period
    const guestsBySourceResult = await query<{
      source: string;
      count: string;
      revenue: string;
    }>(
      `SELECT
        ${normalizePlatformSQL('b.platform')} as source,
        COUNT(DISTINCT (b.guest_name, COALESCE(b.guest_email, ''))) as count,
        SUM(b.total_amount) as revenue
      FROM bookings b
      WHERE b.tenant_id = $1
        AND b.status != 'canceled'
        ${dateFilter}
        ${tagFilter}
      GROUP BY ${normalizePlatformSQL('b.platform')}
      ORDER BY revenue DESC`,
      queryParams
    );

    // Get tag distribution
    const tagDistributionResult = await query<{
      tag_id: string;
      tag_name: string;
      tag_color: string;
      count: string;
    }>(
      `SELECT
        t.id as tag_id,
        t.name as tag_name,
        t.color as tag_color,
        COUNT(DISTINCT (b.guest_name, COALESCE(b.guest_email, ''))) as count
      FROM bookings b
      JOIN booking_tags bt ON b.id = bt.booking_id
      JOIN tags t ON bt.tag_id = t.id
      WHERE b.tenant_id = $1
        AND b.status != 'canceled'
        ${dateFilter}
        ${tagFilter}
      GROUP BY t.id, t.name, t.color
      ORDER BY count DESC`,
      queryParams
    );

    // Get total count for pagination
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(DISTINCT (b.guest_name, COALESCE(b.guest_email, ''))) as count
      FROM bookings b
      WHERE b.tenant_id = $1
        AND b.status != 'canceled'
        ${dateFilter}
        ${tagFilter}`,
      queryParams
    );

    const totalItems = countResult.success ? parseIntField(countResult.data[0].count) : 0;
    const totalPages = Math.ceil(totalItems / pageSize);

    // Get guest list with both period and all-time data
    const guestsListResult = await query<{
      guest_name: string;
      guest_email: string;
      first_visit: string;
      last_visit: string;
      booking_count: string;
      total_spent: string;
      avg_nightly_rate: string;
      properties: string;
      period_bookings: string;
      period_spent: string;
    }>(
      `WITH guest_period_data AS (
        -- Get period-specific stats
        SELECT
          b.guest_name,
          b.guest_email,
          COUNT(*) as period_bookings,
          SUM(b.total_amount) as period_spent
        FROM bookings b
        WHERE b.tenant_id = $1
          AND b.status != 'canceled'
          ${dateFilter}
          ${tagFilter}
        GROUP BY b.guest_name, b.guest_email
      ),
      guest_all_time_data AS (
        -- Get all-time stats for guests active in the period
        SELECT
          b.guest_name,
          b.guest_email,
          MIN(b.arrival) as first_visit,
          MAX(b.arrival) as last_visit,
          COUNT(*) as booking_count,
          SUM(b.total_amount) as total_spent,
          SUM(b.total_amount) / NULLIF(SUM(b.departure - b.arrival), 0) as avg_nightly_rate,
          STRING_AGG(DISTINCT p.name, ', ') as properties
        FROM bookings b
        JOIN properties p ON b.property_id = p.id
        WHERE b.tenant_id = $1
          AND b.status != 'canceled'
          AND EXISTS (
            SELECT 1 FROM guest_period_data gpd 
            WHERE b.guest_name = gpd.guest_name 
            AND COALESCE(b.guest_email, '') = COALESCE(gpd.guest_email, '')
          )
        GROUP BY b.guest_name, b.guest_email
      )
      SELECT 
        gat.guest_name,
        gat.guest_email,
        gat.first_visit,
        gat.last_visit,
        gat.booking_count,
        gat.total_spent,
        gat.avg_nightly_rate,
        gat.properties,
        COALESCE(gpd.period_bookings, 0) as period_bookings,
        COALESCE(gpd.period_spent, 0) as period_spent
      FROM guest_all_time_data gat
      JOIN guest_period_data gpd ON gat.guest_name = gpd.guest_name
        AND COALESCE(gat.guest_email, '') = COALESCE(gpd.guest_email, '')
      ORDER BY gpd.period_spent DESC
      LIMIT ${pageSize}
      OFFSET ${offset}`,
      queryParams
    );

    // Get tags for the guests on this page
    const guestTagsResult = await query<{
      guest_name: string;
      guest_email: string;
      tag_id: string;
      tag_name: string;
      tag_color: string;
    }>(
      `WITH current_page_guests AS (
        SELECT DISTINCT guest_name, guest_email
        FROM (
          SELECT
            b.guest_name,
            b.guest_email,
            SUM(b.total_amount) as period_spent
          FROM bookings b
          WHERE b.tenant_id = $1
            AND b.status != 'canceled'
            ${dateFilter}
            ${tagFilter}
          GROUP BY b.guest_name, b.guest_email
          ORDER BY period_spent DESC
          LIMIT ${pageSize}
          OFFSET ${offset}
        ) g
      )
      SELECT DISTINCT
        b.guest_name,
        b.guest_email,
        t.id as tag_id,
        t.name as tag_name,
        t.color as tag_color
      FROM bookings b
      JOIN booking_tags bt ON b.id = bt.booking_id
      JOIN tags t ON bt.tag_id = t.id
      JOIN current_page_guests cpg ON b.guest_name = cpg.guest_name
        AND COALESCE(b.guest_email, '') = COALESCE(cpg.guest_email, '')
      WHERE b.tenant_id = $1
        AND b.status != 'canceled'
      ORDER BY b.guest_name, b.guest_email, t.name`,
      queryParams
    );

    // Build tags map
    const guestTagsMap = new Map<string, Array<any>>();
    if (guestTagsResult.success) {
      for (const row of guestTagsResult.data) {
        const key = createGuestId(row.guest_name, row.guest_email);
        if (!guestTagsMap.has(key)) {
          guestTagsMap.set(key, []);
        }
        guestTagsMap.get(key)!.push({
          id: row.tag_id,
          name: row.tag_name,
          color: row.tag_color || undefined
        });
      }
    }

    const response: PaginatedResponse = {
      metrics: {
        totalGuests,
        repeatGuests,
        repeatRate: safeDivide(repeatGuests, totalGuests),
        avgStayLength: parseNumericField(metrics.avg_stay_length),
        avgSpend: parseNumericField(metrics.avg_spend),
        totalRevenue: parseNumericField(metrics.total_revenue),
        topSpenders: topSpendersResult.success ? topSpendersResult.data.map(s => ({
          id: createGuestId(s.guest_name, s.guest_email),
          name: s.guest_name,
          email: s.guest_email || undefined,
          totalSpent: parseNumericField(s.total_spent),
          bookingCount: parseIntField(s.booking_count),
          avgNightlyRate: parseNumericField(s.avg_nightly_rate),
          periodSpent: parseNumericField(s.period_spent),
          periodBookings: parseIntField(s.period_bookings)
        })) : [],
        guestsBySource: guestsBySourceResult.success ? guestsBySourceResult.data.map(s => ({
          source: s.source,
          count: parseIntField(s.count),
          revenue: parseNumericField(s.revenue)
        })) : [],
        tagDistribution: tagDistributionResult.success ? tagDistributionResult.data.map(t => ({
          id: t.tag_id,
          name: t.tag_name,
          color: t.tag_color || undefined,
          count: parseIntField(t.count)
        })) : []
      },
      guests: guestsListResult.success ? guestsListResult.data.map(g => {
        const guestKey = createGuestId(g.guest_name, g.guest_email);
        return {
          id: guestKey,
          name: g.guest_name,
          email: g.guest_email || undefined,
          firstVisit: g.first_visit,
          lastVisit: g.last_visit,
          bookingCount: parseIntField(g.booking_count),
          totalSpent: parseNumericField(g.total_spent),
          avgNightlyRate: parseNumericField(g.avg_nightly_rate),
          properties: g.properties ? g.properties.split(', ') : [],
          tags: guestTagsMap.get(guestKey) || [],
          // Add period-specific data
          periodBookings: parseIntField(g.period_bookings),
          periodSpent: parseNumericField(g.period_spent)
        };
      }) : [],
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasMore: page < totalPages
      }
    };

    return createSuccessResponse(response);
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to fetch guests data'
    );
  }
}

app.http('guests', {
  methods: ['GET', 'OPTIONS'],
  route: 'guests',
  authLevel: 'anonymous',
  handler: getGuests
});