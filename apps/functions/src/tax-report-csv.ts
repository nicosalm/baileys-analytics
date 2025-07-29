import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { query } from './services/database';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

type TaxReportRow = {
  booking_id: string;
  property_name: string;
  arrival: string;
  departure: string;
  guest_name: string;
  platform: string;
  rent_amount: string;
  tax_amount: string;
  total_amount: string;
};

function escapeCSV(value: string | null): string {
  if (!value) return '';
  const str = value.toString();
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowToCSV(row: TaxReportRow): string {
  return [
    escapeCSV(row.booking_id),
    escapeCSV(row.property_name),
    escapeCSV(row.arrival),
    escapeCSV(row.departure),
    escapeCSV(row.guest_name),
    escapeCSV(row.platform),
    row.rent_amount,
    row.tax_amount,
    row.total_amount
  ].join(',');
}

export async function taxReportCSV(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const fromDate = request.query.get('from') || '2024-01-01';
    const toDate = request.query.get('to') || '2024-12-31';

    const result = await query<TaxReportRow>(
      `SELECT
        b.ownerrez_booking_id as booking_id,
        p.name as property_name,
        b.arrival::text,
        b.departure::text,
        b.guest_name,
        COALESCE(b.platform, 'Direct') as platform,
        COALESCE(SUM(CASE WHEN bc.type = 'rent' THEN bc.amount ELSE 0 END), 0)::text as rent_amount,
        COALESCE(SUM(CASE WHEN bc.type = 'tax' THEN bc.amount ELSE 0 END), 0)::text as tax_amount,
        b.total_amount::text
      FROM bookings b
      JOIN properties p ON b.property_id = p.id
      LEFT JOIN booking_charges bc ON b.id = bc.booking_id
      WHERE b.tenant_id = $1
        AND b.arrival >= $2
        AND b.arrival <= $3
        AND b.status != 'canceled'
      GROUP BY b.id, b.ownerrez_booking_id, p.name, b.arrival, b.departure,
               b.guest_name, b.platform, b.total_amount
      ORDER BY b.arrival, p.name`,
      [TENANT_ID, fromDate, toDate]
    );

    if (!result.success) {
      throw new Error(`Failed to generate report: ${result.error}`);
    }

    const headers = [
      'Booking ID',
      'Property',
      'Check In',
      'Check Out',
      'Guest Name',
      'Platform',
      'Rent Amount',
      'Tax Amount',
      'Total Amount'
    ].join(',');

    const rows = result.data.map(rowToCSV);
    const csv = [headers, ...rows].join('\n');

    const filename = `tax-report-${fromDate}-to-${toDate}.csv`;

    return {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`
      },
      body: csv
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    context.error('CSV generation failed:', error);

    return {
      status: 500,
      body: `Error generating CSV: ${errorMessage}`
    };
  }
}

app.http('tax-report-csv', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: taxReportCSV
});
