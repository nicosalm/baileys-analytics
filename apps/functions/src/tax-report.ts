import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { query } from './services/database';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';

type TaxReportState =
  | { status: 'loading' }
  | { status: 'success'; data: TaxReportData }
  | { status: 'error'; error: string };

type TaxReportData = {
  summary: {
    totalTax: number;
    totalRent: number;
    totalBookings: number;
    dateRange: {
      from: string;
      to: string;
    };
  };
  byProperty: PropertyTaxData[];
  byMonth: MonthlyTaxData[];
};

type PropertyTaxData = {
  propertyId: string;
  propertyName: string;
  totalTax: number;
  totalRent: number;
  bookingCount: number;
  taxRate: number;
};

type MonthlyTaxData = {
  month: string;
  totalTax: number;
  totalRent: number;
  bookingCount: number;
};

export async function taxReport(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') {
    return handleOptions();
  }

  // Check authentication
  const authCheck = await requireAuth(request);
  if (!authCheck.authenticated) {
    return authCheck.response;
  }

  const { auth } = authCheck.request;

  // Require tenant connection
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
    const fromDate = request.query.get('from') || '2024-01-01';
    const toDate = request.query.get('to') || '2024-12-31';
    const tagIds = request.query.get('tags')?.split(',').filter(Boolean) || [];

    // Get summary using the authenticated tenant ID
    const summaryResult = await query<{
      total_tax: string;
      total_rent: string;
      total_bookings: string;
    }>(
      `SELECT
        COALESCE(SUM(CASE WHEN bc.type = 'tax' THEN bc.amount ELSE 0 END), 0) as total_tax,
        COALESCE(SUM(CASE WHEN bc.type = 'rent' THEN bc.amount ELSE 0 END), 0) as total_rent,
        COUNT(DISTINCT b.id) as total_bookings
      FROM bookings b
      LEFT JOIN booking_charges bc ON b.id = bc.booking_id
      WHERE b.tenant_id = $1
        AND b.arrival >= $2
        AND b.arrival <= $3
        AND b.status != 'canceled'
        ${tagIds.length > 0 ? `AND EXISTS (
          SELECT 1 FROM booking_tags bt
          WHERE bt.booking_id = b.id
          AND bt.tag_id = ANY($4::uuid[])
        )` : ''}`,
      tagIds.length > 0
        ? [auth.tenantId, fromDate, toDate, tagIds]
        : [auth.tenantId, fromDate, toDate]
    );

    if (!summaryResult.success) {
      throw new Error(`Failed to get summary: ${summaryResult.error}`);
    }

    // Get by property
    const byPropertyResult = await query<{
      property_id: string;
      property_name: string;
      total_tax: string;
      total_rent: string;
      booking_count: string;
    }>(
      `SELECT
        p.id as property_id,
        p.name as property_name,
        COALESCE(SUM(CASE WHEN bc.type = 'tax' THEN bc.amount ELSE 0 END), 0) as total_tax,
        COALESCE(SUM(CASE WHEN bc.type = 'rent' THEN bc.amount ELSE 0 END), 0) as total_rent,
        COUNT(DISTINCT b.id) as booking_count
      FROM properties p
      LEFT JOIN bookings b ON p.id = b.property_id
      LEFT JOIN booking_charges bc ON b.id = bc.booking_id
      WHERE p.tenant_id = $1
        AND b.arrival >= $2
        AND b.arrival <= $3
        AND b.status != 'canceled'
        ${tagIds.length > 0 ? `AND EXISTS (
          SELECT 1 FROM booking_tags bt
          WHERE bt.booking_id = b.id
          AND bt.tag_id = ANY($4::uuid[])
        )` : ''}
      GROUP BY p.id, p.name
      ORDER BY total_tax DESC`,
      tagIds.length > 0
        ? [auth.tenantId, fromDate, toDate, tagIds]
        : [auth.tenantId, fromDate, toDate]
    );

    if (!byPropertyResult.success) {
      throw new Error(`Failed to get property data: ${byPropertyResult.error}`);
    }

    // Get by month
    const byMonthResult = await query<{
      month: string;
      total_tax: string;
      total_rent: string;
      booking_count: string;
    }>(
      `SELECT
        TO_CHAR(b.arrival, 'YYYY-MM') as month,
        COALESCE(SUM(CASE WHEN bc.type = 'tax' THEN bc.amount ELSE 0 END), 0) as total_tax,
        COALESCE(SUM(CASE WHEN bc.type = 'rent' THEN bc.amount ELSE 0 END), 0) as total_rent,
        COUNT(DISTINCT b.id) as booking_count
      FROM bookings b
      LEFT JOIN booking_charges bc ON b.id = bc.booking_id
      WHERE b.tenant_id = $1
        AND b.arrival >= $2
        AND b.arrival <= $3
        AND b.status != 'canceled'
        ${tagIds.length > 0 ? `AND EXISTS (
          SELECT 1 FROM booking_tags bt
          WHERE bt.booking_id = b.id
          AND bt.tag_id = ANY($4::uuid[])
        )` : ''}
      GROUP BY TO_CHAR(b.arrival, 'YYYY-MM')
      ORDER BY month`,
      tagIds.length > 0
        ? [auth.tenantId, fromDate, toDate, tagIds]
        : [auth.tenantId, fromDate, toDate]
    );

    if (!byMonthResult.success) {
      throw new Error(`Failed to get monthly data: ${byMonthResult.error}`);
    }

    const summary = summaryResult.data[0];

    const reportData: TaxReportData = {
      summary: {
        totalTax: parseFloat(summary.total_tax),
        totalRent: parseFloat(summary.total_rent),
        totalBookings: parseInt(summary.total_bookings),
        dateRange: { from: fromDate, to: toDate }
      },
      byProperty: byPropertyResult.data.map(row => ({
        propertyId: row.property_id,
        propertyName: row.property_name,
        totalTax: parseFloat(row.total_tax),
        totalRent: parseFloat(row.total_rent),
        bookingCount: parseInt(row.booking_count),
        taxRate: parseFloat(row.total_rent) > 0
          ? (parseFloat(row.total_tax) / parseFloat(row.total_rent)) * 100
          : 0
      })),
      byMonth: byMonthResult.data.map(row => ({
        month: row.month,
        totalTax: parseFloat(row.total_tax),
        totalRent: parseFloat(row.total_rent),
        bookingCount: parseInt(row.booking_count)
      }))
    };

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: {
        status: 'success',
        data: reportData
      }
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    context.error('Tax report failed:', error);

    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: {
        status: 'error',
        error: errorMessage
      }
    };
  }
}

app.http('tax-report', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: taxReport
});
