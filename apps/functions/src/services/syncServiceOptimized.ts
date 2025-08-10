// Example of how to refactor syncService.ts with the new utilities
// This shows the pattern - you can apply it to the actual file

import axios from 'axios'
import { OWNERREZ_API } from '@baileys/constants'
import { batchProcess, retryWithBackoff, apiLimiter } from '../utils/concurrency'
import { formatDate, calculateNights } from '../utils/dates'
import { DbResult } from './database'

// Example: Fetch bookings with concurrency control
export const fetchBookingsOptimized = async (
  token: string,
  propertyIds: string[],
  dateRange: { from: string; to: string }
): Promise<DbResult<any[]>> => {
  const authConfig = buildAuthHeaders(token)
  
  // Process property batches with concurrency control
  const results = await batchProcess(
    propertyIds,
    async (propertyId) => {
      return retryWithBackoff(async () => {
        const response = await axios.get(`${OWNERREZ_API.BASE_URL}/bookings`, {
          ...authConfig,
          params: {
            property_id: propertyId,
            from: dateRange.from,
            to: dateRange.to,
            include_charges: true,
            include_guest: true,
            limit: 500
          }
        })
        return response.data.items || []
      }, {
        maxRetries: 3,
        initialDelay: 1000
      })
    },
    {
      concurrency: 5,  // Process 5 properties at a time
      batchSize: 10,   // Group into batches of 10
      onProgress: (completed, total) => {
        console.log(`Fetched bookings for ${completed}/${total} properties`)
      }
    }
  )
  
  // Flatten results
  const allBookings = results.flat()
  
  return { success: true, data: allBookings }
}

// Example: Simplified date handling
export const getBookingMetrics = (bookings: any[]) => {
  return bookings.map(booking => ({
    ...booking,
    nights: calculateNights(booking.arrival, booking.departure),
    formattedArrival: formatDate(booking.arrival),
    formattedDeparture: formatDate(booking.departure)
  }))
}

function buildAuthHeaders(token: string) {
  const isPAT = !token.startsWith('ey')
  return isPAT
    ? {
        headers: { 'Accept': 'application/json' },
        auth: { username: 'martina@***REMOVED***', password: token }
      }
    : {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      }
}