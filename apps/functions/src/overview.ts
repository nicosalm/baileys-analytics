// apps/functions/src/overview.ts
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { requireAuthWithValidation } from './middleware/validation'
import { financialQuerySchema } from '@baileys/shared-types'
import { query } from './services/database'

interface OverviewMetrics {
  revenue: {
    current: number
    previous: number
    growth: number
    net: number
    avgBookingValue: number
  }
  bookings: {
    current: number
    upcoming: number
    cancellationRate: number
    avgNights: number
  }
  occupancy: {
    current: number
    trend: 'up' | 'down' | 'stable'
    avgPropertyOccupancy: number
  }
  guests: {
    total: number
    newThisMonth: number
    repeatRate: number
  }
  properties: {
    total: number
    avgOccupancy: number
  }
}

export async function overview(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authCheck = await requireAuthWithValidation(request, {
    query: financialQuerySchema
  })
  
  if (!authCheck.authenticated || !authCheck.valid) {
    return authCheck.response
  }

  const { auth, validated } = authCheck.request
  const tenantId = auth.tenantId
  const userId = auth.userId

  if (!tenantId) {
    return {
      status: 403,
      jsonBody: { error: 'No tenant associated with user' }
    }
  }

  // Use validated query parameters
  const from = validated?.query?.from || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
  const to = validated?.query?.to || new Date().toISOString().split('T')[0]
  const tagIds = validated?.query?.tags || []

  try {
    // Get current period metrics
    const currentMetrics = await getCurrentPeriodMetrics(tenantId, from, to, tagIds, userId)

    // Get previous period for comparison
    const daysDiff = Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24))
    const prevFrom = new Date(new Date(from).getTime() - daysDiff * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const prevTo = new Date(new Date(from).getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const previousMetrics = await getCurrentPeriodMetrics(tenantId, prevFrom, prevTo, tagIds, userId)

    // Get charts data
    const charts = await getChartsData(tenantId, from, to, tagIds)

    // Get alerts
    const alerts = await getAlerts(tenantId, from, to)

    // Get recent activity
    const recentActivity = await getRecentActivity(tenantId)

    const metrics: OverviewMetrics = {
      revenue: {
        current: currentMetrics.revenue,
        previous: previousMetrics.revenue,
        growth: previousMetrics.revenue > 0
          ? ((currentMetrics.revenue - previousMetrics.revenue) / previousMetrics.revenue) * 100
          : 0,
        net: currentMetrics.netRevenue,
        avgBookingValue: currentMetrics.avgBookingValue
      },
      bookings: {
        current: currentMetrics.bookings,
        upcoming: currentMetrics.upcomingBookings,
        cancellationRate: currentMetrics.cancellationRate,
        avgNights: currentMetrics.avgNights
      },
      occupancy: {
        current: currentMetrics.occupancyRate,
        trend: currentMetrics.occupancyRate > previousMetrics.occupancyRate ? 'up' :
               currentMetrics.occupancyRate < previousMetrics.occupancyRate ? 'down' : 'stable',
        avgPropertyOccupancy: currentMetrics.avgPropertyOccupancy
      },
      guests: {
        total: currentMetrics.totalGuests,
        newThisMonth: currentMetrics.newGuests,
        repeatRate: currentMetrics.repeatGuestRate
      },
      properties: {
        total: currentMetrics.totalProperties,
        avgOccupancy: currentMetrics.avgPropertyOccupancy
      }
    }

    return {
      status: 200,
      jsonBody: {
        metrics,
        alerts,
        recentActivity,
        charts
      }
    }
  } catch (error) {
    context.error('Error in overview function:', error)
    return {
      status: 500,
      jsonBody: { error: 'Failed to fetch overview data' }
    }
  }
}

