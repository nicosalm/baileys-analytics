// tenant ids that have access to dctz report feature
export const DCTZ_ENABLED_TENANTS = [
  'df2d602d-0472-4ccc-bcfd-374de378a175',
  '91616123-1ffc-4c54-a4ad-f1670b1ce857'
]

// dctz-specific tax rates
export const DCTZ_RATE = 0.08 // 8% door county tourism zone
export const WI_STATE_RATE = 0.055 // 5.5% wisconsin state
export const COMBINED_RATE = DCTZ_RATE + WI_STATE_RATE // 13.5%

// platforms that remit tax on behalf of hosts
export const PLATFORM_REMITS_TAX: Record<string, boolean> = {
  airbnb: true,
  vrbo: true,
  expedia: true,
  'booking.com': false,
  evolve: true,
  direct: false,
  stripe: false,
  other: false
}
