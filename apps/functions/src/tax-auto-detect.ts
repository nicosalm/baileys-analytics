import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { query } from './services/database'
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth'

interface SimplifiedJurisdiction {
  name: string
  rate: number
  ownerrezName: string
  pattern: string
  occurrence_count?: number
}

// GET /api/tax-jurisdiction-auto-detect
export async function autoDetectJurisdictions(
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
  const propertyId = request.query.get('propertyId')

  if (!propertyId) {
    return {
      status: 400,
      headers: corsHeaders(),
      jsonBody: { status: 'error', error: 'propertyId is required' }
    }
  }

  try {
    // Get all tax charges from recent bookings
    const taxChargesResult = await query(
      `SELECT 
        bc.description as tax_name,
        COUNT(*) as occurrence_count,
        ROUND(AVG(bc.amount::numeric / NULLIF(b.total_amount::numeric, 0) * 100)::numeric, 2)::text as avg_rate
       FROM bookings b
       JOIN booking_charges bc ON b.id = bc.booking_id
       WHERE b.property_id = $1 
         AND b.tenant_id = $2
         AND bc.type = 'tax'
         AND b.arrival >= NOW() - INTERVAL '6 months'
       GROUP BY bc.description
       ORDER BY occurrence_count DESC`,
      [propertyId, auth.tenantId]
    )

    if (!taxChargesResult.success || taxChargesResult.data.length === 0) {
      return {
        status: 200,
        headers: corsHeaders(),
        jsonBody: {
          status: 'success',
          data: {
            jurisdictions: [],
            message: 'No tax data found. Import more bookings to enable auto-detection.'
          }
        }
      }
    }

    // Group similar tax names and detect patterns
    const jurisdictionMap = new Map<string, SimplifiedJurisdiction>()
    
    for (const charge of taxChargesResult.data) {
      const taxName = charge.tax_name
      // Parse the rate, ensuring it's treated as a percentage value
      const avgRate = Number(charge.avg_rate)
      
      let simplifiedName = taxName.trim()

      // Check if we already have this jurisdiction
      const existing = jurisdictionMap.get(simplifiedName)
      if (existing && existing.occurrence_count) {
        // Update with weighted average rate
        const totalOccurrences = existing.occurrence_count + charge.occurrence_count
        existing.rate = (existing.rate * existing.occurrence_count + avgRate * charge.occurrence_count) / totalOccurrences
        existing.occurrence_count = totalOccurrences
      } else {
        jurisdictionMap.set(simplifiedName, {
          name: simplifiedName,
          rate: avgRate, // Keep the actual rate without rounding yet
          ownerrezName: taxName,
          pattern: taxName,
          occurrence_count: charge.occurrence_count
        })
      }
    }

    // Convert to array, sorted by rate (highest first) for better visibility
    const jurisdictions = Array.from(jurisdictionMap.values())
      .sort((a, b) => b.rate - a.rate) // Sort by rate, highest first
      .map(({ occurrence_count, ...rest }) => rest) // Remove occurrence_count from output

    // Check if configuration already exists
    const existingConfig = await query(
      `SELECT id FROM property_tax_configs 
       WHERE property_id = $1 AND tenant_id = $2 AND is_active = true`,
      [propertyId, auth.tenantId]
    )

    const hasExistingConfig = existingConfig.success && existingConfig.data.length > 0

    // Calculate total effective rate
    const totalRate = jurisdictions.reduce((sum, j) => sum + j.rate, 0)

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: {
        status: 'success',
        data: {
          jurisdictions,
          summary: {
            totalRate,
            jurisdictionCount: jurisdictions.length,
            hasExistingConfig,
            detectionConfidence: jurisdictions.length > 0 ? 'high' : 'low'
          },
          recommendations: generateRecommendations(jurisdictions, totalRate)
        }
      }
    }
  } catch (error) {
    context.error('Error auto-detecting jurisdictions:', error)
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: { status: 'error', error: 'Failed to auto-detect jurisdictions' }
    }
  }
}

// POST /api/tax-jurisdiction-auto-apply
export async function autoApplyJurisdictions(
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
    const body = await request.json() as { propertyId: string; jurisdictions: SimplifiedJurisdiction[] }
    const { propertyId, jurisdictions } = body

    if (!propertyId || !jurisdictions) {
      return {
        status: 400,
        headers: corsHeaders(),
        jsonBody: { status: 'error', error: 'propertyId and jurisdictions are required' }
      }
    }

    // Deactivate existing configs
    await query(
      `UPDATE property_tax_configs 
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE property_id = $1 AND tenant_id = $2`,
      [propertyId, auth.tenantId]
    )

    // Create new config with auto-detected jurisdictions
    const result = await query(
      `INSERT INTO property_tax_configs 
       (tenant_id, property_id, jurisdictions, ownerrez_mappings, auto_detected, is_active)
       VALUES ($1, $2, $3, $4, true, true)
       RETURNING id`,
      [
        auth.tenantId,
        propertyId,
        JSON.stringify(jurisdictions),
        JSON.stringify(jurisdictions.map((j: SimplifiedJurisdiction) => ({
          ownerrezName: j.ownerrezName,
          mappedTo: j.name
        })))
      ]
    )

    if (!result.success) {
      throw new Error('Failed to save configuration')
    }

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: {
        status: 'success',
        data: {
          configId: result.data[0].id,
          message: 'Tax jurisdictions auto-applied successfully'
        }
      }
    }
  } catch (error) {
    context.error('Error applying jurisdictions:', error)
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: { status: 'error', error: 'Failed to apply jurisdictions' }
    }
  }
}

function generateRecommendations(jurisdictions: SimplifiedJurisdiction[], totalRate: number): string[] {
  const recommendations = []

  if (jurisdictions.length === 0) {
    recommendations.push('Import more recent bookings to enable automatic tax detection')
    return recommendations
  }

  // Check for expected rate ranges
  if (totalRate < 5) {
    recommendations.push('Total tax rate seems low. Verify all jurisdictions are captured.')
  } else if (totalRate > 20) {
    recommendations.push('Total tax rate seems high. Review for potential duplicates.')
  }

  if (jurisdictions.length > 2) {
    recommendations.push('Multiple tax jurisdictions detected. Ensure platform fee tracking for accurate reporting.')
  }

  return recommendations
}

app.http('tax-auto-detect', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: autoDetectJurisdictions
})

app.http('tax-jurisdiction-auto-apply', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: autoApplyJurisdictions
})