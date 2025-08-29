/**
 * Report Data Service
 * Fetches data for PDF reports using the existing dashboard query patterns
 */

import { query, DbResult } from '../services/database'
import { safeDivide } from '@baileys/utils'
import { ReportDateRange, ReportFilters } from '../services/reportService'
import { parseIntField, parseNumericField } from './dataTransformers'

// Property Metrics Types
type PropertyMetrics = {
  propertyId: string
  propertyName: string
  revenue: number
  bookings: number
  occupancyRate: number
  avgNightlyRate: number
  avgStayLength: number
  bookedNights: number
  availableNights: number
}

/**
 * Fetch property metrics for reports
 * Based on property-metrics.ts pattern
 */
export async function fetchPropertyMetricsForReport(
  tenantId: string,
  dateRange: ReportDateRange
): Promise<PropertyMetrics[]> {
  
  try {
    // Simplified query similar to financial data pattern
    const result = await query(
      `SELECT
        p.id as property_id,
        p.name as property_name,
        COUNT(DISTINCT b.id) as booking_count,
        COALESCE(SUM(b.total_amount), 0) as total_revenue,
        COALESCE(SUM(GREATEST(0, LEAST(b.departure::date, $3::date) - GREATEST(b.arrival::date, $2::date))), 0) as total_nights
      FROM properties p
      LEFT JOIN bookings b ON p.id = b.property_id
        AND b.tenant_id = $1
        AND b.arrival >= $2::date
        AND b.arrival <= $3::date
        AND b.status != 'canceled'
      WHERE p.tenant_id = $1 AND p.active = true
      GROUP BY p.id, p.name
      ORDER BY total_revenue DESC`,
      [tenantId, dateRange.from, dateRange.to]
    )

    if (!result.success) {
      return []
    }

    
    const days = Math.ceil((new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime()) / (1000 * 60 * 60 * 24)) + 1

    const mappedResults = result.data.map((row: any) => {
      const revenue = parseFloat(row.total_revenue) || 0
      const bookings = parseInt(row.booking_count) || 0
      const nights = parseInt(row.total_nights) || 0

      return {
        propertyId: row.property_id,
        propertyName: row.property_name,
        revenue,
        bookings,
        occupancyRate: safeDivide(nights, days),
        avgNightlyRate: safeDivide(revenue, nights, 0),
        avgStayLength: safeDivide(nights, bookings, 0),
        bookedNights: nights,
        availableNights: days
      }
    })
    
    return mappedResults
  } catch (error) {
    return []
  }
}

/**
 * Fetch occupancy data for reports
 * Based on occupancy.ts pattern
 */
