export const OWNERREZ_API = {
  BASE_URL: 'https://api.ownerrez.com/v2',
  ENDPOINTS: {
    PROPERTIES: '/properties',
    BOOKINGS: '/bookings',
    GUESTS: '/guests',
  },
} as const;

export const BOOKING_STATUS = {
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  PENDING: 'pending',
} as const;
