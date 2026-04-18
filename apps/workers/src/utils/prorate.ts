import { MS_PER_DAY } from '../constants';

// Count the nights a booking occupies within an exclusive [start, end) window.
// Used by time-bucketed aggregations where each bucket has an exclusive end
// (e.g. `nextMonthStart`) rather than an inclusive date.
export function computeOverlapNights(
	arrival: Date,
	departure: Date,
	windowStart: Date,
	windowEndExclusive: Date,
): number {
	const start = arrival > windowStart ? arrival : windowStart;
	const end = departure < windowEndExclusive ? departure : windowEndExclusive;
	return Math.max(0, Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY));
}

// Proration for bookings that span selected date ranges.
// A booking with arrival 2025-12-01, departure 2026-02-27 (88 nights),
// total_amount $11,690.84 contributes $929.95 to the week of 2026-02-01,
// not the full $11,690.84. Without proration every weekly/monthly chart
// and every ADR inflates by the overlap/totalNights ratio.
//
// The pattern originated in services/pacing.ts and is now centralized here.

export interface BookingForProration {
	arrival: string;
	departure: string;
	total_amount?: number | null;
	host_service_fee?: number | null;
	guest_listing_site_fee?: number | null;
}

export interface ProratedBooking {
	overlapNights: number;
	totalNights: number;
	ratio: number;
	revenue: number;
	hostFee: number;
	guestFee: number;
}

function toUtcDate(s: string): Date {
	// bookings store arrival/departure as YYYY-MM-DD; parse as UTC midnight
	// so subtraction is stable across timezones
	return new Date(s.length === 10 ? `${s}T00:00:00Z` : s);
}

function startOfDayUtc(d: Date): Date {
	const x = new Date(d);
	x.setUTCHours(0, 0, 0, 0);
	return x;
}

export function prorateBooking(
	b: BookingForProration,
	periodStart: Date | string,
	periodEndInclusive: Date | string,
): ProratedBooking {
	const arr = toUtcDate(b.arrival);
	const dep = toUtcDate(b.departure);
	const ps = startOfDayUtc(typeof periodStart === 'string' ? toUtcDate(periodStart) : periodStart);
	const pe = startOfDayUtc(typeof periodEndInclusive === 'string' ? toUtcDate(periodEndInclusive) : periodEndInclusive);

	const totalNights = Math.max(1, Math.floor((dep.getTime() - arr.getTime()) / MS_PER_DAY));
	const clipStart = Math.max(arr.getTime(), ps.getTime());
	const clipEndExclusive = Math.min(dep.getTime(), pe.getTime() + MS_PER_DAY);
	const overlapNights = Math.max(0, Math.floor((clipEndExclusive - clipStart) / MS_PER_DAY));
	const ratio = overlapNights / totalNights;

	return {
		overlapNights,
		totalNights,
		ratio,
		revenue: (b.total_amount || 0) * ratio,
		hostFee: (b.host_service_fee || 0) * ratio,
		guestFee: (b.guest_listing_site_fee || 0) * ratio,
	};
}

// Proportionally allocate a booking_charge (e.g. fee) to a period
// using the same ratio we applied to its parent booking's revenue.
export function prorateCharges<T extends { booking_id: string; amount: number | string }>(
	charges: T[],
	ratioByBookingId: Map<string, number>,
): number {
	let sum = 0;
	for (const c of charges) {
		const r = ratioByBookingId.get(c.booking_id) ?? 0;
		const amt = typeof c.amount === 'string' ? parseFloat(c.amount) : c.amount;
		sum += (amt || 0) * r;
	}
	return sum;
}

// Tax liability attaches to the taxable event (arrival of the guest) in most
// US/CA jurisdictions, not the service period. Use this for anything that
// represents tax collected/remitted so reports match what hosts owe their
// city/state. Revenue, ADR, and occupancy still prorate by service period.
export function isArrivalInPeriod(
	b: { arrival: string },
	periodStart: Date | string,
	periodEndInclusive: Date | string,
): boolean {
	const arr = toUtcDate(b.arrival).getTime();
	const ps = startOfDayUtc(typeof periodStart === 'string' ? toUtcDate(periodStart) : periodStart).getTime();
	const pe = startOfDayUtc(typeof periodEndInclusive === 'string' ? toUtcDate(periodEndInclusive) : periodEndInclusive).getTime();
	return arr >= ps && arr <= pe + MS_PER_DAY - 1;
}

