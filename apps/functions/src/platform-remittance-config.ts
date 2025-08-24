import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { query } from './services/database'
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth'
import { z } from 'zod'
import { createErrorResponse, createSuccessResponse, requireTenant } from './utils/httpResponses'
import { normalizePlatformName } from './utils/dataTransformers'

// Schema for platform remittance configuration
const PlatformRemittanceSchema = z.object({
  platform: z.enum(['airbnb', 'vrbo', 'booking.com', 'direct']),
  remitsOccupancyTax: z.boolean(),
  remitsOnGuestFees: z.boolean(),
  jurisdictions: z.array(z.string()).optional(),
  notes: z.string().optional()
})

// Shared function to transform platform remittance config row data
const transformPlatformRemittanceConfigRow = (row: any) => ({
  platform: normalizePlatformName(row.platform),
  remitsOccupancyTax: row.remits_occupancy_tax,
  remitsOnGuestFees: row.remits_on_guest_fees,
  jurisdictions: row.jurisdictions,
  notes: row.notes
})

const UpdateRemittanceConfigSchema = z.object({
  configs: z.array(PlatformRemittanceSchema)
})

// GET /api/platform-remittance-config
export async function getPlatformRemittanceConfig(
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
  if (tenantCheck) return tenantCheck

  try {
    // First check if tenant has custom configuration
    const configResult = await query(
      `SELECT * FROM tenant_platform_configs WHERE tenant_id = $1`,
      [auth.tenantId]
    )

    if (configResult.success && configResult.data.length > 0) {
      // Return tenant's custom configuration
      const configs = configResult.data.map(transformPlatformRemittanceConfigRow)

      return createSuccessResponse({ status: 'success', data: configs, source: 'custom' })
    }

    // Return default suggestions (not hardcoded rules, just suggestions)
    const defaultSuggestions = [
      {
        platform: normalizePlatformName('airbnb'),
        remitsOccupancyTax: true,
        remitsOnGuestFees: true,
        notes: 'Airbnb remittance varies by jurisdiction - verify with local authorities'
      },
      {
        platform: normalizePlatformName('vrbo'),
        remitsOccupancyTax: false,
        remitsOnGuestFees: false,
        notes: 'VRBO remittance varies by location - verify with local tax authority'
      },
      {
        platform: normalizePlatformName('booking.com'),
        remitsOccupancyTax: false,
        remitsOnGuestFees: false,
        notes: 'Booking.com remittance policies vary - check your agreement'
      },
      {
        platform: normalizePlatformName('direct'),
        remitsOccupancyTax: false,
        remitsOnGuestFees: false,
        notes: 'Direct bookings - owner responsible for all tax remittance'
      }
    ]

    return createSuccessResponse({ 
      status: 'success', 
      data: defaultSuggestions, 
      source: 'suggestions',
      message: 'These are suggestions only. Please verify with your local tax authority.'
    })
  } catch (error) {
    context.error('Error fetching platform remittance config:', error)
    return createErrorResponse('Failed to fetch configuration')
  }
}

// POST /api/platform-remittance-config
export async function updatePlatformRemittanceConfig(
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
  if (tenantCheck) return tenantCheck

  try {
    const body = await request.json()
    const parsed = UpdateRemittanceConfigSchema.parse(body)

    // Delete existing configs and insert new ones
    await query(
      `DELETE FROM tenant_platform_configs WHERE tenant_id = $1`,
      [auth.tenantId]
    )

    for (const config of parsed.configs) {
      await query(
        `INSERT INTO tenant_platform_configs 
         (tenant_id, platform, remits_occupancy_tax, remits_on_guest_fees, jurisdictions, notes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          auth.tenantId,
          normalizePlatformName(config.platform),
          config.remitsOccupancyTax,
          config.remitsOnGuestFees,
          config.jurisdictions || null,
          config.notes || null
        ]
      )
    }

    return createSuccessResponse({ 
      status: 'success', 
      message: 'Platform remittance configuration updated'
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('Invalid configuration', 400)
    }

    context.error('Error updating platform remittance config:', error)
    return createErrorResponse('Failed to update configuration')
  }
}

app.http('platform-remittance-config', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: (request, context) => {
    if (request.method === 'GET') {
      return getPlatformRemittanceConfig(request, context)
    } else if (request.method === 'POST') {
      return updatePlatformRemittanceConfig(request, context)
    } else {
      return handleOptions()
    }
  }
})