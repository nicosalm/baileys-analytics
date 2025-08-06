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

  // Get summary data
  const summaryResult = await query(
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
      ${tagFilter}`,
    queryParams
  )

  // Get property breakdown
  const propertyResult = await query(
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
      ${tagFilter}
    GROUP BY p.id, p.name
    ORDER BY total_tax DESC`,
    queryParams
  )

  // Get monthly breakdown
  const monthlyResult = await query(
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
      ${tagFilter}
    GROUP BY TO_CHAR(b.arrival, 'YYYY-MM')
    ORDER BY month`,
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
