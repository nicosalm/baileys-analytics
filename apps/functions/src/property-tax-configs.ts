// src/property-tax-configs.ts
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { query } from './services/database'
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth'

export async function propertyTaxConfigs(
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

  // First, get all properties for the tenant
  const propertiesResult = await query(
    `SELECT id, name FROM properties WHERE tenant_id = $1 ORDER BY name`,
    [auth.tenantId]
  )

  if (!propertiesResult.success) {
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: { status: 'error', error: propertiesResult.error }
    }
  }

  // Get all active tax rules for the tenant
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

  // Calculate effective rate for each property
  const propertyConfigs = propertiesResult.data.map(property => {
    const applicableRules = rulesResult.data.filter(rule => {
      const appliesTo = typeof rule.applies_to === 'string'
        ? JSON.parse(rule.applies_to)
        : rule.applies_to

      // Check if rule applies to this property
      if (appliesTo.type === 'all') {
        return true
      }

      if (appliesTo.type === 'properties' && appliesTo.propertyIds) {
        return appliesTo.propertyIds.includes(property.id)
      }

      // For now, we'll skip tag-based and other complex rules for this endpoint
      return false
    })

    // Calculate combined effective rate (simplified - just sum percentage rates)
    let effectiveRate = 0
    applicableRules.forEach(rule => {
      const method = typeof rule.method === 'string'
        ? JSON.parse(rule.method)
        : rule.method

      if (method.type === 'percentage') {
        effectiveRate += method.rate
      }
      // For compound methods, we'd need more complex calculation
      else if (method.type === 'compound' && method.components) {
        method.components.forEach((component: any) => {
          if (component.method && component.method.type === 'percentage') {
            effectiveRate += component.method.rate
          }
        })
      }
    })

    return {
      propertyId: property.id,
      propertyName: property.name,
      rules: applicableRules.map(rule => ({
        id: rule.id,
        name: rule.name,
        priority: rule.priority
      })),
      effectiveRate,
      lastCalculated: new Date().toISOString()
    }
  })

  return {
    status: 200,
    headers: corsHeaders(),
    jsonBody: { status: 'success', data: propertyConfigs }
  }
}

app.http('property-tax-configs', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: propertyTaxConfigs
})
