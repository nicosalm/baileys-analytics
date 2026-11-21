const CHART_SERIES_VARS = [
  '--chart-series-1',
  '--chart-series-2',
  '--chart-series-3',
  '--chart-series-4',
  '--chart-series-5',
  '--chart-series-6',
  '--chart-series-7',
  '--chart-series-8',
] as const

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

// each platform owns a fixed categorical slot so it reads the same in every chart
const PLATFORM_SLOTS: Record<string, number> = {
  vrbo: 0,
  airbnb: 1,
  tripadvisor: 2,
  'google vacation rentals': 3,
  'booking.com': 4,
  direct: 5,
  hometogo: 6,
  hopper: 7,
}

// slots past the palette repeat the last hue rather than cycling back to slot 1
export const getChartColor = (index: number): string => resolveToken(CHART_SERIES_VARS[Math.min(index, CHART_SERIES_VARS.length - 1)])

export const getPlatformColor = (platform: string, index: number = 0): string => {
  const slot = PLATFORM_SLOTS[platform.toLowerCase()]
  if (slot !== undefined) return getChartColor(slot)
  if (platform.toLowerCase() === 'other') return resolveToken('--chart-comparison')
  return getChartColor(index)
}

const CHARGE_SLOTS = {
  rent: 0,
  host_fee: 1,
  tax: 2,
  credit_card: 3,
  cleaning: 4,
  discount: 5,
  pet: 6,
  guest_fee: 7,
} as const

export type ChargeKind = keyof typeof CHARGE_SLOTS | 'other'

// one color per charge category, shared by every chart and list that breaks charges down
export const getChargeColor = (kind: ChargeKind): string =>
  kind === 'other' ? resolveToken('--chart-comparison') : getChartColor(CHARGE_SLOTS[kind])

export const getTagColor = (tag: { color?: string; id?: string; name?: string }): string => {
  if (tag.color) return tag.color
  const key = tag.id || tag.name || ''
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0
  }
  return getChartColor(Math.abs(hash) % CHART_SERIES_VARS.length)
}

// bar marks: capped thickness, 4px rounded data end, 2px surface gap between stacked segments
export const BAR_SPEC = {
  maxBarSize: 24,
  radiusUp: [4, 4, 0, 0] as [number, number, number, number],
  radiusRight: [0, 4, 4, 0] as [number, number, number, number],
  gap: 2,
}
