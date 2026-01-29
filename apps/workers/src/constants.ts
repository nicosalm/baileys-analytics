export const OWNERREZ_API = {
  BASE_URL: 'https://api.ownerrez.com/v2',
  ENDPOINTS: {
    PROPERTIES: '/properties',
    BOOKINGS: '/bookings',
    GUESTS: '/guests',
  },
} as const;

/**
 * Supabase PostgREST silently truncates results at 1000 rows by default.
 * Use this limit on queries that need all matching rows for accurate calculations.
 */
export const SUPABASE_MAX_ROWS = 10000;

export const BOOKING_STATUS = {
  CONFIRMED: 'confirmed',
  CANCELED: 'canceled',
  PENDING: 'pending',
} as const;

/**
 * Normalize booking status from OwnerRez API.
 * OwnerRez may send 'cancelled' (British) which must be normalized
 * to 'canceled' (American) to match our database convention.
 */
export function normalizeBookingStatus(status: string | undefined | null): string {
  if (!status) return 'pending';
  const lower = status.toLowerCase().trim();
  if (lower === 'cancelled') return 'canceled';
  return lower;
}
