// src/tax-preview.ts
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { query } from './services/database'
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth'

export async function taxPreview(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') {
    return handleOptions()
  }

  const authCheck = await requireAuth(request)
  if (!authCheck.authenticated) {
    return authCheck.response
  }

  const { auth } = authCheck.request
  const body = await request.json() as { amount: number; context: any }
  const { amount, context: taxContext } = body

  // Get applicable rules
  const rulesResult = await query(
    `SELECT * FROM tax_rules
     WHERE tenant_id = $1 AND is_active = true
     ORDER BY priority DESC`,
    [auth.tenantId]
  )

  if (!rulesResult.success) {
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: { status: 'error', error: rulesResult.error }
    }
  }

  // Parse rules and filter applicable ones
  const rules = rulesResult.data.map(rule => ({
    ...rule,
    method: typeof rule.method === 'string' ? JSON.parse(rule.method) : rule.method,
    appliesTo: typeof rule.applies_to === 'string' ? JSON.parse(rule.applies_to) : rule.applies_to
  }))

  // Simple tax calculation (this is a simplified version)
  const applicableRules = rules.filter(rule => {
    const appliesTo = rule.appliesTo

    if (appliesTo.type === 'all') {
      return true
    }

    if (appliesTo.type === 'properties' && taxContext.propertyId) {
      return appliesTo.propertyIds?.includes(taxContext.propertyId)
    }

    if (appliesTo.type === 'tags' && taxContext.tags) {
      return taxContext.tags.some((tag: string) => appliesTo.tagIds?.includes(tag))
    }

    if (appliesTo.type === 'dateRange') {
      const bookingDate = new Date(taxContext.bookingDate)
      const from = new Date(appliesTo.from)
      const to = new Date(appliesTo.to)
      return bookingDate >= from && bookingDate <= to
    }

    return false
  })

  // Calculate tax
  let totalTax = 0
  const breakdown: any[] = []

  applicableRules.forEach(rule => {
    let taxAmount = 0
    const method = rule.method

    switch (method.type) {
      case 'percentage':
        taxAmount = amount * method.rate
        break
      case 'flat':
        taxAmount = method.amount
        break
      case 'tiered':
        // Simplified tiered calculation
        for (const tier of method.tiers) {
          if (amount > tier.min) {
            const taxableInTier = tier.max
              ? Math.min(amount - tier.min, tier.max - tier.min)
              : amount - tier.min
            taxAmount += taxableInTier * tier.rate
          }
        }
        break
      case 'compound':
        // Simplified compound calculation
        let baseAmount = amount
        method.components.forEach((component: any) => {
          const componentAmount = component.appliesTo === 'base' ? amount : baseAmount
          if (component.method.type === 'percentage') {
            const tax = componentAmount * component.method.rate
            taxAmount += tax
            baseAmount += tax
          }
        })
        break
    }

    totalTax += taxAmount
    breakdown.push({
      ruleId: rule.id,
      ruleName: rule.name,
      amount: taxAmount,
      rate: method.type === 'percentage' ? method.rate : undefined,
      basis: amount
    })
  })

  const result = {
    totalTax,
    breakdown,
    effectiveRate: amount > 0 ? totalTax / amount : 0,
    appliedRules: applicableRules.map(r => r.id)
  }

  return {
    status: 200,
    headers: corsHeaders(),
    jsonBody: { status: 'success', data: result }
  }
}

app.http('tax-preview', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: taxPreview
})
