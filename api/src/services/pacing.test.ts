import { describe, it, expect } from 'vitest';
import { computeOverlapNights } from '../utils/prorate';
import { MS_PER_DAY } from '../constants';

// Door County Stay bookings inside the Apr 25–Nov 3 season window.
const BOOKINGS: Array<{ arrival: string; departure: string }> = [
	{ arrival: '2026-04-22', departure: '2026-04-25' },
	{ arrival: '2026-05-14', departure: '2026-05-18' },
	{ arrival: '2026-07-03', departure: '2026-07-10' },
	{ arrival: '2026-07-10', departure: '2026-07-17' },
	{ arrival: '2026-07-17', departure: '2026-07-24' },
	{ arrival: '2026-07-17', departure: '2026-07-24' },
	{ arrival: '2026-07-24', departure: '2026-07-31' },
	{ arrival: '2026-07-24', departure: '2026-07-31' },
	{ arrival: '2026-07-25', departure: '2026-08-01' },
	{ arrival: '2026-07-31', departure: '2026-08-07' },
	{ arrival: '2026-08-02', departure: '2026-08-09' },
	{ arrival: '2026-08-07', departure: '2026-08-14' },
	{ arrival: '2026-08-14', departure: '2026-08-21' },
	{ arrival: '2026-08-21', departure: '2026-08-23' },
	{ arrival: '2026-08-21', departure: '2026-08-23' },
	{ arrival: '2026-08-21', departure: '2026-08-23' },
	{ arrival: '2026-09-03', departure: '2026-09-05' },
];

describe('pacing JS math simulation for Door County Stay season Apr 25 – Nov 3', () => {
	it('sums to 89, matching the Occupancy RPC', () => {
		// UTC-constructed month boundaries match pacing.ts after the timezone fix
		const months = [
			[new Date(Date.UTC(2026, 3, 1)), new Date(Date.UTC(2026, 4, 1))], // Apr
			[new Date(Date.UTC(2026, 4, 1)), new Date(Date.UTC(2026, 5, 1))], // May
			[new Date(Date.UTC(2026, 5, 1)), new Date(Date.UTC(2026, 6, 1))], // Jun
			[new Date(Date.UTC(2026, 6, 1)), new Date(Date.UTC(2026, 7, 1))], // Jul
			[new Date(Date.UTC(2026, 7, 1)), new Date(Date.UTC(2026, 8, 1))], // Aug
			[new Date(Date.UTC(2026, 8, 1)), new Date(Date.UTC(2026, 9, 1))], // Sep
			[new Date(Date.UTC(2026, 9, 1)), new Date(Date.UTC(2026, 10, 1))], // Oct
			[new Date(Date.UTC(2026, 10, 1)), new Date(Date.UTC(2026, 11, 1))], // Nov
		];
		const windowStart = new Date(Date.UTC(2026, 3, 25));
		const windowEndExclusive = new Date(Date.UTC(2026, 10, 4));

		let total = 0;
		for (const [monthStart, nextMonthStart] of months) {
			const effMonthStart = windowStart > monthStart ? windowStart : monthStart;
			const effNextMonthStart = windowEndExclusive < nextMonthStart ? windowEndExclusive : nextMonthStart;
			const effDays = Math.max(0, Math.floor((effNextMonthStart.getTime() - effMonthStart.getTime()) / MS_PER_DAY));
			if (effDays === 0) continue;

			for (const b of BOOKINGS) {
				const arr = new Date(b.arrival);
				const dep = new Date(b.departure);
				if (arr < effNextMonthStart && dep > effMonthStart) {
					total += computeOverlapNights(arr, dep, effMonthStart, effNextMonthStart);
				}
			}
		}
		expect(total).toBe(89);
	});
});