async function getCurrentPeriodMetrics(tenantId: string, from: string, to: string, tagIds: string[] = [], userId?: string) {
  const hasTagFilter = tagIds.length > 0
  
  
  const metricsQuery = `
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
        b.id, b.total_amount, b.arrival, b.departure, b.platform, b.guest_name, b.status,
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
      ${hasTagFilter ? 'INNER JOIN booking_tags bt ON b.id = bt.booking_id' : ''}
      WHERE b.tenant_id = $1
        AND b.arrival >= $2::date
        AND b.arrival <= $3::date
        AND b.status != 'canceled'
        ${hasTagFilter ? `AND bt.tag_id = ANY($4::uuid[])` : ''}
    ),
    fee_calc AS (
      SELECT
        bd.id, bd.total_amount, bd.arrival, bd.departure, bd.guest_name,
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
    ),
    booking_stats AS (
      SELECT
        COUNT(DISTINCT fc.id) as total_bookings,
        COUNT(DISTINCT CASE WHEN fc.arrival > CURRENT_DATE THEN fc.id END) as upcoming_bookings,
        COALESCE(SUM(fc.total_amount), 0) as total_revenue,
        COALESCE(SUM(fc.total_amount - fc.platform_fee - COALESCE(td.tax_amount, 0)), 0) as net_revenue,
        COALESCE(SUM(fc.platform_fee), 0) as total_fees,
        COALESCE(SUM(td.tax_amount), 0) as total_taxes,
        COUNT(DISTINCT fc.guest_name) as unique_guests,
        AVG(fc.departure::date - fc.arrival::date) as avg_nights,
        AVG(fc.total_amount) as avg_booking_value
      FROM fee_calc fc
      LEFT JOIN tax_data td ON fc.id = td.id
    ),
    cancelled_stats AS (
      SELECT
        COUNT(DISTINCT b.id) as cancelled_bookings
      FROM bookings b
      ${hasTagFilter ? 'INNER JOIN booking_tags bt ON b.id = bt.booking_id' : ''}
      WHERE b.tenant_id = $1
        AND b.arrival >= $2::date
        AND b.arrival <= $3::date
        AND b.status = 'canceled'
        ${hasTagFilter ? `AND bt.tag_id = ANY($4::uuid[])` : ''}
    ),
    occupancy_stats AS (
      WITH property_availability AS (
        SELECT
          p.id as property_id,
          COALESCE(MIN(b_hist.arrival), $2::date) as available_from,
          LEAST($3::date, CURRENT_DATE) as available_to
        FROM properties p
        LEFT JOIN bookings b_hist ON p.id = b_hist.property_id
          AND b_hist.tenant_id = p.tenant_id
          AND b_hist.status != 'canceled'
        WHERE p.tenant_id = $1
          AND p.active = true
        GROUP BY p.id
      ),
      available_nights_calc AS (
        SELECT SUM(
          CASE 
            WHEN available_from > available_to THEN 0
            ELSE (available_to - GREATEST(available_from, $2::date) + 1)
          END
        ) as total_available
        FROM property_availability
      ),
      booked_nights_calc AS (
        SELECT
          COALESCE(SUM(
            CASE
              WHEN b.arrival <= $3::date AND b.departure >= $2::date THEN
                LEAST(b.departure, $3::date, CURRENT_DATE) - GREATEST(b.arrival, $2::date)
              ELSE 0
            END
          ), 0) as total_booked
        FROM bookings b
        JOIN properties p ON b.property_id = p.id
        WHERE b.tenant_id = $1
          AND b.arrival <= $3::date
          AND b.departure >= $2::date
          AND b.status != 'canceled'
          AND p.active = true
          ${hasTagFilter ? `AND b.id IN (SELECT booking_id FROM booking_tags WHERE tag_id = ANY($4::uuid[]))` : ''}
      )
      SELECT
        bn.total_booked as booked_nights,
        an.total_available as available_nights
      FROM booked_nights_calc bn
      CROSS JOIN available_nights_calc an
    ),
    guest_stats AS (
      WITH guest_bookings AS (
        SELECT
          LOWER(TRIM(b.guest_name)) as normalized_name,
          COALESCE(LOWER(TRIM(b.guest_email)), '') as normalized_email,
          COUNT(*) as booking_count
        FROM bookings b
        ${hasTagFilter ? 'INNER JOIN booking_tags bt ON b.id = bt.booking_id' : ''}
        WHERE b.tenant_id = $1
          AND b.arrival >= $2::date
          AND b.arrival <= $3::date
          AND b.status != 'canceled'
          ${hasTagFilter ? `AND bt.tag_id = ANY($4::uuid[])` : ''}
        GROUP BY LOWER(TRIM(b.guest_name)), COALESCE(LOWER(TRIM(b.guest_email)), '')
      )
      SELECT
        COUNT(DISTINCT (gb.normalized_name, gb.normalized_email)) as total_guests,
        COUNT(DISTINCT CASE
          WHEN NOT EXISTS (
            SELECT 1 FROM bookings b_prev
            WHERE b_prev.tenant_id = $1
              AND b_prev.arrival < $2::date
              AND LOWER(TRIM(b_prev.guest_name)) = gb.normalized_name
              AND COALESCE(LOWER(TRIM(b_prev.guest_email)), '') = gb.normalized_email
              AND b_prev.status != 'canceled'
          )
          THEN (gb.normalized_name, gb.normalized_email)
        END) as new_guests_this_month,
        COUNT(DISTINCT CASE
          WHEN gb.booking_count > 1
          THEN (gb.normalized_name, gb.normalized_email)
        END) as repeat_guests,
        0 as vip_guests -- Deprecated: VIP concept removed
      FROM guest_bookings gb
    ),
    property_performance AS (
      WITH property_windows AS (
        SELECT
          p.id,
          p.name,
          COALESCE(MIN(b_hist.arrival), $2::date) as available_from,
          LEAST($3::date, CURRENT_DATE) as available_to
        FROM properties p
        LEFT JOIN bookings b_hist ON p.id = b_hist.property_id
          AND b_hist.tenant_id = p.tenant_id
          AND b_hist.status != 'canceled'
        WHERE p.tenant_id = $1
          AND p.active = true
        GROUP BY p.id, p.name
      )
      SELECT
        COUNT(DISTINCT pw.id) as total_properties,
        AVG(COALESCE(prop_occ.occupancy_rate, 0)) as avg_property_occupancy
      FROM property_windows pw
      ${hasTagFilter ? `
        INNER JOIN (
          SELECT DISTINCT property_id 
          FROM bookings b2
          INNER JOIN booking_tags bt2 ON b2.id = bt2.booking_id
          WHERE b2.tenant_id = $1 AND bt2.tag_id = ANY($4::uuid[])
        ) tagged_props ON pw.id = tagged_props.property_id` : ''}
      LEFT JOIN LATERAL (
        SELECT 
          CASE 
            WHEN pw.available_from > pw.available_to THEN 0
            ELSE 
              COUNT(DISTINCT booking_date)::numeric / 
              NULLIF(pw.available_to - GREATEST(pw.available_from, $2::date) + 1, 0)
          END as occupancy_rate
        FROM bookings b
        LEFT JOIN LATERAL generate_series(
          GREATEST(b.arrival::date, $2::date),
          LEAST(b.departure::date - interval '1 day', $3::date),
          interval '1 day'
        ) AS booking_date ON true
        WHERE b.property_id = pw.id
          AND b.tenant_id = $1
          AND b.status != 'canceled'
          AND b.arrival <= $3::date
          AND b.departure > $2::date
      ) prop_occ ON true
    )
    SELECT
      COALESCE(bs.total_revenue, 0) as revenue,
      COALESCE(bs.net_revenue, 0) as "netRevenue",
      COALESCE(bs.total_bookings, 0) as bookings,
      COALESCE(bs.upcoming_bookings, 0) as "upcomingBookings",
      COALESCE(cs.cancelled_bookings::numeric / NULLIF(bs.total_bookings + cs.cancelled_bookings, 0) * 100, 0) as "cancellationRate",
      COALESCE(os.booked_nights::numeric / NULLIF(os.available_nights, 0), 0) as "occupancyRate",
      COALESCE(gs.total_guests, 0) as "totalGuests",
      COALESCE(gs.new_guests_this_month, 0) as "newGuests",
      COALESCE(gs.repeat_guests::numeric / NULLIF(gs.total_guests, 0), 0) as "repeatGuestRate",
      COALESCE(bs.avg_booking_value, 0) as "avgBookingValue",
      COALESCE(bs.avg_nights, 0) as "avgNights",
      COALESCE(pp.total_properties, 0) as "totalProperties",
      COALESCE(pp.avg_property_occupancy, 0) as "avgPropertyOccupancy",
      COALESCE(bs.total_fees, 0) as "platformFees",
      COALESCE(bs.total_taxes, 0) as "taxes"
    FROM booking_stats bs
    CROSS JOIN cancelled_stats cs
    CROSS JOIN occupancy_stats os
    CROSS JOIN guest_stats gs
    CROSS JOIN property_performance pp
  `

  const params = hasTagFilter ? [tenantId, from, to, tagIds] : [tenantId, from, to]
  const result = await query(metricsQuery, params)

  if (!result.success) {
    throw new Error(`Failed to get metrics: ${result.error}`)
  }

  return result.data[0] || {
    revenue: 0,
    netRevenue: 0,
    bookings: 0,
    upcomingBookings: 0,
    cancellationRate: 0,
    occupancyRate: 0,
    totalGuests: 0,
    newGuests: 0,
    repeatGuestRate: 0,
    avgBookingValue: 0,
    avgNights: 0,
    totalProperties: 0,
    avgPropertyOccupancy: 0,
    platformFees: 0,
    taxes: 0
  }
}

