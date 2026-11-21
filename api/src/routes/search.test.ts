import { describe, it, expect } from 'vitest';
import { sanitizeQuery, groupResults, type SearchRow } from './search';

const row = (overrides: Partial<SearchRow>): SearchRow => ({
	id: 'b1',
	guest_name: 'Jennifer Garcia',
	guest_email: 'jen@example.com',
	guest_phone: null,
	ownerrez_guest_id: '501',
	ownerrez_booking_id: '16632798',
	platform_reservation_number: 'HMX42',
	arrival: '2026-09-04',
	departure: '2026-09-07',
	status: 'active',
	properties: { name: 'Sunset Ridge Cabin', internal_code: 'SRC' },
	...overrides,
});

describe('sanitizeQuery', () => {
	it('keeps what names, emails, phones and reservation numbers use', () => {
		expect(sanitizeQuery("  O'Brien  ")).toBe("O'Brien");
		expect(sanitizeQuery('jen@example.com')).toBe('jen@example.com');
		expect(sanitizeQuery('+1 555-0100')).toBe('+1 555-0100');
		expect(sanitizeQuery('José Núñez')).toBe('José Núñez');
	});

	it('strips filter syntax and LIKE wildcards', () => {
		expect(sanitizeQuery('a,b)or(id.eq.1')).toBe('a b or id.eq.1');
		expect(sanitizeQuery('100%_"*')).toBe('100');
	});

	it('caps the length', () => {
		expect(sanitizeQuery('x'.repeat(200))).toHaveLength(80);
	});
});

describe('groupResults', () => {
	it('groups bookings into one guest keyed the way the guest dialog expects', () => {
		const result = groupResults([row({ id: 'b2', arrival: '2026-09-04' }), row({ id: 'b1', arrival: '2025-07-01' })], 'garcia');
		expect(result.guests).toEqual([{ id: 'or_501', name: 'Jennifer Garcia', email: 'jen@example.com', lastStay: '2026-09-04', stays: 2 }]);
		expect(result.bookings.map((b) => b.id)).toEqual(['b2', 'b1']);
	});

	it('falls back to a name key when the booking has no OwnerRez guest', () => {
		const result = groupResults([row({ ownerrez_guest_id: null })], 'jennifer');
		expect(result.guests[0].id).toBe('name_jennifer garcia');
	});

	it('finds a booking by reservation number without listing its guest', () => {
		const result = groupResults([row({})], 'hmx42');
		expect(result.guests).toEqual([]);
		expect(result.bookings[0].reservation).toBe('HMX42');
	});

	it('trims to the most recent guests and bookings', () => {
		const rows = Array.from({ length: 20 }, (_, i) =>
			row({ id: `b${i}`, ownerrez_guest_id: String(i), guest_name: `Guest ${i}`, arrival: `2026-01-${String(20 - i).padStart(2, '0')}` }),
		);
		const result = groupResults(rows, 'guest');
		expect(result.guests).toHaveLength(6);
		expect(result.guests[0].name).toBe('Guest 0');
		expect(result.bookings).toHaveLength(8);
	});
});
