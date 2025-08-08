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

const buildTagFilter = (tagIds: readonly string[], tableAlias?: string): string => {
  if (tagIds.length === 0) return ''

  const table = tableAlias ? `${tableAlias}.` : ''
  return `AND EXISTS (
    SELECT 1 FROM booking_tags bt
    WHERE bt.booking_id = ${table}id
    AND bt.tag_id = ANY($4::uuid[])
  )`
}

const buildQueryParams = (params: QueryParams): any[] =>
  params.tagIds.length > 0
    ? [params.tenantId, params.fromDate, params.toDate, params.tagIds]
    : [params.tenantId, params.fromDate, params.toDate]

const fetchRevenueSummary = async (params: QueryParams): Promise<DbResult<{
  gross_revenue: string
  total_taxes: string
  total_fees: string
}>> => {
  const tagFilter = buildTagFilter(params.tagIds, 'b')
  const queryParams = buildQueryParams(params)

  const result = await query<{
    gross_revenue: string
    total_taxes: string
    total_fees: string
  }>(
    `WITH platform_fee_lookup AS (
      SELECT DISTINCT ON (platform_name)
        platform_name,
        fee_type,
        fee_value
      FROM platform_fees
      WHERE (tenant_id = $1 OR tenant_id = '00000000-0000-0000-0000-000000000000')
        AND is_active = true
        AND effective_from <= $3::date
        AND (effective_to IS NULL OR effective_to >= $2::date)
      ORDER BY platform_name, tenant_id DESC, effective_from DESC
    ),
    booking_summary AS (
      SELECT
        b.id,
        b.total_amount,
        b.platform,
        -- Normalize platform for fee lookup
        LOWER(
          CASE
            WHEN b.platform IS NULL OR b.platform = '' THEN 'direct'
            WHEN LOWER(b.platform) LIKE '%direct%' THEN 'direct'
            WHEN LOWER(b.platform) LIKE '%airbnb%' THEN 'airbnb'
            WHEN LOWER(b.platform) LIKE '%vrbo%' OR LOWER(b.platform) LIKE '%homeaway%' THEN 'vrbo'
            WHEN LOWER(b.platform) LIKE '%booking.com%' OR LOWER(b.platform) LIKE '%booking%' THEN 'booking.com'
            ELSE LOWER(b.platform)  -- Keep original platform name for fee lookup
          END
        ) as platform_key
      FROM bookings b
      WHERE b.tenant_id = $1
        AND b.arrival >= $2
        AND b.arrival <= $3
        AND b.status != 'canceled'
        ${tagFilter}
    ),
    tax_summary AS (
      SELECT
        booking_id,
        SUM(amount) as tax_total
      FROM booking_charges
      WHERE type = 'tax'
      GROUP BY booking_id
    )
    SELECT
      COALESCE(SUM(bs.total_amount), 0) as gross_revenue,
      COALESCE(SUM(ts.tax_total), 0) as total_taxes,
      COALESCE(SUM(
        CASE
          WHEN pf.fee_type = 'percentage' THEN bs.total_amount * pf.fee_value
          WHEN pf.fee_type = 'flat' THEN pf.fee_value
          ELSE
            -- Default fees only for known platforms if not configured
            CASE
              WHEN bs.platform_key = 'airbnb' THEN bs.total_amount * 0.03
              WHEN bs.platform_key = 'vrbo' THEN bs.total_amount * 0.05
              WHEN bs.platform_key = 'booking.com' THEN bs.total_amount * 0.15
              ELSE 0  -- Unknown platforms default to 0% unless configured
            END
        END
      ), 0) as total_fees
    FROM booking_summary bs
    LEFT JOIN tax_summary ts ON bs.id = ts.booking_id
    LEFT JOIN platform_fee_lookup pf ON bs.platform_key = pf.platform_name`,
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
      CASE
        WHEN platform IS NULL OR platform = '' THEN 'Direct'
        WHEN LOWER(platform) LIKE '%direct%' THEN 'Direct'
        WHEN LOWER(platform) LIKE '%airbnb%' THEN 'Airbnb'
        WHEN LOWER(platform) LIKE '%vrbo%' OR LOWER(platform) LIKE '%homeaway%' THEN 'VRBO'
        WHEN LOWER(platform) LIKE '%booking.com%' OR LOWER(platform) LIKE '%booking%' THEN 'Booking.com'
        ELSE platform  -- Keep original platform name
      END as platform,
      SUM(total_amount) as revenue
    FROM bookings
    WHERE tenant_id = $1
      AND arrival >= $2
      AND arrival <= $3
      AND status != 'canceled'
      ${tagFilter}
    GROUP BY
      CASE
        WHEN platform IS NULL OR platform = '' THEN 'Direct'
        WHEN LOWER(platform) LIKE '%direct%' THEN 'Direct'
        WHEN LOWER(platform) LIKE '%airbnb%' THEN 'Airbnb'
        WHEN LOWER(platform) LIKE '%vrbo%' OR LOWER(platform) LIKE '%homeaway%' THEN 'VRBO'
        WHEN LOWER(platform) LIKE '%booking.com%' OR LOWER(platform) LIKE '%booking%' THEN 'Booking.com'
        ELSE platform
      END
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
