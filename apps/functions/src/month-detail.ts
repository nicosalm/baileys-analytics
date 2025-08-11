import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { query } from './services/database';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';

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
    const year = request.query.get('year');
    const month = request.query.get('month');

    if (!year || !month) {
      return {
        status: 400,
        headers: corsHeaders(),
        jsonBody: { error: 'Year and month are required' }
      };
    }

    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

    // Get summary
    const summaryResult = await query<{
      total_revenue: string;
      total_tax: string;
      total_bookings: string;
      avg_nightly_rate: string;
    }>(
      `SELECT
        COALESCE(SUM(b.total_amount), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN bc.type = 'tax' THEN bc.amount ELSE 0 END), 0) as total_tax,
        COUNT(DISTINCT b.id) as total_bookings,
        CASE
          WHEN SUM(LEAST(b.departure, $3::date) - GREATEST(b.arrival, $2::date)) > 0 THEN
            SUM(b.total_amount) / SUM(LEAST(b.departure, $3::date) - GREATEST(b.arrival, $2::date))
          ELSE 0
        END as avg_nightly_rate
      FROM bookings b
      LEFT JOIN booking_charges bc ON b.id = bc.booking_id
      WHERE b.tenant_id = $1
        AND b.arrival <= $3
        AND b.departure >= $2
        AND b.status != 'canceled'`,
      [auth.tenantId, startDate, endDate]
    );

    // Get by property
    const byPropertyResult = await query<{
      property_id: string;
      property_name: string;
      revenue: string;
      bookings: string;
      tax: string;
    }>(
      `SELECT
        p.id as property_id,
        p.name as property_name,
        COALESCE(SUM(b.total_amount), 0) as revenue,
        COUNT(DISTINCT b.id) as bookings,
        COALESCE(SUM(CASE WHEN bc.type = 'tax' THEN bc.amount ELSE 0 END), 0) as tax
      FROM properties p
      LEFT JOIN bookings b ON p.id = b.property_id
        AND b.arrival <= $3
        AND b.departure >= $2
        AND b.status != 'canceled'
      LEFT JOIN booking_charges bc ON b.id = bc.booking_id
      WHERE p.tenant_id = $1 AND p.active = true
      GROUP BY p.id, p.name
      HAVING COUNT(DISTINCT b.id) > 0
      ORDER BY revenue DESC`,
      [auth.tenantId, startDate, endDate]
    );

    // Get all bookings
    const bookingsResult = await query<{
      id: string;
      property_id: string;
      property_name: string;
      guest_name: string;
      guest_email: string;
      arrival: string;
      departure: string;
      total_amount: string;
      status: string;
    }>(
      `SELECT
        b.id,
        b.property_id,
        p.name as property_name,
        b.guest_name,
        b.guest_email,
        b.arrival,
        b.departure,
        b.total_amount,
        b.status
      FROM bookings b
      JOIN properties p ON b.property_id = p.id
      WHERE b.tenant_id = $1
        AND b.arrival <= $3
        AND b.departure >= $2
        AND b.status != 'canceled'
      ORDER BY b.arrival`,
      [auth.tenantId, startDate, endDate]
    );

    if (!summaryResult.success) {
      throw new Error('Failed to fetch summary');
    }

    const summary = summaryResult.data[0];

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: {
        metrics: {
          revenue: parseFloat(summary.total_revenue),
          bookings: parseInt(summary.total_bookings),
          occupancyRate: 0, // Would need calculation based on property count
          avgNightlyRate: parseFloat(summary.avg_nightly_rate)
        },
        summary: {
          totalRevenue: parseFloat(summary.total_revenue),
          totalTax: parseFloat(summary.total_tax),
          totalBookings: parseInt(summary.total_bookings),
          avgNightlyRate: parseFloat(summary.avg_nightly_rate)
        },
        topProperties: byPropertyResult.success ? byPropertyResult.data.map(p => ({
          propertyId: p.property_id,
          propertyName: p.property_name,
          revenue: parseFloat(p.revenue),
          bookings: parseInt(p.bookings),
          occupancyRate: 0, // Would need calculation
          tax: parseFloat(p.tax)
        })) : [],
        byProperty: byPropertyResult.success ? byPropertyResult.data.map(p => ({
          propertyId: p.property_id,
          propertyName: p.property_name,
          revenue: parseFloat(p.revenue),
          bookings: parseInt(p.bookings),
          tax: parseFloat(p.tax)
        })) : [],
        bookings: bookingsResult.success ? bookingsResult.data.map(b => ({
          id: b.id,
          propertyId: b.property_id,
          propertyName: b.property_name,
          guestId: `${b.guest_name}|${b.guest_email || ''}`,
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
        error: error instanceof Error ? error.message : 'Failed to fetch month detail'
      }
    };
  }
}

app.http('month-detail', {
  methods: ['GET', 'OPTIONS'],
  route: 'month-detail',
  authLevel: 'anonymous',
  handler: getMonthDetail
});
