import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { query } from './services/database'
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth'
import { z } from 'zod'
import { createErrorResponse, createSuccessResponse, requireTenant } from './utils/httpResponses'
import { parseNumericField, parseIntField, normalizePlatformName } from './utils/dataTransformers'

const PlatformFeeSchema = z.object({
  propertyId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  platform: z.enum(['airbnb', 'vrbo', 'booking.com', 'direct', 'other']),
  guestServiceFee: z.number().min(0).default(0),
  hostServiceFee: z.number().min(0).default(0),
  platformRemitsTax: z.boolean().default(false),
  platformTaxRemitted: z.number().min(0).default(0),
  bookingId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable()
})

// Shared function to transform platform fee row data
const transformPlatformFeeRow = (row: any) => ({
  id: row.id,
  tenantId: row.tenant_id,
  propertyId: row.property_id,
  bookingId: row.booking_id,
  platform: normalizePlatformName(row.platform),
  month: row.month,
  guestServiceFee: parseNumericField(row.guest_service_fee),
  hostServiceFee: parseNumericField(row.host_service_fee),
  platformRemitsTax: row.platform_remits_tax || false,
  platformTaxRemitted: parseNumericField(row.platform_tax_remitted),
  notes: row.notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  createdBy: row.created_by,
  createdByEmail: row.created_by_email
})

export async function platformFees(
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
  
  if (request.method === 'GET') {
    const propertyId = request.query.get('property')
    const month = request.query.get('month')
    
    if (!propertyId || !month) {
      return createErrorResponse('Property ID and month are required', 400)
    }
    
    const result = await query(
      `SELECT pfe.*, u.email as created_by_email
       FROM platform_fee_entries pfe
       LEFT JOIN users u ON pfe.created_by = u.id
       WHERE pfe.tenant_id = $1 AND pfe.property_id = $2 AND pfe.month = $3
       ORDER BY pfe.platform`,
      [auth.tenantId, propertyId, month]
    )

    if (!result.success) {
      return createErrorResponse(result.error || 'Failed to fetch platform fees')
    }

    const data = result.data.map(transformPlatformFeeRow)

    return createSuccessResponse({ status: 'success', data })
  }
  
  if (request.method === 'POST') {
    let body: any
    try {
      body = await request.json()
    } catch {
      return createErrorResponse('Invalid JSON body', 400)
    }

    const validation = PlatformFeeSchema.safeParse(body)
    if (!validation.success) {
      return createErrorResponse('Invalid data', 400)
    }

    const data = validation.data
    const result = await query(
    `INSERT INTO platform_fee_entries (
      tenant_id, property_id, platform, month,
      guest_service_fee, host_service_fee,
      platform_remits_tax, platform_tax_remitted,
      booking_id, notes, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (tenant_id, property_id, platform, month)
    DO UPDATE SET
      guest_service_fee = $5,
      host_service_fee = $6,
      platform_remits_tax = $7,
      platform_tax_remitted = $8,
      booking_id = $9,
      notes = $10,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *`,
    [
      auth.tenantId,
      data.propertyId,
      data.platform,
      data.month,
      data.guestServiceFee,
      data.hostServiceFee,
      data.platformRemitsTax,
      data.platformTaxRemitted,
      data.bookingId,
      data.notes,
      auth.userId
    ]
  )

    if (!result.success) {
      return createErrorResponse(result.error || 'Failed to save platform fee')
    }

    return createSuccessResponse({ 
      status: 'success', 
      data: {
        id: result.data[0].id,
        ...data,
        createdAt: result.data[0].created_at,
        updatedAt: result.data[0].updated_at
      }
    })
  }
  
  return createErrorResponse('Method not allowed', 405)
}

export async function deletePlatformFee(
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
  
  const feeId = request.params.id

  if (!feeId) {
    return createErrorResponse('Fee ID is required', 400)
  }

  const result = await query(
    `DELETE FROM platform_fee_entries 
     WHERE id = $1 AND tenant_id = $2
     RETURNING id`,
    [feeId, auth.tenantId]
  )

  if (!result.success) {
    return createErrorResponse('Failed to delete platform fee')
  }

  if (result.data.length === 0) {
    return createErrorResponse('Platform fee not found', 404)
  }

  return createSuccessResponse({ status: 'success', message: 'Platform fee deleted' })
}

app.http('platform-fees', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: platformFees
})

app.http('platform-fees-delete', {
  methods: ['DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'platform-fees/{id}',
  handler: deletePlatformFee
})