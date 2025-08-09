// apps/functions/src/overview.ts
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { requireAuth } from './middleware/auth'
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
    vipCount: number
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
  const authCheck = await requireAuth(request)
  if (!authCheck.authenticated) {
    return authCheck.response
  }

  const { auth } = authCheck.request
  const tenantId = auth.tenantId

  if (!tenantId) {
    return {
      status: 403,
      jsonBody: { error: 'No tenant associated with user' }
    }
  }

  const url = new URL(request.url)
  const from = url.searchParams.get('from') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
  const to = url.searchParams.get('to') || new Date().toISOString().split('T')[0]
  const tagsParam = url.searchParams.get('tags')
  const tagIds = tagsParam ? tagsParam.split(',').filter(Boolean) : []

  try {
    // Get current period metrics
    const currentMetrics = await getCurrentPeriodMetrics(tenantId, from, to, tagIds)

    // Get previous period for comparison
    const daysDiff = Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24))
    const prevFrom = new Date(new Date(from).getTime() - daysDiff * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const prevTo = new Date(new Date(from).getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const previousMetrics = await getCurrentPeriodMetrics(tenantId, prevFrom, prevTo, tagIds)

    // Get charts data
    const charts = await getChartsData(tenantId, from, to, tagIds)

    // Get alerts
    const alerts = await getAlerts(tenantId)

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
        repeatRate: currentMetrics.repeatGuestRate,
        vipCount: currentMetrics.vipGuests
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

async function getCurrentPeriodMetrics(tenantId: string, from: string, to: string, tagIds: string[] = []) {
  const hasTagFilter = tagIds.length > 0
  
  const metricsQuery = `
    WITH booking_stats AS (
      SELECT
        COUNT(DISTINCT b.id) as total_bookings,
        COUNT(DISTINCT CASE WHEN b.status = 'cancelled' OR b.status = 'canceled' THEN b.id END) as cancelled_bookings,
        COUNT(DISTINCT CASE WHEN b.arrival > CURRENT_DATE THEN b.id END) as upcoming_bookings,
        COALESCE(SUM(b.total_amount), 0) as total_revenue,
        COALESCE(SUM(b.total_amount * 0.85), 0) as net_revenue,
        COUNT(DISTINCT b.guest_name) as unique_guests,
        AVG(b.departure::date - b.arrival::date) as avg_nights,
        AVG(b.total_amount) as avg_booking_value
      FROM bookings b
      ${hasTagFilter ? 'INNER JOIN booking_tags bt ON b.id = bt.booking_id' : ''}
      WHERE b.tenant_id = $1
        AND b.arrival >= $2::date
        AND b.arrival <= $3::date
        ${hasTagFilter ? `AND bt.tag_id = ANY($4::uuid[])` : ''}
    ),
    occupancy_stats AS (
      SELECT
        COUNT(DISTINCT b.id) as booked_count,
        COUNT(DISTINCT p.id) as property_count,
        GREATEST(1, ($3::date - $2::date + 1)) as period_days,
        COALESCE(AVG(b.departure::date - b.arrival::date), 0) as avg_stay_length
      FROM properties p
      LEFT JOIN bookings b ON b.property_id = p.id
        AND b.tenant_id = $1
        AND b.status NOT IN ('cancelled', 'canceled')
        AND b.arrival <= $3::date
        AND b.departure >= $2::date
        ${hasTagFilter ? 'AND b.id IN (SELECT booking_id FROM booking_tags WHERE tag_id = ANY($4::uuid[]))' : ''}
      WHERE p.tenant_id = $1
    ),
    guest_stats AS (
      SELECT
        COUNT(DISTINCT b.guest_name) as total_guests,
        COUNT(DISTINCT CASE
          WHEN b.booked_utc >= date_trunc('month', CURRENT_DATE)
          THEN b.guest_name
        END) as new_guests_this_month,
        COUNT(DISTINCT CASE
          WHEN b.guest_name IN (
            SELECT guest_name FROM bookings
            WHERE tenant_id = $1
            GROUP BY guest_name
            HAVING COUNT(*) > 1
          ) THEN b.guest_name
        END) as repeat_guests,
        COUNT(DISTINCT CASE
          WHEN b.guest_name IN (
            SELECT guest_name FROM bookings
            WHERE tenant_id = $1
            GROUP BY guest_name
            HAVING SUM(total_amount) > 5000 OR COUNT(*) >= 3
          ) THEN b.guest_name
        END) as vip_guests
      FROM bookings b
      ${hasTagFilter ? 'INNER JOIN booking_tags bt ON b.id = bt.booking_id' : ''}
      WHERE b.tenant_id = $1
        ${hasTagFilter ? `AND bt.tag_id = ANY($4::uuid[])` : ''}
    ),
    property_performance AS (
      SELECT
        COUNT(DISTINCT p.id) as total_properties,
        AVG(CASE 
          WHEN b.id IS NOT NULL THEN 1.0 
          ELSE 0.0 
        END) as avg_property_occupancy
      FROM properties p
      LEFT JOIN bookings b ON b.property_id = p.id
        AND b.tenant_id = $1
        AND b.arrival >= $2::date
        AND b.arrival <= $3::date
        AND b.status NOT IN ('cancelled', 'canceled')
      WHERE p.tenant_id = $1
    )
    SELECT
      COALESCE(bs.total_revenue, 0) as revenue,
      COALESCE(bs.net_revenue, 0) as "netRevenue",
      COALESCE(bs.total_bookings, 0) as bookings,
      COALESCE(bs.upcoming_bookings, 0) as "upcomingBookings",
      COALESCE(bs.cancelled_bookings::numeric / NULLIF(bs.total_bookings, 0) * 100, 0) as "cancellationRate",
      COALESCE(os.booked_count::numeric / (NULLIF(os.property_count, 0) * os.period_days), 0) as "occupancyRate",
      COALESCE(gs.total_guests, 0) as "totalGuests",
      COALESCE(gs.new_guests_this_month, 0) as "newGuests",
      COALESCE(gs.repeat_guests::numeric / NULLIF(gs.total_guests, 0), 0) as "repeatGuestRate",
      COALESCE(gs.vip_guests, 0) as "vipGuests",
      COALESCE(bs.avg_booking_value, 0) as "avgBookingValue",
      COALESCE(bs.avg_nights, 0) as "avgNights",
      COALESCE(pp.total_properties, 0) as "totalProperties",
      COALESCE(pp.avg_property_occupancy, 0) as "avgPropertyOccupancy"
    FROM booking_stats bs
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
    vipGuests: 0,
    avgBookingValue: 0,
    avgNights: 0,
    totalProperties: 0,
    avgPropertyOccupancy: 0
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
      AND b.status NOT IN ('cancelled', 'canceled')
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
      AND b.status NOT IN ('cancelled', 'canceled')
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
      AND b.status NOT IN ('cancelled', 'canceled')
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
    )
    SELECT
      TO_CHAR(m.month_start, 'Mon') as month,
      COALESCE(
        COUNT(DISTINCT b.id)::numeric /
        (COUNT(DISTINCT p.id) * EXTRACT(day FROM m.month_start + interval '1 month' - interval '1 day')) * 100,
        0
      ) as rate
    FROM months m
    CROSS JOIN properties p
    LEFT JOIN bookings b ON b.property_id = p.id
      AND b.tenant_id = $1
      AND b.arrival >= m.month_start
      AND b.arrival < m.month_start + interval '1 month'
      AND b.status NOT IN ('cancelled', 'canceled')
    WHERE p.tenant_id = $1
    GROUP BY m.month_start
    ORDER BY m.month_start
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

async function getAlerts(tenantId: string) {
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
        AND b.status NOT IN ('cancelled', 'canceled')
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
      AND status NOT IN ('cancelled', 'canceled')
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

  // Check for high cancellation rate
  const cancellationQuery = `
    SELECT
      COUNT(DISTINCT CASE WHEN status IN ('cancelled', 'canceled') THEN id END)::numeric / 
      NULLIF(COUNT(DISTINCT id), 0) * 100 as cancellation_rate
    FROM bookings
    WHERE tenant_id = $1
      AND created_at >= CURRENT_DATE - INTERVAL '30 days'
  `

  const cancellationCheck = await query(cancellationQuery, [tenantId])

  if (cancellationCheck.success && cancellationCheck.data[0]?.cancellation_rate > 10) {
    alerts.push({
      id: 'high-cancellations',
      type: 'warning' as const,
      title: 'High Cancellation Rate',
      description: `Recent cancellation rate is ${Math.round(cancellationCheck.data[0].cancellation_rate)}%. Review your cancellation policy.`,
      timestamp: new Date().toISOString()
    })
  }

  // Check for revenue milestone
  const revenueQuery = `
    SELECT SUM(total_amount) as month_revenue
    FROM bookings
    WHERE tenant_id = $1
      AND arrival >= date_trunc('month', CURRENT_DATE)
      AND status NOT IN ('cancelled', 'canceled')
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
      AND b.status NOT IN ('cancelled', 'canceled')
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
  const activityQuery = `
    SELECT
      b.id,
      'booking' as type,
      CONCAT('New booking from ', b.guest_name, ' for ', p.name) as description,
      b.booked_utc as timestamp,
      b.total_amount as value
    FROM bookings b
    JOIN properties p ON p.id = b.property_id
    WHERE b.tenant_id = $1
      AND b.booked_utc >= CURRENT_DATE - INTERVAL '7 days'
    ORDER BY b.booked_utc DESC
    LIMIT 10
  `

  const result = await query(activityQuery, [tenantId])

  if (!result.success) {
    return [] // Return empty array if query fails
  }

  return result.data
}

app.http('overview', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: overview
})
