// API Response Types for Dashboard Data

// Common types
export interface DateRange {
  from: string
  to: string
}

export interface Tag {
  id: string
  name: string
  color?: string
}

export interface ComparisonData<T> {
  current: T
  previous: T | null
}

// Overview Dashboard Types
export interface OverviewMetrics {
  revenue: number
  bookings: number
  occupancyRate: number
  avgNightlyRate: number
  bookedNights: number
  availableNights: number
}

export interface PlatformData {
  platform: string
  revenue: number
  bookings: number
  percentage?: number
}

export interface TrendData {
  month: string
  revenue: number
  bookings?: number
  occupancy?: number
  rate?: number
  bookedNights?: number
  availableNights?: number
}

export interface OverviewData {
  metrics: OverviewMetrics
  platforms: PlatformData[]
  byMonth: TrendData[]
  previousPeriod?: OverviewMetrics
}

// Financial Dashboard Types
export interface FinancialMetrics {
  revenue: number
  expenses: number
  netIncome: number
  netMargin: number
  grossRevenue?: number
  fees?: number
  taxes?: number
}

export interface FinancialTrendData extends TrendData {
  expenses?: number
  netIncome?: number
  grossRevenue?: number
  fees?: number
  taxes?: number
}

export interface FinancialData {
  metrics: FinancialMetrics
  platforms: PlatformData[]
  monthlyTrend: FinancialTrendData[]
  weeklyRevenue?: TrendData[]
  byMonth: FinancialTrendData[]
  previousPeriod?: FinancialMetrics
}

// Revenue Analysis Types
export interface RevenueData {
  metrics: FinancialMetrics
  gross: number
  net: number
  taxes: number
  fees: number
  bySource: Array<{
    source: string
    revenue: number
    percentage: number
  }>
  byMonth: FinancialTrendData[]
  byProperty: Array<{
    propertyId: string
    propertyName: string
    revenue: number
  }>
  lastYearData?: FinancialTrendData[]
  previousPeriod?: FinancialMetrics
}

// Tax Data Types
export interface TaxSummary {
  totalTax: number
  localTax: number
  stateTax: number
  countyTax?: number
  otherTax?: number
}

export interface TaxByProperty {
  propertyId: string
  propertyName: string
  tax: number
  revenue: number
  taxRate: number
}

export interface TaxData {
  summary: TaxSummary
  byProperty: TaxByProperty[]
  byMonth: Array<{
    month: string
    tax: number
    revenue: number
  }>
  previousPeriod?: TaxSummary
}

// Occupancy Dashboard Types
export interface OccupancyMetrics {
  overall: number
  bookedNights: number
  availableNights: number
}

export interface OccupancyByProperty {
  propertyId: string
  propertyName: string
  rate: number
  bookedNights: number
  availableNights: number
}

export interface OccupancyTrendData {
  month: string
  rate: number
  bookedNights: number
  availableNights: number
}

export interface BookingGap {
  propertyId: string
  propertyName: string
  gapStart: string
  gapEnd: string
  gapDays: number
  daysUntilGap: number
  estimatedRevenueLoss: number
  severity: 'critical' | 'warning' | 'info'
}

export interface OccupancyData extends OccupancyMetrics {
  byMonth: OccupancyTrendData[]
  byProperty: OccupancyByProperty[]
  gaps?: BookingGap[]
}

// Properties Dashboard Types
export interface PropertyMetrics {
  propertyId: string
  propertyName: string
  revenue: number
  bookings: number
  occupancyRate: number
  avgNightlyRate: number
  bookedNights: number
  availableNights: number
  date?: string
}

// Guests Dashboard Types
export interface GuestMetrics {
  totalGuests: number
  repeatGuests: number
  repeatRate: number
  avgStayLength: number
  avgSpend: number
}

export interface GuestListItem {
  id: string
  name: string
  email?: string
  phone?: string
  firstVisit: string
  lastVisit: string
  bookingCount: number
  totalSpent: number
  avgNightlyRate: number
  properties: string[]
  tags: Tag[]
  periodBookings?: number
  periodSpent?: number
}

export interface GuestSourceData {
  source: string
  count: number
  revenue?: number
  percentage?: number
}

export interface GuestTagDistribution {
  name: string
  count: number
  color?: string
}

export interface GuestData {
  metrics: GuestMetrics
  guests: GuestListItem[]
  guestsBySource?: GuestSourceData[]
  tagDistribution?: GuestTagDistribution[]
  topSpenders?: GuestListItem[]
}

// Batch API Response Types
export interface BatchDashboardResponse {
  view: 'overview' | 'financial' | 'occupancy' | 'properties' | 'guests'
  pl: FinancialData
  revenue: RevenueData
  cashflow?: {
    previousPeriod?: FinancialMetrics
  }
  tax: {
    summary: TaxSummary
    byProperty: TaxByProperty[]
    byMonth: Array<{
      month: string
      tax: number
      revenue: number
    }>
    previousPeriod?: TaxSummary
  }
  current?: OccupancyData | PropertyMetrics[] | GuestData
  previous?: OccupancyData | PropertyMetrics[] | GuestData
  properties?: PropertyMetrics[]
  metrics?: GuestMetrics
  guests?: GuestListItem[]
}

// Chart Data Types
export interface ChartDataPoint {
  name?: string
  month?: string
  fullName?: string
  value?: number
  revenue?: number
  occupancy?: number
  bookings?: number
  color?: string
  date?: string | null
  previousRevenue?: number
  previousOccupancy?: number
  [key: string]: string | number | null | undefined
}

export interface RadarChartData {
  property: string
  revenue: number
  occupancy: number
  avgRate: number
  bookings: number
}