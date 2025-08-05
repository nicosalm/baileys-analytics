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
    type: string;
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
    type: string;
    color?: string;
  }>;
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
    // Parse query parameters
    const url = new URL(request.url);
    const startDate = url.searchParams.get('from');
    const endDate = url.searchParams.get('to');
    const tagIds = url.searchParams.get('tags')?.split(',').filter(Boolean) || [];

    // Build date filter
    let dateFilter = '';
    const queryParams: any[] = [auth.tenantId];
    let paramIndex = 2;

    if (startDate && endDate) {
      dateFilter = `AND b.arrival >= $${paramIndex} AND b.arrival <= $${paramIndex + 1}`;
      queryParams.push(startDate, endDate);
      paramIndex += 2;
    }

    // Build tag filter
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

    // Get guest metrics
    const metricsResult = await query<{
      total_guests: string;
      repeat_guests: string;
      avg_stay_length: string;
      avg_spend: string;
      total_revenue: string;
    }>(
      `WITH guest_stats AS (
        SELECT
          guest_name,
          guest_email,
          COUNT(*) as booking_count,
          SUM(total_amount) as total_spent,
          SUM(departure - arrival) as total_nights,
          MIN(arrival) as first_visit,
          MAX(arrival) as last_visit
        FROM bookings b
        WHERE tenant_id = $1
          AND status != 'canceled'
          ${dateFilter}
          ${tagFilter}
        GROUP BY guest_name, guest_email
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

    // Get top spenders
    const topSpendersResult = await query<{
      guest_name: string;
      guest_email: string;
      total_spent: string;
      booking_count: string;
      avg_nightly_rate: string;
    }>(
      `WITH guest_spending AS (
        SELECT
          guest_name,
          guest_email,
          SUM(total_amount) as total_spent,
          COUNT(*) as booking_count,
          SUM(total_amount) / NULLIF(SUM(departure - arrival), 0) as avg_nightly_rate
        FROM bookings b
        WHERE tenant_id = $1
          AND status != 'canceled'
          ${dateFilter}
          ${tagFilter}
        GROUP BY guest_name, guest_email
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

    // Get guests by source
    const guestsBySourceResult = await query<{
      source: string;
      count: string;
      revenue: string;
    }>(
      `SELECT
        COALESCE(
          CASE
            WHEN platform ILIKE '%airbnb%' THEN 'Airbnb'
            WHEN platform ILIKE '%vrbo%' THEN 'VRBO'
            WHEN platform ILIKE '%booking%' THEN 'Booking.com'
            ELSE 'Direct'
          END,
          'Unknown'
        ) as source,
        COUNT(DISTINCT (guest_name, COALESCE(guest_email, ''))) as count,
        SUM(total_amount) as revenue
      FROM bookings b
      WHERE tenant_id = $1
        AND status != 'canceled'
        ${dateFilter}
        ${tagFilter}
      GROUP BY source
      ORDER BY revenue DESC`,
      queryParams
    );

    // Get tag distribution
    const tagDistributionResult = await query<{
      tag_id: string;
      tag_name: string;
      tag_type: string;
      tag_color: string;
      count: string;
    }>(
      `SELECT
        t.id as tag_id,
        t.name as tag_name,
        t.type as tag_type,
        t.color as tag_color,
        COUNT(DISTINCT (b.guest_name, COALESCE(b.guest_email, ''))) as count
      FROM bookings b
      JOIN booking_tags bt ON b.id = bt.booking_id
      JOIN tags t ON bt.tag_id = t.id
      WHERE b.tenant_id = $1
        AND b.status != 'canceled'
        ${dateFilter}
        ${tagFilter}
      GROUP BY t.id, t.name, t.type, t.color
      ORDER BY count DESC`,
      queryParams
    );

    // Get all guests list
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
      `WITH guest_data AS (
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
          ${dateFilter}
          ${tagFilter}
        GROUP BY b.guest_name, b.guest_email
      )
      SELECT * FROM guest_data
      ORDER BY total_spent DESC`,
      queryParams
    );

    // Get tags for each guest
    const guestTagsResult = await query<{
      guest_name: string;
      guest_email: string;
      tag_id: string;
      tag_name: string;
      tag_type: string;
      tag_color: string;
    }>(
      `SELECT DISTINCT
        b.guest_name,
        b.guest_email,
        t.id as tag_id,
        t.name as tag_name,
        t.type as tag_type,
        t.color as tag_color
      FROM bookings b
      JOIN booking_tags bt ON b.id = bt.booking_id
      JOIN tags t ON bt.tag_id = t.id
      WHERE b.tenant_id = $1
        AND b.status != 'canceled'
        ${dateFilter}
        ${tagFilter}
      ORDER BY b.guest_name, b.guest_email, t.type, t.name`,
      queryParams
    );

    // Build tags map for guests
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
          type: row.tag_type,
          color: row.tag_color || undefined
        });
      }
    }

    // Build response
    const response = {
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
          type: t.tag_type,
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
      }) : []
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
