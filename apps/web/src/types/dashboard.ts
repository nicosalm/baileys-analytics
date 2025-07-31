export type DateRange = {
  from: string
  to: string
}

export type Tag = {
  id: string
  name: string
  type: 'property' | 'booking' | 'payment' | 'custom'
}

export type FilterState = {
  dateRange: DateRange
  selectedTags: Tag[]
  selectedProperties: string[]
}

export type DashboardTab =
  | 'tax'
  | 'properties'
  | 'revenue'
  | 'occupancy'
  | 'seasonal'
  | 'guests'
  | 'financial'

export type PropertyMetrics = {
  propertyId: string
  propertyName: string
  revenue: number
  bookings: number
  occupancyRate: number
  avgNightlyRate: number
  avgStayLength: number
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
  byProperty: Array<{ propertyId: string; propertyName?: string; rate: number }>
  byMonth: Array<{ month: string; rate: number }>
  bookedNights: number
  availableNights: number
}

export type TaxReportData = {
  summary: {
    totalTax: number
    totalRent: number
    totalBookings: number
    dateRange: { from: string; to: string }
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
  }>
}

export type DashboardData =
  | { type: 'loading' }
  | { type: 'error'; error: string }
  | { type: 'tax'; data: TaxReportData }
  | { type: 'properties'; data: PropertyMetrics[] }
  | { type: 'revenue'; data: RevenueMetrics }
  | { type: 'occupancy'; data: OccupancyMetrics }
