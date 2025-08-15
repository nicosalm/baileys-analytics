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
  const last6Months: string[] = []
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

    // Get months with bookings in the last 6 months
    const bookingsResult = await query(
      `SELECT DISTINCT TO_CHAR(arrival, 'YYYY-MM') as month
       FROM bookings
       WHERE property_id = $1 AND tenant_id = $2
       AND arrival >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '6 months')
       AND arrival < DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month')
       AND status NOT IN ('canceled', 'declined')
       ORDER BY month DESC`,
      [property.id, auth.tenantId]
    )
    
    const monthsWithBookings = bookingsResult.success 
      ? bookingsResult.data.map(row => row.month)
      : []

    // Get months with platform fees
    const feesResult = await query(
      `SELECT DISTINCT month FROM platform_fee_entries
       WHERE property_id = $1 AND tenant_id = $2
       AND month IN (${last6Months.map((_, i) => `$${i + 3}`).join(',')})`,
      [property.id, auth.tenantId, ...last6Months]
    )
    
    const monthsWithFees = feesResult.success 
      ? feesResult.data.map(row => row.month)
      : []
    
    // Only consider months that had bookings as "missing"
    const monthsNeedingFees = monthsWithBookings.filter(
      month => last6Months.includes(month)
    )
    
    const missingFeeMonths = monthsNeedingFees.filter(
      month => !monthsWithFees.includes(month)
    )
    
    // Determine fee status
    let feeStatus: 'none' | 'partial' | 'complete' = 'none'
    if (monthsWithFees.length === 0) {
      feeStatus = 'none'
    } else if (missingFeeMonths.length > 0) {
      feeStatus = 'partial'
    } else {
      // All months that need fees have them
      feeStatus = 'complete'
    }

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
      feeStatus,
      monthsWithBookings,
      monthsWithFees,
      missingFeeMonths,
      totalBookingMonths: monthsNeedingFees.length,
      totalFeeMonths: monthsWithFees.length,
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