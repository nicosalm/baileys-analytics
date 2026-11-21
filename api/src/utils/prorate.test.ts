import { describe, it, expect } from 'vitest';
import {
	prorateBooking,
	bucketBooking,
	enumerateBuckets,
	prorateCharges,
	isArrivalInPeriod,
	sumChargesForArrivalsInPeriod,
	effectiveDaysInMonth,
} from './prorate';

describe('prorateBooking', () => {
	it('Bill Masella Sanctuary II case: 88-night booking, Week of Feb 1 → $929.95, 7 nights', () => {
		const r = prorateBooking({ arrival: '2025-12-01', departure: '2026-02-27', total_amount: 11690.84 }, '2026-02-01', '2026-02-07');
		expect(r.totalNights).toBe(88);
		expect(r.overlapNights).toBe(7);
		expect(r.revenue).toBeCloseTo(929.95, 2);
		expect(r.ratio).toBeCloseTo(7 / 88, 6);
	});

	it('booking fully inside period → ratio 1', () => {
		const r = prorateBooking({ arrival: '2026-02-10', departure: '2026-02-13', total_amount: 900 }, '2026-02-01', '2026-02-28');
		expect(r.ratio).toBe(1);
		expect(r.overlapNights).toBe(3);
		expect(r.revenue).toBe(900);
	});

	it('booking fully spans period → overlap = period length', () => {
		const r = prorateBooking({ arrival: '2026-01-01', departure: '2026-12-31', total_amount: 36500 }, '2026-02-01', '2026-02-28');
		expect(r.overlapNights).toBe(28);
		expect(r.totalNights).toBe(364);
		expect(r.revenue).toBeCloseTo((36500 * 28) / 364, 4);
	});

	it('arrival == period end → zero overlap', () => {
		const r = prorateBooking({ arrival: '2026-02-28', departure: '2026-03-02', total_amount: 200 }, '2026-02-01', '2026-02-27');
		expect(r.overlapNights).toBe(0);
		expect(r.revenue).toBe(0);
	});

	it('departure == period start → zero overlap', () => {
		const r = prorateBooking({ arrival: '2026-01-28', departure: '2026-02-01', total_amount: 400 }, '2026-02-01', '2026-02-28');
		expect(r.overlapNights).toBe(0);
		expect(r.revenue).toBe(0);
	});

	it('partial overlap at start', () => {
		const r = prorateBooking({ arrival: '2026-01-29', departure: '2026-02-05', total_amount: 700 }, '2026-02-01', '2026-02-28');
		expect(r.totalNights).toBe(7);
		expect(r.overlapNights).toBe(4);
		expect(r.revenue).toBeCloseTo(400, 4);
	});

	it('partial overlap at end', () => {
		const r = prorateBooking({ arrival: '2026-02-27', departure: '2026-03-05', total_amount: 700 }, '2026-02-01', '2026-02-28');
		expect(r.totalNights).toBe(6);
		expect(r.overlapNights).toBe(2);
		expect(r.revenue).toBeCloseTo((700 * 2) / 6, 4);
	});

	it('prorates host and guest fees with same ratio', () => {
		const r = prorateBooking(
			{
				arrival: '2025-12-01',
				departure: '2026-02-27',
				total_amount: 11690.84,
				host_service_fee: 575.04,
				guest_listing_site_fee: 1000,
			},
			'2026-02-01',
			'2026-02-07',
		);
		expect(r.hostFee).toBeCloseTo((575.04 * 7) / 88, 4);
		expect(r.guestFee).toBeCloseTo((1000 * 7) / 88, 4);
	});

	it('single-night booking inside single-day period', () => {
		const r = prorateBooking({ arrival: '2026-02-14', departure: '2026-02-15', total_amount: 300 }, '2026-02-14', '2026-02-14');
		expect(r.ratio).toBe(1);
		expect(r.overlapNights).toBe(1);
		expect(r.revenue).toBe(300);
	});
});

describe('bucketBooking', () => {
	it('fully-contained booking: sum of per-bucket revenue equals total', () => {
		const buckets = bucketBooking(
			{ arrival: '2026-02-10', departure: '2026-02-24', total_amount: 1400 },
			'2026-02-01',
			'2026-02-28',
			'week',
		);
		const sum = buckets.reduce((s, b) => s + b.revenue, 0);
		expect(sum).toBeCloseTo(1400, 6);
	});

	it('88-night booking spans multiple weeks — nightly split correct', () => {
		const buckets = bucketBooking(
			{ arrival: '2025-12-01', departure: '2026-02-27', total_amount: 11690.84 },
			'2026-02-01',
			'2026-02-07',
			'week',
		);
		// Feb 1 is Sunday → week of Feb 1 holds all 7 days
		expect(buckets.length).toBe(1);
		expect(buckets[0].nights).toBe(7);
		expect(buckets[0].revenue).toBeCloseTo(929.95, 2);
	});

	it('emits one bucket per day for day granularity', () => {
		const buckets = bucketBooking({ arrival: '2026-02-10', departure: '2026-02-13', total_amount: 300 }, '2026-02-01', '2026-02-28', 'day');
		expect(buckets.length).toBe(3);
		expect(buckets.every((b) => b.revenue === 100)).toBe(true);
	});

	it('month granularity: booking spanning Jan-Feb splits correctly', () => {
		const buckets = bucketBooking(
			{ arrival: '2026-01-28', departure: '2026-02-05', total_amount: 800 },
			'2026-01-01',
			'2026-02-28',
			'month',
		);
		expect(buckets.length).toBe(2);
		const jan = buckets.find((b) => b.key === '2026-01')!;
		const feb = buckets.find((b) => b.key === '2026-02')!;
		// Jan 28, 29, 30, 31 = 4 nights; Feb 1, 2, 3, 4 = 4 nights (departure Feb 5 exclusive)
		expect(jan.nights).toBe(4);
		expect(feb.nights).toBe(4);
		expect(jan.revenue + feb.revenue).toBeCloseTo(800, 4);
	});

	it('zero-overlap booking returns empty array', () => {
		const buckets = bucketBooking(
			{ arrival: '2026-03-01', departure: '2026-03-05', total_amount: 500 },
			'2026-02-01',
			'2026-02-28',
			'week',
		);
		expect(buckets.length).toBe(0);
	});
});

