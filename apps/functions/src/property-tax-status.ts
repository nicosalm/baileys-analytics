import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { query } from './services/database'
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth'
import { format, subMonths } from 'date-fns'

export async function getPropertyTaxStatus(
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
  const propertiesResult = await query(
    `SELECT id, name FROM properties 
     WHERE tenant_id = $1 AND active = true
     ORDER BY name`,
    [auth.tenantId]
  )

  if (!propertiesResult.success) {
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: { status: 'error', error: 'Failed to fetch properties' }
    }
  }

  const statuses = []
  const currentMonth = format(new Date(), 'yyyy-MM')
  const last6Months = []
  for (let i = 0; i < 6; i++) {
    const month = format(subMonths(new Date(), i), 'yyyy-MM')
    last6Months.push(month)
  }

  for (const property of propertiesResult.data) {
    // Check if property has tax configuration
    // A property only has config if there's an active config with actual jurisdictions
    const configResult = await query(
      `SELECT COUNT(*) as count, 
              MAX(COALESCE(jsonb_array_length(jurisdictions), 0)) as jurisdiction_count
       FROM property_tax_configs
       WHERE property_id = $1 AND tenant_id = $2 AND is_active = true`,
      [property.id, auth.tenantId]
    )
    const hasConfig = configResult.success && 
                     configResult.data.length > 0 &&
                     parseInt(configResult.data[0].count) > 0 &&
                     parseInt(configResult.data[0].jurisdiction_count) > 0

    const feesResult = await query(
      `SELECT DISTINCT month FROM platform_fee_entries
       WHERE property_id = $1 AND tenant_id = $2
       AND month IN (${last6Months.map((_, i) => `$${i + 3}`).join(',')})`,
      [property.id, auth.tenantId, ...last6Months]
    )
    
    const monthsWithFees = feesResult.success 
      ? feesResult.data.map(row => row.month)
      : []
    
    const missingMonths = last6Months.filter(
      month => !monthsWithFees.includes(month)
    )

    // Get last update time
    const lastUpdateResult = await query(
      `SELECT MAX(updated_at) as last_updated
       FROM (
         SELECT updated_at FROM property_tax_configs 
         WHERE property_id = $1 AND tenant_id = $2
         UNION ALL
         SELECT updated_at FROM platform_fee_entries
         WHERE property_id = $1 AND tenant_id = $2
       ) as updates`,
      [property.id, auth.tenantId]
    )
    
    const lastUpdated = lastUpdateResult.success && lastUpdateResult.data[0].last_updated
      ? lastUpdateResult.data[0].last_updated
      : null

    statuses.push({
      propertyId: property.id,
      propertyName: property.name,
      hasConfig,
      hasPlatformFees: monthsWithFees.length > 0,
      missingMonths,
      lastUpdated
    })
  }

  return {
    status: 200,
    headers: corsHeaders(),
    jsonBody: { status: 'success', data: statuses }
  }
}

app.http('property-tax-status', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: getPropertyTaxStatus
})