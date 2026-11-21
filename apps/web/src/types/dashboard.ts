export type DateRange = {
  from: string
  to: string
}

export type Tag = {
  id: string
  name: string
  type: 'property' | 'booking' | 'payment' | 'guest' | 'custom'
  color?: string
  usageCount?: number
}

export type FilterState = {
  dateRange: DateRange
  selectedTags: Tag[]
  selectedProperties: string[]
}

export type DashboardTab =
  | 'overview'
  | 'financial'
  | 'properties'
  | 'occupancy'
  | 'guests'

export type PropertyMetrics = {
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

export type RevenueMetrics = {
  gross: number
  net: number
  taxes: number
  fees: number
  bySource: Array<{ source: string; amount: number }>
  byMonth: Array<{ month: string; amount: number }>
}

export type OccupancyMetrics = {
  overall: number
  byProperty: Array<{
    propertyId: string
    propertyName?: string
    rate: number
    bookedNights: number
    availableNights: number
  }>
  byMonth: Array<{
    month: string
    rate: number
    bookedNights: number
    availableNights: number
  }>
  bookedNights: number
  availableNights: number
}

export type TaxReportData = {
  summary: {
    totalTax: number
    totalRent: number
    totalBookings: number
    dateRange: { from: string; to: string }
    effectiveRate: number
  }
  byProperty: Array<{
    propertyId: string
    propertyName: string
    totalTax: number
    totalRent: number
    bookingCount: number
    taxRate: number
  }>
  byMonth: Array<{
    month: string
    totalTax: number
    totalRent: number
    bookingCount: number
    effectiveRate: number
  }>
}

// New unified financial data type
export type FinancialData = {
  pl: {
    metrics: {
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
    platforms: Array<{
      platform: string
      grossRevenue: number
      fees: number
      netRevenue: number
      feeRate: number
      bookingCount: number
    }>
    monthlyTrend: Array<{
      month: string
      revenue: number
      bookings: number
      avgBookingValue: number
    }>
    weeklyRevenue: Array<{
      week: string
      revenue: number
      bookings: number
    }>
    previousPeriod?: {
      revenue: { gross: number; net: number }
      performance: { netRevenueRate: number }
    }
  }
  revenue: RevenueMetrics & {
    lastYearData?: {
      gross: number
      net: number
    }
  }
  cashflow: {
    collected: number
    pending: number
    collectionRate: number
    upcoming: {
      next30Days: number
      next60Days: number
      next90Days: number
    }
  }
  tax: TaxReportData
  metadata: {
    dateRange: { from: string; to: string }
    generatedAt: string
  }
}

  | { type: 'error'; error: string }
  | { type: 'financial'; data: FinancialData }
  | { type: 'properties'; data: PropertyMetrics[] }
  | { type: 'occupancy'; data: OccupancyMetrics }
