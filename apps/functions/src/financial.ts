import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { query, DbResult } from './services/database'
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth'
import { safeDivide, calculatePercentage } from '@baileys/utils'

// ============================================
// Type Definitions
// ============================================

type UnifiedFinancialResponse = {
  pl: PLData
  revenue: RevenueData
  cashflow: CashflowData
  tax: TaxData
  metadata: {
    dateRange: { from: string; to: string }
    generatedAt: string
  }
}

type PLData = {
  metrics: FinancialMetrics
  platforms: PlatformFinancials[]
  monthlyTrend: MonthlyTrend[]
  weeklyRevenue: WeeklyRevenue[]
  previousPeriod?: {
    revenue: { gross: number; net: number }
    performance: { netRevenueRate: number }
  }
}

type RevenueData = {
  gross: number
  net: number
  taxes: number
  fees: number
  bySource: SourceRevenue[]
  byMonth: MonthlyRevenue[]
  lastYearData?: {
    gross: number
    net: number
  }
}

type CashflowData = {
  collected: number
  pending: number
  collectionRate: number
  upcoming: {
    next30Days: number
    next60Days: number
    next90Days: number
  }
}

type TaxData = {
  summary: {
    totalTax: number
    totalRent: number
    totalBookings: number
    effectiveRate: number
  }
  byProperty: PropertyTaxData[]
  byMonth: MonthlyTaxData[]
}

type FinancialMetrics = {
  revenue: {
    gross: number
    net: number
    pending: number
    collected: number
    platformFees: number
    taxes: number
  }
  performance: {
    netRevenueRate: number
    avgBookingValue: number
    totalBookings: number
  }
  upcoming: {
    next30Days: number
    next60Days: number
    next90Days: number
  }
  kpis: {
    revpar: number
    adr: number
    collectionRate: number
  }
}

type PlatformFinancials = {
  platform: string
  grossRevenue: number
  fees: number
  netRevenue: number
  feeRate: number
  bookingCount: number
}

type MonthlyTrend = {
  month: string
  revenue: number
  bookings: number
  avgBookingValue: number
}

type WeeklyRevenue = {
  week: string
  revenue: number
  bookings: number
}

type SourceRevenue = {
  source: string
  amount: number
}

type MonthlyRevenue = {
  month: string
  amount: number
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
  effectiveRate: number
}

// ============================================
// Helper Functions
// ============================================

const buildTagFilter = (tagIds: string[], tableAlias?: string): string => {
  if (tagIds.length === 0) return ''
  const table = tableAlias ? `${tableAlias}.` : ''
  return `AND EXISTS (
    SELECT 1 FROM booking_tags bt
    WHERE bt.booking_id = ${table}id
    AND bt.tag_id = ANY($4::uuid[])
  )`
}

const buildQueryParams = (tenantId: string, fromDate: string, toDate: string, tagIds: string[]): any[] =>
  tagIds.length > 0
    ? [tenantId, fromDate, toDate, tagIds]
    : [tenantId, fromDate, toDate]

// ============================================
// P&L Data Functions
// ============================================

