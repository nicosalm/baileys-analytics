// Constants for Baileys Analytics

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const API_VERSION = 'v1';

export const OWNERREZ_API = {
  BASE_URL: 'https://api.ownerrez.com/v2',
  ENDPOINTS: {
    PROPERTIES: '/properties',
    BOOKINGS: '/bookings',
    GUESTS: '/guests',
  },
} as const;

export const TAX_TYPES = {
  STATE: 'state',
  COUNTY: 'county',
  CITY: 'city',
  TOURISM: 'tourism',
  OCCUPANCY: 'occupancy',
} as const;

export const BOOKING_STATUS = {
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  PENDING: 'pending',
} as const;

export * from './tax'
export * from './tiers'