async function getChartsData(tenantId: string, from: string, to: string, tagIds: string[] = []) {
  const hasTagFilter = tagIds.length > 0
  
  // Revenue last 7 days
  const revenueQuery = `
    SELECT
      b.arrival::date as day,
      SUM(b.total_amount) as revenue
    FROM bookings b
    ${hasTagFilter ? 'INNER JOIN booking_tags bt ON b.id = bt.booking_id' : ''}
    WHERE b.tenant_id = $1
      AND b.arrival >= CURRENT_DATE - INTERVAL '7 days'
      AND b.status != 'canceled'
      ${hasTagFilter ? `AND bt.tag_id = ANY($2::uuid[])` : ''}
    GROUP BY b.arrival::date
    ORDER BY day DESC
    LIMIT 7
  `

  // Top properties
  const propertiesQuery = `
    SELECT
      p.name,
      COALESCE(SUM(b.total_amount), 0) as revenue,
      COUNT(b.id) as bookings
    FROM properties p
    LEFT JOIN bookings b ON b.property_id = p.id
      AND b.tenant_id = $1
      AND b.arrival >= $2::date
      AND b.arrival <= $3::date
      AND b.status != 'canceled'
      ${hasTagFilter ? `AND b.id IN (SELECT booking_id FROM booking_tags WHERE tag_id = ANY($4::uuid[]))` : ''}
    WHERE p.tenant_id = $1
    GROUP BY p.id, p.name
    ORDER BY revenue DESC
    LIMIT 5
  `

  // Bookings by source
  const sourcesQuery = `
    SELECT
      COALESCE(b.platform, 'Direct') as source,
      COUNT(*) as count
    FROM bookings b
    ${hasTagFilter ? 'INNER JOIN booking_tags bt ON b.id = bt.booking_id' : ''}
    WHERE b.tenant_id = $1
      AND b.arrival >= $2::date
      AND b.arrival <= $3::date
      AND b.status != 'canceled'
      ${hasTagFilter ? `AND bt.tag_id = ANY($4::uuid[])` : ''}
    GROUP BY b.platform
    ORDER BY count DESC
  `

  // Occupancy trend (last 6 months)
  const occupancyQuery = `
    WITH months AS (
      SELECT generate_series(
        date_trunc('month', CURRENT_DATE - INTERVAL '5 months'),
        date_trunc('month', CURRENT_DATE),
        '1 month'::interval
      )::date as month_start
    ),
    property_availability AS (
      SELECT
        p.id as property_id,
        COALESCE(MIN(b.arrival), date_trunc('month', CURRENT_DATE - INTERVAL '5 months')) as first_booking
      FROM properties p
      LEFT JOIN bookings b ON p.id = b.property_id
        AND b.tenant_id = p.tenant_id
        AND b.status != 'canceled'
      WHERE p.tenant_id = $1
        AND p.active = true
      GROUP BY p.id
    ),
    monthly_available AS (
      SELECT
        m.month_start,
        SUM(
          CASE
            WHEN pa.first_booking <= m.month_start + interval '1 month' - interval '1 day' THEN
              LEAST(m.month_start + interval '1 month' - interval '1 day', CURRENT_DATE)::date -
              GREATEST(m.month_start, pa.first_booking)::date + 1
            ELSE 0
          END
        ) as total_available
      FROM months m
      CROSS JOIN property_availability pa
      GROUP BY m.month_start
    ),
    monthly_booked AS (
      SELECT
        m.month_start,
        COALESCE(SUM(
          CASE
            WHEN b.arrival <= m.month_start + interval '1 month' - interval '1 day' 
              AND b.departure > m.month_start THEN
              LEAST(b.departure::date, m.month_start + interval '1 month', CURRENT_DATE + interval '1 day')::date -
              GREATEST(b.arrival::date, m.month_start)::date
            ELSE 0
          END
        ), 0) as total_booked
      FROM months m
      LEFT JOIN bookings b ON b.tenant_id = $1
        AND b.status != 'canceled'
        AND b.arrival <= m.month_start + interval '1 month' - interval '1 day'
        AND b.departure > m.month_start
      JOIN properties p ON b.property_id = p.id
        AND p.active = true
      GROUP BY m.month_start
    )
    SELECT
      TO_CHAR(ma.month_start, 'Mon') as month,
      CASE 
        WHEN ma.total_available > 0 THEN
          ROUND((mb.total_booked::numeric / ma.total_available) * 100, 1)
        ELSE 0
      END as rate
    FROM monthly_available ma
    JOIN monthly_booked mb ON ma.month_start = mb.month_start
    ORDER BY ma.month_start
  `

  const revenueParams = hasTagFilter ? [tenantId, tagIds] : [tenantId]
  const chartParams = hasTagFilter ? [tenantId, from, to, tagIds] : [tenantId, from, to]
  
  const [revenue, properties, sources, occupancy] = await Promise.all([
    query(revenueQuery, revenueParams),
    query(propertiesQuery, chartParams),
    query(sourcesQuery, chartParams),
    query(occupancyQuery, [tenantId])  // Occupancy trend doesn't need tag filtering for historical view
  ])

  // Check all queries succeeded
  if (!revenue.success || !properties.success || !sources.success || !occupancy.success) {
    throw new Error('Failed to fetch chart data')
  }

  return {
    revenueLastWeek: revenue.data.map((r: any) => ({
      day: new Date(r.day).toLocaleDateString('en-US', { weekday: 'short' }),
      revenue: parseFloat(r.revenue || 0)
    })).reverse(),
    topProperties: properties.data,
    bookingsBySource: sources.data,
    occupancyTrend: occupancy.data
  }
}

