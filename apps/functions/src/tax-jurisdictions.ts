import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth'
import { query } from './services/database'
import { 
  type DetectedJurisdiction, 
  type JurisdictionType,
  taxJurisdictionsResponseSchema 
} from '@baileys/shared-types'

/**
 * Analyzes OwnerRez tax charge descriptions to detect jurisdictions
 * Groups similar tax descriptions and calculates effective rates
 */
export async function getTaxJurisdictions(
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
  const tenantId = auth.tenantId

  if (!tenantId) {
    return {
      status: 403,
      headers: corsHeaders(),
      jsonBody: { error: 'No tenant associated with user' }
    }
  }

  try {
    // Get all unique tax descriptions by property with occurrence counts and amounts
    const taxDataResult = await query<{
      property_id: string
      property_name: string
      description: string
      occurrence_count: string
      total_amount: string
      avg_booking_amount: string
    }>(`
      WITH tax_aggregates AS (
        SELECT 
          b.property_id,
          p.name as property_name,
          bc.description,
          COUNT(*) as occurrence_count,
          SUM(bc.amount) as total_amount,
          AVG(b.total_amount) as avg_booking_amount
        FROM booking_charges bc
        JOIN bookings b ON bc.booking_id = b.id
        JOIN properties p ON b.property_id = p.id
        WHERE bc.type = 'tax'
          AND b.tenant_id = $1
          AND b.status != 'canceled'
          AND bc.description IS NOT NULL
          AND bc.description != ''
        GROUP BY b.property_id, p.name, bc.description
      )
      SELECT 
        property_id::text,
        property_name,
        description,
        occurrence_count::text,
        total_amount::text,
        avg_booking_amount::text
      FROM tax_aggregates
      ORDER BY property_id, occurrence_count DESC`,
      [tenantId]
    )

    if (!taxDataResult.success) {
      throw new Error('Failed to fetch tax data')
    }

    // Process and group tax descriptions by property
    const propertiesMap = new Map<string, DetectedJurisdiction>()

    for (const row of taxDataResult.data) {
      const propertyId = row.property_id
      const description = row.description
      const occurrenceCount = parseInt(row.occurrence_count)
      const totalAmount = parseFloat(row.total_amount)
      const avgBookingAmount = parseFloat(row.avg_booking_amount)

      if (!propertiesMap.has(propertyId)) {
        propertiesMap.set(propertyId, {
          propertyId,
          propertyName: row.property_name,
          jurisdictions: []
        })
      }

      const property = propertiesMap.get(propertyId)!
      
      // Parse and categorize the tax description
      const parsed = parseTaxDescription(description)
      
      // Calculate average effective rate
      const averageRate = avgBookingAmount > 0 
        ? (totalAmount / (occurrenceCount * avgBookingAmount)) * 100
        : 0

      // Check if we already have this base pattern
      const existingJurisdiction = property.jurisdictions.find(
        j => j.basePattern === parsed.basePattern
      )

      if (existingJurisdiction) {
        // Aggregate similar patterns
        existingJurisdiction.occurrenceCount += occurrenceCount
        existingJurisdiction.totalAmount += totalAmount
        // Recalculate average rate
        existingJurisdiction.averageRate = 
          (existingJurisdiction.totalAmount / existingJurisdiction.occurrenceCount) / avgBookingAmount * 100
      } else {
        property.jurisdictions.push({
          originalDescription: description,
          basePattern: parsed.basePattern,
          jurisdictionType: parsed.type,
          occurrenceCount,
          totalAmount,
          averageRate,
          suggestedName: parsed.suggestedName
        })
      }
    }

    // Sort jurisdictions by occurrence count (most common first)
    for (const property of propertiesMap.values()) {
      property.jurisdictions.sort((a, b) => b.occurrenceCount - a.occurrenceCount)
    }

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: {
        properties: Array.from(propertiesMap.values()),
        summary: {
          totalProperties: propertiesMap.size,
          averageJurisdictionsPerProperty: 
            Array.from(propertiesMap.values()).reduce((sum, p) => sum + p.jurisdictions.length, 0) / 
            Math.max(propertiesMap.size, 1)
        }
      }
    }
  } catch (error) {
    context.error('Error fetching tax jurisdictions:', error)
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: { error: 'Failed to fetch tax jurisdictions' }
    }
  }
}

/**
 * Parses tax description to extract base pattern and jurisdiction type
 */
function parseTaxDescription(description: string): {
  basePattern: string
  type: JurisdictionType
  suggestedName: string
} {
  // Normalize the description
  const normalized = description.trim()
  
  // Remove common suffixes and variations
  const basePattern = normalized
    .replace(/\s*\(.*?\)\s*/g, '') // Remove parenthetical notes
    .replace(/\s*(extra|additional|second).*$/i, '') // Remove modifiers
    .replace(/\s*-\s*\$[\d,]+.*$/i, '') // Remove amounts
    .replace(/\s*remitted by.*$/i, '') // Remove "remitted by" clauses
    .replace(/\s*Tax\s*$/i, ' Tax') // Normalize "Tax" suffix
    .trim()

  // Determine jurisdiction type based on patterns
  let type: JurisdictionType = 'other'
  let suggestedName = basePattern

  // Generic state/provincial tax patterns
  if (/\b(state|provincial|federal|national)\b/i.test(basePattern)) {
    type = 'state'
    suggestedName = basePattern
  }
  // County/regional patterns
  else if (/\b(county|regional|prefecture|department)\b/i.test(basePattern)) {
    type = 'county'
    suggestedName = basePattern
  }
  // City patterns
  else if (/(City|Municipal|Town)\s/i.test(basePattern)) {
    type = 'city'
    suggestedName = basePattern
  }
  // Special district patterns
  else if (/(Tourism|Zone|District|Special)\s/i.test(basePattern)) {
    type = 'special'
    suggestedName = basePattern
  }
  // Credit card fees and other non-tax items
  else if (/(Credit Card|Fee|Processing)/i.test(basePattern)) {
    type = 'other'
    suggestedName = 'Processing Fee (Not Tax)'
  }

  return {
    basePattern,
    type,
    suggestedName
  }
}

app.http('tax-jurisdictions', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: getTaxJurisdictions
})