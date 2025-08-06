export type TaxCalculationMethod =
  | { type: 'percentage'; rate: number }
  | { type: 'flat'; amount: number }
  | { type: 'tiered'; tiers: TaxTier[] }
  | { type: 'compound'; components: TaxComponent[] }
  | { type: 'seasonal'; baseRate: number; seasonalMultipliers: SeasonalMultiplier[] }
  | { type: 'custom'; formula: string; variables: Record<string, number> }

export type TaxTier = {
  min: number
  max: number | null
  rate: number
}

export type TaxComponent = {
  name: string
  method: Exclude<TaxCalculationMethod, { type: 'compound' }>
  appliesTo: 'base' | 'total'
  order: number
}

export type SeasonalMultiplier = {
  startMonth: number
  endMonth: number
  multiplier: number
}

export type TaxRule = {
  id: string
  name: string
  description?: string
  method: TaxCalculationMethod
  appliesTo: TaxAppliesTo
  jurisdiction?: string
  effectiveFrom: string
  effectiveTo?: string
  priority: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type TaxAppliesTo =
  | { type: 'all' }
  | { type: 'properties'; propertyIds: string[] }
  | { type: 'tags'; tagIds: string[] }
  | { type: 'dateRange'; from: string; to: string }
  | { type: 'bookingSource'; sources: string[] }

export type PropertyTaxConfig = {
  propertyId: string
  propertyName: string
  rules: TaxRule[]
  effectiveRate: number
  lastCalculated: string
}

export type TaxCalculationResult = {
  totalTax: number
  breakdown: TaxBreakdownItem[]
  effectiveRate: number
  appliedRules: string[]
}

export type TaxBreakdownItem = {
  ruleId: string
  ruleName: string
  amount: number
  rate?: number
  basis: number
}

export type TaxConfigState =
  | { status: 'loading' }
  | { status: 'loaded'; rules: TaxRule[]; propertyConfigs: PropertyTaxConfig[] }
  | { status: 'error'; error: string }

export type TaxRuleFormData = Omit<TaxRule, 'id' | 'createdAt' | 'updatedAt'>

export type TaxValidationError = {
  field: string
  message: string
}

export type TaxCalculationEngine = {
  calculateTax: (amount: number, rules: TaxRule[], context: TaxContext) => TaxCalculationResult
  validateRule: (rule: TaxRuleFormData) => TaxValidationError[]
  getEffectiveRules: (rules: TaxRule[], context: TaxContext) => TaxRule[]
  combineRules: (rules: TaxRule[]) => TaxCalculationMethod
}

export type TaxContext = {
  propertyId?: string
  bookingDate: string
  bookingSource?: string
  tags?: string[]
}

export type TaxReportData = {
  summary: TaxSummary
  byProperty: readonly PropertyTaxData[]
  byMonth: readonly MonthlyTaxData[]
}

export type TaxSummary = {
  totalTax: number
  totalRent: number
  totalBookings: number
  dateRange: { from: string; to: string }
  effectiveRate: number
}

export type PropertyTaxData = {
  propertyId: string
  propertyName: string
  totalTax: number
  totalRent: number
  bookingCount: number
  taxRate: number
  breakdown?: TaxBreakdownItem[]
}

export type MonthlyTaxData = {
  month: string
  totalTax: number
  totalRent: number
  bookingCount: number
  effectiveRate: number
}
