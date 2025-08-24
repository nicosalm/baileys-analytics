export const CHART_COLORS = [
  '#3B82F6', // blue-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#EF4444', // red-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
  '#14B8A6', // teal-500
  '#F97316', // orange-500
  '#06B6D4', // cyan-500
  '#84CC16', // lime-500
] as const

export const TAG_TYPE_STYLES = {
  payment: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-300',
    hover: 'hover:bg-green-200'
  },
  guest: {
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    border: 'border-purple-300',
    hover: 'hover:bg-purple-200'
  },
  booking: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-300',
    hover: 'hover:bg-blue-200'
  },
  property: {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    border: 'border-orange-300',
    hover: 'hover:bg-orange-200'
  },
  custom: {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    border: 'border-gray-300',
    hover: 'hover:bg-gray-200'
  }
} as const

export const STATUS_STYLES = {
  confirmed: {
    bg: 'bg-green-100',
    text: 'text-green-800'
  },
  cancelled: {
    bg: 'bg-red-100',
    text: 'text-red-800'
  },
  canceled: {
    bg: 'bg-red-100',
    text: 'text-red-800'
  },
  pending: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800'
  },
  default: {
    bg: 'bg-gray-100',
    text: 'text-gray-800'
  }
} as const

export const METRIC_COLORS = {
  revenue: '#3B82F6',
  occupancy: '#10B981',
  bookings: '#F59E0B',
  tax: '#EF4444',
  expenses: '#8B5CF6',
  profit: '#14B8A6',
  primary: '#3B82F6',
  success: '#10B981',
  danger: '#EF4444'
} as const

export const PLATFORM_COLORS: Record<string, string> = {
  'Airbnb': '#FF5A5F',
  'VRBO': '#0061A7',
  'Booking.com': '#003580',
  'Direct': '#22C55E',
  'Other': '#6B7280'
} as const

export const getChartColor = (index: number): string => {
  return CHART_COLORS[index % CHART_COLORS.length]
}

export const getPlatformColor = (platform: string, index: number = 0): string => {
  // Check if we have a specific color for this platform
  if (PLATFORM_COLORS[platform]) {
    return PLATFORM_COLORS[platform]
  }
  // Otherwise use the standard chart colors
  return CHART_COLORS[index % CHART_COLORS.length]
}

export const getOccupancyColor = (rate: number): string => {
  if (rate >= 0.8) return 'text-green-600'
  if (rate >= 0.6) return 'text-yellow-600'
  return 'text-red-600'
}

export const getOccupancyBgColor = (rate: number): string => {
  if (rate >= 0.8) return 'bg-green-600'
  if (rate >= 0.6) return 'bg-yellow-600'
  return 'bg-red-600'
}
