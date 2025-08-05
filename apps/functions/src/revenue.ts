import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { query, DbResult } from './services/database';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';

type RevenueMetrics = {
  gross: number
  net: number
  taxes: number
  fees: number
  bySource: readonly SourceRevenue[]
  byMonth: readonly MonthlyRevenue[]
}

type SourceRevenue = {
  source: string
  amount: number
}

type MonthlyRevenue = {
  month: string
  amount: number
}

type QueryParams = {
  tenantId: string
  fromDate: string
  toDate: string
  tagIds: readonly string[]
}

const parseQueryParams = (request: HttpRequest, tenantId: string): QueryParams => ({
  tenantId,
  fromDate: request.query.get('from') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
  toDate: request.query.get('to') || new Date().toISOString().split('T')[0],
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

const fetchRevenueSummary = async (params: QueryParams): Promise<DbResult<{
  gross_revenue: string
  total_taxes: string
  total_fees: string
}>> => {
  const tagFilter = buildTagFilter(params.tagIds)
  const queryParams = buildQueryParams(params)

  const result = await query<{
    gross_revenue: string
    total_taxes: string
    total_fees: string
  }>(
    `SELECT
      COALESCE(SUM(b.total_amount), 0) as gross_revenue,
      COALESCE(SUM(CASE WHEN bc.type = 'tax' THEN bc.amount ELSE 0 END), 0) as total_taxes,
      COALESCE(SUM(CASE WHEN bc.type = 'fee' THEN bc.amount ELSE 0 END), 0) as total_fees
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

  if (result.data.length === 0) {
    return {
      success: true,
      data: {
        gross_revenue: '0',
        total_taxes: '0',
        total_fees: '0'
      }
    }
  }

  return { success: true, data: result.data[0] }
}

const fetchRevenueBySource = async (params: QueryParams): Promise<DbResult<readonly {
  platform: string
  revenue: string
}[]>> => {
  const tagFilter = buildTagFilter(params.tagIds)
  const queryParams = buildQueryParams(params)

  return query<{
    platform: string
    revenue: string
  }>(
    `SELECT
      COALESCE(platform, 'Direct') as platform,
      SUM(total_amount) as revenue
    FROM bookings
    WHERE tenant_id = $1
      AND arrival >= $2
      AND arrival <= $3
      AND status != 'canceled'
      ${tagFilter}
    GROUP BY platform
    ORDER BY revenue DESC`,
    queryParams
  )
}

const fetchRevenueByMonth = async (params: QueryParams): Promise<DbResult<readonly {
  month: string
  revenue: string
}[]>> => {
  const tagFilter = buildTagFilter(params.tagIds)
  const queryParams = buildQueryParams(params)

  return query<{
    month: string
    revenue: string
  }>(
    `SELECT
      TO_CHAR(arrival, 'YYYY-MM') as month,
      SUM(total_amount) as revenue
    FROM bookings
    WHERE tenant_id = $1
      AND arrival >= $2
      AND arrival <= $3
      AND status != 'canceled'
      ${tagFilter}
    GROUP BY TO_CHAR(arrival, 'YYYY-MM')
    ORDER BY month`,
    queryParams
  )
}

const calculateMetrics = (
  summary: { gross_revenue: string; total_taxes: string; total_fees: string }
): Omit<RevenueMetrics, 'bySource' | 'byMonth'> => {
  const gross = parseFloat(summary.gross_revenue)
  const taxes = parseFloat(summary.total_taxes)
  const fees = parseFloat(summary.total_fees)

  return {
    gross,
    net: gross - taxes - fees,
    taxes,
    fees
  }
}

const transformSourceRevenue = (
  data: readonly { platform: string; revenue: string }[]
): readonly SourceRevenue[] =>
  data.map(row => ({
    source: row.platform,
    amount: parseFloat(row.revenue)
  }))

const transformMonthlyRevenue = (
  data: readonly { month: string; revenue: string }[]
): readonly MonthlyRevenue[] =>
  data.map(row => ({
    month: row.month,
    amount: parseFloat(row.revenue)
  }))

const fetchRevenueData = async (params: QueryParams): Promise<DbResult<RevenueMetrics>> => {
  const [summaryResult, bySourceResult, byMonthResult] = await Promise.all([
    fetchRevenueSummary(params),
    fetchRevenueBySource(params),
    fetchRevenueByMonth(params)
  ])

  if (!summaryResult.success) {
    return { success: false, error: 'Failed to fetch revenue summary' }
  }

  const metrics = calculateMetrics(summaryResult.data)

  return {
    success: true,
    data: {
      ...metrics,
      bySource: transformSourceRevenue(bySourceResult.success ? bySourceResult.data : []),
      byMonth: transformMonthlyRevenue(byMonthResult.success ? byMonthResult.data : [])
    }
  }
}

export async function getRevenue(
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
  const result = await fetchRevenueData(params)

  if (!result.success) {
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: { error: result.error }
    }
  }

  return {
    status: 200,
    headers: corsHeaders(),
    jsonBody: result.data
  }
}

app.http('revenue', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: getRevenue
})