// Build a lookup of which bookings had their arrival within the period window.
// Pairs with the per-charge summation loops in tax aggregations.
export function arrivalInPeriodMap(
	bookings: Array<{ id: string; arrival: string }>,
	periodStart: Date | string,
	periodEndInclusive: Date | string,
): Map<string, boolean> {
	const m = new Map<string, boolean>();
	for (const b of bookings) m.set(b.id, isArrivalInPeriod(b, periodStart, periodEndInclusive));
	return m;
}

// Sum tax/fee-style charges at full amount, but only for bookings whose arrival
// fell inside the period. Mirrors the shape of prorateCharges.
export function sumChargesForArrivalsInPeriod<T extends { booking_id: string; amount: number | string }>(
	charges: T[],
	arrivalInPeriodByBookingId: Map<string, boolean>,
): number {
	let sum = 0;
	for (const c of charges) {
		if (!arrivalInPeriodByBookingId.get(c.booking_id)) continue;
		const amt = typeof c.amount === 'string' ? parseFloat(c.amount) : c.amount;
		sum += amt || 0;
	}
	return sum;
}

export type Granularity = 'day' | 'week' | 'month';

export interface BucketedOverlap {
	key: string;
	label: string;
	nights: number;
	revenue: number;
	hostFee: number;
	guestFee: number;
}

// Week starts Sunday (matches existing overview.ts/financial.ts behavior).
function weekStartUtc(d: Date): Date {
	const x = startOfDayUtc(d);
	x.setUTCDate(x.getUTCDate() - x.getUTCDay());
	return x;
}

function bucketKeyAndLabel(day: Date, g: Granularity): { key: string; label: string } {
	if (g === 'day') {
		const key = day.toISOString().split('T')[0];
		const label = day.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
		return { key, label };
	}
	if (g === 'week') {
		const w = weekStartUtc(day);
		const key = w.toISOString().split('T')[0];
		const label = `Week of ${w.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })} (Sun–Sat)`;
		return { key, label };
	}
	const y = day.getUTCFullYear();
	const m = String(day.getUTCMonth() + 1).padStart(2, '0');
	const key = `${y}-${m}`;
	const label = day.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', year: 'numeric' });
	return { key, label };
}

// Count the number of days in [month, nextMonth) that also fall inside the
// selected period [periodStart, periodEndInclusive]. Use this as the denominator
// for monthly occupancy charts so partial edge months don't dilute the ratio.
export function effectiveDaysInMonth(
	year: number,
	month: number, // 0-indexed
	periodStart: Date | string,
	periodEndInclusive: Date | string,
): number {
	const monthStart = new Date(Date.UTC(year, month, 1));
	const nextMonthStart = new Date(Date.UTC(year, month + 1, 1));
	const ps = startOfDayUtc(typeof periodStart === 'string' ? toUtcDate(periodStart) : periodStart);
	const peExclusive = new Date(startOfDayUtc(typeof periodEndInclusive === 'string' ? toUtcDate(periodEndInclusive) : periodEndInclusive).getTime() + MS_PER_DAY);
	const effStart = Math.max(monthStart.getTime(), ps.getTime());
	const effEnd = Math.min(nextMonthStart.getTime(), peExclusive.getTime());
	return Math.max(0, Math.floor((effEnd - effStart) / MS_PER_DAY));
}

// Resolve a single date to its bucket key at the given granularity.
// Used when attributing one-shot events (e.g. a booking's tax charge) to the
// bucket that contains the event date, without splitting across buckets.
export function bucketKeyForDate(date: Date | string, granularity: Granularity): string {
	const d = startOfDayUtc(typeof date === 'string' ? toUtcDate(date) : date);
	return bucketKeyAndLabel(d, granularity).key;
}

