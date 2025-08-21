// Tax-related constants and utilities
// These are configurable defaults that can be overridden per tenant

export interface PlatformRemittanceConfig {
  platform: string
  remitsOccupancyTax: boolean
  remitsOnGuestFees: boolean
  notes?: string
}

// Default fee structures (can be overridden)
export const DEFAULT_PLATFORM_FEES = {
  airbnb: {
    guestServiceFee: { min: 0.12, max: 0.16, typical: 0.14 },
    hostServiceFee: { min: 0.03, max: 0.03, typical: 0.03 }
  },
  vrbo: {
    guestServiceFee: { min: 0.08, max: 0.12, typical: 0.10 },
    hostServiceFee: { min: 0.05, max: 0.08, typical: 0.05 }
  },
  'booking.com': {
    guestServiceFee: { min: 0, max: 0, typical: 0 },
    hostServiceFee: { min: 0.15, max: 0.15, typical: 0.15 }
  }
}

// Tax jurisdiction types - works globally
export const TAX_JURISDICTION_TYPES = {
  // Primary level (country/state/province)
  NATIONAL: 'national',
  FEDERAL: 'federal',
  STATE: 'state',
  PROVINCIAL: 'provincial',
  
  // Secondary level (regional)
  REGIONAL: 'regional',
  COUNTY: 'county',
  PREFECTURE: 'prefecture',
  CANTON: 'canton',
  
  // Local level
  CITY: 'city',
  MUNICIPAL: 'municipal',
  LOCAL: 'local',
  
  // Special taxes
  DISTRICT: 'district',
  TOURISM: 'tourism',
  VAT: 'vat',
  GST: 'gst',
  SPECIAL: 'special'
} as const

// Common tax name patterns for auto-detection - international
export const TAX_NAME_PATTERNS = [
  // National/Federal level
  { pattern: /\b(national|federal|country)\s+tax/i, type: TAX_JURISDICTION_TYPES.NATIONAL },
  { pattern: /\bVAT\b/i, type: TAX_JURISDICTION_TYPES.VAT },
  { pattern: /\bGST\b/i, type: TAX_JURISDICTION_TYPES.GST },
  
  // State/Provincial level - check for state abbreviations or "state" keyword
  { pattern: /^[A-Z]{2}\s+tax/i, type: TAX_JURISDICTION_TYPES.STATE }, // Matches "WI Tax", "CA Tax", etc.
  { pattern: /\b(state|provincial|province)\s+tax/i, type: TAX_JURISDICTION_TYPES.STATE },
  
  // Regional/County level - check for "county" or regional indicators
  { pattern: /county/i, type: TAX_JURISDICTION_TYPES.COUNTY },
  { pattern: /\b(regional|region|prefecture|canton)\s+tax/i, type: TAX_JURISDICTION_TYPES.REGIONAL },
  
  // Local level
  { pattern: /\b(city|municipal|local|town)\s+tax/i, type: TAX_JURISDICTION_TYPES.CITY },
  
  // Tourism/Special - check for tourism-related keywords or zone abbreviations
  { pattern: /\b[A-Z]{3,5}\s+tax/i, type: TAX_JURISDICTION_TYPES.TOURISM }, // Matches "DCTZ Tax", "NOLA Tax", etc.
  { pattern: /tourism|tourist|visitor|resort/i, type: TAX_JURISDICTION_TYPES.TOURISM },
  { pattern: /zone|TZ\b/i, type: TAX_JURISDICTION_TYPES.DISTRICT },
  { pattern: /\b(occupancy|lodging|accommodation|hotel)\s+(tax|fee)/i, type: TAX_JURISDICTION_TYPES.TOURISM },
  { pattern: /\b(district|special)\s+tax/i, type: TAX_JURISDICTION_TYPES.DISTRICT }
]