export async function fetchOccupancyDataForReport(
  tenantId: string,
  dateRange: ReportDateRange
) {
  
  // Get detailed gap nights analysis with property and date info
  const gapAnalysisResult = await query<{
    property_name: string
    gap_start: string
    gap_end: string
    gap_days: string
  }>(
    `WITH booking_gaps AS (
      SELECT 
        p.name as property_name,
        b1.departure as gap_start,
        b2.arrival as gap_end,
        (b2.arrival::date - b1.departure::date) as gap_days
      FROM bookings b1
      JOIN bookings b2 ON b1.property_id = b2.property_id
        AND b2.arrival > b1.departure
        AND b2.arrival = (
          SELECT MIN(b3.arrival)
          FROM bookings b3
          WHERE b3.property_id = b1.property_id
            AND b3.arrival > b1.departure
            AND b3.tenant_id = $1
        )
      JOIN properties p ON b1.property_id = p.id
      WHERE b1.tenant_id = $1
        AND b1.departure >= $2::date
        AND b1.departure <= $3::date
        AND b1.status != 'canceled'
        AND b2.status != 'canceled'
    )
    SELECT 
      property_name,
      TO_CHAR(gap_start, 'MM/DD') as gap_start,
      TO_CHAR(gap_end, 'MM/DD') as gap_end,
      gap_days::text
    FROM booking_gaps
    WHERE gap_days <= 7  -- Focus on fillable gaps
    ORDER BY gap_days ASC, gap_start ASC
    LIMIT 20`,
    [tenantId, dateRange.from, dateRange.to]
  )
  
  // Get booking lead time analysis
  const leadTimeResult = await query(
    `SELECT 
      AVG(arrival::date - created_at::date) as avg_lead_days,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY arrival::date - created_at::date) as median_lead_days,
      COUNT(CASE WHEN (arrival::date - created_at::date) <= 7 THEN 1 END) as last_minute_bookings,
      COUNT(CASE WHEN (arrival::date - created_at::date) > 30 THEN 1 END) as advance_bookings,
      COUNT(*) as total_bookings
    FROM bookings
    WHERE tenant_id = $1
      AND arrival >= $2::date
      AND arrival <= $3::date
      AND status != 'canceled'
      AND created_at IS NOT NULL`,
    [tenantId, dateRange.from, dateRange.to]
  )
  
  // Overall occupancy - simplified query
  const overallResult = await query(
    `WITH booking_nights AS (
      SELECT 
        SUM(
          CASE
            WHEN b.arrival <= $3::date AND b.departure >= $2::date THEN
              LEAST(b.departure::date, $3::date) - GREATEST(b.arrival::date, $2::date)
            ELSE 0
          END
        ) as total_nights
      FROM bookings b
      WHERE b.tenant_id = $1
        AND b.departure > $2::date
        AND b.arrival < $3::date
        AND b.status != 'canceled'
    ),
    property_count AS (
      SELECT COUNT(*) as count
      FROM properties
      WHERE tenant_id = $1 AND active = true
    )
    SELECT 
      COALESCE(bn.total_nights, 0)::numeric as total_nights,
      (pc.count * (($3::date - $2::date) + 1))::numeric as available_nights
    FROM booking_nights bn
    CROSS JOIN property_count pc`,
    [tenantId, dateRange.from, dateRange.to]
  )

  const bookedNights = overallResult.success && overallResult.data[0] ? 
    parseFloat(overallResult.data[0].total_nights) : 0
  const availableNights = overallResult.success && overallResult.data[0] ? 
    parseFloat(overallResult.data[0].available_nights) : 1
  const overall = safeDivide(bookedNights, availableNights)

  // By property
  const byPropertyResult = await query<{
    property_id: string
    property_name: string
    booked_nights: string
  }>(
    `SELECT 
      p.id as property_id,
      p.name as property_name,
      COALESCE(SUM(
        CASE
          WHEN b.arrival <= $3::date AND b.departure >= $2::date THEN
            LEAST(b.departure::date, $3::date) - GREATEST(b.arrival::date, $2::date)
          ELSE 0
        END
      ), 0)::text as booked_nights
    FROM properties p
    LEFT JOIN bookings b ON p.id = b.property_id
      AND b.tenant_id = $1
      AND b.departure > $2::date
      AND b.arrival < $3::date
      AND b.status != 'canceled'
    WHERE p.tenant_id = $1 AND p.active = true
    GROUP BY p.id, p.name
    ORDER BY p.name`,
    [tenantId, dateRange.from, dateRange.to]
  )

  const days = Math.ceil((new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime()) / (1000 * 60 * 60 * 24)) + 1
  
  const byProperty = byPropertyResult.success ? byPropertyResult.data.map(row => ({
    propertyId: row.property_id,
    propertyName: row.property_name,
    rate: safeDivide(parseIntField(row.booked_nights), days),
    bookedNights: parseIntField(row.booked_nights),
    availableNights: days
  })) : []

  // By month - properly calculate available nights per month
  const byMonthResult = await query<{
    month: string
    booked_nights: string
    property_count: string
    days_in_month: string
  }>(
    `WITH monthly_bookings AS (
      SELECT 
        TO_CHAR(DATE_TRUNC('month', arrival), 'YYYY-MM') as month,
        DATE_TRUNC('month', arrival)::date as month_start,
        COALESCE(SUM(
          CASE
            WHEN arrival <= DATE_TRUNC('month', arrival) + INTERVAL '1 month' - INTERVAL '1 day'
             AND departure >= DATE_TRUNC('month', arrival) THEN
              LEAST(departure::date, (DATE_TRUNC('month', arrival) + INTERVAL '1 month' - INTERVAL '1 day')::date) 
              - GREATEST(arrival::date, DATE_TRUNC('month', arrival)::date)
            ELSE 0
          END
        ), 0)::text as booked_nights
      FROM bookings
      WHERE tenant_id = $1
        AND arrival >= $2::date
        AND arrival <= $3::date
        AND status != 'canceled'
      GROUP BY DATE_TRUNC('month', arrival)
    ),
    property_count AS (
      SELECT COUNT(*) as count
      FROM properties
      WHERE tenant_id = $1 AND active = true
    )
    SELECT 
      mb.month,
      mb.booked_nights,
      pc.count::text as property_count,
      EXTRACT(DAY FROM (mb.month_start + INTERVAL '1 month' - INTERVAL '1 day'))::text as days_in_month
    FROM monthly_bookings mb
    CROSS JOIN property_count pc
    ORDER BY mb.month`,
    [tenantId, dateRange.from, dateRange.to]
  )

  const byMonth = byMonthResult.success ? byMonthResult.data.map(row => {
    const propertyCount = parseIntField(row.property_count) || 1
    const daysInMonth = parseIntField(row.days_in_month) || 30
    const bookedNights = parseIntField(row.booked_nights)
    const availableNights = propertyCount * daysInMonth
    
    return {
      month: row.month,
      rate: safeDivide(bookedNights, availableNights),
      bookedNights: bookedNights,
      availableNights: availableNights
    }
  }) : []

  const gapDetails = gapAnalysisResult.success ? gapAnalysisResult.data.map(row => ({
    propertyName: row.property_name,
    gapStart: row.gap_start,
    gapEnd: row.gap_end,
    gapDays: parseInt(row.gap_days) || 0
  })) : []
  
  // Also get summary counts
  const gapSummaryResult = await query(
    `WITH booking_gaps AS (
      SELECT 
        (b2.arrival::date - b1.departure::date) as gap_days
      FROM bookings b1
      JOIN bookings b2 ON b1.property_id = b2.property_id
        AND b2.arrival > b1.departure
        AND b2.arrival = (
          SELECT MIN(b3.arrival)
          FROM bookings b3
          WHERE b3.property_id = b1.property_id
            AND b3.arrival > b1.departure
            AND b3.tenant_id = $1
        )
      WHERE b1.tenant_id = $1
        AND b1.departure >= $2::date
        AND b1.departure <= $3::date
        AND b1.status != 'canceled'
        AND b2.status != 'canceled'
    )
    SELECT 
      COUNT(CASE WHEN gap_days = 1 THEN 1 END) as single_night,
      COUNT(CASE WHEN gap_days = 2 THEN 1 END) as two_night,
      COUNT(CASE WHEN gap_days >= 3 AND gap_days <= 7 THEN 1 END) as short_stay,
      COUNT(*) as total
    FROM booking_gaps
    WHERE gap_days <= 7`,
    [tenantId, dateRange.from, dateRange.to]
  )
  
  const gapSummary = gapSummaryResult.success && gapSummaryResult.data[0] ? {
    singleNight: parseInt(gapSummaryResult.data[0].single_night) || 0,
    twoNight: parseInt(gapSummaryResult.data[0].two_night) || 0,
    shortStay: parseInt(gapSummaryResult.data[0].short_stay) || 0,
    total: parseInt(gapSummaryResult.data[0].total) || 0
  } : null
  
  const leadTimeMetrics = leadTimeResult.success && leadTimeResult.data[0] ? {
    avgLeadDays: parseFloat(leadTimeResult.data[0].avg_lead_days) || 0,
    medianLeadDays: parseFloat(leadTimeResult.data[0].median_lead_days) || 0,
    lastMinuteBookings: parseInt(leadTimeResult.data[0].last_minute_bookings) || 0,
    advanceBookings: parseInt(leadTimeResult.data[0].advance_bookings) || 0,
    totalBookings: parseInt(leadTimeResult.data[0].total_bookings) || 0
  } : null
  
  return {
    overall,
    bookedNights,
    availableNights,
    byProperty,
    byMonth,
    gapAnalysis: gapDetails,
    gapSummary: gapSummary,
    leadTime: leadTimeMetrics
  }
}

