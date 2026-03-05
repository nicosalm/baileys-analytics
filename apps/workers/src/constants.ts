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

/** Milliseconds in one day — used to convert inclusive date boundaries to exclusive ones. */
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

// platform service fee rates charged to the guest by the OTA (estimates pending OR API exposure)
const PLATFORM_GUEST_FEE_RATES: Record<string, number> = {
  vrbo: 0.13,
  airbnb: 0.15,
};

/**
 * Estimate the guest-facing OTA service fee for a booking.
 * Returns 0 for direct bookings; uses known platform rates otherwise.
 */
export function estimateGuestListingSiteFee(platform: string | null | undefined, totalAmount: number): number {
  if (!platform || !totalAmount) return 0;
  const key = platform.toLowerCase().replace(/[^a-z]/g, '');
  for (const [name, rate] of Object.entries(PLATFORM_GUEST_FEE_RATES)) {
    if (key.includes(name)) return Math.round(totalAmount * rate * 100) / 100;
  }
  return 0;
}