async function getPLData(
  tenantId: string,
  fromDate: string,
  toDate: string,
  tagIds: string[]
): Promise<DbResult<PLData>> {
  const tagFilter = buildTagFilter(tagIds, 'b')
  const queryParams = buildQueryParams(tenantId, fromDate, toDate, tagIds)

  // Main financial metrics query
  const [metricsResult, platformsResult, monthlyResult, weeklyResult, upcomingResult, propertyResult, bookingStatsResult] =
    await Promise.all([
      // Core metrics
      query<{
        gross_revenue: string
        total_fees: string
        total_taxes: string
        pending_revenue: string
        collected_revenue: string
        booking_count: string
      }>(`
        WITH platform_fee_lookup AS (
          SELECT DISTINCT ON (platform_name)
            platform_name, fee_type, fee_value
          FROM platform_fees
          WHERE (tenant_id = $1 OR tenant_id = '00000000-0000-0000-0000-000000000000')
            AND is_active = true
            AND effective_from <= $3::date
            AND (effective_to IS NULL OR effective_to >= $2::date)
          ORDER BY platform_name, tenant_id DESC, effective_from DESC
        ),
        booking_data AS (
          SELECT
            b.id, b.total_amount, b.arrival, b.platform,
            LOWER(
              CASE
                WHEN b.platform IS NULL OR b.platform = '' THEN 'direct'
                WHEN LOWER(b.platform) LIKE '%direct%' THEN 'direct'
                WHEN LOWER(b.platform) LIKE '%airbnb%' THEN 'airbnb'
                WHEN LOWER(b.platform) LIKE '%vrbo%' OR LOWER(b.platform) LIKE '%homeaway%' THEN 'vrbo'
                WHEN LOWER(b.platform) LIKE '%booking.com%' OR LOWER(b.platform) LIKE '%booking%' THEN 'booking.com'
                ELSE LOWER(b.platform)
              END
            ) as platform_key
          FROM bookings b
          WHERE b.tenant_id = $1
            AND b.arrival >= $2::date
            AND b.arrival <= $3::date
            AND b.status != 'canceled'
            ${tagFilter}
        ),
        fee_calc AS (
          SELECT
            bd.id, bd.total_amount, bd.arrival,
            COALESCE(
              CASE
                WHEN pf.fee_type = 'percentage' THEN bd.total_amount * pf.fee_value
                WHEN pf.fee_type = 'flat' THEN pf.fee_value
                ELSE
                  CASE
                    WHEN bd.platform_key = 'airbnb' THEN bd.total_amount * 0.03
                    WHEN bd.platform_key = 'vrbo' THEN bd.total_amount * 0.05
                    WHEN bd.platform_key = 'booking.com' THEN bd.total_amount * 0.15
                    ELSE 0
                  END
              END, 0
            ) as platform_fee
          FROM booking_data bd
          LEFT JOIN platform_fee_lookup pf ON bd.platform_key = pf.platform_name
        ),
        tax_data AS (
          SELECT bd.id, COALESCE(SUM(bc.amount), 0) as tax_amount
          FROM booking_data bd
          LEFT JOIN booking_charges bc ON bd.id = bc.booking_id AND bc.type = 'tax'
          GROUP BY bd.id
        )
        SELECT
          COALESCE(SUM(fc.total_amount), 0)::text as gross_revenue,
          COALESCE(SUM(fc.platform_fee), 0)::text as total_fees,
          COALESCE(SUM(td.tax_amount), 0)::text as total_taxes,
          COALESCE(SUM(CASE WHEN fc.arrival > CURRENT_DATE THEN fc.total_amount ELSE 0 END), 0)::text as pending_revenue,
          COALESCE(SUM(CASE WHEN fc.arrival <= CURRENT_DATE THEN fc.total_amount ELSE 0 END), 0)::text as collected_revenue,
          COUNT(*)::text as booking_count
        FROM fee_calc fc
        LEFT JOIN tax_data td ON fc.id = td.id`,
        queryParams
      ),

      // Platform breakdown
      getPlatformFinancials(tenantId, fromDate, toDate, tagIds),

      // Monthly trend
      getMonthlyTrend(tenantId, fromDate, toDate, tagIds),

      // Weekly revenue
      getWeeklyRevenue(tenantId, fromDate, toDate, tagIds),

      // Upcoming revenue
      getUpcomingRevenue(tenantId, tagIds),

      // Property count
      query<{ count: string }>(
        'SELECT COUNT(*)::text as count FROM properties WHERE tenant_id = $1 AND active = true',
        [tenantId]
      ),

      // Nights booked
      query<{ nights_booked: string }>(
        `SELECT COUNT(DISTINCT (booking_date))::text as nights_booked
        FROM bookings b
        CROSS JOIN LATERAL generate_series(
          b.arrival::date,
          b.departure::date - interval '1 day',
          interval '1 day'
        ) AS booking_date
        WHERE b.tenant_id = $1
          AND b.arrival >= $2::date
          AND b.departure <= $3::date
          AND b.status != 'canceled'
          ${tagFilter}`,
        queryParams
      )
    ])

  if (!metricsResult.success) {
    return { success: false, error: 'Failed to fetch P&L metrics' }
  }

  const revenue = metricsResult.data[0]
  const grossRevenue = parseFloat(revenue.gross_revenue)
  const platformFees = parseFloat(revenue.total_fees)
  const taxes = parseFloat(revenue.total_taxes)
  const netRevenue = grossRevenue - platformFees - taxes
  const pendingRevenue = parseFloat(revenue.pending_revenue)
  const collectedRevenue = parseFloat(revenue.collected_revenue)
  const bookingCount = parseInt(revenue.booking_count)

  // Calculate KPIs
  const propertyCount = propertyResult.success ? parseInt(propertyResult.data[0].count) : 1
  const daysInPeriod = Math.ceil(
    (new Date(toDate).getTime() - new Date(fromDate).getTime()) / (1000 * 60 * 60 * 24)
  ) + 1
  const availableRoomNights = propertyCount * daysInPeriod
  const nightsBooked = bookingStatsResult.success ? parseInt(bookingStatsResult.data[0].nights_booked) : 0

  // Get previous period data
  const previousPeriod = await getPreviousPeriodMetrics(tenantId, fromDate, toDate)

  const metrics: FinancialMetrics = {
    revenue: {
      gross: grossRevenue,
      net: netRevenue,
      pending: pendingRevenue,
      collected: collectedRevenue,
      platformFees,
      taxes
    },
    performance: {
      netRevenueRate: calculatePercentage(netRevenue, grossRevenue),
      avgBookingValue: safeDivide(grossRevenue, bookingCount, 0),
      totalBookings: bookingCount
    },
    upcoming: upcomingResult.success ? upcomingResult.data : {
      next30Days: 0,
      next60Days: 0,
      next90Days: 0
    },
    kpis: {
      revpar: safeDivide(grossRevenue, availableRoomNights, 0),
      adr: safeDivide(grossRevenue, nightsBooked, 0),
      collectionRate: calculatePercentage(collectedRevenue, grossRevenue)
    }
  }

  return {
    success: true,
    data: {
      metrics,
      platforms: platformsResult.success ? platformsResult.data : [],
      monthlyTrend: monthlyResult.success ? monthlyResult.data : [],
      weeklyRevenue: weeklyResult.success ? weeklyResult.data : [],
      previousPeriod
    }
  }
}

