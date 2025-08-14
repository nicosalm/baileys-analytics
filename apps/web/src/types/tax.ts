// Basic tax types used by the API

export interface TaxRule {
  id: string
  tenant_id: string
  name: string
  type: 'percentage' | 'flat'
  rate: number
  applies_to: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TaxRuleFormData {
  name: string
  type: 'percentage' | 'flat'
  rate: number
  applies_to: string[]
  is_active?: boolean
}

export interface TaxCalculationResult {
  booking_id: string
  tax_amount: number
  tax_breakdown: Array<{
    rule_id: string
    rule_name: string
    amount: number
  }>
  calculated_at: string
}

export interface TaxContext {
  property_id: string
  booking_date: string
  amount: number
  platform?: string
}