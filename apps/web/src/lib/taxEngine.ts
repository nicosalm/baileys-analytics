// lib/taxEngine.ts
import {
  TaxCalculationMethod,
  TaxRule,
  TaxContext,
  TaxCalculationResult,
  TaxBreakdownItem,
  TaxValidationError,
  TaxRuleFormData,
  TaxCalculationEngine,
  TaxComponent
} from '@/types/tax'
import { safeDivide, isValidNumber, getMonth } from '@baileys/utils'

// Calculate tax based on method
const calculateByMethod = (
  amount: number,
  method: TaxCalculationMethod,
  ruleName: string,
  ruleId: string
): TaxBreakdownItem => {
  switch (method.type) {
    case 'percentage':
      return {
        ruleId,
        ruleName,
        amount: amount * method.rate,
        rate: method.rate,
        basis: amount
      }

    case 'flat':
      return {
        ruleId,
        ruleName,
        amount: method.amount,
        basis: amount
      }

    case 'tiered': {
      let totalTax = 0
      let effectiveRate = 0

      for (const tier of method.tiers) {
        const tierMin = tier.min
        const tierMax = tier.max ?? Infinity

        if (amount > tierMin) {
          const taxableInTier = Math.min(amount - tierMin, tierMax - tierMin)
          totalTax += taxableInTier * tier.rate
        }
      }

      effectiveRate = safeDivide(totalTax, amount, 0)

      return {
        ruleId,
        ruleName,
        amount: totalTax,
        rate: effectiveRate,
        basis: amount
      }
    }

    case 'seasonal': {
      const currentMonth = getMonth(new Date()) + 1
      const multiplier = method.seasonalMultipliers.find(
        sm => currentMonth >= sm.startMonth && currentMonth <= sm.endMonth
      )?.multiplier ?? 1

      const adjustedRate = method.baseRate * multiplier

      return {
        ruleId,
        ruleName,
        amount: amount * adjustedRate,
        rate: adjustedRate,
        basis: amount
      }
    }

    case 'custom': {
      // Simple formula evaluation (in production, use a proper expression parser)
      let result = amount

      try {
        // Replace variables in formula
        let formula = method.formula
        formula = formula.replace(/\bamount\b/g, amount.toString())

        for (const [key, value] of Object.entries(method.variables)) {
          formula = formula.replace(new RegExp(`\\b${key}\\b`, 'g'), value.toString())
        }

        // Basic safe evaluation (only allows math operations)
        if (/^[\d\s+\-*/().]+$/.test(formula)) {
          result = Function('"use strict"; return (' + formula + ')')()
        }
      } catch {
        // Fallback to zero if formula fails
        result = 0
      }

      return {
        ruleId,
        ruleName,
        amount: result,
        basis: amount
      }
    }

    case 'compound': {
      let runningTotal = amount
      let totalTax = 0
      const subBreakdown: TaxBreakdownItem[] = []

      // Sort components by order
      const sortedComponents = [...method.components].sort((a, b) => a.order - b.order)

      for (const component of sortedComponents) {
        const basis = component.appliesTo === 'base' ? amount : runningTotal
        const componentTax = calculateByMethod(basis, component.method, component.name, ruleId)

        subBreakdown.push(componentTax)
        totalTax += componentTax.amount
        runningTotal += componentTax.amount
      }

      return {
        ruleId,
        ruleName,
        amount: totalTax,
        rate: safeDivide(totalTax, amount, 0),
        basis: amount
      }
    }
  }
}

// Check if rule applies to context
const ruleApplies = (rule: TaxRule, context: TaxContext): boolean => {
  // Check date effectiveness
  const bookingDate = new Date(context.bookingDate)
  const effectiveFrom = new Date(rule.effectiveFrom)
  const effectiveTo = rule.effectiveTo ? new Date(rule.effectiveTo) : null

  if (bookingDate < effectiveFrom || (effectiveTo && bookingDate > effectiveTo)) {
    return false
  }

  // Check applies to conditions
  switch (rule.appliesTo.type) {
    case 'all':
      return true

    case 'properties':
      return context.propertyId
        ? rule.appliesTo.propertyIds.includes(context.propertyId)
        : false

    case 'tags':
      return context.tags
        ? context.tags.some(tag =>
            rule.appliesTo.type === 'tags' && rule.appliesTo.tagIds.includes(tag)
          )
        : false

    case 'dateRange': {
      const from = new Date(rule.appliesTo.from)
      const to = new Date(rule.appliesTo.to)
      return bookingDate >= from && bookingDate <= to
    }

    case 'bookingSource':
      return context.bookingSource
        ? rule.appliesTo.sources.includes(context.bookingSource)
        : false

    default:
      return false
  }
}

