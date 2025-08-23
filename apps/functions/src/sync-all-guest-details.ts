import { InvocationContext } from '@azure/functions';
import axios from 'axios';
import { OWNERREZ_API } from '@baileys/constants';
import { buildAuthHeaders } from './services/syncService';
import { query } from './services/database';

type GuestInfo = {
  id: number
  first_name: string
  last_name: string
  email?: string
  email_addresses?: Array<{
    address: string
    is_default: boolean
  }>
  phones?: Array<{
    number: string
    is_default: boolean
  }>
}

export async function syncAllGuestDetailsInBulk(
  token: string,
  tenantId: string,
  context: InvocationContext
): Promise<{ updated: number; total: number }> {
  
  const uniqueGuestsResult = await query<{ guest_name: string; count: number }>(
    `SELECT guest_name, COUNT(*) as count
     FROM bookings 
     WHERE tenant_id = $1 
       AND guest_name IS NOT NULL
       AND (guest_phone IS NULL OR guest_email IS NULL)
     GROUP BY guest_name
     ORDER BY count DESC`,
    [tenantId]
  )

  if (!uniqueGuestsResult.success || uniqueGuestsResult.data.length === 0) {
    return { updated: 0, total: 0 }
  }

  context.log(`Found ${uniqueGuestsResult.data.length} unique guests needing contact info`)

  const authConfig = buildAuthHeaders(token)
  let totalUpdated = 0
  const batchSize = 20
  const guestNames = uniqueGuestsResult.data.map(g => g.guest_name)
  
  for (let i = 0; i < guestNames.length; i += batchSize) {
    const batch = guestNames.slice(i, i + batchSize)
    
    const batchPromises = batch.map(async (guest_name) => {
      try {
        const searchResponse = await axios.get(`${OWNERREZ_API.BASE_URL}/guests`, {
          ...authConfig,
          params: {
            q: guest_name,
            limit: 3
          }
        })

        if (searchResponse.data?.items?.length > 0) {
          const guests = searchResponse.data.items as GuestInfo[]
          const exactMatch = guests.find(g => 
            `${g.first_name} ${g.last_name}`.toLowerCase() === guest_name.toLowerCase()
          )
          const guest = exactMatch || guests[0]
          
          const email = guest.email || 
                       guest.email_addresses?.find(e => e.is_default)?.address || 
                       guest.email_addresses?.[0]?.address
          
          const phone = guest.phones?.find(p => p.is_default)?.number || 
                       guest.phones?.[0]?.number

          if (email || phone) {
            await query(
              `UPDATE bookings 
               SET guest_email = COALESCE($2, guest_email),
                   guest_phone = COALESCE($3, guest_phone)
               WHERE tenant_id = $1 AND guest_name = $4`,
              [tenantId, email, phone, guest_name]
            )
            return true
          }
        }
        return false
      } catch (error) {
        return false
      }
    })

    const results = await Promise.all(batchPromises)
    totalUpdated += results.filter(r => r).length
    
    if (i + batchSize < guestNames.length) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  return { updated: totalUpdated, total: guestNames.length }
}