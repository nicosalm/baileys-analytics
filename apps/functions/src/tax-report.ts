import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { query } from './services/database'
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth'

export async function taxReport(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') {
    return handleOptions()
  }

  const authCheck = await requireAuth(request)
  if (!authCheck.authenticated) {
    return authCheck.response
  }

  const { auth } = authCheck.request

  if (!auth.tenantId) {
    return {
      status: 403,
      headers: corsHeaders(),
      jsonBody: {
        error: 'OwnerRez connection required',
        code: 'NO_OWNERREZ_CONNECTION'
      }
    }
  }

  const fromDate = request.query.get('from') || '2024-01-01'
  const toDate = request.query.get('to') || '2024-12-31'
  const tagIds = request.query.get('tags')?.split(',').filter(Boolean) || []

  // Get active tax rules
  const taxRulesResult = await query(
    `SELECT * FROM tax_rules
     WHERE tenant_id = $1 AND is_active = true
     ORDER BY priority DESC`,
    [auth.tenantId]
  )

  const taxRules = taxRulesResult.success ? taxRulesResult.data.map(rule => ({
    ...rule,
    method: typeof rule.method === 'string' ? JSON.parse(rule.method) : rule.method,
    appliesTo: typeof rule.applies_to === 'string' ? JSON.parse(rule.applies_to) : rule.applies_to
  })) : []

  // Build tag filter
  const tagFilter = tagIds.length > 0
    ? `AND EXISTS (
        SELECT 1 FROM booking_tags bt
        WHERE bt.booking_id = b.id
        AND bt.tag_id = ANY($4::uuid[])
      )`
    : ''

  const queryParams = tagIds.length > 0
    ? [auth.tenantId, fromDate, toDate, tagIds]
    : [auth.tenantId, fromDate, toDate]

  // Get summary data - FIXED: Total rent should be total booking amount
  const summaryResult = await query(
    `WITH booking_totals AS (
      -- First, get the total amount per booking to avoid multiplication
      SELECT DISTINCT
        b.id,
        b.total_amount,
        b.arrival
      FROM bookings b
      WHERE b.tenant_id = $1
        AND b.arrival >= $2
        AND b.arrival <= $3
        AND b.status != 'canceled'
        ${tagFilter}
    ),
    tax_totals AS (
      -- Then sum taxes separately
      SELECT
        b.id as booking_id,
        SUM(bc.amount) as tax_total
      FROM bookings b
      JOIN booking_charges bc ON b.id = bc.booking_id
      WHERE b.tenant_id = $1
        AND b.arrival >= $2
        AND b.arrival <= $3
        AND b.status != 'canceled'
        AND bc.type = 'tax'
        ${tagFilter}
      GROUP BY b.id
    )
    SELECT
      COALESCE(SUM(bt.total_amount), 0) as total_rent,
      COALESCE(SUM(tt.tax_total), 0) as total_tax,
      COUNT(DISTINCT bt.id) as total_bookings
    FROM booking_totals bt
    LEFT JOIN tax_totals tt ON bt.id = tt.booking_id`,
    queryParams
  )

  // Get property breakdown
  const propertyResult = await query(
    `WITH property_bookings AS (
      SELECT DISTINCT
        p.id as property_id,
        p.name as property_name,
        b.id as booking_id,
        b.total_amount
      FROM properties p
      JOIN bookings b ON p.id = b.property_id
      WHERE b.tenant_id = $1
        AND b.arrival >= $2
        AND b.arrival <= $3
        AND b.status != 'canceled'
        ${tagFilter}
    ),
    property_taxes AS (
      SELECT
        pb.property_id,
        pb.property_name,
        SUM(bc.amount) as total_tax
      FROM property_bookings pb
      JOIN booking_charges bc ON pb.booking_id = bc.booking_id
      WHERE bc.type = 'tax'
      GROUP BY pb.property_id, pb.property_name
    )
    SELECT
      pb.property_id,
      pb.property_name,
      COALESCE(SUM(pb.total_amount), 0) as total_rent,
      COALESCE(pt.total_tax, 0) as total_tax,
      COUNT(DISTINCT pb.booking_id) as booking_count
    FROM property_bookings pb
    LEFT JOIN property_taxes pt ON pb.property_id = pt.property_id
    GROUP BY pb.property_id, pb.property_name, pt.total_tax
    HAVING COUNT(DISTINCT pb.booking_id) > 0
    ORDER BY total_rent DESC`,
    queryParams
  )

  // Get monthly breakdown
  const monthlyResult = await query(
    `WITH monthly_bookings AS (
      SELECT DISTINCT
        TO_CHAR(b.arrival, 'YYYY-MM') as month,
        b.id,
        b.total_amount
      FROM bookings b
      WHERE b.tenant_id = $1
        AND b.arrival >= $2
        AND b.arrival <= $3
        AND b.status != 'canceled'
        ${tagFilter}
    ),
    monthly_taxes AS (
      SELECT
        TO_CHAR(b.arrival, 'YYYY-MM') as month,
        SUM(bc.amount) as total_tax
      FROM bookings b
      JOIN booking_charges bc ON b.id = bc.booking_id
      WHERE b.tenant_id = $1
        AND b.arrival >= $2
        AND b.arrival <= $3
        AND b.status != 'canceled'
        AND bc.type = 'tax'
        ${tagFilter}
      GROUP BY TO_CHAR(b.arrival, 'YYYY-MM')
    )
    SELECT
      mb.month,
      COALESCE(SUM(mb.total_amount), 0) as total_rent,
      COALESCE(mt.total_tax, 0) as total_tax,
      COUNT(DISTINCT mb.id) as booking_count
    FROM monthly_bookings mb
    LEFT JOIN monthly_taxes mt ON mb.month = mt.month
    GROUP BY mb.month, mt.total_tax
    ORDER BY mb.month`,
    queryParams
  )

  if (!summaryResult.success || !propertyResult.success || !monthlyResult.success) {
    context.error('Tax report failed:', {
      summary: !summaryResult.success ? summaryResult.error : 'Success',
      property: !propertyResult.success ? propertyResult.error : 'Success',
      monthly: !monthlyResult.success ? monthlyResult.error : 'Success'
    })
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: {
        status: 'error',
        error: 'Failed to generate tax report'
      }
    }
  }

  const summaryData = summaryResult.data[0] || {
    total_tax: '0',
    total_rent: '0',
    total_bookings: '0'
  }

  const totalRent = parseFloat(summaryData.total_rent)
  const totalTax = parseFloat(summaryData.total_tax)
  const effectiveRate = totalRent > 0 ? totalTax / totalRent : 0

  const data = {
    summary: {
      totalTax,
      totalRent,
      totalBookings: parseInt(summaryData.total_bookings),
      dateRange: { from: fromDate, to: toDate },
      effectiveRate
    },
    byProperty: propertyResult.data.map(row => ({
      propertyId: row.property_id,
      propertyName: row.property_name,
      totalTax: parseFloat(row.total_tax),
      totalRent: parseFloat(row.total_rent),
      bookingCount: parseInt(row.booking_count),
      taxRate: parseFloat(row.total_rent) > 0
        ? parseFloat(row.total_tax) / parseFloat(row.total_rent)
        : 0
    })),
    byMonth: monthlyResult.data.map(row => ({
      month: row.month,
      totalTax: parseFloat(row.total_tax),
      totalRent: parseFloat(row.total_rent),
      bookingCount: parseInt(row.booking_count),
      effectiveRate: parseFloat(row.total_rent) > 0
        ? parseFloat(row.total_tax) / parseFloat(row.total_rent)
        : 0
    }))
  }

  return {
    status: 200,
    headers: corsHeaders(),
    jsonBody: {
      status: 'success',
      data
    }
  }
}

app.http('tax-report', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: taxReport
})
