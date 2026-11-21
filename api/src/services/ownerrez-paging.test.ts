import { describe, it, expect, vi, afterEach } from 'vitest';
import { OwnerRezService } from './ownerrez';

// serves one canned page per request and records every url requested
function stubOwnerRez(pages: Array<{ items: unknown[]; next_page_url: string | null }>) {
	const urls: URL[] = [];
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: string) => {
			urls.push(new URL(url));
			const page = pages[urls.length - 1] ?? { items: [], next_page_url: null };
			return new Response(JSON.stringify(page), { status: 200, headers: { 'content-type': 'application/json' } });
		}),
	);
	return urls;
}

const noop = async () => {};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('chunked paging', () => {
	it('hands back the cursor from next_page_url when a chunk stops early', async () => {
		stubOwnerRez([{ items: [{ id: 1 }], next_page_url: '/v2/bookings?cursor=abc123&limit=100' }]);
		const result = await new OwnerRezService('t').fetchBookingsChunked(['1'], '2026-01-01', '2027-01-01', null, 1, noop);
		expect(result.next).toBe('c:abc123');
	});

	it('resumes with the cursor and never sends an offset alongside it', async () => {
		const urls = stubOwnerRez([
			{ items: [{ id: 2 }], next_page_url: '/v2/bookings?cursor=def456' },
			{ items: [{ id: 3 }], next_page_url: null },
		]);
		const result = await new OwnerRezService('t').fetchBookingsChunked(['1'], '2026-01-01', '2027-01-01', 'c:abc123', 5, noop);
		expect(urls[0].searchParams.get('cursor')).toBe('abc123');
		expect(urls.every((u) => !u.searchParams.has('offset'))).toBe(true);
		// follow-up pages keep the original filters
		expect(urls[1].searchParams.get('property_ids')).toBe('1');
		expect(result).toMatchObject({ totalItems: 2, next: null });
	});

	it('falls back to an offset token when ownerrez issues no cursor', async () => {
		stubOwnerRez([{ items: Array.from({ length: 100 }, (_, i) => ({ id: i })), next_page_url: '/v2/bookings?offset=100' }]);
		const result = await new OwnerRezService('t').fetchBookingsChunked(['1'], '2026-01-01', '2027-01-01', null, 1, noop);
		expect(result.next).toBe('o:100');
	});

	it('skips the detail includes for lean fetches', async () => {
		const urls = stubOwnerRez([{ items: [], next_page_url: null }]);
		await new OwnerRezService('t').fetchBookingsChunked(['1'], '2026-01-01', '2027-01-01', null, 1, noop, { withDetails: false });
		expect([...urls[0].searchParams.keys()].some((k) => k.startsWith('include_'))).toBe(false);
	});

	it('sends the same guest filter on every chunk so a cursor stays valid', async () => {
		const urls = stubOwnerRez([
			{ items: [{ id: 1 }], next_page_url: null },
			{ items: [{ id: 2 }], next_page_url: null },
		]);
		const service = new OwnerRezService('t');
		await service.fetchGuestsChunked(null, 1, noop);
		await new Promise((r) => setTimeout(r, 5));
		await service.fetchGuestsChunked('c:abc', 1, noop);
		expect(urls[0].searchParams.get('created_since_utc')).toBe(urls[1].searchParams.get('created_since_utc'));
	});
});