async function getPlatformFinancials(
  tenantId: string,
  fromDate: string,
  toDate: string,
  tagIds: string[]
): Promise<DbResult<PlatformFinancials[]>> {
  const tagFilter = buildTagFilter(tagIds, 'bookings')
  const queryParams = buildQueryParams(tenantId, fromDate, toDate, tagIds)

  const result = await query<{
    platform: string
    booking_count: string
    gross_revenue: string
    total_fees: string
  }>(`
    WITH platform_summary AS (
      SELECT
        COALESCE(
          CASE
            WHEN platform IS NULL OR platform = '' THEN 'Direct'
            WHEN LOWER(platform) LIKE '%direct%' THEN 'Direct'
            WHEN LOWER(platform) LIKE '%airbnb%' THEN 'Airbnb'
            WHEN LOWER(platform) LIKE '%vrbo%' OR LOWER(platform) LIKE '%homeaway%' THEN 'VRBO'
            WHEN LOWER(platform) LIKE '%booking.com%' THEN 'Booking.com'
            ELSE platform
          END,
          'Direct'
        ) as platform,
        COUNT(*) as booking_count,
        SUM(total_amount) as gross_revenue
      FROM bookings
      WHERE tenant_id = $1
        AND arrival >= $2::date
        AND arrival <= $3::date
        AND status != 'canceled'
        ${tagFilter}
      GROUP BY
        CASE
          WHEN platform IS NULL OR platform = '' THEN 'Direct'
          WHEN LOWER(platform) LIKE '%direct%' THEN 'Direct'
          WHEN LOWER(platform) LIKE '%airbnb%' THEN 'Airbnb'
          WHEN LOWER(platform) LIKE '%vrbo%' OR LOWER(platform) LIKE '%homeaway%' THEN 'VRBO'
          WHEN LOWER(platform) LIKE '%booking.com%' THEN 'Booking.com'
          ELSE platform
        END
    ),
    platform_fees AS (
      SELECT DISTINCT ON (platform_name)
        platform_name, fee_type, fee_value
      FROM platform_fees
      WHERE (tenant_id = $1 OR tenant_id = '00000000-0000-0000-0000-000000000000')
        AND is_active = true
        AND effective_from <= $3::date
        AND (effective_to IS NULL OR effective_to >= $2::date)
      ORDER BY platform_name, tenant_id DESC, effective_from DESC
    )
    SELECT
      ps.platform,
      ps.booking_count::text,
      ps.gross_revenue::text,
      COALESCE(
        CASE
          WHEN pf.fee_type = 'percentage' THEN ps.gross_revenue * pf.fee_value
          WHEN pf.fee_type = 'flat' THEN pf.fee_value * ps.booking_count
          ELSE
            CASE
              WHEN LOWER(ps.platform) LIKE '%airbnb%' THEN ps.gross_revenue * 0.03
              WHEN LOWER(ps.platform) LIKE '%vrbo%' THEN ps.gross_revenue * 0.05
              WHEN LOWER(ps.platform) LIKE '%booking.com%' THEN ps.gross_revenue * 0.15
              WHEN LOWER(ps.platform) = 'direct' THEN 0
              ELSE 0
            END
        END,
        0
      )::text as total_fees
    FROM platform_summary ps
    LEFT JOIN platform_fees pf ON LOWER(ps.platform) = LOWER(pf.platform_name)
    ORDER BY ps.gross_revenue DESC`,
    queryParams
  )

  if (!result.success) return result

  const platforms = result.data.map(row => {
    const grossRevenue = parseFloat(row.gross_revenue)
    const fees = parseFloat(row.total_fees)
    const bookingCount = parseInt(row.booking_count)

    return {
      platform: row.platform,
      grossRevenue,
      fees,
      netRevenue: grossRevenue - fees,
      feeRate: grossRevenue > 0 ? (fees / grossRevenue) * 100 : 0,
      bookingCount
    }
  })

  return { success: true, data: platforms }
}

