import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { query } from './services/database'
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth'

interface TaxCalculationRequest {
  propertyId: string
  amount: number
  month: string
  includesPlatformFees?: boolean
}

interface TaxCalculationResponse {
  propertyId: string
  propertyName: string
  baseAmount: number
  taxableAmount: number
  totalTax: number
  effectiveRate: number
  platformFees: {
    total: number
    taxOnFees: number
    platformRemits: number
  }
  breakdown: Array<{
    jurisdiction: string
    type: string
    rate: number
    amount: number
  }>
  netOwnerRemits: number
}

export async function calculatePropertyTax(
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

  try {
    let body: TaxCalculationRequest
    try {
      body = await request.json() as TaxCalculationRequest
    } catch {
      return {
        status: 400,
        headers: corsHeaders(),
        jsonBody: { status: 'error', error: 'Invalid request body' }
      }
    }

    const { propertyId, amount, month, includesPlatformFees = true } = body

    if (!propertyId || !amount || !month) {
      return {
        status: 400,
        headers: corsHeaders(),
        jsonBody: { status: 'error', error: 'propertyId, amount, and month are required' }
      }
    }

    const [propertyResult, configResult] = await Promise.all([
      query(
        `SELECT id, name FROM properties WHERE id = $1 AND tenant_id = $2`,
        [propertyId, auth.tenantId]
      ),
      query(
        `SELECT * FROM property_tax_configs 
         WHERE property_id = $1 AND tenant_id = $2 AND is_active = true
         LIMIT 1`,
        [propertyId, auth.tenantId]
      )
    ])

    if (!propertyResult.success || propertyResult.data.length === 0) {
      return {
        status: 404,
        headers: corsHeaders(),
        jsonBody: { status: 'error', error: 'Property not found' }
      }
    }

    if (!configResult.success || configResult.data.length === 0) {
      return {
        status: 404,
        headers: corsHeaders(),
        jsonBody: { status: 'error', error: 'No tax configuration found for this property' }
      }
    }

    const property = propertyResult.data[0]
    const config = configResult.data[0]
    const jurisdictions = typeof config.jurisdictions === 'string' 
      ? JSON.parse(config.jurisdictions) 
      : config.jurisdictions

    let platformFees = { total: 0, taxOnFees: 0, platformRemits: 0 }
    
    if (includesPlatformFees) {
      const feesResult = await query(
        `SELECT 
          COALESCE(SUM(guest_service_fee + host_service_fee), 0) as total_fees,
          COALESCE(SUM(platform_tax_remitted), 0) as platform_remits
         FROM platform_fee_entries
         WHERE property_id = $1 AND tenant_id = $2 AND month = $3`,
        [propertyId, auth.tenantId, month]
      )

      if (feesResult.success && feesResult.data.length > 0) {
        const feeData = feesResult.data[0]
        platformFees.total = parseFloat(feeData.total_fees || 0)
        platformFees.platformRemits = parseFloat(feeData.platform_remits || 0)
      }
    }

    const taxableAmount = amount + platformFees.total
    const breakdown = []
    let totalTax = 0

    for (const jurisdiction of jurisdictions) {
      const taxAmount = (taxableAmount * jurisdiction.rate) / 100
      totalTax += taxAmount
      
      breakdown.push({
        jurisdiction: jurisdiction.name,
        type: jurisdiction.type,
        rate: jurisdiction.rate,
        amount: taxAmount
      })
    }

    if (platformFees.total > 0) {
      platformFees.taxOnFees = (platformFees.total * totalTax) / taxableAmount
    }
    const netOwnerRemits = totalTax - platformFees.platformRemits

    const response: TaxCalculationResponse = {
      propertyId: property.id,
      propertyName: property.name,
      baseAmount: amount,
      taxableAmount,
      totalTax,
      effectiveRate: taxableAmount > 0 ? (totalTax / taxableAmount) * 100 : 0,
      platformFees,
      breakdown,
      netOwnerRemits: Math.max(0, netOwnerRemits)
    }

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: { status: 'success', data: response }
    }
  } catch (error) {
    context.log('Error calculating tax:', error)
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: { status: 'error', error: 'Failed to calculate tax' }
    }
  }
}