async function getAlerts(tenantId: string, from: string, to: string) {
  const alerts = []

  // Check for low occupancy
  const occupancyCheckQuery = `
    WITH next_30_days AS (
      SELECT
        COUNT(DISTINCT b.id) as booked_days,
        COUNT(DISTINCT p.id) * 30 as available_days
      FROM properties p
      LEFT JOIN bookings b ON b.property_id = p.id
        AND b.tenant_id = $1
        AND b.arrival >= CURRENT_DATE
        AND b.arrival < CURRENT_DATE + INTERVAL '30 days'
        AND b.status != 'canceled'
      WHERE p.tenant_id = $1
    )
    SELECT
      COALESCE(booked_days::numeric / NULLIF(available_days, 0), 0) as avg_occupancy
    FROM next_30_days
  `

  const occupancyCheck = await query(occupancyCheckQuery, [tenantId])

  if (occupancyCheck.success && occupancyCheck.data[0]?.avg_occupancy < 0.5) {
    alerts.push({
      id: 'low-occupancy',
      type: 'warning' as const,
      title: 'Low Upcoming Occupancy',
      description: `Next 30 days occupancy is below 50%. Consider promotional pricing.`,
      timestamp: new Date().toISOString()
    })
  }

  // Check for upcoming arrivals
  const upcomingArrivalsQuery = `
    SELECT COUNT(*) as count
    FROM bookings
    WHERE tenant_id = $1
      AND arrival BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
      AND status != 'canceled'
  `

  const upcomingArrivals = await query(upcomingArrivalsQuery, [tenantId])

  if (upcomingArrivals.success && upcomingArrivals.data[0]?.count > 0) {
    alerts.push({
      id: 'upcoming-arrivals',
      type: 'info' as const,
      title: 'Upcoming Arrivals',
      description: `${upcomingArrivals.data[0].count} guests arriving in the next 7 days`,
      timestamp: new Date().toISOString()
    })
  }

  // Check for high cancellation rate in selected period
  const cancellationQuery = `
    SELECT
      COUNT(DISTINCT CASE WHEN status = 'canceled' THEN id END)::numeric / 
      NULLIF(COUNT(DISTINCT id), 0) * 100 as cancellation_rate
    FROM bookings
    WHERE tenant_id = $1
      AND arrival >= $2::date
      AND arrival <= $3::date
  `

  const cancellationCheck = await query(cancellationQuery, [tenantId, from, to])

  if (cancellationCheck.success && cancellationCheck.data[0]?.cancellation_rate > 10) {
    alerts.push({
      id: 'high-cancellations',
      type: 'warning' as const,
      title: 'High Cancellation Rate',
      description: `Cancellation rate in selected period is ${Math.round(cancellationCheck.data[0].cancellation_rate)}%. Review your cancellation policy.`,
      timestamp: new Date().toISOString()
    })
  }

  // Check for revenue milestone
  const revenueQuery = `
    SELECT SUM(total_amount) as month_revenue
    FROM bookings
    WHERE tenant_id = $1
      AND arrival >= date_trunc('month', CURRENT_DATE)
      AND status != 'canceled'
  `

  const revenueCheck = await query(revenueQuery, [tenantId])

  if (revenueCheck.success && revenueCheck.data[0]?.month_revenue > 100000) {
    alerts.push({
      id: 'revenue-milestone',
      type: 'success' as const,
      title: 'Revenue Milestone',
      description: `Congratulations! You've exceeded $100k in revenue this month.`,
      timestamp: new Date().toISOString()
    })
  }

  // Check for properties needing attention
  const underperformingQuery = `
    SELECT
      p.name,
      COUNT(b.id) as booking_count
    FROM properties p
    LEFT JOIN bookings b ON b.property_id = p.id
      AND b.tenant_id = $1
      AND b.arrival >= CURRENT_DATE - INTERVAL '30 days'
      AND b.status != 'canceled'
    WHERE p.tenant_id = $1
    GROUP BY p.id, p.name
    HAVING COUNT(b.id) = 0
    LIMIT 3
  `

  const underperforming = await query(underperformingQuery, [tenantId])

  if (underperforming.success && underperforming.data.length > 0) {
    alerts.push({
      id: 'underperforming-properties',
      type: 'warning' as const,
      title: 'Properties Need Attention',
      description: `${underperforming.data.length} properties have no bookings in the last 30 days.`,
      timestamp: new Date().toISOString()
    })
  }

  return alerts
}

