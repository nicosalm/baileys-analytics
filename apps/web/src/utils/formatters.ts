import { 
  formatCurrency as formatCurrencyBase, 
  formatCompactCurrency as formatCompactBase,
  formatPercentage as formatPercentageBase 
} from '@baileys/utils'

export { formatCurrencyBase as formatCurrency, formatCompactBase as formatCompactCurrency }

export const formatPercentage = formatPercentageBase

export const formatGrowthRate = (current: number, previous: number): string => {
  if (previous === 0) return current > 0 ? '+100%' : '0%'
  const rate = ((current - previous) / previous) * 100
  const formatted = formatPercentageBase(rate, 1)
  return rate > 0 ? `+${formatted}` : formatted
}

export const formatCompactNumber = (value: number): string => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
  return value.toString()
}

export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('en-US').format(value)
}

export const formatDateRange = (from: Date | string, to: Date | string): string => {
  const fromDate = typeof from === 'string' ? new Date(from) : from
  const toDate = typeof to === 'string' ? new Date(to) : to
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
  
  return `${formatter.format(fromDate)} - ${formatter.format(toDate)}`
}

export const formatMonthYear = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric'
  }).format(d)
}

export const formatShortMonth = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-US', {
    month: 'short'
  }).format(d)
}

export const normalizePlatformName = (platform: string | null): string => {
  if (!platform || platform === '') return 'Direct'
  
  const lower = platform.toLowerCase()
  if (lower.includes('airbnb')) return 'Airbnb'
  if (lower.includes('vrbo') || lower.includes('homeaway')) return 'VRBO'
  if (lower.includes('booking.com')) return 'Booking.com'
  
  return platform
}

export const formatTaxRate = (rate: number): string => {
  return formatPercentageBase(rate * 100, 2)
}

export const formatOccupancyRate = (rate: number): string => {
  return formatPercentageBase(rate * 100, 1)
}

export const formatADR = (adr: number): string => {
  return formatCurrencyBase(adr)
}

export const formatDays = (days: number): string => {
  if (days === 1) return '1 day'
  return `${days} days`
}

export const formatNights = (nights: number): string => {
  if (nights === 1) return '1 night'
  return `${nights} nights`
}

export const formatGuestCount = (count: number): string => {
  if (count === 1) return '1 guest'
  return `${count} guests`
}

export const formatPropertyCount = (count: number): string => {
  if (count === 1) return '1 property'
  return `${count} properties`
}

export const formatBookingStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    'confirmed': 'Confirmed',
    'pending': 'Pending',
    'cancelled': 'Cancelled',
    'completed': 'Completed',
    'in_progress': 'In Progress'
  }
  return statusMap[status.toLowerCase()] || status
}

export const formatMetricValue = (
  value: number | string | undefined | null,
  format: 'currency' | 'percentage' | 'number' | 'compact' = 'number'
): string => {
  if (value === undefined || value === null) return '—'
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(numValue)) return '—'
  
  switch (format) {
    case 'currency':
      return formatCurrencyBase(numValue)
    case 'percentage':
      return formatPercentageBase(numValue, 1)
    case 'compact':
      return formatCompactNumber(numValue)
    default:
      return numValue.toLocaleString()
  }
}