async function getMonthlyTrend(
  tenantId: string,
  fromDate: string,
  toDate: string,
  tagIds: string[]
): Promise<DbResult<MonthlyTrend[]>> {
  const tagFilter = buildTagFilter(tagIds, 'bookings')
  const queryParams = buildQueryParams(tenantId, fromDate, toDate, tagIds)

  const result = await query<{
    month: string
    revenue: string
    bookings: string
  }>(`
    SELECT
      TO_CHAR(DATE_TRUNC('month', arrival), 'Mon YY') as month,
      SUM(total_amount)::text as revenue,
      COUNT(*)::text as bookings
    FROM bookings
    WHERE tenant_id = $1
      AND arrival >= $2::date
      AND arrival <= $3::date
      AND status != 'canceled'
      ${tagFilter}
    GROUP BY DATE_TRUNC('month', arrival)
    ORDER BY DATE_TRUNC('month', arrival)`,
    queryParams
  )

  if (!result.success) return result

  const monthlyData = result.data.map(row => {
    const revenue = parseFloat(row.revenue)
    const bookings = parseInt(row.bookings)

    return {
      month: row.month,
      revenue,
      bookings,
      avgBookingValue: safeDivide(revenue, bookings, 0)
    }
  })

  return { success: true, data: monthlyData }
}

