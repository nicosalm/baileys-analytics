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

// guest-facing OTA service fee estimates (what the OTA charges the guest on top of listing price)
// host-side fees are tracked separately in host_service_fee (real data from OR API)
//
// airbnb split-fee (pre oct 27 2025): 14.2% guest fee on top of listing price
// airbnb host-only (post oct 27 2025): 0% guest fee (host absorbs 15.5%, baked into price)
// vrbo: 6-15% sliding scale on top of listing price. ~8% for typical $1.5-5k bookings
// booking.com: 0% guest fee (host pays ~15% commission, baked into price)
// tripadvisor: shut down direct bookings nov 2024
//
// "direct booking savings" = guest_listing_site_fee + host_service_fee + cc fees
// this is computed in the UI, not here — this function only estimates the guest portion
const AIRBNB_SPLIT_FEE_CUTOFF = '2025-10-27';
const AIRBNB_GUEST_FEE_RATE = 0.142;
const VRBO_GUEST_FEE_RATE = 0.08;

/**
 * Estimate the guest-facing OTA service fee for a booking.
 * This is ONLY the fee the OTA charges the guest on top of the listing price.
 * Host-side fees (commission, payment processing) are stored separately in host_service_fee.
 *
 * Airbnb pre-Oct 2025: ~14.2% guest service fee
 * Airbnb post-Oct 2025: 0% (host-only model, no guest fee)
 * Vrbo: ~8% traveler service fee
 * Booking.com: 0% (no guest fee)
 */
export function estimateGuestListingSiteFee(platform: string | null | undefined, totalAmount: number, bookedDate?: string | null): number {
	if (!platform || !totalAmount) return 0;
	const key = platform.toLowerCase().replace(/[^a-z]/g, '');

	if (key.includes('airbnb')) {
		// post oct 27 2025: host-only model, guest pays no separate fee
		if (bookedDate && bookedDate >= AIRBNB_SPLIT_FEE_CUTOFF) return 0;
		return totalAmount * AIRBNB_GUEST_FEE_RATE;
	}

	if (key.includes('vrbo')) {
		return totalAmount * VRBO_GUEST_FEE_RATE;
	}

	// booking.com, direct, etc. — no guest fee
	return 0;
}
