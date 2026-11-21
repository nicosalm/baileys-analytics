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
  propertyCode?: string | null
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
  propertyCode?: string | null
  rate: number
  bookedNights: number
  availableNights: number
  avgNightlyRate: number
}

export interface OccupancyTrendData {
  month: string
  rate: number
  bookedNights: number
  availableNights: number
}

// Properties Dashboard Types
export interface PropertyMetrics {
  propertyId: string
  propertyName: string
  propertyCode?: string | null
  revenue: number
  bookings: number
  occupancyRate: number
  avgNightlyRate: number
  bookedNights: number
  availableNights: number
  date?: string
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
  isRepeat?: boolean
}

export interface GuestSourceData {
  source: string
  count: number
  revenue?: number
  percentage?: number
}

export interface GuestTagDistribution {
  id: string
  name: string
  count: number
  color?: string
}