async function getWeeklyRevenue(
  tenantId: string,
  fromDate: string,
  toDate: string,
  tagIds: string[]
): Promise<DbResult<WeeklyRevenue[]>> {
  const tagFilter = buildTagFilter(tagIds, 'bookings')
  const queryParams = buildQueryParams(tenantId, fromDate, toDate, tagIds)

  const result = await query<{
    week_start: string
    revenue: string
    bookings: string
  }>(`
    SELECT
      TO_CHAR(DATE_TRUNC('week', arrival), 'MM/DD') as week_start,
      SUM(total_amount)::text as revenue,
      COUNT(*)::text as bookings
    FROM bookings
    WHERE tenant_id = $1
      AND arrival >= $2::date
      AND arrival <= $3::date
      AND status != 'canceled'
      ${tagFilter}
    GROUP BY DATE_TRUNC('week', arrival)
    ORDER BY DATE_TRUNC('week', arrival)
    LIMIT 12`,
    queryParams
  )

  if (!result.success) return { success: false, error: 'Failed to get weekly revenue' }

  const weeklyData = result.data.map(row => ({
    week: row.week_start,
    revenue: parseFloat(row.revenue),
    bookings: parseInt(row.bookings)
  }))

  return { success: true, data: weeklyData }
}

async function getUpcomingRevenue(
  tenantId: string,
  tagIds: string[]
): Promise<DbResult<{ next30Days: number; next60Days: number; next90Days: number }>> {
  const tagFilter = tagIds.length > 0 
    ? `AND EXISTS (
        SELECT 1 FROM booking_tags bt
        WHERE bt.booking_id = bookings.id
        AND bt.tag_id = ANY($2::uuid[])
      )`
    : ''
  const queryParams = tagIds.length > 0 ? [tenantId, tagIds] : [tenantId]

  const result = await query<{
    next_30_days: string
    next_60_days: string
    next_90_days: string
  }>(`
    SELECT
      COALESCE(SUM(CASE
        WHEN arrival BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
        THEN total_amount ELSE 0
      END), 0)::text as next_30_days,
      COALESCE(SUM(CASE
        WHEN arrival BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
        THEN total_amount ELSE 0
      END), 0)::text as next_60_days,
      COALESCE(SUM(CASE
        WHEN arrival BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
        THEN total_amount ELSE 0
      END), 0)::text as next_90_days
    FROM bookings
    WHERE tenant_id = $1
      AND arrival >= CURRENT_DATE
      AND status != 'canceled'
      ${tagFilter}`,
    queryParams
  )

  if (!result.success) return { success: false, error: 'Failed to get upcoming revenue' }

  return {
    success: true,
    data: {
      next30Days: parseFloat(result.data[0].next_30_days),
      next60Days: parseFloat(result.data[0].next_60_days),
      next90Days: parseFloat(result.data[0].next_90_days)
    }
  }
}

async function getPreviousPeriodMetrics(
  tenantId: string,
  fromDate: string,
  toDate: string
): Promise<{ revenue: { gross: number; net: number }; performance: { netRevenueRate: number } }> {
  const currentFrom = new Date(fromDate)
  const currentTo = new Date(toDate)
  const periodLength = currentTo.getTime() - currentFrom.getTime()

  const previousTo = new Date(currentFrom.getTime() - 1)
  const previousFrom = new Date(previousTo.getTime() - periodLength)

  const previousFromStr = previousFrom.toISOString().split('T')[0]
  const previousToStr = previousTo.toISOString().split('T')[0]

  const result = await query<{
    gross_revenue: string
    total_fees: string
  }>(`
    WITH platform_fee_calc AS (
      SELECT
        b.total_amount,
        COALESCE(
          CASE
            WHEN LOWER(b.platform) LIKE '%airbnb%' THEN b.total_amount * 0.03
            WHEN LOWER(b.platform) LIKE '%vrbo%' OR LOWER(b.platform) LIKE '%homeaway%' THEN b.total_amount * 0.05
            WHEN LOWER(b.platform) LIKE '%booking.com%' THEN b.total_amount * 0.15
            ELSE 0
          END, 0
        ) as fee
      FROM bookings b
      WHERE b.tenant_id = $1
        AND b.arrival >= $2::date
        AND b.arrival <= $3::date
        AND b.status != 'canceled'
    )
    SELECT
      COALESCE(SUM(total_amount), 0)::text as gross_revenue,
      COALESCE(SUM(fee), 0)::text as total_fees
    FROM platform_fee_calc`,
    [tenantId, previousFromStr, previousToStr]
  )

  if (result.success && result.data.length > 0) {
    const gross = parseFloat(result.data[0].gross_revenue)
    const fees = parseFloat(result.data[0].total_fees)
    const net = gross - fees

    return {
      revenue: { gross, net },
      performance: { netRevenueRate: gross > 0 ? (net / gross) * 100 : 0 }
    }
  }

  return { revenue: { gross: 0, net: 0 }, performance: { netRevenueRate: 0 } }
}