describe('enumerateBuckets', () => {
	it('produces zero-filled week list for a 2-month period', () => {
		const keys = enumerateBuckets('2026-01-01', '2026-02-28', 'week').map((b) => b.key);
		// weeks starting on Sundays within that range
		expect(keys.length).toBeGreaterThanOrEqual(8);
		expect(new Set(keys).size).toBe(keys.length); // unique
	});

	it('month granularity: one entry per month', () => {
		const keys = enumerateBuckets('2026-01-01', '2026-03-31', 'month').map((b) => b.key);
		expect(keys).toEqual(['2026-01', '2026-02', '2026-03']);
	});

	it('day granularity: one entry per day inclusive', () => {
		const keys = enumerateBuckets('2026-02-01', '2026-02-07', 'day');
		expect(keys.length).toBe(7);
	});
});

describe('isArrivalInPeriod (tax attribution)', () => {
	it('arrival inside period → true', () => {
		expect(isArrivalInPeriod({ arrival: '2026-02-10' }, '2026-02-01', '2026-02-28')).toBe(true);
	});
	it('arrival on period start → true', () => {
		expect(isArrivalInPeriod({ arrival: '2026-02-01' }, '2026-02-01', '2026-02-28')).toBe(true);
	});
	it('arrival on period end → true', () => {
		expect(isArrivalInPeriod({ arrival: '2026-02-28' }, '2026-02-01', '2026-02-28')).toBe(true);
	});
	it('arrival before period → false', () => {
		expect(isArrivalInPeriod({ arrival: '2026-01-31' }, '2026-02-01', '2026-02-28')).toBe(false);
	});
	it('arrival after period → false', () => {
		expect(isArrivalInPeriod({ arrival: '2026-03-01' }, '2026-02-01', '2026-02-28')).toBe(false);
	});

	it('Bill Sanctuary II case: 88-night booking arrived Dec 1 → Feb window excludes its tax', () => {
		// If the booking arrived on Dec 1, Feb's tax report must NOT include this
		// booking's tax — it was already owed/remitted in Dec. This is the key
		// semantic difference from revenue proration.
		expect(isArrivalInPeriod({ arrival: '2025-12-01' }, '2026-02-01', '2026-02-07')).toBe(false);
	});
});

describe('sumChargesForArrivalsInPeriod', () => {
	it('counts full amount for in-period arrivals, skips others', () => {
		const arrivalMap = new Map([
			['b1', true],
			['b2', false],
			['b3', true],
		]);
		const total = sumChargesForArrivalsInPeriod(
			[
				{ booking_id: 'b1', amount: 100 },
				{ booking_id: 'b2', amount: 50 },
				{ booking_id: 'b3', amount: '25' },
				{ booking_id: 'b-unknown', amount: 999 },
			],
			arrivalMap,
		);
		expect(total).toBe(125);
	});
});

describe('effectiveDaysInMonth', () => {
	it('fully contained month → full calendar days', () => {
		expect(effectiveDaysInMonth(2026, 1, '2026-01-01', '2026-12-31')).toBe(28);
		expect(effectiveDaysInMonth(2026, 0, '2026-01-01', '2026-12-31')).toBe(31);
	});
	it('partial edge at start (season Apr 25 → Nov 3, Apr)', () => {
		// Apr has 30 days; season covers Apr 25-30 → 6 effective days
		expect(effectiveDaysInMonth(2026, 3, '2026-04-25', '2026-11-03')).toBe(6);
	});
	it('partial edge at end (same season, Nov)', () => {
		// season covers Nov 1-3 → 3 effective days
		expect(effectiveDaysInMonth(2026, 10, '2026-04-25', '2026-11-03')).toBe(3);
	});
	it('middle month in season → full calendar', () => {
		expect(effectiveDaysInMonth(2026, 5, '2026-04-25', '2026-11-03')).toBe(30); // June
		expect(effectiveDaysInMonth(2026, 6, '2026-04-25', '2026-11-03')).toBe(31); // July
	});
	it('month entirely outside period → 0', () => {
		expect(effectiveDaysInMonth(2026, 1, '2026-04-01', '2026-04-30')).toBe(0); // Feb vs Apr-only window
	});
	it('leap February → 29 days when fully contained', () => {
		expect(effectiveDaysInMonth(2024, 1, '2024-01-01', '2024-12-31')).toBe(29);
	});
});

describe('prorateCharges', () => {
	it('applies per-booking ratio to each charge amount', () => {
		const ratios = new Map([
			['b1', 0.5],
			['b2', 1.0],
		]);
		const total = prorateCharges(
			[
				{ booking_id: 'b1', amount: 100 },
				{ booking_id: 'b1', amount: '50' },
				{ booking_id: 'b2', amount: 30 },
				{ booking_id: 'b3', amount: 999 }, // missing from map → ratio 0
			],
			ratios,
		);
		expect(total).toBeCloseTo(0.5 * 100 + 0.5 * 50 + 1.0 * 30, 6);
	});
});
