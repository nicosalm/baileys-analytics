import { describe, it, expect } from 'vitest';
import {
	collectBlockedNights,
	collectBlockedNightsExclusive,
	sumBlockedNights,
	TranslatedBlock,
} from './blocks';

const prop = (id: string) => id; // readable alias

describe('collectBlockedNights', () => {
	it('counts a block fully inside the window', () => {
		const blocks: TranslatedBlock[] = [
			{ property_id: prop('p1'), arrival: '2026-02-10', departure: '2026-02-13' },
		];
		const m = collectBlockedNights(blocks, '2026-02-01', '2026-02-28');
		expect(m.get('p1')).toBe(3);
	});

	it('clips a block that extends past the window end', () => {
		const blocks: TranslatedBlock[] = [
			{ property_id: prop('p1'), arrival: '2026-02-25', departure: '2026-03-05' },
		];
		const m = collectBlockedNights(blocks, '2026-02-01', '2026-02-28');
		// Feb 25, 26, 27, 28 = 4 nights (Feb 28 inclusive)
		expect(m.get('p1')).toBe(4);
	});

	it('clips a block that starts before the window', () => {
		const blocks: TranslatedBlock[] = [
			{ property_id: prop('p1'), arrival: '2026-01-29', departure: '2026-02-03' },
		];
		const m = collectBlockedNights(blocks, '2026-02-01', '2026-02-28');
		// Feb 1, 2 = 2 nights (departure Feb 3 is exclusive)
		expect(m.get('p1')).toBe(2);
	});

	it('drops blocks that do not overlap the window', () => {
		const blocks: TranslatedBlock[] = [
			{ property_id: prop('p1'), arrival: '2026-03-01', departure: '2026-03-05' },
		];
		const m = collectBlockedNights(blocks, '2026-02-01', '2026-02-28');
		expect(m.get('p1')).toBeUndefined();
	});

	it('sums blocks for the same property', () => {
		const blocks: TranslatedBlock[] = [
			{ property_id: prop('p1'), arrival: '2026-02-05', departure: '2026-02-08' },
			{ property_id: prop('p1'), arrival: '2026-02-20', departure: '2026-02-22' },
		];
		const m = collectBlockedNights(blocks, '2026-02-01', '2026-02-28');
		expect(m.get('p1')).toBe(5);
	});

	it('keys separately per property', () => {
		const blocks: TranslatedBlock[] = [
			{ property_id: prop('p1'), arrival: '2026-02-05', departure: '2026-02-08' },
			{ property_id: prop('p2'), arrival: '2026-02-05', departure: '2026-02-10' },
		];
		const m = collectBlockedNights(blocks, '2026-02-01', '2026-02-28');
		expect(m.get('p1')).toBe(3);
		expect(m.get('p2')).toBe(5);
	});

	it('departure exactly on window start → zero overlap', () => {
		const blocks: TranslatedBlock[] = [
			{ property_id: prop('p1'), arrival: '2026-01-25', departure: '2026-02-01' },
		];
		const m = collectBlockedNights(blocks, '2026-02-01', '2026-02-28');
		expect(m.get('p1')).toBeUndefined();
	});

	it('arrival exactly on window end (inclusive) → one night', () => {
		const blocks: TranslatedBlock[] = [
			{ property_id: prop('p1'), arrival: '2026-02-28', departure: '2026-03-02' },
		];
		const m = collectBlockedNights(blocks, '2026-02-01', '2026-02-28');
		// Feb 28 is inclusive → 1 night falls in the window
		expect(m.get('p1')).toBe(1);
	});
});

describe('collectBlockedNightsExclusive', () => {
	it('matches pacing.ts semantics: [monthStart, nextMonthStart)', () => {
		const blocks: TranslatedBlock[] = [
			{ property_id: prop('p1'), arrival: '2026-02-25', departure: '2026-03-05' },
		];
		const m = collectBlockedNightsExclusive(
			blocks,
			new Date(Date.UTC(2026, 1, 1)), // Feb 1
			new Date(Date.UTC(2026, 2, 1)), // Mar 1 (exclusive)
		);
		// Feb 25, 26, 27, 28 = 4 nights
		expect(m.get('p1')).toBe(4);
	});
});

describe('sumBlockedNights', () => {
	it('sums across properties', () => {
		const m = new Map<string, number>([
			['p1', 3],
			['p2', 5],
			['p3', 0],
		]);
		expect(sumBlockedNights(m)).toBe(8);
	});

	it('empty map returns 0', () => {
		expect(sumBlockedNights(new Map())).toBe(0);
	});
});