/**
 * Fetch guest data for reports
 * Based on guest-list.ts pattern
 */
export async function fetchGuestDataForReport(
  tenantId: string,
  dateRange: ReportDateRange
) {
  
  // Enhanced guest metrics with historical context
  const metricsResult = await query(
    `WITH guest_bookings AS (
      SELECT 
        guest_name,
        COUNT(*) as booking_count,
        SUM(total_amount) as total_spent,
        AVG(total_amount) as avg_spent,
        AVG(departure - arrival) as avg_stay_length
      FROM bookings
      WHERE tenant_id = $1
        AND arrival >= $2::date
        AND arrival <= $3::date
        AND status != 'canceled'
        AND guest_name IS NOT NULL
        AND guest_name != ''
      GROUP BY guest_name
    ),
    historical_guests AS (
      SELECT DISTINCT guest_name
      FROM bookings
      WHERE tenant_id = $1
        AND arrival < $2::date
        AND status != 'canceled'
        AND guest_name IS NOT NULL
        AND guest_name != ''
    )
    SELECT 
      COUNT(gb.guest_name)::numeric as total_guests,
      COUNT(CASE WHEN gb.booking_count > 1 THEN 1 END)::numeric as repeat_in_period,
      COUNT(hg.guest_name)::numeric as returning_guests,
      COALESCE(AVG(gb.avg_stay_length), 0)::numeric as avg_stay_length,
      COALESCE(AVG(gb.avg_spent), 0)::numeric as avg_spend,
      COALESCE(SUM(gb.total_spent), 0)::numeric as total_revenue
    FROM guest_bookings gb
    LEFT JOIN historical_guests hg ON gb.guest_name = hg.guest_name`,
    [tenantId, dateRange.from, dateRange.to]
  )

  const metrics = metricsResult.success && metricsResult.data[0] ? {
    totalGuests: parseInt(metricsResult.data[0].total_guests) || 0,
    repeatGuests: parseInt(metricsResult.data[0].repeat_in_period) || 0,
    returningGuests: parseInt(metricsResult.data[0].returning_guests) || 0,
    repeatRate: safeDivide(
      parseInt(metricsResult.data[0].repeat_in_period) || 0,
      parseInt(metricsResult.data[0].total_guests) || 1
    ),
    returningRate: safeDivide(
      parseInt(metricsResult.data[0].returning_guests) || 0,
      parseInt(metricsResult.data[0].total_guests) || 1
    ),
    avgStayLength: parseFloat(metricsResult.data[0].avg_stay_length) || 0,
    avgSpend: parseFloat(metricsResult.data[0].avg_spend) || 0,
    totalRevenue: parseFloat(metricsResult.data[0].total_revenue) || 0
  } : {
    totalGuests: 0,
    repeatGuests: 0,
    returningGuests: 0,
    repeatRate: 0,
    returningRate: 0,
    avgStayLength: 0,
    avgSpend: 0,
    totalRevenue: 0
  }

  // Enhanced top guests with lifetime value
  const guestsResult = await query(
    `WITH period_bookings AS (
      SELECT 
        guest_name,
        guest_email,
        COUNT(*) as period_bookings,
        SUM(total_amount) as period_spent,
        AVG(total_amount / NULLIF(departure - arrival, 0)) as avg_nightly_rate,
        MAX(arrival) as last_visit
      FROM bookings
      WHERE tenant_id = $1
        AND arrival >= $2::date
        AND arrival <= $3::date
        AND status != 'canceled'
        AND guest_name IS NOT NULL
        AND guest_name != ''
      GROUP BY guest_name, guest_email
    ),
    lifetime_bookings AS (
      SELECT 
        guest_name,
        COUNT(*) as total_bookings,
        SUM(total_amount) as lifetime_value,
        MIN(arrival) as first_visit_ever
      FROM bookings
      WHERE tenant_id = $1
        AND status != 'canceled'
        AND guest_name IS NOT NULL
        AND guest_name != ''
      GROUP BY guest_name
    )
    SELECT 
      pb.guest_name as name,
      pb.guest_email as email,
      pb.period_bookings::numeric as booking_count,
      pb.period_spent::numeric as total_spent,
      pb.avg_nightly_rate::numeric,
      lb.total_bookings::numeric as lifetime_bookings,
      lb.lifetime_value::numeric,
      TO_CHAR(lb.first_visit_ever, 'YYYY-MM-DD') as first_visit,
      TO_CHAR(pb.last_visit, 'YYYY-MM-DD') as last_visit
    FROM period_bookings pb
    LEFT JOIN lifetime_bookings lb ON pb.guest_name = lb.guest_name
    ORDER BY pb.period_spent DESC
    LIMIT 20`,
    [tenantId, dateRange.from, dateRange.to]
  )

  const guests = guestsResult.success ? guestsResult.data.map((row: any) => ({
    name: row.name,
    email: row.email || '',
    bookingCount: parseInt(row.booking_count) || 0,
    totalSpent: parseFloat(row.total_spent) || 0,
    avgNightlyRate: parseFloat(row.avg_nightly_rate) || 0,
    lifetimeBookings: parseInt(row.lifetime_bookings) || 0,
    lifetimeValue: parseFloat(row.lifetime_value) || 0,
    firstVisit: row.first_visit,
    lastVisit: row.last_visit
  })) : []

  return { metrics, guests }
}