// Calculate taxes for multiple properties/bookings
export async function calculateBulkTax(
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

  try {
    const params = request.query
    const fromDate = params.get('from')
    const toDate = params.get('to')
    const propertyId = params.get('propertyId')

    // Get all properties with tax configs
    let propertyFilter = ''
    const queryParams: any[] = [auth.tenantId]
    
    if (propertyId) {
      propertyFilter = 'AND p.id = $2'
      queryParams.push(propertyId)
    }

    const propertiesResult = await query(
      `SELECT 
        p.id, p.name,
        ptc.jurisdictions,
        ptc.taxable_items,
        ptc.platform_settings
       FROM properties p
       JOIN property_tax_configs ptc ON p.id = ptc.property_id
       WHERE p.tenant_id = $1 AND ptc.is_active = true ${propertyFilter}`,
      queryParams
    )

    if (!propertiesResult.success) {
      throw new Error('Failed to fetch properties')
    }

    // Calculate estimated taxes for each property
    const results = []
    
    for (const property of propertiesResult.data) {
      const jurisdictions = typeof property.jurisdictions === 'string'
        ? JSON.parse(property.jurisdictions)
        : property.jurisdictions

      // Calculate total rate for this property
      const totalRate = jurisdictions.reduce((sum: number, j: any) => sum + j.rate, 0)

      // Get booking revenue for the period (if dates provided)
      let revenue = 0
      if (fromDate && toDate) {
        const revenueResult = await query(
          `SELECT COALESCE(SUM(total_amount), 0) as revenue
           FROM bookings
           WHERE property_id = $1 AND tenant_id = $2
             AND arrival >= $3 AND arrival <= $4
             AND status != 'canceled'`,
          [property.id, auth.tenantId, fromDate, toDate]
        )
        
        if (revenueResult.success && revenueResult.data.length > 0) {
          revenue = parseFloat(revenueResult.data[0].revenue)
        }
      }

      // Get platform fees for the period
      let platformFees = 0
      let platformRemits = 0
      
      if (fromDate && toDate) {
        // Extract year-month from dates for platform fee lookup
        const startMonth = fromDate.substring(0, 7)
        const endMonth = toDate.substring(0, 7)
        
        const feesResult = await query(
          `SELECT 
            COALESCE(SUM(guest_service_fee + host_service_fee), 0) as total_fees,
            COALESCE(SUM(platform_tax_remitted), 0) as platform_remits
           FROM platform_fee_entries
           WHERE property_id = $1 AND tenant_id = $2
             AND month >= $3 AND month <= $4`,
          [property.id, auth.tenantId, startMonth, endMonth]
        )

        if (feesResult.success && feesResult.data.length > 0) {
          platformFees = parseFloat(feesResult.data[0].total_fees || 0)
          platformRemits = parseFloat(feesResult.data[0].platform_remits || 0)
        }
      }

      const taxableAmount = revenue + platformFees
      const estimatedTax = (taxableAmount * totalRate) / 100
      const netOwnerRemits = estimatedTax - platformRemits

      results.push({
        propertyId: property.id,
        propertyName: property.name,
        revenue,
        platformFees,
        taxableAmount,
        taxRate: totalRate,
        estimatedTax,
        platformRemits,
        netOwnerRemits: Math.max(0, netOwnerRemits),
        jurisdictions
      })
    }

    // Calculate totals
    const summary = {
      totalRevenue: results.reduce((sum, r) => sum + r.revenue, 0),
      totalPlatformFees: results.reduce((sum, r) => sum + r.platformFees, 0),
      totalTaxableAmount: results.reduce((sum, r) => sum + r.taxableAmount, 0),
      totalEstimatedTax: results.reduce((sum, r) => sum + r.estimatedTax, 0),
      totalPlatformRemits: results.reduce((sum, r) => sum + r.platformRemits, 0),
      totalOwnerRemits: results.reduce((sum, r) => sum + r.netOwnerRemits, 0),
      effectiveRate: 0,
      propertyCount: results.length
    }

    if (summary.totalTaxableAmount > 0) {
      summary.effectiveRate = (summary.totalEstimatedTax / summary.totalTaxableAmount) * 100
    }

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: { 
        status: 'success', 
        data: {
          summary,
          properties: results,
          period: fromDate && toDate ? { from: fromDate, to: toDate } : null
        }
      }
    }
  } catch (error) {
    context.log('Error calculating bulk tax:', error)
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: { status: 'error', error: 'Failed to calculate taxes' }
    }
  }
}

app.http('tax-calculate', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: calculatePropertyTax
})

app.http('tax-calculate-bulk', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: calculateBulkTax
})