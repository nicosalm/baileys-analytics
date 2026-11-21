import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { createSupabaseClient } from '../services/supabase';
import type { AppEnv } from '../types';

const search = new Hono<AppEnv>();

search.use('/*', authMiddleware);

const MAX_GUESTS = 6;
const MAX_BOOKINGS = 8;
// enough rows to find the most recent matches; results are grouped and trimmed afterwards
const ROW_LIMIT = 60;

export interface SearchRow {
	id: string;
	guest_name: string | null;
	guest_email: string | null;
	guest_phone: string | null;
	ownerrez_guest_id: string | null;
	ownerrez_booking_id: string;
	platform_reservation_number: string | null;
	arrival: string;
	departure: string;
	status: string | null;
	properties: { name: string; internal_code: string | null } | null;
}

// keeps only characters that occur in names, emails, phone numbers and reservation numbers.
// everything else is dropped, which also removes PostgREST filter syntax (, ( ) " *) and LIKE wildcards (% _).
export const sanitizeQuery = (raw: string) =>
	raw
		.normalize('NFKC')
		.replace(/[^\p{L}\p{N}\s@.'+-]/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 80);

const matches = (value: string | null, q: string) => !!value && value.toLowerCase().includes(q);

// the guest detail endpoint expects this id format
const guestKey = (row: SearchRow) =>
	row.ownerrez_guest_id ? `or_${row.ownerrez_guest_id}` : `name_${(row.guest_name ?? '').toLowerCase().trim()}`;

export function groupResults(rows: SearchRow[], query: string) {
	const q = query.toLowerCase();

	const guests = new Map<string, { id: string; name: string; email: string | null; lastStay: string; stays: number }>();
	for (const row of rows) {
		// a match on a reservation number finds the booking, not the guest
		if (!row.guest_name || !(matches(row.guest_name, q) || matches(row.guest_email, q) || matches(row.guest_phone, q))) continue;
		const key = guestKey(row);
		const existing = guests.get(key);
		if (existing) {
			existing.stays += 1;
			if (row.arrival > existing.lastStay) existing.lastStay = row.arrival;
		} else {
			guests.set(key, { id: key, name: row.guest_name, email: row.guest_email, lastStay: row.arrival, stays: 1 });
		}
	}

	const bookings = rows.slice(0, MAX_BOOKINGS).map((row) => ({
		id: row.id,
		guestName: row.guest_name ?? 'Unknown guest',
		propertyName: row.properties?.name ?? null,
		propertyCode: row.properties?.internal_code ?? null,
		arrival: row.arrival,
		departure: row.departure,
		status: row.status,
		reservation: row.platform_reservation_number ?? row.ownerrez_booking_id,
	}));

	return {
		guests: [...guests.values()].sort((a, b) => b.lastStay.localeCompare(a.lastStay)).slice(0, MAX_GUESTS),
		bookings,
	};
}

search.get('/', async (c) => {
	c.header('Cache-Control', 'private, no-store');
	const tenantId = c.get('tenantId');
	const q = sanitizeQuery(c.req.query('q') ?? '');
	if (!tenantId || q.length < 2) return c.json({ guests: [], bookings: [] });

	// quoted values keep any remaining punctuation literal inside the filter
	const like = `"%${q}%"`;
	const supabase = createSupabaseClient(c.env);
	const { data, error } = await supabase
		.from('bookings')
		.select(
			'id, guest_name, guest_email, guest_phone, ownerrez_guest_id, ownerrez_booking_id, platform_reservation_number, arrival, departure, status, properties!inner(name, internal_code)',
		)
		.eq('tenant_id', tenantId)
		.or(
			[
				`guest_name.ilike.${like}`,
				`guest_email.ilike.${like}`,
				`guest_phone.ilike.${like}`,
				`ownerrez_booking_id.ilike.${like}`,
				`platform_reservation_number.ilike.${like}`,
			].join(','),
		)
		.order('arrival', { ascending: false })
		.limit(ROW_LIMIT);

	if (error) {
		console.error('search failed:', error.message);
		return c.json({ error: 'Search failed' }, 500);
	}

	return c.json(groupResults((data ?? []) as unknown as SearchRow[], q));
});

export { search };