// Emit the portion of a booking that falls inside [periodStart, periodEndInclusive],
// split across day/week/month buckets. Per-bucket revenue = nightly rate × bucketNights,
// so a booking spanning 3 weeks contributes to all 3 weekly bars proportionally.
export function bucketBooking(
	b: BookingForProration,
	periodStart: Date | string,
	periodEndInclusive: Date | string,
	granularity: Granularity,
): BucketedOverlap[] {
	const arr = toUtcDate(b.arrival);
	const dep = toUtcDate(b.departure);
	const ps = startOfDayUtc(typeof periodStart === 'string' ? toUtcDate(periodStart) : periodStart);
	const pe = startOfDayUtc(typeof periodEndInclusive === 'string' ? toUtcDate(periodEndInclusive) : periodEndInclusive);

	const totalNights = Math.max(1, Math.floor((dep.getTime() - arr.getTime()) / MS_PER_DAY));
	const clipStartMs = Math.max(arr.getTime(), ps.getTime());
	const clipEndExclusiveMs = Math.min(dep.getTime(), pe.getTime() + MS_PER_DAY);
	if (clipEndExclusiveMs <= clipStartMs) return [];

	const nightlyRevenue = (b.total_amount || 0) / totalNights;
	const nightlyHostFee = (b.host_service_fee || 0) / totalNights;
	const nightlyGuestFee = (b.guest_listing_site_fee || 0) / totalNights;

	const buckets = new Map<string, BucketedOverlap>();
	for (let t = clipStartMs; t < clipEndExclusiveMs; t += MS_PER_DAY) {
		const day = new Date(t);
		const { key, label } = bucketKeyAndLabel(day, granularity);
		const existing = buckets.get(key);
		if (existing) {
			existing.nights += 1;
			existing.revenue += nightlyRevenue;
			existing.hostFee += nightlyHostFee;
			existing.guestFee += nightlyGuestFee;
		} else {
			buckets.set(key, {
				key,
				label,
				nights: 1,
				revenue: nightlyRevenue,
				hostFee: nightlyHostFee,
				guestFee: nightlyGuestFee,
			});
		}
	}
	return Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key));
}

// Walk the period at the given granularity and return every bucket key+label,
// so charts can render zeros for empty buckets without scanning bookings.
export function enumerateBuckets(
	periodStart: Date | string,
	periodEndInclusive: Date | string,
	granularity: Granularity,
): Array<{ key: string; label: string }> {
	const ps = startOfDayUtc(typeof periodStart === 'string' ? toUtcDate(periodStart) : periodStart);
	const pe = startOfDayUtc(typeof periodEndInclusive === 'string' ? toUtcDate(periodEndInclusive) : periodEndInclusive);

	const out: Array<{ key: string; label: string }> = [];
	const seen = new Set<string>();

	if (granularity === 'day') {
		for (let t = ps.getTime(); t <= pe.getTime(); t += MS_PER_DAY) {
			const d = new Date(t);
			const { key, label } = bucketKeyAndLabel(d, 'day');
			out.push({ key, label });
		}
		return out;
	}

	if (granularity === 'week') {
		let cur = weekStartUtc(ps);
		while (cur.getTime() <= pe.getTime()) {
			const { key, label } = bucketKeyAndLabel(cur, 'week');
			if (!seen.has(key)) {
				seen.add(key);
				out.push({ key, label });
			}
			cur = new Date(cur.getTime() + 7 * MS_PER_DAY);
		}
		return out;
	}

	// month
	const start = new Date(Date.UTC(ps.getUTCFullYear(), ps.getUTCMonth(), 1));
	const end = new Date(Date.UTC(pe.getUTCFullYear(), pe.getUTCMonth(), 1));
	let cur = start;
	while (cur.getTime() <= end.getTime()) {
		const { key, label } = bucketKeyAndLabel(cur, 'month');
		out.push({ key, label });
		cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
	}
	return out;
}
