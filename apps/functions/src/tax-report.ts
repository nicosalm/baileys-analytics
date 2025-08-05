import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { query, DbResult } from './services/database';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';

type TaxReportState =
  | { status: 'loading' }
  | { status: 'success'; data: TaxReportData }
  | { status: 'error'; error: string }

type TaxReportData = {
  summary: TaxSummary
  byProperty: readonly PropertyTaxData[]
  byMonth: readonly MonthlyTaxData[]
}

type TaxSummary = {
  totalTax: number
  totalRent: number
  totalBookings: number
  dateRange: DateRange
}

type PropertyTaxData = {
  propertyId: string
  propertyName: string
  totalTax: number
  totalRent: number
  bookingCount: number
  taxRate: number
}

type MonthlyTaxData = {
  month: string
  totalTax: number
  totalRent: number
  bookingCount: number
}

type DateRange = {
  from: string
  to: string
}

type QueryParams = {
  tenantId: string
  fromDate: string
  toDate: string
  tagIds: readonly string[]
}

const parseQueryParams = (request: HttpRequest, tenantId: string): QueryParams => ({
  tenantId,
  fromDate: request.query.get('from') || '2024-01-01',
  toDate: request.query.get('to') || '2024-12-31',
  tagIds: request.query.get('tags')?.split(',').filter(Boolean) || []
})

const buildTagFilter = (tagIds: readonly string[]): string =>
  tagIds.length > 0
    ? `AND EXISTS (
        SELECT 1 FROM booking_tags bt
        WHERE bt.booking_id = b.id
        AND bt.tag_id = ANY($4::uuid[])
      )`
    : ''

const buildQueryParams = (params: QueryParams): any[] =>
  params.tagIds.length > 0
    ? [params.tenantId, params.fromDate, params.toDate, params.tagIds]
    : [params.tenantId, params.fromDate, params.toDate]

const fetchTaxSummary = async (params: QueryParams): Promise<DbResult<TaxSummary>> => {
  const tagFilter = buildTagFilter(params.tagIds)
  const queryParams = buildQueryParams(params)

  const result = await query<{
    total_tax: string
    total_rent: string
    total_bookings: string
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
      ${tagFilter}`,
    queryParams
  )

  if (!result.success) {
    return result
  }

  const data = result.data[0] || {
    total_tax: '0',
    total_rent: '0',
    total_bookings: '0'
  }

  return {
    success: true,
    data: {
      totalTax: parseFloat(data.total_tax),
      totalRent: parseFloat(data.total_rent),
      totalBookings: parseInt(data.total_bookings),
      dateRange: { from: params.fromDate, to: params.toDate }
    }
  }
}

const fetchPropertyTaxData = async (params: QueryParams): Promise<DbResult<readonly PropertyTaxData[]>> => {
  const tagFilter = buildTagFilter(params.tagIds)
  const queryParams = buildQueryParams(params)

  const result = await query<{
    property_id: string
    property_name: string
    total_tax: string
    total_rent: string
    booking_count: string
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
      ${tagFilter}
    GROUP BY p.id, p.name
    ORDER BY total_tax DESC`,
    queryParams
  )

  if (!result.success) {
    return result
  }

  const data = result.data.map(row => ({
    propertyId: row.property_id,
    propertyName: row.property_name,
    totalTax: parseFloat(row.total_tax),
    totalRent: parseFloat(row.total_rent),
    bookingCount: parseInt(row.booking_count),
    taxRate: parseFloat(row.total_rent) > 0
      ? (parseFloat(row.total_tax) / parseFloat(row.total_rent)) * 100
      : 0
  }))

  return { success: true, data }
}

const fetchMonthlyTaxData = async (params: QueryParams): Promise<DbResult<readonly MonthlyTaxData[]>> => {
  const tagFilter = buildTagFilter(params.tagIds)
  const queryParams = buildQueryParams(params)

  const result = await query<{
    month: string
    total_tax: string
    total_rent: string
    booking_count: string
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
      ${tagFilter}
    GROUP BY TO_CHAR(b.arrival, 'YYYY-MM')
    ORDER BY month`,
    queryParams
  )

  if (!result.success) {
    return result
  }

  const data = result.data.map(row => ({
    month: row.month,
    totalTax: parseFloat(row.total_tax),
    totalRent: parseFloat(row.total_rent),
    bookingCount: parseInt(row.booking_count)
  }))

  return { success: true, data }
}

const fetchTaxReportData = async (params: QueryParams): Promise<DbResult<TaxReportData>> => {
  const [summaryResult, propertyResult, monthlyResult] = await Promise.all([
    fetchTaxSummary(params),
    fetchPropertyTaxData(params),
    fetchMonthlyTaxData(params)
  ])

  if (!summaryResult.success) {
    return { success: false, error: 'Failed to fetch tax summary' }
  }

  return {
    success: true,
    data: {
      summary: summaryResult.data,
      byProperty: propertyResult.success ? propertyResult.data : [],
      byMonth: monthlyResult.success ? monthlyResult.data : []
    }
  }
}

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

  const params = parseQueryParams(request, auth.tenantId)
  const result = await fetchTaxReportData(params)

  if (!result.success) {
    context.error('Tax report failed:', result.error)
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: {
        status: 'error',
        error: result.error
      }
    }
  }

  return {
    status: 200,
    headers: corsHeaders(),
    jsonBody: {
      status: 'success',
      data: result.data
    }
  }
}

app.http('tax-report', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: taxReport
})
