import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { query } from './services/database';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';

export async function getPropertyMonthDetail(
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
    const year = request.params.year;
    const month = request.params.month;

    // Ensure month is padded to 2 digits
    const monthPadded = month.padStart(2, '0');
    const yearInt = parseInt(year);
    const monthInt = parseInt(month);

    // Calculate correct start and end dates for the month
    const startDate = `${year}-${monthPadded}-01`;
    // Get last day of the month correctly
    const lastDay = new Date(yearInt, monthInt, 0).getDate();
    const endDate = `${year}-${monthPadded}-${lastDay.toString().padStart(2, '0')}`;

    // Get property info
    const propertyResult = await query<{ id: string; name: string }>(
      `SELECT id, name FROM properties WHERE id = $1 AND tenant_id = $2`,
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

    // Get summary for the property and month
    const summaryResult = await query<{
      revenue: string;
      tax: string;
      bookings: string;
      nights: string;
      avg_nightly_rate: string;
    }>(
      `SELECT
        COALESCE(SUM(b.total_amount), 0) as revenue,
        COALESCE(SUM(bc.tax_total), 0) as tax,
        COUNT(DISTINCT b.id) as bookings,
        COALESCE(SUM(
          CASE
            WHEN b.arrival <= $4::date AND b.departure >= $3::date THEN
              LEAST(b.departure, $4::date + 1) - GREATEST(b.arrival, $3::date)
            ELSE 0
          END
        ), 0) as nights,
        CASE
          WHEN SUM(
            CASE
              WHEN b.arrival <= $4::date AND b.departure >= $3::date THEN
                LEAST(b.departure, $4::date + 1) - GREATEST(b.arrival, $3::date)
              ELSE 0
            END
          ) > 0 THEN
            SUM(b.total_amount) / SUM(
              CASE
                WHEN b.arrival <= $4::date AND b.departure >= $3::date THEN
                  LEAST(b.departure, $4::date + 1) - GREATEST(b.arrival, $3::date)
                ELSE 0
              END
            )
          ELSE 0
        END as avg_nightly_rate
      FROM bookings b
      LEFT JOIN (
        SELECT booking_id, SUM(amount) as tax_total
        FROM booking_charges
        WHERE type = 'tax'
        GROUP BY booking_id
      ) bc ON b.id = bc.booking_id
      WHERE b.property_id = $1
        AND b.tenant_id = $2
        AND b.arrival <= $4::date
        AND b.departure > $3::date
        AND b.status != 'canceled'`,
      [propertyId, auth.tenantId, startDate, endDate]
    );

    // Get detailed bookings
    const bookingsResult = await query<{
      id: string;
      guest_name: string;
      arrival: string;
      departure: string;
      nights: string;
      total_amount: string;
      tax_amount: string;
      status: string;
    }>(
      `SELECT
        b.id,
        b.guest_name,
        b.arrival::text,
        b.departure::text,
        CASE
          WHEN b.arrival <= $4::date AND b.departure >= $3::date THEN
            LEAST(b.departure, $4::date + 1) - GREATEST(b.arrival, $3::date)
          ELSE 0
        END as nights,
        b.total_amount,
        COALESCE(bc.tax_total, 0) as tax_amount,
        b.status
      FROM bookings b
      LEFT JOIN (
        SELECT booking_id, SUM(amount) as tax_total
        FROM booking_charges
        WHERE type = 'tax'
        GROUP BY booking_id
      ) bc ON b.id = bc.booking_id
      WHERE b.property_id = $1
        AND b.tenant_id = $2
        AND b.arrival <= $4::date
        AND b.departure > $3::date
        AND b.status != 'canceled'
      ORDER BY b.arrival`,
      [propertyId, auth.tenantId, startDate, endDate]
    );

    if (!summaryResult.success) {
      throw new Error('Failed to fetch summary');
    }

    const summary = summaryResult.data[0] || {
      revenue: '0',
      tax: '0',
      bookings: '0',
      nights: '0',
      avg_nightly_rate: '0'
    };

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: {
        property: {
          id: property.id,
          name: property.name
        },
        summary: {
          revenue: parseFloat(summary.revenue),
          tax: parseFloat(summary.tax),
          bookings: parseInt(summary.bookings),
          nights: parseInt(summary.nights),
          avgNightlyRate: parseFloat(summary.avg_nightly_rate)
        },
        bookings: bookingsResult.success ? bookingsResult.data.map(b => ({
          id: b.id,
          guestName: b.guest_name,
          arrival: b.arrival,
          departure: b.departure,
          nights: parseInt(b.nights),
          totalAmount: parseFloat(b.total_amount),
          taxAmount: parseFloat(b.tax_amount),
          status: b.status
        })) : []
      }
    };
  } catch (error) {
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: {
        error: error instanceof Error ? error.message : 'Failed to fetch property month detail'
      }
    };
  }
}

app.http('property-month-detail', {
  methods: ['GET', 'OPTIONS'],
  route: 'property/{propertyId}/month/{year}/{month}',
  authLevel: 'anonymous',
  handler: getPropertyMonthDetail
});
