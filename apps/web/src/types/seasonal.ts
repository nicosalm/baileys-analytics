export type SeasonalData = {
 yearOverYear: {
   currentYear: number
   previousYear: number
   years: Array<{
     year: number
     revenue: number
     bookings: number
     occupancy: number        // percentage (0-100)
     avgNightlyRate: number
   }>
 }
 monthlyTrends: Array<{
   month: string
   monthName: string
   currentYear: {
     revenue: number
     bookings: number
     occupancy: number        // percentage (0-100)
     avgNightlyRate: number
   }
   previousYear: {
     revenue: number
     bookings: number
     occupancy: number        // percentage (0-100)
     avgNightlyRate: number
   }
   yoyGrowth: {
     revenue: number          // ratio (e.g., 0.15 for 15% growth)
     bookings: number         // ratio (e.g., 0.15 for 15% growth)
     occupancy: number        // ratio (e.g., 0.15 for 15% growth)
     avgNightlyRate: number   // ratio (e.g., 0.15 for 15% growth)
   }
 }>
 seasonalPatterns: {
   peakMonths: Array<{
     month: string
     score: number            // percentage (0-100)
   }>
   lowMonths: Array<{
     month: string
     score: number            // percentage (0-100)
   }>
   avgPeakOccupancy: number   // percentage (0-100)
   avgLowOccupancy: number    // percentage (0-100)
   seasonalityIndex: number   // ratio (0-1), higher = more seasonal variation
 }
 propertySeasonality: Array<{
   propertyId: string
   propertyName: string
   peakMonth: string          // month name (e.g., "Jul")
   lowMonth: string           // month name (e.g., "Jan")
   seasonalityScore: number   // percentage (0-100), represents variation
   monthlyOccupancy: Array<{
     month: number            // month number (1-12)
     occupancy: number        // percentage (0-100)
     revenue: number          // dollar amount
   }>
 }>
 priceOptimization: {
   underpriced: Array<{
     propertyId: string
     propertyName: string
     month: string            // month name (e.g., "July")
     currentRate: number      // dollar amount
     suggestedRate: number    // dollar amount
     revenueOpportunity: number  // dollar amount (potential monthly increase)
   }>
   overpriced: Array<{
     propertyId: string
     propertyName: string
     month: string            // month name (e.g., "January")
     currentRate: number      // dollar amount
     suggestedRate: number    // dollar amount
     occupancyImpact: number  // percentage points (e.g., 0.1 for 10% potential increase)
   }>
 }
}
