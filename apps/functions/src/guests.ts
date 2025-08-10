import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { safeDivide } from '@baileys/utils';
import { query } from './services/database';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';

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
};

type PaginatedResponse = {
  metrics: GuestMetrics;
  guests: GuestListItem[];
  vipThresholds: {
    spendThreshold: number;
    bookingThreshold: number;
  };
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
    // Fetch user's VIP thresholds
    const vipSettingsResult = await query<{
      vip_spend_threshold: string;
      vip_booking_threshold: string;
    }>(
      `SELECT vip_spend_threshold, vip_booking_threshold
       FROM users
       WHERE id = $1`,
      [auth.userId]
    );

    const vipSpendThreshold = vipSettingsResult.success && vipSettingsResult.data.length > 0
      ? parseFloat(vipSettingsResult.data[0].vip_spend_threshold)
      : 5000;

    const vipBookingThreshold = vipSettingsResult.success && vipSettingsResult.data.length > 0
      ? parseInt(vipSettingsResult.data[0].vip_booking_threshold)
      : 5;

    const url = new URL(request.url);
    const startDate = url.searchParams.get('from');
    const endDate = url.searchParams.get('to');
    const tagIds = url.searchParams.get('tags')?.split(',').filter(Boolean) || [];
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '50');
    const offset = (page - 1) * pageSize;

    let dateFilter = '';
    const queryParams: any[] = [auth.tenantId];
    let paramIndex = 2;

    if (startDate && endDate) {
      dateFilter = `AND b.arrival >= $${paramIndex} AND b.arrival <= $${paramIndex + 1}`;
      queryParams.push(startDate, endDate);
      paramIndex += 2;
    }

    let tagFilter = '';
    if (tagIds.length > 0) {
      const tagPlaceholders = tagIds.map((_, i) => `$${paramIndex + i}`).join(',');
      tagFilter = `AND EXISTS (
        SELECT 1 FROM booking_tags bt
        WHERE bt.booking_id = b.id
        AND bt.tag_id IN (${tagPlaceholders})
      )`;
      queryParams.push(...tagIds);
    }

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
      return {
        status: 500,
        headers: corsHeaders(),
        jsonBody: { error: 'Failed to fetch guest metrics' }
      };
    }

    const metrics = metricsResult.data[0];
    const totalGuests = parseInt(metrics.total_guests) || 0;
    const repeatGuests = parseInt(metrics.repeat_guests) || 0;

    const topSpendersResult = await query<{
      guest_name: string;
      guest_email: string;
      total_spent: string;
      booking_count: string;
      avg_nightly_rate: string;
    }>(
      `WITH guest_period AS (
        -- Get guests that have bookings in the selected period
        SELECT DISTINCT b.guest_name, b.guest_email
        FROM bookings b
        WHERE b.tenant_id = $1
          AND b.status != 'canceled'
          ${dateFilter}
          ${tagFilter}
      ),
      guest_spending AS (
        -- Get all-time spending for these guests
        SELECT
          b.guest_name,
          b.guest_email,
          SUM(b.total_amount) as total_spent,
          COUNT(*) as booking_count,
          SUM(b.total_amount) / NULLIF(SUM(b.departure - b.arrival), 0) as avg_nightly_rate
        FROM bookings b
        JOIN guest_period gp ON b.guest_name = gp.guest_name 
          AND COALESCE(b.guest_email, '') = COALESCE(gp.guest_email, '')
        WHERE b.tenant_id = $1
          AND b.status != 'canceled'
        GROUP BY b.guest_name, b.guest_email
      )
      SELECT
        guest_name,
        guest_email,
        total_spent,
        booking_count,
        avg_nightly_rate
      FROM guest_spending
      ORDER BY total_spent DESC
      LIMIT 20`,
      queryParams
    );

    const guestsBySourceResult = await query<{
      source: string;
      count: string;
      revenue: string;
    }>(
      `SELECT
        CASE
          WHEN b.platform IS NULL OR b.platform = '' THEN 'Direct'
          WHEN LOWER(b.platform) LIKE '%direct%' THEN 'Direct'
          WHEN LOWER(b.platform) LIKE '%airbnb%' THEN 'Airbnb'
          WHEN LOWER(b.platform) LIKE '%vrbo%' OR LOWER(b.platform) LIKE '%homeaway%' THEN 'VRBO'
          WHEN LOWER(b.platform) LIKE '%booking.com%' OR LOWER(b.platform) LIKE '%booking%' THEN 'Booking.com'
          ELSE b.platform
        END as source,
        COUNT(DISTINCT (b.guest_name, COALESCE(b.guest_email, ''))) as count,
        SUM(b.total_amount) as revenue
      FROM bookings b
      WHERE b.tenant_id = $1
        AND b.status != 'canceled'
        ${dateFilter}
        ${tagFilter}
      GROUP BY
        CASE
          WHEN b.platform IS NULL OR b.platform = '' THEN 'Direct'
          WHEN LOWER(b.platform) LIKE '%direct%' THEN 'Direct'
          WHEN LOWER(b.platform) LIKE '%airbnb%' THEN 'Airbnb'
          WHEN LOWER(b.platform) LIKE '%vrbo%' OR LOWER(b.platform) LIKE '%homeaway%' THEN 'VRBO'
          WHEN LOWER(b.platform) LIKE '%booking.com%' OR LOWER(b.platform) LIKE '%booking%' THEN 'Booking.com'
          ELSE b.platform
        END
      ORDER BY revenue DESC`,
      queryParams
    );

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

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(DISTINCT (b.guest_name, COALESCE(b.guest_email, ''))) as count
      FROM bookings b
      WHERE b.tenant_id = $1
        AND b.status != 'canceled'
        ${dateFilter}
        ${tagFilter}`,
      queryParams
    );

    const totalItems = countResult.success ? parseInt(countResult.data[0].count) : 0;
    const totalPages = Math.ceil(totalItems / pageSize);

    const guestsListResult = await query<{
      guest_name: string;
      guest_email: string;
      first_visit: string;
      last_visit: string;
      booking_count: string;
      total_spent: string;
      avg_nightly_rate: string;
      properties: string;
    }>(
      `WITH guest_period_data AS (
        -- Get guests that have bookings in the selected period
        SELECT DISTINCT
          b.guest_name,
          b.guest_email
        FROM bookings b
        WHERE b.tenant_id = $1
          AND b.status != 'canceled'
          ${dateFilter}
          ${tagFilter}
      ),
      guest_all_time_data AS (
        -- Get all-time stats for these guests (for accurate VIP calculation)
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
        JOIN guest_period_data gpd ON b.guest_name = gpd.guest_name 
          AND COALESCE(b.guest_email, '') = COALESCE(gpd.guest_email, '')
        WHERE b.tenant_id = $1
          AND b.status != 'canceled'
        GROUP BY b.guest_name, b.guest_email
      )
      SELECT * FROM guest_all_time_data
      ORDER BY total_spent DESC
      LIMIT ${pageSize}
      OFFSET ${offset}`,
      queryParams
    );

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
            SUM(b.total_amount) as total_spent
          FROM bookings b
          WHERE b.tenant_id = $1
            AND b.status != 'canceled'
            ${dateFilter}
            ${tagFilter}
          GROUP BY b.guest_name, b.guest_email
          ORDER BY total_spent DESC
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
        ${dateFilter}
        ${tagFilter}
      ORDER BY b.guest_name, b.guest_email, t.name`,
      queryParams
    );

    const guestTagsMap = new Map<string, Array<any>>();
    if (guestTagsResult.success) {
      for (const row of guestTagsResult.data) {
        const key = `${row.guest_name}|${row.guest_email || ''}`;
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
        avgStayLength: parseFloat(metrics.avg_stay_length) || 0,
        avgSpend: parseFloat(metrics.avg_spend) || 0,
        totalRevenue: parseFloat(metrics.total_revenue) || 0,
        topSpenders: topSpendersResult.success ? topSpendersResult.data.map(s => ({
          id: `${s.guest_name}|${s.guest_email || ''}`,
          name: s.guest_name,
          email: s.guest_email || undefined,
          totalSpent: parseFloat(s.total_spent),
          bookingCount: parseInt(s.booking_count),
          avgNightlyRate: parseFloat(s.avg_nightly_rate) || 0
        })) : [],
        guestsBySource: guestsBySourceResult.success ? guestsBySourceResult.data.map(s => ({
          source: s.source,
          count: parseInt(s.count),
          revenue: parseFloat(s.revenue)
        })) : [],
        tagDistribution: tagDistributionResult.success ? tagDistributionResult.data.map(t => ({
          id: t.tag_id,
          name: t.tag_name,
          color: t.tag_color || undefined,
          count: parseInt(t.count)
        })) : []
      },
      guests: guestsListResult.success ? guestsListResult.data.map(g => {
        const guestKey = `${g.guest_name}|${g.guest_email || ''}`;
        return {
          id: guestKey,
          name: g.guest_name,
          email: g.guest_email || undefined,
          firstVisit: g.first_visit,
          lastVisit: g.last_visit,
          bookingCount: parseInt(g.booking_count),
          totalSpent: parseFloat(g.total_spent),
          avgNightlyRate: parseFloat(g.avg_nightly_rate) || 0,
          properties: g.properties ? g.properties.split(', ') : [],
          tags: guestTagsMap.get(guestKey) || []
        };
      }) : [],
      vipThresholds: {
        spendThreshold: vipSpendThreshold,
        bookingThreshold: vipBookingThreshold
      },
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasMore: page < totalPages
      }
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
        error: error instanceof Error ? error.message : 'Failed to fetch guests data'
      }
    };
  }
}

app.http('guests', {
  methods: ['GET', 'OPTIONS'],
  route: 'guests',
  authLevel: 'anonymous',
  handler: getGuests
});
