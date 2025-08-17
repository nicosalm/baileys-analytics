import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { query, DbResult } from './services/database'
import { corsHeaders, handleOptions } from './middleware/auth'
import { requireAuthWithValidation } from './middleware/validation'
import { financialQuerySchema } from '@baileys/shared-types'
import { safeDivide, calculatePercentage } from '@baileys/utils'
import { formatDateISO, getYear } from './utils/dates'


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
    platformRemitted: number
    ownerRemitted: number
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


async function getPLData(
  tenantId: string,
  fromDate: string,
  toDate: string,
  tagIds: string[]
): Promise<DbResult<PLData>> {
  const tagFilter = buildTagFilter(tagIds, 'b')
  const queryParams = buildQueryParams(tenantId, fromDate, toDate, tagIds)

  const [metricsResult, platformsResult, monthlyResult, weeklyResult, upcomingResult, propertyResult, bookingStatsResult] =
    await Promise.all([
      query<{
        gross_revenue: string
        total_fees: string
        total_taxes: string
        pending_revenue: string
        collected_revenue: string
        booking_count: string
      }>(`
        WITH booking_data AS (
          SELECT
            b.id, 
            b.property_id,
            b.total_amount, 
            b.arrival, 
            b.platform,
            TO_CHAR(b.arrival, 'YYYY-MM') as month,
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
        platform_fees_actual AS (
          SELECT 
            pfe.property_id,
            pfe.month,
            SUM(pfe.guest_service_fee + pfe.host_service_fee) as total_platform_fees,
            SUM(pfe.platform_tax_remitted) as platform_tax_remitted
          FROM platform_fee_entries pfe
          WHERE pfe.tenant_id = $1
            AND pfe.month >= TO_CHAR($2::date, 'YYYY-MM')
            AND pfe.month <= TO_CHAR($3::date, 'YYYY-MM')
          GROUP BY pfe.property_id, pfe.month
        ),
        property_taxes AS (
          SELECT 
            ptc.property_id,
            ptc.jurisdictions,
            COALESCE(
              (SELECT SUM((j->>'rate')::numeric) 
               FROM jsonb_array_elements(ptc.jurisdictions) j), 
              0
            ) as total_tax_rate
          FROM property_tax_configs ptc
          WHERE ptc.tenant_id = $1
            AND ptc.is_active = true
            AND ptc.effective_from <= $3::date
            AND (ptc.effective_to IS NULL OR ptc.effective_to >= $2::date)
        ),
        fee_tax_calc AS (
          SELECT
            bd.id, 
            bd.total_amount, 
            bd.arrival,
            COALESCE(pfa.total_platform_fees, 0) as platform_fee,
            CASE 
              WHEN pt.total_tax_rate IS NOT NULL AND pt.total_tax_rate > 0 THEN 
                -- OwnerRez tax + platform fee tax
                COALESCE((SELECT SUM(amount) FROM booking_charges WHERE booking_id = bd.id AND type = 'tax'), 0) +
                (COALESCE(pfa.total_platform_fees, 0) * (pt.total_tax_rate / 100))
              ELSE 
                COALESCE((SELECT SUM(amount) FROM booking_charges WHERE booking_id = bd.id AND type = 'tax'), 0)
            END as tax_amount,
            COALESCE(pfa.platform_tax_remitted, 0) as platform_tax_remitted
          FROM booking_data bd
          LEFT JOIN platform_fees_actual pfa ON bd.property_id = pfa.property_id AND bd.month = pfa.month
          LEFT JOIN property_taxes pt ON bd.property_id = pt.property_id
        )
        SELECT
          COALESCE(SUM(ftc.total_amount), 0)::text as gross_revenue,
          COALESCE(SUM(ftc.platform_fee), 0)::text as total_fees,
          COALESCE(SUM(ftc.tax_amount), 0)::text as total_taxes,
          COALESCE(SUM(CASE WHEN ftc.arrival > CURRENT_DATE THEN ftc.total_amount ELSE 0 END), 0)::text as pending_revenue,
          COALESCE(SUM(CASE WHEN ftc.arrival <= CURRENT_DATE THEN ftc.total_amount ELSE 0 END), 0)::text as collected_revenue,
          COUNT(*)::text as booking_count
        FROM fee_tax_calc ftc`,
        queryParams
      ),

      getPlatformFinancials(tenantId, fromDate, toDate, tagIds),

      getMonthlyTrend(tenantId, fromDate, toDate, tagIds),

      getWeeklyRevenue(tenantId, fromDate, toDate, tagIds),

      getUpcomingRevenue(tenantId, tagIds),

      query<{ count: string }>(
        'SELECT COUNT(*)::text as count FROM properties WHERE tenant_id = $1 AND active = true',
        [tenantId]
      ),

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

  const propertyCount = propertyResult.success ? parseInt(propertyResult.data[0].count) : 1
  const daysInPeriod = Math.ceil(
    (new Date(toDate).getTime() - new Date(fromDate).getTime()) / (1000 * 60 * 60 * 24)
  ) + 1
  const availableRoomNights = propertyCount * daysInPeriod
  const nightsBooked = bookingStatsResult.success ? parseInt(bookingStatsResult.data[0].nights_booked) : 0

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
            WHEN b.platform IS NULL OR b.platform = '' THEN 'Direct'
            WHEN LOWER(b.platform) LIKE '%direct%' THEN 'Direct'
            WHEN LOWER(b.platform) LIKE '%airbnb%' THEN 'Airbnb'
            WHEN LOWER(b.platform) LIKE '%vrbo%' OR LOWER(b.platform) LIKE '%homeaway%' THEN 'VRBO'
            WHEN LOWER(b.platform) LIKE '%booking.com%' THEN 'Booking.com'
            ELSE b.platform
          END,
          'Direct'
        ) as platform,
        LOWER(
          CASE
            WHEN b.platform IS NULL OR b.platform = '' THEN 'direct'
            WHEN LOWER(b.platform) LIKE '%direct%' THEN 'direct'
            WHEN LOWER(b.platform) LIKE '%airbnb%' THEN 'airbnb'
            WHEN LOWER(b.platform) LIKE '%vrbo%' OR LOWER(b.platform) LIKE '%homeaway%' THEN 'vrbo'
            WHEN LOWER(b.platform) LIKE '%booking.com%' THEN 'booking.com'
            ELSE LOWER(b.platform)
          END
        ) as platform_key,
        COUNT(*) as booking_count,
        SUM(b.total_amount) as gross_revenue,
        STRING_AGG(DISTINCT b.property_id::text, ',') as property_ids,
        STRING_AGG(DISTINCT TO_CHAR(b.arrival, 'YYYY-MM'), ',') as months
      FROM bookings b
      WHERE b.tenant_id = $1
        AND b.arrival >= $2::date
        AND b.arrival <= $3::date
        AND b.status != 'canceled'
        ${tagFilter}
      GROUP BY 1, 2
    ),
    actual_fees AS (
      SELECT 
        LOWER(pfe.platform) as platform_key,
        SUM(pfe.guest_service_fee + pfe.host_service_fee) as total_fees
      FROM platform_fee_entries pfe
      WHERE pfe.tenant_id = $1
        AND pfe.month >= TO_CHAR($2::date, 'YYYY-MM')
        AND pfe.month <= TO_CHAR($3::date, 'YYYY-MM')
      GROUP BY LOWER(pfe.platform)
    )
    SELECT
      ps.platform,
      ps.booking_count::text,
      ps.gross_revenue::text,
      COALESCE(af.total_fees, 0)::text as total_fees
    FROM platform_summary ps
    LEFT JOIN actual_fees af ON ps.platform_key = af.platform_key
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

  const previousFromStr = formatDateISO(previousFrom)
  const previousToStr = formatDateISO(previousTo)

  const result = await query<{
    gross_revenue: string
    total_fees: string
  }>(`
    WITH platform_fee_calc AS (
      SELECT
        b.total_amount,
        COALESCE(
          CASE
            WHEN pf.fee_type = 'percentage' THEN b.total_amount * pf.fee_value
            WHEN pf.fee_type = 'flat' THEN pf.fee_value
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
    query<{
      gross_revenue: string
      total_taxes: string
      total_fees: string
    }>(`
      WITH booking_summary AS (
        SELECT
          b.id, 
          b.property_id,
          b.total_amount, 
          b.platform,
          b.arrival,
          TO_CHAR(b.arrival, 'YYYY-MM') as month
        FROM bookings b
        WHERE b.tenant_id = $1
          AND b.arrival >= $2
          AND b.arrival <= $3
          AND b.status != 'canceled'
          ${tagFilter}
      ),
      platform_fees_actual AS (
        SELECT 
          property_id,
          month,
          SUM(guest_service_fee + host_service_fee) as total_fees,
          SUM(platform_tax_remitted) as platform_tax
        FROM platform_fee_entries
        WHERE tenant_id = $1
          AND month >= TO_CHAR($2::date, 'YYYY-MM')
          AND month <= TO_CHAR($3::date, 'YYYY-MM')
        GROUP BY property_id, month
      ),
      property_taxes AS (
        SELECT 
          property_id,
          COALESCE(
            (SELECT SUM((j->>'rate')::numeric) 
             FROM jsonb_array_elements(jurisdictions) j), 
            0
          ) as total_tax_rate
        FROM property_tax_configs
        WHERE tenant_id = $1
          AND is_active = true
          AND effective_from <= $3::date
          AND (effective_to IS NULL OR effective_to >= $2::date)
      ),
      calc_totals AS (
        SELECT
          bs.id,
          bs.total_amount,
          COALESCE(pfa.total_fees, 0) as platform_fees,
          CASE 
            WHEN pt.total_tax_rate IS NOT NULL AND pt.total_tax_rate > 0 THEN 
              -- OwnerRez tax + platform fee tax
              COALESCE((SELECT SUM(amount) FROM booking_charges WHERE booking_id = bs.id AND type = 'tax'), 0) +
              (COALESCE(pfa.total_fees, 0) * (pt.total_tax_rate / 100))
            ELSE 
              COALESCE((SELECT SUM(amount) FROM booking_charges WHERE booking_id = bs.id AND type = 'tax'), 0)
          END as tax_amount
        FROM booking_summary bs
        LEFT JOIN platform_fees_actual pfa ON bs.property_id = pfa.property_id AND bs.month = pfa.month
        LEFT JOIN property_taxes pt ON bs.property_id = pt.property_id
      )
      SELECT
        COALESCE(SUM(total_amount), 0) as gross_revenue,
        COALESCE(SUM(tax_amount), 0) as total_taxes,
        COALESCE(SUM(platform_fees), 0) as total_fees
      FROM calc_totals`,
      queryParams
    ),

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
    formatDateISO(lastYearFrom),
    formatDateISO(lastYearTo),
    tagIds
  )

  const result = await query<{
    gross_revenue: string
    total_fees: string
    total_taxes: string
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
    )
    SELECT
      COALESCE(SUM(bookings.total_amount), 0) as gross_revenue,
      COALESCE(SUM(
        CASE
          WHEN pf.fee_type = 'percentage' THEN bookings.total_amount * pf.fee_value
          WHEN pf.fee_type = 'flat' THEN pf.fee_value
          ELSE 0
        END
      ), 0) as total_fees,
      COALESCE(SUM(
        (SELECT SUM(amount) FROM booking_charges WHERE booking_id = bookings.id AND type = 'tax')
      ), 0) as total_taxes
    FROM bookings
    LEFT JOIN platform_fee_lookup pf ON LOWER(
      CASE
        WHEN bookings.platform IS NULL OR bookings.platform = '' THEN 'direct'
        WHEN LOWER(bookings.platform) LIKE '%direct%' THEN 'direct'
        WHEN LOWER(bookings.platform) LIKE '%airbnb%' THEN 'airbnb'
        WHEN LOWER(bookings.platform) LIKE '%vrbo%' OR LOWER(bookings.platform) LIKE '%homeaway%' THEN 'vrbo'
        WHEN LOWER(bookings.platform) LIKE '%booking.com%' OR LOWER(bookings.platform) LIKE '%booking%' THEN 'booking.com'
        ELSE LOWER(bookings.platform)
      END
    ) = pf.platform_name
    WHERE bookings.tenant_id = $1
      AND bookings.arrival >= $2
      AND bookings.arrival <= $3
      AND bookings.status != 'canceled'
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


async function getTaxData(
  tenantId: string,
  fromDate: string,
  toDate: string,
  tagIds: string[]
): Promise<DbResult<TaxData>> {
  const tagFilter = buildTagFilter(tagIds, 'b')
  const queryParams = buildQueryParams(tenantId, fromDate, toDate, tagIds)

  const [summaryResult, propertyResult, monthlyResult, configsResult, platformFeesResult] = await Promise.all([
    query<{
      total_rent: string
      imported_tax: string
      total_bookings: string
    }>(`
      SELECT
        COALESCE(SUM(b.total_amount), 0) as total_rent,
        COALESCE(SUM(
          (SELECT SUM(amount) FROM booking_charges WHERE booking_id = b.id AND type = 'tax')
        ), 0) as imported_tax,
        COUNT(DISTINCT b.id) as total_bookings
      FROM bookings b
      WHERE b.tenant_id = $1
        AND b.arrival >= $2
        AND b.arrival <= $3
        AND b.status != 'canceled'
        ${tagFilter}`,
      queryParams
    ),
    
    query<{
      property_id: string
      property_name: string
      total_rent: string
      imported_tax: string
      booking_count: string
    }>(`
      SELECT
        p.id as property_id,
        p.name as property_name,
        COALESCE(SUM(b.total_amount), 0) as total_rent,
        COALESCE(SUM(
          (SELECT SUM(amount) FROM booking_charges WHERE booking_id = b.id AND type = 'tax')
        ), 0) as imported_tax,
        COUNT(b.id) as booking_count
      FROM properties p
      LEFT JOIN bookings b ON p.id = b.property_id
        AND b.tenant_id = $1
        AND b.arrival >= $2
        AND b.arrival <= $3
        AND b.status != 'canceled'
        ${tagFilter}
      WHERE p.tenant_id = $1
      GROUP BY p.id, p.name
      HAVING COUNT(b.id) > 0`,
      queryParams
    ),
    
    query<{
      month: string
      total_rent: string
      imported_tax: string
      booking_count: string
    }>(`
      SELECT
        TO_CHAR(b.arrival, 'YYYY-MM') as month,
        COALESCE(SUM(b.total_amount), 0) as total_rent,
        COALESCE(SUM(
          (SELECT SUM(amount) FROM booking_charges WHERE booking_id = b.id AND type = 'tax')
        ), 0) as imported_tax,
        COUNT(b.id) as booking_count
      FROM bookings b
      WHERE b.tenant_id = $1
        AND b.arrival >= $2
        AND b.arrival <= $3
        AND b.status != 'canceled'
        ${tagFilter}
      GROUP BY TO_CHAR(b.arrival, 'YYYY-MM')
      ORDER BY month`,
      queryParams
    ),
    
    query<{
      property_id: string
      jurisdictions: any
    }>(`
      SELECT property_id, jurisdictions
      FROM property_tax_configs
      WHERE tenant_id = $1
        AND is_active = true
        AND effective_from <= $2::date
        AND (effective_to IS NULL OR effective_to >= $3::date)`,
      [tenantId, toDate, fromDate]
    ),
    
    query<{
      property_id: string
      total_fees: string
    }>(`
      SELECT 
        property_id,
        SUM(guest_service_fee + host_service_fee) as total_fees
      FROM platform_fee_entries
      WHERE tenant_id = $1
        AND month >= TO_CHAR($2::date, 'YYYY-MM')
        AND month <= TO_CHAR($3::date, 'YYYY-MM')
      GROUP BY property_id`,
      [tenantId, fromDate, toDate]
    )
  ])

  if (!summaryResult.success || !propertyResult.success || !monthlyResult.success) {
    return { success: false, error: 'Failed to fetch tax data' }
  }

  const configsByProperty = new Map()
  if (configsResult.success) {
    configsResult.data.forEach(row => {
      const jurisdictions = typeof row.jurisdictions === 'string' 
        ? JSON.parse(row.jurisdictions) 
        : row.jurisdictions || []
      const totalRate = jurisdictions.reduce((sum: number, j: any) => sum + (j.rate || 0), 0)
      configsByProperty.set(row.property_id, totalRate / 100) // Convert to decimal
    })
  }

  const feesByProperty = new Map()
  if (platformFeesResult.success) {
    platformFeesResult.data.forEach(row => {
      feesByProperty.set(row.property_id, parseFloat(row.total_fees))
    })
  }

  const summaryData = summaryResult.data[0] || { total_rent: '0', imported_tax: '0', total_bookings: '0' }
  const baseRent = parseFloat(summaryData.total_rent)
  const importedTax = parseFloat(summaryData.imported_tax)
  
  let platformFeeTax = 0
  propertyResult.data.forEach(property => {
    const taxRate = configsByProperty.get(property.property_id) || 0
    const platformFees = feesByProperty.get(property.property_id) || 0
    platformFeeTax += platformFees * taxRate
  })
  
  const totalTax = importedTax + platformFeeTax
  const effectiveRate = baseRent > 0 ? totalTax / baseRent : 0

  const propertyTaxData = propertyResult.data.map(row => {
    const rent = parseFloat(row.total_rent)
    const imported = parseFloat(row.imported_tax)
    const taxRate = configsByProperty.get(row.property_id) || 0
    const platformFees = feesByProperty.get(row.property_id) || 0
    const platformTax = platformFees * taxRate
    const totalPropertyTax = imported + platformTax
    
    return {
      propertyId: row.property_id,
      propertyName: row.property_name,
      totalTax: totalPropertyTax,
      totalRent: rent,
      bookingCount: parseInt(row.booking_count),
      taxRate: rent > 0 ? totalPropertyTax / rent : 0
    }
  })

  const monthlyTaxData = monthlyResult.data.map(row => {
    const rent = parseFloat(row.total_rent)
    const imported = parseFloat(row.imported_tax)
    // Estimate platform tax proportionally for this month
    const estimatedPlatformTax = platformFeeTax * (rent / baseRent)
    const totalMonthlyTax = imported + estimatedPlatformTax
    
    return {
      month: row.month,
      totalTax: totalMonthlyTax,
      totalRent: rent,
      bookingCount: parseInt(row.booking_count),
      effectiveRate: rent > 0 ? totalMonthlyTax / rent : 0
    }
  })

  // Platform remits tax on their fees (Airbnb), owner remits tax on bookings
  const platformRemitted = platformFeeTax
  const ownerRemitted = importedTax
  
  return {
    success: true,
    data: {
      summary: {
        totalTax,
        totalRent: baseRent,
        totalBookings: parseInt(summaryData.total_bookings),
        effectiveRate,
        platformRemitted,
        ownerRemitted
      },
      byProperty: propertyTaxData,
      byMonth: monthlyTaxData
    }
  }
}


export async function getUnifiedFinancials(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') {
    return handleOptions()
  }

  const authCheck = await requireAuthWithValidation(request, {
    query: financialQuerySchema
  })

  if (!authCheck.authenticated || !authCheck.valid) {
    return authCheck.response
  }

  const { auth, validated } = authCheck.request

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
    const fromDate = validated?.query?.from ||
      formatDateISO(new Date(getYear(new Date()), 0, 1))
    const toDate = validated?.query?.to ||
      formatDateISO(new Date())
    const tagIds = validated?.query?.tags || []

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

    const cashflowData: CashflowData = {
      collected: plResult.data.metrics.revenue.collected,
      pending: plResult.data.metrics.revenue.pending,
      collectionRate: plResult.data.metrics.kpis.collectionRate,
      upcoming: plResult.data.metrics.upcoming
    }

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
