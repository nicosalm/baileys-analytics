import { query } from '../services/database'
import { 
  fetchRevenueData,
  fetchPropertyData,
  fetchOccupancyData, 
  fetchGuestData,
  fetchTaxData,
  ReportDateRange,
  ReportFilters
} from '../services/reportService'
import { formatDateISO } from '../utils/dates'

// Fetch comprehensive financial data
export async function fetchFinancialData(
  tenantId: string,
  dateRange: ReportDateRange,
  filters: ReportFilters = {}
) {
  console.log('fetchFinancialData called with:', { tenantId, dateRange, filters })
  try {
    // For now, use a simpler direct query instead of fetchRevenueData
    const revenueResult = await query(
      `SELECT 
        COALESCE(SUM(total_amount), 0) as revenue,
        COALESCE(COUNT(*), 0) as bookings,
        COALESCE(AVG(total_amount), 0) as avg_booking_value
       FROM bookings
       WHERE tenant_id = $1
       AND arrival >= $2::date
       AND arrival <= $3::date
       AND status != 'canceled'`,
      [tenantId, dateRange.from, dateRange.to]
    )
    
    console.log('Direct revenue query result:', revenueResult.success ? 'success' : 'failed')
    
    if (!revenueResult.success || !revenueResult.data[0]) {
      console.error('Revenue query failed')
      return null
    }
    
    const revenue = parseFloat(revenueResult.data[0].revenue) || 0
    const bookings = parseInt(revenueResult.data[0].bookings) || 0
    const avgBookingValue = parseFloat(revenueResult.data[0].avg_booking_value) || 0

    // Get platform fees
    const feesResult = await query(
      `SELECT 
        COALESCE(SUM(pfe.total_fees), 0) as platform_fees,
        COALESCE(SUM(pfe.airbnb_host_fee), 0) as airbnb_fees,
        COALESCE(SUM(pfe.vrbo_host_fee), 0) as vrbo_fees,
        COALESCE(SUM(pfe.booking_com_fee), 0) as booking_fees
       FROM platform_fee_entries pfe
       WHERE pfe.tenant_id = $1 
       AND pfe.month >= DATE_TRUNC('month', $2::date)
       AND pfe.month <= DATE_TRUNC('month', $3::date)`,
      [tenantId, dateRange.from, dateRange.to]
    )

    const fees = feesResult.success ? feesResult.data[0] : { platform_fees: 0 }
    
    const platformFees = parseFloat(fees.platform_fees) || 0

    // Structure as simplified P&L data
    const result = {
      pl: {
        revenue: revenue,
        previousRevenue: 0, // TODO: Calculate previous period
        netRevenue: revenue - platformFees,
        previousNetRevenue: 0,
        expenses: platformFees,
        previousExpenses: 0,
        netProfit: revenue - platformFees,
        previousNetProfit: 0,
        profitMargin: revenue > 0 ? ((revenue - platformFees) / revenue) : 0,
        previousProfitMargin: 0,
        revenueGrowth: 0,
        netRevenueGrowth: 0,
        expenseGrowth: 0,
        profitGrowth: 0,
        bookings: bookings,
        avgBookingValue: avgBookingValue,
        platformFees: platformFees,
        airbnbFees: parseFloat(fees.airbnb_fees) || 0,
        vrboFees: parseFloat(fees.vrbo_fees) || 0,
        bookingFees: parseFloat(fees.booking_fees) || 0
      }
    }
    
    console.log('Returning financial data with keys:', Object.keys(result))
    return result
  } catch (error) {
    console.error('Error fetching financial data:', error)
    return null
  }
}

// Fetch today's arrivals and departures
export async function fetchDailyOperations(tenantId: string, date: string = 'CURRENT_DATE') {
  console.log('Fetching daily operations for tenant:', tenantId, 'date:', date)
  try {
    const dateFilter = date === 'CURRENT_DATE' ? 'CURRENT_DATE' : `$2::date`
    const params = date === 'CURRENT_DATE' ? [tenantId] : [tenantId, date]

    // Get arrivals
    const arrivalsResult = await query(
      `SELECT 
        b.id,
        b.ownerrez_booking_id,
        b.property_id,
        p.name as property_name,
        b.guest_name,
        b.guest_email,
        b.arrival,
        b.departure,
        b.adults,
        b.children,
        b.total_amount,
        b.status,
        b.platform,
        (b.departure - b.arrival) as nights
       FROM bookings b
       JOIN properties p ON b.property_id = p.id
       WHERE b.tenant_id = $1 
       AND b.arrival = ${dateFilter}
       AND b.status != 'canceled'
       ORDER BY p.name, b.arrival`,
      params
    )

    // Get departures
    const departuresResult = await query(
      `SELECT 
        b.id,
        b.ownerrez_booking_id,
        b.property_id,
        p.name as property_name,
        b.guest_name,
        b.guest_email,
        b.arrival,
        b.departure,
        b.adults,
        b.children,
        b.total_amount,
        b.status,
        b.platform,
        (b.departure - b.arrival) as nights
       FROM bookings b
       JOIN properties p ON b.property_id = p.id
       WHERE b.tenant_id = $1 
       AND b.departure = ${dateFilter}
       AND b.status != 'canceled'
       ORDER BY p.name, b.departure`,
      params
    )

    // Get turnovers (departure today and arrival today for same property)
    const turnoversResult = await query(
      `SELECT DISTINCT
        p.id as property_id,
        p.name as property_name,
        dep.guest_name as departing_guest,
        dep.departure as departure_time,
        arr.guest_name as arriving_guest,
        arr.arrival as arrival_time
       FROM properties p
       JOIN bookings dep ON p.id = dep.property_id
       JOIN bookings arr ON p.id = arr.property_id
       WHERE p.tenant_id = $1
       AND dep.departure = ${dateFilter}
       AND arr.arrival = ${dateFilter}
       AND dep.status != 'canceled'
       AND arr.status != 'canceled'
       ORDER BY p.name`,
      params
    )

    console.log('Daily ops results:', {
      arrivals: arrivalsResult.success ? arrivalsResult.data.length : 'failed',
      departures: departuresResult.success ? departuresResult.data.length : 'failed',
      turnovers: turnoversResult.success ? turnoversResult.data.length : 'failed'
    })
    
    return {
      arrivals: arrivalsResult.success ? arrivalsResult.data : [],
      departures: departuresResult.success ? departuresResult.data : [],
      turnovers: turnoversResult.success ? turnoversResult.data : []
    }
  } catch (error) {
    console.error('Error fetching daily operations:', error)
    return { arrivals: [], departures: [], turnovers: [] }
  }
}

