export type SeasonalData = {
  yearOverYear: {
    currentYear: number
    previousYear: number
    years: Array<{
      year: number
      revenue: number
      bookings: number
      occupancy: number
      avgNightlyRate: number
    }>
  }
  monthlyTrends: Array<{
    month: string
    monthName: string
    currentYear: {
      revenue: number
      bookings: number
      occupancy: number
      avgNightlyRate: number
    }
    previousYear: {
      revenue: number
      bookings: number
      occupancy: number
      avgNightlyRate: number
    }
    yoyGrowth: {
      revenue: number
      bookings: number
      occupancy: number
      avgNightlyRate: number
    }
  }>
  seasonalPatterns: {
    peakMonths: Array<{ month: string; score: number }>
    lowMonths: Array<{ month: string; score: number }>
    avgPeakOccupancy: number
    avgLowOccupancy: number
    seasonalityIndex: number // 0-1, higher = more seasonal
  }
  propertySeasonality: Array<{
    propertyId: string
    propertyName: string
    peakMonth: string
    lowMonth: string
    seasonalityScore: number
    monthlyOccupancy: Array<{
      month: number
      occupancy: number
      revenue: number
    }>
  }>
  priceOptimization: {
    underpriced: Array<{
      propertyId: string
      propertyName: string
      month: string
      currentRate: number
      suggestedRate: number
      revenueOpportunity: number
    }>
    overpriced: Array<{
      propertyId: string
      propertyName: string
      month: string
      currentRate: number
      suggestedRate: number
      occupancyImpact: number
    }>
  }
}