// ============================================
// Revenue Data Functions
// ============================================

async function getRevenueData(
  tenantId: string,
  fromDate: string,
  toDate: string,
  tagIds: string[]
): Promise<DbResult<RevenueData>> {
  const tagFilter = buildTagFilter(tagIds, 'b')
  const tagFilterNoAlias = buildTagFilter(tagIds, 'bookings')
  const queryParams = buildQueryParams(tenantId, fromDate, toDate, tagIds)

  const [summaryResult, bySourceResult, byMonthResult, lastYearResult] = await Promise.all([
    // Revenue summary
    query<{
      gross_revenue: string
      total_taxes: string
      total_fees: string
    }>(`
      WITH platform_fee_lookup AS (
        SELECT DISTINCT ON (platform_name)
          platform_name, fee_type, fee_value
        FROM platform_fees
        WHERE (tenant_id = $1 OR tenant_id = '00000000-0000-0000-0000-000000000000')
          AND is_active = true
          AND effective_from <= $3::date
          AND (effective_to IS NULL OR effective_to >= $2::date)
        ORDER BY platform_name, tenant_id DESC, effective_from DESC
      ),
      booking_summary AS (
        SELECT
          b.id, b.total_amount, b.platform,
          LOWER(
            CASE
              WHEN b.platform IS NULL OR b.platform = '' THEN 'direct'
              WHEN LOWER(b.platform) LIKE '%direct%' THEN 'direct'
              WHEN LOWER(b.platform) LIKE '%airbnb%' THEN 'airbnb'
              WHEN LOWER(b.platform) LIKE '%vrbo%' OR LOWER(b.platform) LIKE '%homeaway%' THEN 'vrbo'
              WHEN LOWER(b.platform) LIKE '%booking.com%' OR LOWER(b.platform) LIKE '%booking%' THEN 'booking.com'
              ELSE LOWER(b.platform)
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
        SELECT booking_id, SUM(amount) as tax_total
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
              CASE
                WHEN bs.platform_key = 'airbnb' THEN bs.total_amount * 0.03
                WHEN bs.platform_key = 'vrbo' THEN bs.total_amount * 0.05
                WHEN bs.platform_key = 'booking.com' THEN bs.total_amount * 0.15
                ELSE 0
              END
          END
        ), 0) as total_fees
      FROM booking_summary bs
      LEFT JOIN tax_summary ts ON bs.id = ts.booking_id
      LEFT JOIN platform_fee_lookup pf ON bs.platform_key = pf.platform_name`,
      queryParams
    ),

    // Revenue by source
    query<{
      platform: string
      revenue: string
    }>(`
      SELECT
        CASE
          WHEN platform IS NULL OR platform = '' THEN 'Direct'
          WHEN LOWER(platform) LIKE '%direct%' THEN 'Direct'
          WHEN LOWER(platform) LIKE '%airbnb%' THEN 'Airbnb'
          WHEN LOWER(platform) LIKE '%vrbo%' OR LOWER(platform) LIKE '%homeaway%' THEN 'VRBO'
          WHEN LOWER(platform) LIKE '%booking.com%' OR LOWER(platform) LIKE '%booking%' THEN 'Booking.com'
          ELSE platform
        END as platform,
        SUM(total_amount) as revenue
      FROM bookings
      WHERE tenant_id = $1
        AND arrival >= $2
        AND arrival <= $3
        AND status != 'canceled'
        ${tagFilterNoAlias}
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
    ),

    // Revenue by month
    query<{
      month: string
      revenue: string
    }>(`
      SELECT
        TO_CHAR(arrival, 'YYYY-MM') as month,
        SUM(total_amount) as revenue
      FROM bookings
      WHERE tenant_id = $1
        AND arrival >= $2
        AND arrival <= $3
        AND status != 'canceled'
        ${tagFilterNoAlias}
      GROUP BY TO_CHAR(arrival, 'YYYY-MM')
      ORDER BY month`,
      queryParams
    ),

    // Last year comparison
    getLastYearRevenue(tenantId, fromDate, toDate, tagIds)
  ])

  if (!summaryResult.success) {
    return { success: false, error: 'Failed to fetch revenue data' }
  }

  const summary = summaryResult.data[0] || { gross_revenue: '0', total_taxes: '0', total_fees: '0' }
  const gross = parseFloat(summary.gross_revenue)
  const taxes = parseFloat(summary.total_taxes)
  const fees = parseFloat(summary.total_fees)

  return {
    success: true,
    data: {
      gross,
      net: gross - taxes - fees,
      taxes,
      fees,
      bySource: bySourceResult.success
        ? bySourceResult.data.map(row => ({
            source: row.platform,
            amount: parseFloat(row.revenue)
          }))
        : [],
      byMonth: byMonthResult.success
        ? byMonthResult.data.map(row => ({
            month: row.month,
            amount: parseFloat(row.revenue)
          }))
        : [],
      lastYearData: lastYearResult
    }
  }
}

async function getLastYearRevenue(
  tenantId: string,
  fromDate: string,
  toDate: string,
  tagIds: string[]
): Promise<{ gross: number; net: number } | undefined> {
  const currentFrom = new Date(fromDate)
  const currentTo = new Date(toDate)

  const lastYearFrom = new Date(currentFrom)
  lastYearFrom.setFullYear(lastYearFrom.getFullYear() - 1)

  const lastYearTo = new Date(currentTo)
  lastYearTo.setFullYear(lastYearTo.getFullYear() - 1)

  const tagFilter = buildTagFilter(tagIds, 'bookings')
  const queryParams = buildQueryParams(
    tenantId,
    lastYearFrom.toISOString().split('T')[0],
    lastYearTo.toISOString().split('T')[0],
    tagIds
  )

  const result = await query<{
    gross_revenue: string
    total_fees: string
    total_taxes: string
  }>(`
    SELECT
      COALESCE(SUM(total_amount), 0) as gross_revenue,
      COALESCE(SUM(
        CASE
          WHEN LOWER(platform) LIKE '%airbnb%' THEN total_amount * 0.03
          WHEN LOWER(platform) LIKE '%vrbo%' OR LOWER(platform) LIKE '%homeaway%' THEN total_amount * 0.05
          WHEN LOWER(platform) LIKE '%booking.com%' THEN total_amount * 0.15
          ELSE 0
        END
      ), 0) as total_fees,
      COALESCE(SUM(
        (SELECT SUM(amount) FROM booking_charges WHERE booking_id = bookings.id AND type = 'tax')
      ), 0) as total_taxes
    FROM bookings
    WHERE tenant_id = $1
      AND arrival >= $2
      AND arrival <= $3
      AND status != 'canceled'
      ${tagFilter}`,
    queryParams
  )

  if (result.success && result.data.length > 0) {
    const gross = parseFloat(result.data[0].gross_revenue)
    const fees = parseFloat(result.data[0].total_fees)
    const taxes = parseFloat(result.data[0].total_taxes)
    return { gross, net: gross - fees - taxes }
  }

  return undefined
}

// ============================================
// Tax Data Functions
// ============================================

async function getTaxData(
  tenantId: string,
  fromDate: string,
  toDate: string,
  tagIds: string[]
): Promise<DbResult<TaxData>> {
  const tagFilter = buildTagFilter(tagIds, 'b')
  const queryParams = buildQueryParams(tenantId, fromDate, toDate, tagIds)

  const [summaryResult, propertyResult, monthlyResult] = await Promise.all([
    // Tax summary
    query<{
      total_rent: string
      total_tax: string
      total_bookings: string
    }>(`
      WITH booking_totals AS (
        SELECT DISTINCT
          b.id, b.total_amount, b.arrival
        FROM bookings b
        WHERE b.tenant_id = $1
          AND b.arrival >= $2
          AND b.arrival <= $3
          AND b.status != 'canceled'
          ${tagFilter}
      ),
      tax_totals AS (
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
    ),

    // Property breakdown
    query<{
      property_id: string
      property_name: string
      total_rent: string
      total_tax: string
      booking_count: string
    }>(`
      WITH property_bookings AS (
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
    ),

    // Monthly breakdown
    query<{
      month: string
      total_rent: string
      total_tax: string
      booking_count: string
    }>(`
      WITH monthly_bookings AS (
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
  ])

  if (!summaryResult.success || !propertyResult.success || !monthlyResult.success) {
    return { success: false, error: 'Failed to fetch tax data' }
  }

  const summaryData = summaryResult.data[0] || {
    total_tax: '0',
    total_rent: '0',
    total_bookings: '0'
  }

  const totalRent = parseFloat(summaryData.total_rent)
  const totalTax = parseFloat(summaryData.total_tax)
  const effectiveRate = totalRent > 0 ? totalTax / totalRent : 0

  return {
    success: true,
    data: {
      summary: {
        totalTax,
        totalRent,
        totalBookings: parseInt(summaryData.total_bookings),
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
  }
}

// ============================================
// Main Handler
// ============================================

export async function getUnifiedFinancials(
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

  try {
    // Parse query parameters
    const fromDate = request.query.get('from') ||
      new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
    const toDate = request.query.get('to') ||
      new Date().toISOString().split('T')[0]
    const tagIds = request.query.get('tags')?.split(',').filter(Boolean) || []

    // Fetch all data in parallel
    const [plResult, revenueResult, taxResult] = await Promise.all([
      getPLData(auth.tenantId, fromDate, toDate, tagIds),
      getRevenueData(auth.tenantId, fromDate, toDate, tagIds),
      getTaxData(auth.tenantId, fromDate, toDate, tagIds)
    ])

    if (!plResult.success || !revenueResult.success || !taxResult.success) {
      context.error('Failed to fetch unified financials:', {
        pl: plResult.success ? 'Success' : plResult.error,
        revenue: revenueResult.success ? 'Success' : revenueResult.error,
        tax: taxResult.success ? 'Success' : taxResult.error
      })

      return {
        status: 500,
        headers: corsHeaders(),
        jsonBody: {
          error: 'Failed to fetch financial data',
          details: {
            pl: !plResult.success ? plResult.error : null,
            revenue: !revenueResult.success ? revenueResult.error : null,
            tax: !taxResult.success ? taxResult.error : null
          }
        }
      }
    }

    // Build cashflow data from P&L metrics
    const cashflowData: CashflowData = {
      collected: plResult.data.metrics.revenue.collected,
      pending: plResult.data.metrics.revenue.pending,
      collectionRate: plResult.data.metrics.kpis.collectionRate,
      upcoming: plResult.data.metrics.upcoming
    }

    // Build unified response
    const response: UnifiedFinancialResponse = {
      pl: plResult.data,
      revenue: revenueResult.data,
      cashflow: cashflowData,
      tax: taxResult.data,
      metadata: {
        dateRange: { from: fromDate, to: toDate },
        generatedAt: new Date().toISOString()
      }
    }

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: response
    }
  } catch (error) {
    context.error('Unified financials error:', error)
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: {
        error: error instanceof Error ? error.message : 'Failed to fetch financial data'
      }
    }
  }
}

app.http('financial', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: getUnifiedFinancials
})
