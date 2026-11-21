import type { PacingMonthSummary } from '@/hooks/use-api'

export interface PacingTotals {
  occupancy: number
  revenue: number
  adr: number
}

// portfolio totals across the pacing window for one point in time
export function sumBuckets(months: PacingMonthSummary[], key: 'current' | 'priorAtThisPoint' | 'priorFinal'): PacingTotals {
  const nights = months.reduce((s, m) => s + m[key].bookedNights, 0)
  const revenue = months.reduce((s, m) => s + m[key].revenue, 0)
  const available = months.reduce((s, m) => s + (key === 'current' ? m.totalAvailableNights : m.priorAvailableNights), 0)
  return {
    occupancy: available > 0 ? (nights / available) * 100 : 0,
    revenue,
    adr: nights > 0 ? revenue / nights : 0,
  }
}

export const hasPriorYear = (months: PacingMonthSummary[]) =>
  months.some((m) => m.priorFinal.bookedNights > 0 || m.priorAtThisPoint.bookedNights > 0)
