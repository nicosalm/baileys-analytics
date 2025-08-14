import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { query } from './services/database'
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth'

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
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: { status: 'error', error: result.error }
    }
  }

  const data = result.data.map(row => ({
    id: row.id,
    tenantId: row.tenant_id,
    propertyId: row.property_id,
    propertyName: row.property_name,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    totalRevenue: parseFloat(row.total_revenue || 0),
    totalPlatformFees: parseFloat(row.total_platform_fees || 0),
    totalTaxDue: parseFloat(row.total_tax_due || 0),
    platformRemitted: parseFloat(row.platform_remitted || 0),
    ownerRemitted: parseFloat(row.owner_remitted || 0),
    filingStatus: row.filing_status,
    filedDate: row.filed_date,
    confirmationNumber: row.confirmation_number,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))

  return {
    status: 200,
    headers: corsHeaders(),
    jsonBody: { status: 'success', data }
  }
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
  
  let body: any
  try {
    body = await request.json()
  } catch {
    return {
      status: 400,
      headers: corsHeaders(),
      jsonBody: { status: 'error', error: 'Invalid JSON body' }
    }
  }

  const { propertyId, bookingAmount, platformFees, bookingDate, platform } = body
  
  if (!propertyId || !bookingAmount || !bookingDate) {
    return {
      status: 400,
      headers: corsHeaders(),
      jsonBody: { 
        status: 'error', 
        error: 'Property ID, booking amount, and booking date are required' 
      }
    }
  }

  // Get active tax rules for the property
  const rulesResult = await query(
    `SELECT * FROM tax_rules
     WHERE tenant_id = $1 
       AND is_active = true
       AND effective_from <= $2
       AND (effective_to IS NULL OR effective_to >= $2)
     ORDER BY priority DESC`,
    [auth.tenantId, bookingDate]
  )

  if (!rulesResult.success) {
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: { status: 'error', error: 'Failed to fetch tax rules' }
    }
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
    
    // Determine who remits the tax
    const platformFeesTax = (guestFee + hostFee) * rate
    if (platform === 'airbnb' && jurisdiction.type === 'state') {
      // Airbnb typically remits state taxes on their fees
      platformRemitted += platformFeesTax
      ownerRemitted += (bookingAmount * rate)
    } else {
      ownerRemitted += taxAmount
    }
    
    breakdown.push({
      jurisdiction: jurisdiction.name,
      rate,
      amount: taxAmount,
      paidBy: platformFeesTax > 0 && platform === 'airbnb' ? 'split' : 'owner'
    })
  }

  const effectiveRate = totalAmount > 0 ? totalTaxDue / totalAmount : 0

  return {
    status: 200,
    headers: corsHeaders(),
    jsonBody: { 
      status: 'success', 
      data: {
        totalRevenue: totalAmount,
        totalTaxDue,
        platformRemitted,
        ownerRemitted,
        effectiveRate,
        breakdown
      }
    }
  }
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