// Fetch channel/platform analysis
export async function fetchChannelData(tenantId: string, dateRange: ReportDateRange) {
  console.log('fetchChannelData called for tenant:', tenantId, 'dateRange:', dateRange)
  try {
    const result = await query(
      `SELECT 
        COALESCE(platform, 'Direct') as channel,
        COUNT(*)::numeric as bookings,
        COALESCE(SUM(total_amount), 0)::numeric as revenue,
        COALESCE(AVG(total_amount), 0)::numeric as avg_booking_value,
        COALESCE(AVG(departure - arrival), 0)::numeric as avg_stay_length
       FROM bookings
       WHERE tenant_id = $1
       AND arrival >= $2::date
       AND arrival <= $3::date
       AND status != 'canceled'
       GROUP BY platform
       ORDER BY revenue DESC`,
      [tenantId, dateRange.from, dateRange.to]
    )

    console.log('Channel query result:', result.success ? `${result.data.length} channels` : 'failed')
    
    if (!result.success || result.data.length === 0) {
      console.log('No channel data found')
      return []
    }

    const mapped = result.data.map((row: any) => ({
      name: row.channel || 'Unknown',
      bookings: parseInt(row.bookings) || 0,
      revenue: parseFloat(row.revenue) || 0,
      avgBookingValue: parseFloat(row.avg_booking_value) || 0,
      avgStayLength: parseFloat(row.avg_stay_length) || 0
    }))
    
    console.log('Returning channel data:', mapped.length, 'channels')
    return mapped
  } catch (error) {
    console.error('Error fetching channel data:', error)
    return []
  }
}

// Fetch monthly trends for charts
export async function fetchMonthlyTrends(
  tenantId: string, 
  dateRange: ReportDateRange,
  metrics: ('revenue' | 'occupancy' | 'bookings')[] = ['revenue']
) {
  console.log('fetchMonthlyTrends called with:', { tenantId, dateRange })
  try {
    const result = await query(
      `SELECT 
        DATE_TRUNC('month', arrival)::date as month,
        SUM(total_amount) as revenue,
        COUNT(*) as bookings,
        COUNT(DISTINCT property_id) as properties_with_bookings,
        SUM(departure - arrival) as total_nights
       FROM bookings
       WHERE tenant_id = $1
       AND arrival BETWEEN $2 AND $3
       AND status != 'canceled'
       GROUP BY DATE_TRUNC('month', arrival)
       ORDER BY month`,
      [tenantId, dateRange.from, dateRange.to]
    )

    if (!result.success) return []

    // Get property count for occupancy calculation
    const propertyResult = await query(
      `SELECT COUNT(*) as total_properties 
       FROM properties 
       WHERE tenant_id = $1`,
      [tenantId]
    )

    const totalProperties = propertyResult.success ? 
      parseInt(propertyResult.data[0].total_properties) : 1

    return result.data.map(row => {
      const monthDate = new Date(row.month)
      const year = monthDate.getFullYear()
      const month = monthDate.getMonth()
      // Get the actual number of days in this month
      const daysInMonth = new Date(year, month + 1, 0).getDate()
      const totalNights = parseInt(row.total_nights) || 0
      const availableNights = totalProperties * daysInMonth
      
      return {
        month: formatDateISO(monthDate),
        revenue: parseFloat(row.revenue) || 0,
        bookings: parseInt(row.bookings) || 0,
        occupancy: Math.min((totalNights / availableNights) * 100, 100)
      }
    })
  } catch (error) {
    console.error('Error fetching monthly trends:', error)
    return []
  }
}

// Fetch booking details for a period
export async function fetchBookingsList(
  tenantId: string,
  dateRange: ReportDateRange,
  limit: number = 50
) {
  try {
    const result = await query(
      `SELECT 
        b.id,
        b.ownerrez_booking_id,
        b.property_id,
        p.name as property_name,
        b.guest_name,
        b.guest_email,
        b.arrival,
        b.departure,
        b.adults,
        b.children,
        b.total_amount,
        b.status,
        b.platform,
        (b.departure - b.arrival) as nights
       FROM bookings b
       JOIN properties p ON b.property_id = p.id
       WHERE b.tenant_id = $1 
       AND b.arrival BETWEEN $2 AND $3
       AND b.status != 'canceled'
       ORDER BY b.arrival DESC
       LIMIT $4`,
      [tenantId, dateRange.from, dateRange.to, limit]
    )

    return result.success ? result.data : []
  } catch (error) {
    console.error('Error fetching bookings list:', error)
    return []
  }
}