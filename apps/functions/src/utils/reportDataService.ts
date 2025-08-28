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
  console.log('[fetchPropertyMetricsForReport] Fetching for tenant:', tenantId, 'dateRange:', dateRange)
  
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
      console.error('[fetchPropertyMetricsForReport] Query failed')
      return []
    }

    console.log('[fetchPropertyMetricsForReport] Got', result.data.length, 'properties')
    
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
    
    console.log('[fetchPropertyMetricsForReport] Returning', mappedResults.length, 'mapped properties')
    return mappedResults
  } catch (error) {
    console.error('[fetchPropertyMetricsForReport] Error:', error)
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
  console.log('[fetchOccupancyDataForReport] Fetching for tenant:', tenantId, 'dateRange:', dateRange)
  
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

  console.log('[fetchOccupancyDataForReport] Overall:', (overall * 100).toFixed(1), '%')

  return {
    overall,
    bookedNights,
    availableNights,
    byProperty,
    byMonth
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
  console.log('[fetchGuestDataForReport] Fetching for tenant:', tenantId, 'dateRange:', dateRange)
  
  // Guest metrics - simplified and fixed
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
    )
    SELECT 
      COUNT(*)::numeric as total_guests,
      COUNT(CASE WHEN booking_count > 1 THEN 1 END)::numeric as repeat_guests,
      COALESCE(AVG(avg_stay_length), 0)::numeric as avg_stay_length,
      COALESCE(AVG(avg_spent), 0)::numeric as avg_spend,
      COALESCE(SUM(total_spent), 0)::numeric as total_revenue
    FROM guest_bookings`,
    [tenantId, dateRange.from, dateRange.to]
  )

  const metrics = metricsResult.success && metricsResult.data[0] ? {
    totalGuests: parseInt(metricsResult.data[0].total_guests) || 0,
    repeatGuests: parseInt(metricsResult.data[0].repeat_guests) || 0,
    repeatRate: safeDivide(
      parseInt(metricsResult.data[0].repeat_guests) || 0,
      parseInt(metricsResult.data[0].total_guests) || 1
    ),
    avgStayLength: parseFloat(metricsResult.data[0].avg_stay_length) || 0,
    avgSpend: parseFloat(metricsResult.data[0].avg_spend) || 0,
    totalRevenue: parseFloat(metricsResult.data[0].total_revenue) || 0
  } : {
    totalGuests: 0,
    repeatGuests: 0,
    repeatRate: 0,
    avgStayLength: 0,
    avgSpend: 0,
    totalRevenue: 0
  }

  // Top guests
  const guestsResult = await query(
    `SELECT 
      guest_name as name,
      guest_email as email,
      COUNT(*)::numeric as booking_count,
      SUM(total_amount)::numeric as total_spent,
      AVG(total_amount / NULLIF(departure - arrival, 0))::numeric as avg_nightly_rate,
      TO_CHAR(MIN(arrival), 'YYYY-MM-DD') as first_visit,
      TO_CHAR(MAX(arrival), 'YYYY-MM-DD') as last_visit
    FROM bookings
    WHERE tenant_id = $1
      AND arrival >= $2::date
      AND arrival <= $3::date
      AND status != 'canceled'
      AND guest_name IS NOT NULL
      AND guest_name != ''
    GROUP BY guest_name, guest_email
    ORDER BY SUM(total_amount) DESC
    LIMIT 20`,
    [tenantId, dateRange.from, dateRange.to]
  )

  const guests = guestsResult.success ? guestsResult.data.map((row: any) => ({
    name: row.name,
    email: row.email || '',
    bookingCount: parseInt(row.booking_count) || 0,
    totalSpent: parseFloat(row.total_spent) || 0,
    avgNightlyRate: parseFloat(row.avg_nightly_rate) || 0,
    firstVisit: row.first_visit,
    lastVisit: row.last_visit
  })) : []

  console.log('[fetchGuestDataForReport] Metrics:', metrics.totalGuests, 'guests')

  return { metrics, guests }
}

/**
 * Fetch tax data for reports
 */
export async function fetchTaxDataForReport(
  tenantId: string,
  dateRange: ReportDateRange
) {
  console.log('[fetchTaxDataForReport] Fetching for tenant:', tenantId, 'dateRange:', dateRange)
  
  // Tax summary from bookings with configured tax rates
  const taxResult = await query<{
    property_name: string
    tax_name: string
    tax_rate: string
    total_revenue: string
    estimated_tax: string
  }>(
    `SELECT 
      p.name as property_name,
      COALESCE(ptc.tax_name, 'Tax') as tax_name,
      COALESCE(ptc.tax_rate, 0)::text as tax_rate,
      COALESCE(SUM(b.total_amount), 0)::text as total_revenue,
      COALESCE(SUM(b.total_amount * COALESCE(ptc.tax_rate, 0) / 100), 0)::text as estimated_tax
    FROM properties p
    LEFT JOIN property_tax_configs ptc ON p.id = ptc.property_id
      AND ptc.tenant_id = $1
    LEFT JOIN bookings b ON p.id = b.property_id
      AND b.tenant_id = $1
      AND b.arrival >= $2::date
      AND b.arrival <= $3::date
      AND b.status != 'canceled'
    WHERE p.tenant_id = $1 AND p.active = true
    GROUP BY p.name, ptc.tax_name, ptc.tax_rate
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

  // By property
  const byPropertyResult = await query<{
    property_id: string
    property_name: string
    booking_count: string
    total_tax: string
  }>(
    `SELECT 
      p.id as property_id,
      p.name as property_name,
      COUNT(b.id)::text as booking_count,
      COALESCE(
        SUM(b.total_amount * COALESCE(ptc.tax_rate, 0) / 100), 
        0
      )::text as total_tax
    FROM properties p
    LEFT JOIN property_tax_configs ptc ON p.id = ptc.property_id
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

  console.log('[fetchTaxDataForReport] Total tax:', totalTax)

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