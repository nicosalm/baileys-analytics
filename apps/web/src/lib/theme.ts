const CHART_SERIES_VARS = [
  '--chart-series-1',
  '--chart-series-2',
  '--chart-series-3',
  '--chart-series-4',
  '--chart-series-5',
  '--chart-series-6',
  '--chart-series-7',
  '--chart-series-8',
  '--chart-series-9',
  '--chart-series-10',
] as const

export const STATUS_STYLES = {
  confirmed: {
    bg: 'bg-success-subtle',
    text: 'text-success-fg',
  },
  cancelled: {
    bg: 'bg-danger-subtle',
    text: 'text-danger-fg',
  },
  canceled: {
    bg: 'bg-danger-subtle',
    text: 'text-danger-fg',
  },
  pending: {
    bg: 'bg-warning-subtle',
    text: 'text-warning-fg',
  },
  default: {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
  },
} as const

// reads a CSS custom property value at render time — safe to call inside components
export const resolveToken = (varName: string): string => getComputedStyle(document.documentElement).getPropertyValue(varName).trim()

// metric series colors for recharts props and legend swatches
// each getter reads the CSS variable at render time so they stay in sync with index.css
export const METRIC_COLORS = {
  get revenue() {
    return resolveToken('--metric-revenue')
  },
  get occupancy() {
    return resolveToken('--metric-occupancy')
  },
  get bookings() {
    return resolveToken('--metric-bookings')
  },
  get tax() {
    return resolveToken('--metric-tax')
  },
  get expenses() {
    return resolveToken('--metric-expenses')
  },
  get profit() {
    return resolveToken('--metric-profit')
  },
}

// chart infrastructure colors for recharts stroke/fill props
export const CHART_INFRA = {
  get grid() {
    return resolveToken('--border')
  },
  get axis() {
    return resolveToken('--muted-foreground')
  },
  get reference() {
    return resolveToken('--chart-reference')
  },
  get goal() {
    return resolveToken('--chart-goal')
  },
  get comparison() {
    return resolveToken('--chart-comparison')
  },
}

export const PLATFORM_COLORS: Record<string, string> = {
  airbnb: '#FF5A5F',
  vrbo: '#0061A7',
  'booking.com': '#003580',
  'google vacation rentals': '#4285F4',
  hopper: '#8B5CF6',
  hometogo: '#F97316',
  direct: '#22C55E',
  other: '#6B7280',
} as const

export const getChartColor = (index: number): string => resolveToken(CHART_SERIES_VARS[index % CHART_SERIES_VARS.length])

export const getPlatformColor = (platform: string, index: number = 0): string => {
  const lowerPlatform = platform.toLowerCase()
  if (PLATFORM_COLORS[lowerPlatform]) {
    return PLATFORM_COLORS[lowerPlatform]
  }
  return getChartColor(index)
}

export const getTagColor = (tag: { color?: string; id?: string; name?: string }): string => {
  if (tag.color) return tag.color
  const key = tag.id || tag.name || ''
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0
  }
  return getChartColor(Math.abs(hash) % CHART_SERIES_VARS.length)
}

export const getOccupancyColor = (rate: number): string => {
  if (rate >= 0.8) return 'text-success'
  if (rate >= 0.6) return 'text-warning'
  return 'text-danger'
}
