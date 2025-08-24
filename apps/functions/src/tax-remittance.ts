import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { query } from './services/database'
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth'
import { createSuccessResponse, createErrorResponse, requireTenant } from './utils/httpResponses'
import { parseNumericField } from './utils/dataTransformers'

// GET /api/tax-remittance
export async function getTaxRemittance(
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
  
  const tenantCheck = requireTenant(auth.tenantId)
  if (tenantCheck) {
    return tenantCheck
  }
  
  const propertyId = request.query.get('property')
  const periodStart = request.query.get('start')
  const periodEnd = request.query.get('end')
  
  let whereClause = 'WHERE tr.tenant_id = $1'
  const params: any[] = [auth.tenantId]
  let paramIndex = 2
  
  if (propertyId) {
    whereClause += ` AND tr.property_id = $${paramIndex}`
    params.push(propertyId)
    paramIndex++
  }
  
  if (periodStart) {
    whereClause += ` AND tr.period_end >= $${paramIndex}`
    params.push(periodStart)
    paramIndex++
  }
  
  if (periodEnd) {
    whereClause += ` AND tr.period_start <= $${paramIndex}`
    params.push(periodEnd)
    paramIndex++
  }

  const result = await query(
    `SELECT 
      tr.*,
      p.name as property_name
     FROM tax_remittances tr
     LEFT JOIN properties p ON tr.property_id = p.id
     ${whereClause}
     ORDER BY tr.period_start DESC`,
    params
  )

  if (!result.success) {
    return createErrorResponse(result.error)
  }

  const data = result.data.map(row => ({
    id: row.id,
    tenantId: row.tenant_id,
    propertyId: row.property_id,
    propertyName: row.property_name,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    totalRevenue: parseNumericField(row.total_revenue),
    totalPlatformFees: parseNumericField(row.total_platform_fees),
    totalTaxDue: parseNumericField(row.total_tax_due),
    platformRemitted: parseNumericField(row.platform_remitted),
    ownerRemitted: parseNumericField(row.owner_remitted),
    filingStatus: row.filing_status,
    filedDate: row.filed_date,
    confirmationNumber: row.confirmation_number,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))

  return createSuccessResponse({ status: 'success', data })
}

// POST /api/tax-calculate
export async function calculateTax(
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
  
  const tenantCheck = requireTenant(auth.tenantId)
  if (tenantCheck) {
    return tenantCheck
  }
  
  let body: any
  try {
    body = await request.json()
  } catch {
    return createErrorResponse('Invalid JSON body', 400)
  }

  const { propertyId, bookingAmount, platformFees, bookingDate, platform } = body
  
  if (!propertyId || !bookingAmount || !bookingDate) {
    return createErrorResponse('Property ID, booking amount, and booking date are required', 400)
  }

  // Get property tax configuration
  const configResult = await query(
    `SELECT * FROM property_tax_configs
     WHERE property_id = $1 
       AND tenant_id = $2
       AND is_active = true
       AND effective_from <= $3
       AND (effective_to IS NULL OR effective_to >= $3)
     LIMIT 1`,
    [propertyId, auth.tenantId, bookingDate]
  )

  const config = configResult.success && configResult.data.length > 0
    ? configResult.data[0]
    : null

  // Calculate taxes based on rules and configuration
  const jurisdictions = config?.jurisdictions || []
  const guestFee = platformFees?.guestServiceFee || 0
  const hostFee = platformFees?.hostServiceFee || 0
  const totalAmount = bookingAmount + guestFee + hostFee
  
  let totalTaxDue = 0
  let platformRemitted = 0
  let ownerRemitted = 0
  const breakdown = []
  
  // Apply each jurisdiction's tax rate
  for (const jurisdiction of jurisdictions) {
    const rate = jurisdiction.rate || 0
    const taxAmount = totalAmount * rate
    totalTaxDue += taxAmount
    
    // Calculate tax - remittance should be determined by platform config
    const platformFeesTax = (guestFee + hostFee) * rate
    // TODO: Get actual remittance rules from tenant_platform_configs
    ownerRemitted += taxAmount
    
    breakdown.push({
      jurisdiction: jurisdiction.name,
      rate,
      amount: taxAmount,
      paidBy: 'owner' // Should be determined by platform configuration
    })
  }

  const effectiveRate = totalAmount > 0 ? totalTaxDue / totalAmount : 0

  return createSuccessResponse({ 
    status: 'success', 
    data: {
      totalRevenue: totalAmount,
      totalTaxDue,
      platformRemitted,
      ownerRemitted,
      effectiveRate,
      breakdown
    }
  })
}

app.http('tax-remittance', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: getTaxRemittance
})

app.http('tax-calculate', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: calculateTax
})