/**
 * Fetch tax data for reports
 */
export async function fetchTaxDataForReport(
  tenantId: string,
  dateRange: ReportDateRange
) {
  
  // Tax summary from bookings with configured tax rates (using JSONB jurisdictions)
  const taxResult = await query<{
    property_name: string
    tax_name: string
    tax_rate: string
    total_revenue: string
    estimated_tax: string
  }>(
    `WITH tax_jurisdictions AS (
      SELECT 
        ptc.property_id,
        ptc.tenant_id,
        jsonb_array_elements(ptc.jurisdictions) as jurisdiction
      FROM property_tax_configs ptc
      WHERE ptc.tenant_id = $1 
        AND ptc.is_active = true
        AND ptc.effective_from <= $3::date
        AND (ptc.effective_to IS NULL OR ptc.effective_to >= $2::date)
    )
    SELECT 
      p.name as property_name,
      COALESCE(tj.jurisdiction->>'name', 'Tax') as tax_name,
      COALESCE((tj.jurisdiction->>'rate')::numeric, 0)::text as tax_rate,
      COALESCE(SUM(b.total_amount), 0)::text as total_revenue,
      COALESCE(SUM(b.total_amount * COALESCE((tj.jurisdiction->>'rate')::numeric, 0) / 100), 0)::text as estimated_tax
    FROM properties p
    LEFT JOIN tax_jurisdictions tj ON p.id = tj.property_id
    LEFT JOIN bookings b ON p.id = b.property_id
      AND b.tenant_id = $1
      AND b.arrival >= $2::date
      AND b.arrival <= $3::date
      AND b.status != 'canceled'
    WHERE p.tenant_id = $1 AND p.active = true
    GROUP BY p.name, tj.jurisdiction->>'name', tj.jurisdiction->>'rate'
    ORDER BY estimated_tax DESC`,
    [tenantId, dateRange.from, dateRange.to]
  )

  // Aggregate tax by type
  const taxBreakdown: Record<string, number> = {}
  let totalTax = 0

  if (taxResult.success) {
    taxResult.data.forEach(row => {
      const taxAmount = parseNumericField(row.estimated_tax)
      const taxName = row.tax_name || 'Tax'
      
      if (!taxBreakdown[taxName]) {
        taxBreakdown[taxName] = 0
      }
      taxBreakdown[taxName] += taxAmount
      totalTax += taxAmount
    })
  }

  // By property - sum all tax jurisdictions per property
  const byPropertyResult = await query<{
    property_id: string
    property_name: string
    booking_count: string
    total_tax: string
  }>(
    `WITH property_tax_rates AS (
      SELECT 
        ptc.property_id,
        COALESCE(SUM((j->>'rate')::numeric), 0) as total_rate
      FROM property_tax_configs ptc,
        jsonb_array_elements(ptc.jurisdictions) as j
      WHERE ptc.tenant_id = $1 
        AND ptc.is_active = true
        AND ptc.effective_from <= $3::date
        AND (ptc.effective_to IS NULL OR ptc.effective_to >= $2::date)
      GROUP BY ptc.property_id
    )
    SELECT 
      p.id as property_id,
      p.name as property_name,
      COUNT(b.id)::text as booking_count,
      COALESCE(
        SUM(b.total_amount * COALESCE(ptr.total_rate, 0) / 100), 
        0
      )::text as total_tax
    FROM properties p
    LEFT JOIN property_tax_rates ptr ON p.id = ptr.property_id
    LEFT JOIN bookings b ON p.id = b.property_id
      AND b.tenant_id = $1
      AND b.arrival >= $2::date
      AND b.arrival <= $3::date
      AND b.status != 'canceled'
    WHERE p.tenant_id = $1 AND p.active = true
    GROUP BY p.id, p.name
    ORDER BY total_tax DESC`,
    [tenantId, dateRange.from, dateRange.to]
  )

  const byProperty = byPropertyResult.success ? byPropertyResult.data.map(row => ({
    propertyId: row.property_id,
    propertyName: row.property_name,
    bookingCount: parseIntField(row.booking_count),
    totalTax: parseNumericField(row.total_tax)
  })) : []

  return {
    summary: {
      totalTax,
      taxBreakdown: Object.entries(taxBreakdown).map(([name, amount]) => ({
        name,
        type: name.toLowerCase().replace(/\s+/g, '_'),
        amount
      }))
    },
    byProperty
  }
}