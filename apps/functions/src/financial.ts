import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { query, DbResult } from './services/database'
import { corsHeaders, handleOptions } from './middleware/auth'
import { requireAuthWithValidation } from './middleware/validation'
import { financialQuerySchema } from '@baileys/shared-types'
import { safeDivide, calculatePercentage } from '@baileys/utils'
import { formatDateISO, getYear } from './utils/dates'
import { getActiveSeasons, buildBookingFilters } from './services/seasonService'
import {
  createSuccessResponse,
  createErrorResponse,
  requireTenant
} from './utils/httpResponses'
import {
  buildDateRangeFilter,
  buildTagFilter,
  buildQueryParams as buildParams,
  normalizePlatformSQL,
  QueryParams,
  determineGranularity
} from './utils/queryBuilders'
import {
  parseNumericField,
  parseIntField,
  calculateDaysDifference,
  normalizePlatformName,
  transformBookingRow
} from './utils/dataTransformers'

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
    revenue: { gross: number; net: number; taxes: number; platformFees: number }
    performance: { netRevenueRate: number }
    monthlyTrend?: MonthlyTrend[]
    weeklyRevenue?: WeeklyRevenue[]
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
  ownerRemitted?: number
  platformRemitted?: number
}

export async function getPLData(
  tenantId: string,
  fromDate: string,
  toDate: string,
  tagIds: string[]
): Promise<DbResult<PLData>> {
  const seasons = await getActiveSeasons(tenantId)
  const bookingFilters = buildBookingFilters(seasons, 'b')

  const tagFilter = tagIds.length > 0 ? buildTagFilter(4) : ''
  const queryParams: QueryParams = { tenantId, fromDate, toDate, tagIds }
  const params = buildParams(queryParams)

  // Use helper to determine granularity
  const { useDaily: useDailyPL, useWeekly: useWeeklyPL } = determineGranularity(fromDate, toDate)

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
            LOWER(${normalizePlatformSQL('b.platform')}) as platform_key
          FROM bookings b
          WHERE b.tenant_id = $1
            ${buildDateRangeFilter('arrival', 2)}
            AND b.status != 'canceled'
            ${tagFilter}
            ${bookingFilters}
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
                COALESCE((SELECT SUM(amount) FROM booking_charges WHERE booking_id = bd.id AND type = 'tax'), 0) +
                (COALESCE(pfa.total_platform_fees, 0) * (pt.total_tax_rate / 100))
              ELSE
                COALESCE((SELECT SUM(amount) FROM booking_charges WHERE booking_id = bd.id AND type = 'tax'), 0)
            END as tax_amount
          FROM booking_data bd
          LEFT JOIN platform_fees_actual pfa ON bd.property_id = pfa.property_id AND bd.month = pfa.month
          LEFT JOIN property_taxes pt ON bd.property_id = pt.property_id
        )
        SELECT
          COALESCE(SUM(total_amount), 0) as gross_revenue,
          COALESCE(SUM(platform_fee), 0) as total_fees,
          COALESCE(SUM(tax_amount), 0) as total_taxes,
          COALESCE(SUM(CASE WHEN arrival > CURRENT_DATE THEN total_amount ELSE 0 END), 0) as pending_revenue,
          COALESCE(SUM(CASE WHEN arrival <= CURRENT_DATE THEN total_amount ELSE 0 END), 0) as collected_revenue,
          COUNT(*) as booking_count
        FROM fee_tax_calc
      `, params),

      // Platform financials query
      query<{
        platform: string
        gross_revenue: string
        total_fees: string
        booking_count: string
      }>(`
        WITH booking_data AS (
          SELECT
            b.id,
            b.property_id,
            b.total_amount,
            b.arrival,
            ${normalizePlatformSQL('b.platform')} as platform,
            TO_CHAR(b.arrival, 'YYYY-MM') as month
          FROM bookings b
          WHERE b.tenant_id = $1
            ${buildDateRangeFilter('arrival', 2)}
            AND b.status != 'canceled'
            ${tagFilter}
            ${bookingFilters}
        ),
        platform_fees AS (
          SELECT
            pfe.property_id,
            pfe.month,
            pfe.platform,
            SUM(pfe.guest_service_fee + pfe.host_service_fee) as total_fees
          FROM platform_fee_entries pfe
          WHERE pfe.tenant_id = $1
            AND pfe.month >= TO_CHAR($2::date, 'YYYY-MM')
            AND pfe.month <= TO_CHAR($3::date, 'YYYY-MM')
          GROUP BY pfe.property_id, pfe.month, pfe.platform
        )
        SELECT
          bd.platform,
          COALESCE(SUM(bd.total_amount), 0) as gross_revenue,
          COALESCE(SUM(pf.total_fees), 0) as total_fees,
          COUNT(DISTINCT bd.id) as booking_count
        FROM booking_data bd
        LEFT JOIN platform_fees pf ON
          bd.property_id = pf.property_id
          AND bd.month = pf.month
          AND LOWER(bd.platform) = LOWER(pf.platform)
        GROUP BY bd.platform
        ORDER BY gross_revenue DESC
      `, params),

      // Trend query with adaptive granularity
      query<{
        month: string
        revenue: string
        bookings: string
      }>(useDailyPL ? `
        -- Daily trend for short date ranges
        WITH date_series AS (
          SELECT generate_series($2::date, $3::date, '1 day'::interval)::date as day
        ),
        daily_bookings AS (
          SELECT
            b.arrival::date as day,
            COALESCE(SUM(b.total_amount), 0) as revenue,
            COUNT(*) as bookings
          FROM bookings b
          WHERE b.tenant_id = $1
            ${buildDateRangeFilter('arrival', 2)}
            AND b.status != 'canceled'
            ${tagFilter}
            ${bookingFilters}
          GROUP BY b.arrival::date
        )
        SELECT
          TO_CHAR(ds.day, 'YYYY-MM-DD') as month,
          COALESCE(db.revenue, 0) as revenue,
          COALESCE(db.bookings, 0) as bookings
        FROM date_series ds
        LEFT JOIN daily_bookings db ON ds.day = db.day
        ORDER BY ds.day
      ` : useWeeklyPL ? `
        -- Weekly trend for medium date ranges
        WITH week_series AS (
          SELECT generate_series(
            date_trunc('week', $2::date),
            date_trunc('week', $3::date),
            '1 week'::interval
          )::date as week_start
        ),
        weekly_bookings AS (
          SELECT
            date_trunc('week', b.arrival)::date as week_start,
            COALESCE(SUM(b.total_amount), 0) as revenue,
            COUNT(*) as bookings
          FROM bookings b
          WHERE b.tenant_id = $1
            ${buildDateRangeFilter('arrival', 2)}
            AND b.status != 'canceled'
            ${tagFilter}
            ${bookingFilters}
          GROUP BY date_trunc('week', b.arrival)
        )
        SELECT
          TO_CHAR(ws.week_start, 'YYYY-MM-DD') as month,
          COALESCE(wb.revenue, 0) as revenue,
          COALESCE(wb.bookings, 0) as bookings
        FROM week_series ws
        LEFT JOIN weekly_bookings wb ON ws.week_start = wb.week_start
        ORDER BY ws.week_start
      ` : `
        -- Monthly trend for long date ranges
        WITH month_series AS (
          SELECT TO_CHAR(generate_series(
            date_trunc('month', $2::date),
            date_trunc('month', $3::date),
            '1 month'::interval
          )::date, 'YYYY-MM') as month
        ),
        monthly_bookings AS (
          SELECT
            TO_CHAR(b.arrival, 'YYYY-MM') as month,
            COALESCE(SUM(b.total_amount), 0) as revenue,
            COUNT(*) as bookings
          FROM bookings b
          WHERE b.tenant_id = $1
            ${buildDateRangeFilter('arrival', 2)}
            AND b.status != 'canceled'
            ${tagFilter}
            ${bookingFilters}
          GROUP BY TO_CHAR(b.arrival, 'YYYY-MM')
        )
        SELECT
          ms.month,
          COALESCE(mb.revenue, 0) as revenue,
          COALESCE(mb.bookings, 0) as bookings
        FROM month_series ms
        LEFT JOIN monthly_bookings mb ON ms.month = mb.month
        ORDER BY ms.month
      `, params),

      // Weekly revenue query
      query<{
        week_start: string
        revenue: string
        bookings: string
      }>(`
        SELECT
          DATE_TRUNC('week', b.arrival)::date as week_start,
          COALESCE(SUM(b.total_amount), 0) as revenue,
          COUNT(*) as bookings
        FROM bookings b
        WHERE b.tenant_id = $1
          ${buildDateRangeFilter('arrival', 2)}
          AND b.status != 'canceled'
          ${tagFilter}
          ${bookingFilters}
        GROUP BY DATE_TRUNC('week', b.arrival)::date
        ORDER BY week_start DESC
        LIMIT 12
      `, params),

      // Upcoming revenue query
      query<{
        days_30: string
        days_60: string
        days_90: string
      }>(`
        SELECT
          COALESCE(SUM(CASE
            WHEN b.arrival BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
            THEN b.total_amount ELSE 0
          END), 0) as days_30,
          COALESCE(SUM(CASE
            WHEN b.arrival BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
            THEN b.total_amount ELSE 0
          END), 0) as days_60,
          COALESCE(SUM(CASE
            WHEN b.arrival BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
            THEN b.total_amount ELSE 0
          END), 0) as days_90
        FROM bookings b
        WHERE b.tenant_id = $1
          AND b.arrival >= CURRENT_DATE
          AND b.status != 'canceled'
          ${tagFilter.replace('$4', '$2')}
          ${bookingFilters}
      `, tagIds.length > 0 ? [tenantId, tagIds] : [tenantId]),

      // Property count query
      query<{ property_count: string }>(`
        SELECT COUNT(DISTINCT b.property_id) as property_count
        FROM bookings b
        WHERE b.tenant_id = $1
          ${buildDateRangeFilter('arrival', 2)}
          AND b.status != 'canceled'
          ${tagFilter}
          ${bookingFilters}
      `, params),

      // Booking stats query
      query<{
        total_nights: string
        avg_length: string
      }>(`
        SELECT
          COALESCE(SUM(b.departure - b.arrival), 0) as total_nights,
          COALESCE(AVG(b.departure - b.arrival), 0) as avg_length
        FROM bookings b
        WHERE b.tenant_id = $1
          ${buildDateRangeFilter('arrival', 2)}
          AND b.status != 'canceled'
          ${tagFilter}
          ${bookingFilters}
      `, params)
    ])

  if (!metricsResult.success) return { success: false, error: metricsResult.error }
  if (!platformsResult.success) return { success: false, error: platformsResult.error }
  if (!monthlyResult.success) return { success: false, error: monthlyResult.error }
  if (!weeklyResult.success) return { success: false, error: weeklyResult.error }
  if (!upcomingResult.success) return { success: false, error: upcomingResult.error }
  if (!propertyResult.success) return { success: false, error: propertyResult.error }
  if (!bookingStatsResult.success) return { success: false, error: bookingStatsResult.error }

  const metrics = metricsResult.data[0]
  const upcomingData = upcomingResult.data[0]
  const propertyCount = parseIntField(propertyResult.data[0]?.property_count, 1)
  const bookingStats = bookingStatsResult.data[0]

  const grossRevenue = parseNumericField(metrics?.gross_revenue)
  const platformFees = parseNumericField(metrics?.total_fees)
  const taxes = parseNumericField(metrics?.total_taxes)
  const netRevenue = grossRevenue - platformFees - taxes
  const pendingRevenue = parseNumericField(metrics?.pending_revenue)
  const collectedRevenue = parseNumericField(metrics?.collected_revenue)
  const bookingCount = parseIntField(metrics?.booking_count)
  const totalNights = parseIntField(bookingStats?.total_nights)

  const plDateRange = calculateDaysDifference(fromDate, toDate) + 1
  const revpar = safeDivide(grossRevenue, propertyCount * plDateRange)
  const adr = safeDivide(grossRevenue, totalNights)

  const plData: PLData = {
    metrics: {
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
        avgBookingValue: safeDivide(grossRevenue, bookingCount),
        totalBookings: bookingCount
      },
      upcoming: {
        next30Days: parseNumericField(upcomingData?.days_30),
        next60Days: parseNumericField(upcomingData?.days_60),
        next90Days: parseNumericField(upcomingData?.days_90)
      },
      kpis: {
        revpar,
        adr,
        collectionRate: calculatePercentage(collectedRevenue, grossRevenue)
      }
    },
    platforms: platformsResult.data.map(p => {
      const gross = parseNumericField(p.gross_revenue)
      const fees = parseNumericField(p.total_fees)
      return {
        platform: p.platform,
        grossRevenue: gross,
        fees,
        netRevenue: gross - fees,
        feeRate: calculatePercentage(fees, gross),
        bookingCount: parseIntField(p.booking_count)
      }
    }),
    monthlyTrend: monthlyResult.data.map(m => {
      const revenue = parseNumericField(m.revenue)
      const bookings = parseIntField(m.bookings)
      return {
        month: m.month,
        revenue,
        bookings,
        avgBookingValue: safeDivide(revenue, bookings)
      }
    }),
    weeklyRevenue: weeklyResult.data.map(w => ({
      week: w.week_start,
      revenue: parseNumericField(w.revenue),
      bookings: parseIntField(w.bookings)
    }))
  }

  return { success: true, data: plData }
}

export async function getRevenueData(
  tenantId: string,
  fromDate: string,
  toDate: string,
  tagIds: string[]
): Promise<DbResult<RevenueData>> {
  const seasons = await getActiveSeasons(tenantId)
  const bookingFilters = buildBookingFilters(seasons, 'b')

  const tagFilter = tagIds.length > 0 ? buildTagFilter(4) : ''
  const queryParams: QueryParams = { tenantId, fromDate, toDate, tagIds }
  const params = buildParams(queryParams)

  const lastYearNum = getYear(fromDate) - 1
  const lastYearFrom = fromDate.replace(/\d{4}/, lastYearNum.toString())
  const lastYearTo = toDate.replace(/\d{4}/, lastYearNum.toString())

  // Use helper to determine granularity
  const { useDaily, useWeekly } = determineGranularity(fromDate, toDate)

  const [currentResult, sourceResult, monthlyResult, lastYearResult] = await Promise.all([
    query<{
      gross: string
      taxes: string
      fees: string
    }>(`
      WITH booking_data AS (
        SELECT
          b.id,
          b.property_id,
          b.total_amount,
          TO_CHAR(b.arrival, 'YYYY-MM') as month
        FROM bookings b
        WHERE b.tenant_id = $1
          ${buildDateRangeFilter('arrival', 2)}
          AND b.status != 'canceled'
          ${tagFilter}
          ${bookingFilters}
      ),
      platform_fees AS (
        SELECT
          pfe.property_id,
          pfe.month,
          SUM(pfe.guest_service_fee + pfe.host_service_fee) as total_fees
        FROM platform_fee_entries pfe
        WHERE pfe.tenant_id = $1
          AND pfe.month >= TO_CHAR($2::date, 'YYYY-MM')
          AND pfe.month <= TO_CHAR($3::date, 'YYYY-MM')
        GROUP BY pfe.property_id, pfe.month
      )
      SELECT
        COALESCE(SUM(bd.total_amount), 0) as gross,
        COALESCE(SUM((SELECT SUM(amount) FROM booking_charges WHERE booking_id = bd.id AND type = 'tax')), 0) as taxes,
        COALESCE(SUM(pf.total_fees), 0) as fees
      FROM booking_data bd
      LEFT JOIN platform_fees pf ON bd.property_id = pf.property_id AND bd.month = pf.month
    `, params),

    query<{
      source: string
      amount: string
    }>(`
      SELECT
        ${normalizePlatformSQL('b.platform')} as source,
        COALESCE(SUM(b.total_amount), 0) as amount
      FROM bookings b
      WHERE b.tenant_id = $1
        ${buildDateRangeFilter('arrival', 2)}
        AND b.status != 'canceled'
        ${tagFilter}
        ${bookingFilters}
      GROUP BY ${normalizePlatformSQL('b.platform')}
      ORDER BY amount DESC
    `, params),

    query<{
      month: string
      amount: string
    }>(useDaily ? `
      -- Daily revenue for short date ranges
      WITH date_series AS (
        SELECT generate_series($2::date, $3::date, '1 day'::interval)::date as period
      ),
      daily_revenue AS (
        SELECT
          b.arrival::date as period,
          COALESCE(SUM(b.total_amount), 0) as amount
        FROM bookings b
        WHERE b.tenant_id = $1
          ${buildDateRangeFilter('arrival', 2)}
          AND b.status != 'canceled'
          ${tagFilter}
          ${bookingFilters}
        GROUP BY b.arrival::date
      )
      SELECT
        TO_CHAR(ds.period, 'YYYY-MM-DD') as month,
        COALESCE(dr.amount, 0) as amount
      FROM date_series ds
      LEFT JOIN daily_revenue dr ON ds.period = dr.period
      ORDER BY ds.period
    ` : useWeekly ? `
      -- Weekly revenue for medium date ranges
      WITH week_series AS (
        SELECT generate_series(
          date_trunc('week', $2::date),
          date_trunc('week', $3::date),
          '1 week'::interval
        )::date as period
      ),
      weekly_revenue AS (
        SELECT
          date_trunc('week', b.arrival)::date as period,
          COALESCE(SUM(b.total_amount), 0) as amount
        FROM bookings b
        WHERE b.tenant_id = $1
          ${buildDateRangeFilter('arrival', 2)}
          AND b.status != 'canceled'
          ${tagFilter}
          ${bookingFilters}
        GROUP BY date_trunc('week', b.arrival)
      )
      SELECT
        TO_CHAR(ws.period, 'YYYY-MM-DD') as month,
        COALESCE(wr.amount, 0) as amount
      FROM week_series ws
      LEFT JOIN weekly_revenue wr ON ws.period = wr.period
      ORDER BY ws.period
    ` : `
      -- Monthly revenue for long date ranges
      WITH month_series AS (
        SELECT TO_CHAR(generate_series(
          date_trunc('month', $2::date),
          date_trunc('month', $3::date),
          '1 month'::interval
        )::date, 'YYYY-MM') as month
      ),
      monthly_revenue AS (
        SELECT
          TO_CHAR(b.arrival, 'YYYY-MM') as month,
          COALESCE(SUM(b.total_amount), 0) as amount
        FROM bookings b
        WHERE b.tenant_id = $1
          ${buildDateRangeFilter('arrival', 2)}
          AND b.status != 'canceled'
          ${tagFilter}
          ${bookingFilters}
        GROUP BY TO_CHAR(b.arrival, 'YYYY-MM')
      )
      SELECT
        ms.month,
        COALESCE(mr.amount, 0) as amount
      FROM month_series ms
      LEFT JOIN monthly_revenue mr ON ms.month = mr.month
      ORDER BY ms.month
    `, params),

    query<{
      gross: string
      taxes: string
      fees: string
    }>(`
      WITH booking_data AS (
        SELECT
          b.id,
          b.property_id,
          b.total_amount,
          TO_CHAR(b.arrival, 'YYYY-MM') as month
        FROM bookings b
        WHERE b.tenant_id = $1
          AND b.arrival >= $2::date
          AND b.arrival <= $3::date
          AND b.status != 'canceled'
          ${tagFilter}
          ${bookingFilters}
      ),
      platform_fees AS (
        SELECT
          pfe.property_id,
          pfe.month,
          SUM(pfe.guest_service_fee + pfe.host_service_fee) as total_fees
        FROM platform_fee_entries pfe
        WHERE pfe.tenant_id = $1
          AND pfe.month >= TO_CHAR($2::date, 'YYYY-MM')
          AND pfe.month <= TO_CHAR($3::date, 'YYYY-MM')
        GROUP BY pfe.property_id, pfe.month
      )
      SELECT
        COALESCE(SUM(bd.total_amount), 0) as gross,
        COALESCE(SUM((SELECT SUM(amount) FROM booking_charges WHERE booking_id = bd.id AND type = 'tax')), 0) as taxes,
        COALESCE(SUM(pf.total_fees), 0) as fees
      FROM booking_data bd
      LEFT JOIN platform_fees pf ON bd.property_id = pf.property_id AND bd.month = pf.month
    `, tagIds.length > 0 ? [tenantId, lastYearFrom, lastYearTo, tagIds] : [tenantId, lastYearFrom, lastYearTo])
  ])

  if (!currentResult.success) return { success: false, error: currentResult.error }
  if (!sourceResult.success) return { success: false, error: sourceResult.error }
  if (!monthlyResult.success) return { success: false, error: monthlyResult.error }

  const current = currentResult.data[0]
  const lastYearData = lastYearResult.success ? lastYearResult.data[0] : null

  const gross = parseNumericField(current?.gross)
  const taxes = parseNumericField(current?.taxes)
  const fees = parseNumericField(current?.fees)
  const net = gross - taxes - fees

  const revenueData: RevenueData = {
    gross,
    net,
    taxes,
    fees,
    bySource: sourceResult.data.map(s => ({
      source: s.source,
      amount: parseNumericField(s.amount)
    })),
    byMonth: monthlyResult.data.map(m => ({
      month: m.month,
      amount: parseNumericField(m.amount)
    }))
  }

  if (lastYearData) {
    const lastYearGross = parseNumericField(lastYearData.gross)
    const lastYearTaxes = parseNumericField(lastYearData.taxes)
    const lastYearFees = parseNumericField(lastYearData.fees)
    revenueData.lastYearData = {
      gross: lastYearGross,
      net: lastYearGross - lastYearTaxes - lastYearFees
    }
  }

  return { success: true, data: revenueData }
}

export async function getCashflowData(
  tenantId: string,
  fromDate: string,
  toDate: string,
  tagIds: string[]
): Promise<DbResult<CashflowData>> {
  const seasons = await getActiveSeasons(tenantId)
  const bookingFilters = buildBookingFilters(seasons, 'b')

  const tagFilter = tagIds.length > 0 ? buildTagFilter(4) : ''
  const queryParams: QueryParams = { tenantId, fromDate, toDate, tagIds }
  const params = buildParams(queryParams)

  const result = await query<{
    collected: string
    pending: string
    total: string
    next_30: string
    next_60: string
    next_90: string
  }>(`
    SELECT
      COALESCE(SUM(CASE WHEN b.arrival <= CURRENT_DATE THEN b.total_amount ELSE 0 END), 0) as collected,
      COALESCE(SUM(CASE WHEN b.arrival > CURRENT_DATE THEN b.total_amount ELSE 0 END), 0) as pending,
      COALESCE(SUM(b.total_amount), 0) as total,
      COALESCE(SUM(CASE
        WHEN b.arrival BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
        THEN b.total_amount ELSE 0
      END), 0) as next_30,
      COALESCE(SUM(CASE
        WHEN b.arrival BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
        THEN b.total_amount ELSE 0
      END), 0) as next_60,
      COALESCE(SUM(CASE
        WHEN b.arrival BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
        THEN b.total_amount ELSE 0
      END), 0) as next_90
    FROM bookings b
    WHERE b.tenant_id = $1
      ${buildDateRangeFilter('arrival', 2)}
      AND b.status != 'canceled'
      ${tagFilter}
      ${bookingFilters}
  `, params)

  if (!result.success) return { success: false, error: result.error }

  const data = result.data[0]
  const collected = parseNumericField(data?.collected)
  const pending = parseNumericField(data?.pending)
  const total = parseNumericField(data?.total)

  return {
    success: true,
    data: {
      collected,
      pending,
      collectionRate: calculatePercentage(collected, total),
      upcoming: {
        next30Days: parseNumericField(data?.next_30),
        next60Days: parseNumericField(data?.next_60),
        next90Days: parseNumericField(data?.next_90)
      }
    }
  }
}

export async function getTaxData(
  tenantId: string,
  fromDate: string,
  toDate: string,
  tagIds: string[]
): Promise<DbResult<TaxData>> {
  const seasons = await getActiveSeasons(tenantId)
  const bookingFilters = buildBookingFilters(seasons, 'b')

  const tagFilter = tagIds.length > 0 ? buildTagFilter(4) : ''
  const queryParams: QueryParams = { tenantId, fromDate, toDate, tagIds }
  const params = buildParams(queryParams)

  // Use helper to determine granularity
  const { useDaily: useDailyTax, useWeekly: useWeeklyTax } = determineGranularity(fromDate, toDate)

  const [summaryResult, propertyResult, monthlyResult] = await Promise.all([
    query<{
      total_tax: string
      total_rent: string
      total_bookings: string
      platform_remitted: string
    }>(`
      WITH booking_data AS (
        SELECT
          b.id,
          b.property_id,
          b.total_amount,
          TO_CHAR(b.arrival, 'YYYY-MM') as month,
          COALESCE((SELECT SUM(amount) FROM booking_charges WHERE booking_id = b.id AND type = 'tax'), 0) as ownerrez_tax
        FROM bookings b
        WHERE b.tenant_id = $1
          ${buildDateRangeFilter('arrival', 2)}
          AND b.status != 'canceled'
          ${tagFilter}
          ${bookingFilters}
      ),
      platform_taxes AS (
        SELECT
          pfe.property_id,
          pfe.month,
          SUM(pfe.platform_tax_remitted) as platform_tax
        FROM platform_fee_entries pfe
        WHERE pfe.tenant_id = $1
          AND pfe.month >= TO_CHAR($2::date, 'YYYY-MM')
          AND pfe.month <= TO_CHAR($3::date, 'YYYY-MM')
        GROUP BY pfe.property_id, pfe.month
      )
      SELECT
        COALESCE(SUM(bd.ownerrez_tax), 0) + COALESCE(SUM(pt.platform_tax), 0) as total_tax,
        COALESCE(SUM(bd.total_amount), 0) as total_rent,
        COUNT(DISTINCT bd.id) as total_bookings,
        COALESCE(SUM(pt.platform_tax), 0) as platform_remitted
      FROM booking_data bd
      LEFT JOIN platform_taxes pt ON bd.property_id = pt.property_id AND bd.month = pt.month
    `, params),

    query<{
      property_id: string
      property_name: string
      total_tax: string
      total_rent: string
      booking_count: string
    }>(`
      WITH booking_data AS (
        SELECT
          b.id,
          b.property_id,
          b.total_amount,
          COALESCE((SELECT SUM(amount) FROM booking_charges WHERE booking_id = b.id AND type = 'tax'), 0) as tax_amount
        FROM bookings b
        WHERE b.tenant_id = $1
          ${buildDateRangeFilter('arrival', 2)}
          AND b.status != 'canceled'
          ${tagFilter}
          ${bookingFilters}
      )
      SELECT
        p.id as property_id,
        p.name as property_name,
        COALESCE(SUM(bd.tax_amount), 0) as total_tax,
        COALESCE(SUM(bd.total_amount), 0) as total_rent,
        COUNT(bd.id) as booking_count
      FROM properties p
      LEFT JOIN booking_data bd ON p.id = bd.property_id
      WHERE p.tenant_id = $1
      GROUP BY p.id, p.name
      HAVING COUNT(bd.id) > 0
      ORDER BY total_tax DESC
    `, params),

    query<{
      month: string
      total_tax: string
      total_rent: string
      booking_count: string
      owner_tax: string
      platform_tax: string
    }>(useDailyTax ? `
      -- Daily tax data for short date ranges
      WITH date_series AS (
        SELECT generate_series($2::date, $3::date, '1 day'::interval)::date as period
      ),
      daily_tax_data AS (
        SELECT
          b.arrival::date as period,
          COALESCE(SUM((SELECT SUM(amount) FROM booking_charges WHERE booking_id = b.id AND type = 'tax')), 0) as owner_tax,
          COALESCE(SUM(b.total_amount), 0) as total_rent,
          COUNT(*) as booking_count
        FROM bookings b
        WHERE b.tenant_id = $1
          ${buildDateRangeFilter('arrival', 2)}
          AND b.status != 'canceled'
          ${tagFilter}
          ${bookingFilters}
        GROUP BY b.arrival::date
      ),
      platform_tax_data AS (
        SELECT
          TO_CHAR(TO_DATE(month || '-01', 'YYYY-MM-DD'), 'YYYY-MM-DD') as period,
          COALESCE(SUM(platform_tax_remitted), 0) as platform_tax
        FROM platform_fee_entries
        WHERE tenant_id = $1
          AND TO_DATE(month || '-01', 'YYYY-MM-DD') >= $2::date
          AND TO_DATE(month || '-01', 'YYYY-MM-DD') <= $3::date
        GROUP BY month
      )
      SELECT
        TO_CHAR(ds.period, 'YYYY-MM-DD') as month,
        COALESCE(dtd.owner_tax, 0) + COALESCE(ptd.platform_tax, 0) as total_tax,
        COALESCE(dtd.total_rent, 0) as total_rent,
        COALESCE(dtd.booking_count, 0) as booking_count,
        COALESCE(dtd.owner_tax, 0) as owner_tax,
        COALESCE(ptd.platform_tax, 0) as platform_tax
      FROM date_series ds
      LEFT JOIN daily_tax_data dtd ON ds.period = dtd.period
      LEFT JOIN platform_tax_data ptd ON TO_CHAR(ds.period, 'YYYY-MM-DD') = ptd.period
      ORDER BY ds.period
    ` : useWeeklyTax ? `
      -- Weekly tax data for medium date ranges
      WITH week_series AS (
        SELECT generate_series(
          date_trunc('week', $2::date),
          date_trunc('week', $3::date),
          '1 week'::interval
        )::date as period
      ),
      weekly_tax_data AS (
        SELECT
          date_trunc('week', b.arrival)::date as period,
          COALESCE(SUM((SELECT SUM(amount) FROM booking_charges WHERE booking_id = b.id AND type = 'tax')), 0) as owner_tax,
          COALESCE(SUM(b.total_amount), 0) as total_rent,
          COUNT(*) as booking_count
        FROM bookings b
        WHERE b.tenant_id = $1
          ${buildDateRangeFilter('arrival', 2)}
          AND b.status != 'canceled'
          ${tagFilter}
          ${bookingFilters}
        GROUP BY date_trunc('week', b.arrival)
      ),
      platform_tax_data AS (
        SELECT
          date_trunc('week', TO_DATE(month || '-01', 'YYYY-MM-DD'))::date as period,
          COALESCE(SUM(platform_tax_remitted), 0) as platform_tax
        FROM platform_fee_entries
        WHERE tenant_id = $1
          AND TO_DATE(month || '-01', 'YYYY-MM-DD') >= $2::date
          AND TO_DATE(month || '-01', 'YYYY-MM-DD') <= $3::date
        GROUP BY date_trunc('week', TO_DATE(month || '-01', 'YYYY-MM-DD'))
      )
      SELECT
        TO_CHAR(ws.period, 'YYYY-MM-DD') as month,
        COALESCE(wtd.owner_tax, 0) + COALESCE(ptd.platform_tax, 0) as total_tax,
        COALESCE(wtd.total_rent, 0) as total_rent,
        COALESCE(wtd.booking_count, 0) as booking_count,
        COALESCE(wtd.owner_tax, 0) as owner_tax,
        COALESCE(ptd.platform_tax, 0) as platform_tax
      FROM week_series ws
      LEFT JOIN weekly_tax_data wtd ON ws.period = wtd.period
      LEFT JOIN platform_tax_data ptd ON ws.period = ptd.period
      ORDER BY ws.period
    ` : `
      -- Monthly tax data for long date ranges
      WITH month_series AS (
        SELECT TO_CHAR(generate_series(
          date_trunc('month', $2::date),
          date_trunc('month', $3::date),
          '1 month'::interval
        )::date, 'YYYY-MM') as month
      ),
      monthly_tax_data AS (
        SELECT
          TO_CHAR(b.arrival, 'YYYY-MM') as month,
          COALESCE(SUM((SELECT SUM(amount) FROM booking_charges WHERE booking_id = b.id AND type = 'tax')), 0) as owner_tax,
          COALESCE(SUM(b.total_amount), 0) as total_rent,
          COUNT(*) as booking_count
        FROM bookings b
        WHERE b.tenant_id = $1
          ${buildDateRangeFilter('arrival', 2)}
          AND b.status != 'canceled'
          ${tagFilter}
          ${bookingFilters}
        GROUP BY TO_CHAR(b.arrival, 'YYYY-MM')
      ),
      platform_tax_data AS (
        SELECT
          month,
          COALESCE(SUM(platform_tax_remitted), 0) as platform_tax
        FROM platform_fee_entries
        WHERE tenant_id = $1
          AND month >= TO_CHAR($2::date, 'YYYY-MM')
          AND month <= TO_CHAR($3::date, 'YYYY-MM')
        GROUP BY month
      )
      SELECT
        ms.month,
        COALESCE(mtd.owner_tax, 0) + COALESCE(ptd.platform_tax, 0) as total_tax,
        COALESCE(mtd.total_rent, 0) as total_rent,
        COALESCE(mtd.booking_count, 0) as booking_count,
        COALESCE(mtd.owner_tax, 0) as owner_tax,
        COALESCE(ptd.platform_tax, 0) as platform_tax
      FROM month_series ms
      LEFT JOIN monthly_tax_data mtd ON ms.month = mtd.month
      LEFT JOIN platform_tax_data ptd ON ms.month = ptd.month
      ORDER BY ms.month
    `, params)
  ])

  if (!summaryResult.success) return { success: false, error: summaryResult.error }
  if (!propertyResult.success) return { success: false, error: propertyResult.error }
  if (!monthlyResult.success) return { success: false, error: monthlyResult.error }

  const summary = summaryResult.data[0]
  const totalTax = parseNumericField(summary?.total_tax)
  const totalRent = parseNumericField(summary?.total_rent)
  const platformRemitted = parseNumericField(summary?.platform_remitted)

  return {
    success: true,
    data: {
      summary: {
        totalTax,
        totalRent,
        totalBookings: parseIntField(summary?.total_bookings),
        effectiveRate: calculatePercentage(totalTax, totalRent),
        platformRemitted,
        ownerRemitted: totalTax - platformRemitted
      },
      byProperty: propertyResult.data.map(p => {
        const tax = parseNumericField(p.total_tax)
        const rent = parseNumericField(p.total_rent)
        return {
          propertyId: p.property_id,
          propertyName: p.property_name,
          totalTax: tax,
          totalRent: rent,
          bookingCount: parseIntField(p.booking_count),
          taxRate: calculatePercentage(tax, rent)
        }
      }),
      byMonth: monthlyResult.data.map(m => {
        const tax = parseNumericField(m.total_tax)
        const rent = parseNumericField(m.total_rent)
        const ownerTax = parseNumericField(m.owner_tax)
        const platformTax = parseNumericField(m.platform_tax)
        return {
          month: m.month,
          totalTax: tax,
          totalRent: rent,
          bookingCount: parseIntField(m.booking_count),
          effectiveRate: calculatePercentage(tax, rent),
          ownerRemitted: ownerTax,
          platformRemitted: platformTax
        }
      })
    }
  }
}

export async function financial(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Financial API handler called')

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

  const tenantError = requireTenant(auth.tenantId)
  if (tenantError) return tenantError

  // Type assertion after validation
  const tenantId = auth.tenantId!

  const { from, to, tags: tagIds = [] } = validated?.query || {}

  // Handle comparison dates like overview.ts does
  let comparisonFrom: string | undefined
  let comparisonTo: string | undefined

  if (validated?.query?.comparisonFrom && validated?.query?.comparisonTo) {
    comparisonFrom = validated.query.comparisonFrom
    comparisonTo = validated.query.comparisonTo
  } else if (from && to) {
    // Auto-calculate previous period if not provided
    const daysDiff = calculateDaysDifference(from, to)
    comparisonFrom = formatDateISO(new Date(new Date(from).getTime() - daysDiff * 24 * 60 * 60 * 1000))
    comparisonTo = formatDateISO(new Date(new Date(from).getTime() - 24 * 60 * 60 * 1000))
  }

  const [plResult, revenueResult, cashflowResult, taxResult] = await Promise.all([
    getPLData(tenantId, from, to, tagIds),
    getRevenueData(tenantId, from, to, tagIds),
    getCashflowData(tenantId, from, to, tagIds),
    getTaxData(tenantId, from, to, tagIds)
  ])

  if (!plResult.success) return createErrorResponse(plResult.error)
  if (!revenueResult.success) return createErrorResponse(revenueResult.error)
  if (!cashflowResult.success) return createErrorResponse(cashflowResult.error)
  if (!taxResult.success) return createErrorResponse(taxResult.error)

  // Fetch previous period data if comparison dates are available
  let previousPeriodData = undefined
  if (comparisonFrom && comparisonTo) {
    const previousPLResult = await getPLData(tenantId, comparisonFrom, comparisonTo, tagIds)
    if (previousPLResult.success) {
      previousPeriodData = {
        revenue: {
          gross: previousPLResult.data.metrics.revenue.gross,
          net: previousPLResult.data.metrics.revenue.net,
          taxes: previousPLResult.data.metrics.revenue.taxes,
          platformFees: previousPLResult.data.metrics.revenue.platformFees
        },
        performance: {
          netRevenueRate: previousPLResult.data.metrics.performance.netRevenueRate
        },
        monthlyTrend: previousPLResult.data.monthlyTrend,
        weeklyRevenue: previousPLResult.data.weeklyRevenue
      }
    }
  }

  const response: UnifiedFinancialResponse = {
    pl: {
      ...plResult.data,
      previousPeriod: previousPeriodData
    },
    revenue: revenueResult.data,
    cashflow: cashflowResult.data,
    tax: taxResult.data,
    metadata: {
      dateRange: { from, to },
      generatedAt: new Date().toISOString()
    }
  }

  return createSuccessResponse(response)
}

app.http('financial', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: financial
})
