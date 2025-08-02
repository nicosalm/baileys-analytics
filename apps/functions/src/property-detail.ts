import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { query } from './services/database';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';

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
    const propertyId = request.params.propertyId;
    const fromDate = request.query.get('from') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const toDate = request.query.get('to') || new Date().toISOString().split('T')[0];

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
      [propertyId, auth.tenantId]
    );

    if (!propertyResult.success || propertyResult.data.length === 0) {
      return {
        status: 404,
        headers: corsHeaders(),
        jsonBody: { error: 'Property not found' }
      };
    }

    const property = propertyResult.data[0];

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
              LEAST(b.departure, $3::date) - GREATEST(b.arrival, $2::date)
            ELSE 0
          END
        ), 0) as total_nights,
        CASE
          WHEN COUNT(DISTINCT b.id) > 0 THEN
            SUM(b.total_amount) / NULLIF(SUM(
              CASE
                WHEN b.arrival <= $3 AND b.departure >= $2 THEN
                  LEAST(b.departure, $3::date) - GREATEST(b.arrival, $2::date)
                ELSE 0
              END
            ), 0)
          ELSE 0
        END as avg_nightly_rate
      FROM bookings b
      WHERE b.property_id = $1
        AND b.arrival <= $3
        AND b.departure >= $2
        AND b.status != 'canceled'`,
      [propertyId, fromDate, toDate]
    );

    // Get monthly data
    const monthlyResult = await query<{
      month: string;
      revenue: string;
      bookings: string;
      nights: string;
    }>(
      `SELECT
        TO_CHAR(b.arrival, 'YYYY-MM') as month,
        SUM(b.total_amount) as revenue,
        COUNT(DISTINCT b.id) as bookings,
        SUM(LEAST(b.departure, $3::date) - GREATEST(b.arrival, $2::date)) as nights
      FROM bookings b
      WHERE b.property_id = $1
        AND b.arrival <= $3
        AND b.departure >= $2
        AND b.status != 'canceled'
      GROUP BY TO_CHAR(b.arrival, 'YYYY-MM')
      ORDER BY month`,
      [propertyId, fromDate, toDate]
    );

    // Calculate occupancy for monthly data
    const monthlyData = monthlyResult.success ? monthlyResult.data.map(row => {
      const [year, month] = row.month.split('-');
      const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
      const occupancy = (parseInt(row.nights) / daysInMonth) * 100;

      return {
        month: row.month,
        revenue: parseFloat(row.revenue),
        bookings: parseInt(row.bookings),
        occupancy: Math.min(occupancy, 100)
      };
    }) : [];

    // Get recent bookings
    const bookingsResult = await query<{
      id: string;
      guest_name: string;
      arrival: string;
      departure: string;
      total_amount: string;
      status: string;
    }>(
      `SELECT id, guest_name, arrival, departure, total_amount, status
       FROM bookings
       WHERE property_id = $1
         AND arrival >= $2
         AND arrival <= $3
       ORDER BY arrival DESC
       LIMIT 20`,
      [propertyId, fromDate, toDate]
    );

    if (!metricsResult.success) {
      throw new Error('Failed to fetch metrics');
    }

    const metrics = metricsResult.data[0];
    const totalDays = Math.ceil((new Date(toDate).getTime() - new Date(fromDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const occupancyRate = parseInt(metrics.total_nights) / totalDays;

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: {
        property: {
          id: property.id,
          name: property.name,
          address: `${property.address}, ${property.city}, ${property.state}`,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          maxGuests: property.max_guests
        },
        metrics: {
          totalRevenue: parseFloat(metrics.total_revenue),
          totalBookings: parseInt(metrics.total_bookings),
          avgNightlyRate: parseFloat(metrics.avg_nightly_rate),
          occupancyRate
        },
        monthlyData,
        recentBookings: bookingsResult.success ? bookingsResult.data.map(b => ({
          id: b.id,
          guestName: b.guest_name,
          arrival: b.arrival,
          departure: b.departure,
          totalAmount: parseFloat(b.total_amount),
          status: b.status
        })) : []
      }
    };
  } catch (error) {
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: {
        error: error instanceof Error ? error.message : 'Failed to fetch property detail'
      }
    };
  }
}

app.http('property-detail', {
  methods: ['GET', 'OPTIONS'],
  route: 'property/{propertyId}/detail',
  authLevel: 'anonymous',
  handler: getPropertyDetail
});
