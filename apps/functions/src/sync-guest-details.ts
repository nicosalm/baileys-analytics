import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import axios from 'axios';
import { OWNERREZ_API } from '@baileys/constants';
import { corsHeaders, handleOptions } from './middleware/auth';
import { requireAuthWithValidation } from './middleware/validation';
import { getTenantToken, buildAuthHeaders } from './services/syncService';
import { query } from './services/database';
import { createErrorResponse, createSuccessResponse, requireTenant } from './utils/httpResponses';

type GuestInfo = {
  id: number
  first_name: string
  last_name: string
  email_addresses?: Array<{
    address: string
    is_default: boolean
  }>
  phones?: Array<{
    number: string
    is_default: boolean
  }>
}

export async function syncGuestDetailsHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') return handleOptions()

  const authCheck = await requireAuthWithValidation(request, {})
  
  if (!authCheck.authenticated || !authCheck.valid) {
    return authCheck.response
  }

  const { auth } = authCheck.request
  
  const tenantValidation = requireTenant(auth.tenantId);
  if (tenantValidation) {
    return tenantValidation;
  }

  try {
    // Get OwnerRez token
    const tokenResult = await getTenantToken(auth.tenantId!)
    if (!tokenResult.success) {
      return createErrorResponse(tokenResult.error, 403);
    }

    const guestsResult = await query<{ guest_name: string }>(
      `SELECT DISTINCT guest_name 
       FROM bookings 
       WHERE tenant_id = $1 
         AND guest_name IS NOT NULL
         AND (guest_phone IS NULL OR guest_email IS NULL)
       ORDER BY guest_name
       LIMIT 100`,
      [auth.tenantId!]
    )

    if (!guestsResult.success || guestsResult.data.length === 0) {
      return createSuccessResponse({ 
        status: 'success', 
        message: 'No guests need updating',
        guestsUpdated: 0 
      });
    }

    context.log(`Found ${guestsResult.data.length} unique guests needing contact info`)

    const authConfig = buildAuthHeaders(tokenResult.data)
    const guestBatches: string[][] = []
    const batchSize = 10
    
    for (let i = 0; i < guestsResult.data.length; i += batchSize) {
      guestBatches.push(guestsResult.data.slice(i, i + batchSize).map(g => g.guest_name))
    }

    let totalUpdated = 0
    let totalProcessed = 0

    for (const batch of guestBatches) {
      const batchPromises = batch.map(async (guest_name) => {
        try {
          const searchResponse = await axios.get(`${OWNERREZ_API.BASE_URL}/guests`, {
            ...authConfig,
            params: {
              q: guest_name,
              limit: 5
            }
          })

          if (searchResponse.data?.items?.length > 0) {
            const guests = searchResponse.data.items as GuestInfo[]
            
            const exactMatch = guests.find(g => 
              `${g.first_name} ${g.last_name}`.toLowerCase() === guest_name.toLowerCase()
            )
            
            const guest = exactMatch || guests[0]
            
            const email = guest.email_addresses?.find(e => e.is_default)?.address || 
                         guest.email_addresses?.[0]?.address
            
            const phone = guest.phones?.find(p => p.is_default)?.number || 
                         guest.phones?.[0]?.number

            if (email || phone) {
              const updateResult = await query(
                `UPDATE bookings 
                 SET guest_email = COALESCE($2, guest_email),
                     guest_phone = COALESCE($3, guest_phone),
                     updated_at = CURRENT_TIMESTAMP
                 WHERE tenant_id = $1 
                   AND guest_name = $4
                   AND (guest_phone IS NULL OR guest_email IS NULL)`,
                [auth.tenantId!, email, phone, guest_name]
              )
              
              if (updateResult.success) {
                return { updated: true, name: guest_name }
              }
            }
          }
          return { updated: false, name: guest_name }
        } catch (error: any) {
          context.warn(`Failed to process guest ${guest_name}:`, error.message)
          return { updated: false, name: guest_name }
        }
      })

      const results = await Promise.all(batchPromises)
      totalProcessed += results.length
      totalUpdated += results.filter(r => r.updated).length
      
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    context.log(`Processed ${totalProcessed} guests, updated ${totalUpdated}`)

    return createSuccessResponse({
      status: 'success',
      guestsUpdated: totalUpdated,
      guestsProcessed: totalProcessed,
      message: `Updated contact info for ${totalUpdated} out of ${totalProcessed} guests`
    });
  } catch (error) {
    context.error('Guest sync failed:', error)
    return createErrorResponse('Guest sync failed');
  }
}

app.http('sync-guest-details', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: syncGuestDetailsHandler
})