// Validate tax rule
const validateRule = (rule: TaxRuleFormData): TaxValidationError[] => {
  const errors: TaxValidationError[] = []

  if (!rule.name.trim()) {
    errors.push({ field: 'name', message: 'Name is required' })
  }

  if (!isValidNumber(rule.priority)) {
    errors.push({ field: 'priority', message: 'Priority must be a valid number' })
  }

  // Validate method-specific fields
  switch (rule.method.type) {
    case 'percentage':
      if (!isValidNumber(rule.method.rate) || rule.method.rate < 0 || rule.method.rate > 1) {
        errors.push({ field: 'method.rate', message: 'Rate must be between 0 and 1' })
      }
      break

    case 'flat':
      if (!isValidNumber(rule.method.amount) || rule.method.amount < 0) {
        errors.push({ field: 'method.amount', message: 'Amount must be a positive number' })
      }
      break

    case 'tiered':
      if (!rule.method.tiers.length) {
        errors.push({ field: 'method.tiers', message: 'At least one tier is required' })
      }

      rule.method.tiers.forEach((tier, i) => {
        if (!isValidNumber(tier.rate) || tier.rate < 0 || tier.rate > 1) {
          errors.push({ field: `method.tiers[${i}].rate`, message: 'Tier rate must be between 0 and 1' })
        }
        if (!isValidNumber(tier.min) || tier.min < 0) {
          errors.push({ field: `method.tiers[${i}].min`, message: 'Tier minimum must be positive' })
        }
      })
      break

    case 'seasonal':
      if (!isValidNumber(rule.method.baseRate) || rule.method.baseRate < 0 || rule.method.baseRate > 1) {
        errors.push({ field: 'method.baseRate', message: 'Base rate must be between 0 and 1' })
      }

      rule.method.seasonalMultipliers.forEach((sm, i) => {
        if (sm.startMonth < 1 || sm.startMonth > 12) {
          errors.push({ field: `method.seasonalMultipliers[${i}].startMonth`, message: 'Start month must be between 1 and 12' })
        }
        if (sm.endMonth < 1 || sm.endMonth > 12) {
          errors.push({ field: `method.seasonalMultipliers[${i}].endMonth`, message: 'End month must be between 1 and 12' })
        }
        if (!isValidNumber(sm.multiplier) || sm.multiplier < 0) {
          errors.push({ field: `method.seasonalMultipliers[${i}].multiplier`, message: 'Multiplier must be positive' })
        }
      })
      break

    case 'custom':
      if (!rule.method.formula.trim()) {
        errors.push({ field: 'method.formula', message: 'Formula is required' })
      }
      break

    case 'compound':
      if (!rule.method.components.length) {
        errors.push({ field: 'method.components', message: 'At least one component is required' })
      }
      break
  }

  // Validate date range
  if (!rule.effectiveFrom) {
    errors.push({ field: 'effectiveFrom', message: 'Effective from date is required' })
  }

  if (rule.effectiveTo && new Date(rule.effectiveTo) < new Date(rule.effectiveFrom)) {
    errors.push({ field: 'effectiveTo', message: 'Effective to date must be after effective from date' })
  }

  return errors
}

// Get effective rules for context
const getEffectiveRules = (rules: TaxRule[], context: TaxContext): TaxRule[] => {
  return rules
    .filter(rule => rule.isActive && ruleApplies(rule, context))
    .sort((a, b) => b.priority - a.priority)
}

// Combine multiple rules into a single calculation method
const combineRules = (rules: TaxRule[]): TaxCalculationMethod => {
  if (rules.length === 0) {
    return { type: 'percentage', rate: 0 }
  }

  if (rules.length === 1) {
    return rules[0].method
  }

  // Create compound method from multiple rules
  const components: TaxComponent[] = rules.map((rule, index) => ({
    name: rule.name,
    method: rule.method.type === 'compound'
      ? { type: 'percentage', rate: 0 } // Avoid nested compounds
      : rule.method,
    appliesTo: index === 0 ? 'base' : 'total',
    order: index
  }))

  return { type: 'compound', components }
}

// Main tax calculation function
const calculateTax = (
  amount: number,
  rules: TaxRule[],
  context: TaxContext
): TaxCalculationResult => {
  const effectiveRules = getEffectiveRules(rules, context)

  if (effectiveRules.length === 0) {
    return {
      totalTax: 0,
      breakdown: [],
      effectiveRate: 0,
      appliedRules: []
    }
  }

  const breakdown: TaxBreakdownItem[] = []
  let totalTax = 0

  // Calculate tax for each rule
  for (const rule of effectiveRules) {
    const breakdownItem = calculateByMethod(amount, rule.method, rule.name, rule.id)
    breakdown.push(breakdownItem)
    totalTax += breakdownItem.amount
  }

  return {
    totalTax,
    breakdown,
    effectiveRate: safeDivide(totalTax, amount, 0),
    appliedRules: effectiveRules.map(r => r.id)
  }
}

export const taxEngine: TaxCalculationEngine = {
  calculateTax,
  validateRule,
  getEffectiveRules,
  combineRules
}