async function getRecentActivity(tenantId: string) {
  // Simply show most recent bookings by any available date
  const activityQuery = `
    SELECT
      b.id,
      CASE 
        WHEN b.arrival > CURRENT_DATE THEN 'upcoming'
        WHEN b.departure >= CURRENT_DATE THEN 'current'
        ELSE 'past'
      END as type,
      CONCAT(
        b.guest_name, ' - ', p.name, ' (', 
        TO_CHAR(b.arrival, 'Mon DD'), ' to ', 
        TO_CHAR(b.departure, 'Mon DD'), ')'
      ) as description,
      COALESCE(
        b.booked_utc, 
        b.created_at, 
        b.updated_at,
        b.arrival
      ) as timestamp,
      b.total_amount as value
    FROM bookings b
    JOIN properties p ON p.id = b.property_id
    WHERE b.tenant_id = $1
      AND b.status != 'canceled'
    ORDER BY 
      COALESCE(
        b.booked_utc, 
        b.created_at, 
        b.updated_at,
        b.arrival
      ) DESC NULLS LAST
    LIMIT 10
  `

  const result = await query(activityQuery, [tenantId])

  if (!result.success) {
    console.error('Failed to fetch recent activity:', result.error)
    return [] // Return empty array if query fails
  }

  return result.data || []
}

app.http('overview', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: overview
})
