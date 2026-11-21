import { OWNERREZ_API } from '../constants';

// resume token for the next chunk of a paged list: 'c:<cursor>' taken from ownerrez's
// next_page_url, or 'o:<offset>' where no cursor was issued. ownerrez rejects offsets
// above 0 from 2027-01-05, and ignores a cursor if the filters change between requests,
// so every chunked request must send identical filters.
export type PageResume = string | null;

// nextOffset only serves a browser still running the pre-cursor sync loop mid-deploy
export interface ChunkResult {
	totalItems: number;
	next: PageResume;
	nextOffset: number | null;
}

function applyResume(params: URLSearchParams, resume: PageResume) {
	if (resume?.startsWith('c:')) params.set('cursor', resume.slice(2));
	else params.set('offset', resume?.startsWith('o:') ? String(Number.parseInt(resume.slice(2), 10) || 0) : '0');
}

// next_page_url may drop the include_* params, so carry the originals over, but never
// a paging param: a cursor page must not also send the first request's offset
function withOriginalParams(nextPage: string, originalParams: URLSearchParams): string {
	const nextUrl = nextPage.startsWith('/') ? new URL(`https://api.ownerrez.com${nextPage}`) : new URL(nextPage);
	for (const [k, v] of originalParams) {
		if (k !== 'offset' && k !== 'cursor' && !nextUrl.searchParams.has(k)) nextUrl.searchParams.set(k, v);
	}
	return nextUrl.toString();
}

export class OwnerRezService {
	private baseUrl = OWNERREZ_API.BASE_URL;
	private accessToken: string;
	private cache?: KVNamespace;
	private timeout = 25000;
	private maxPages = 500;

	constructor(accessToken: string, cache?: KVNamespace) {
		this.accessToken = accessToken;
		this.cache = cache;
	}

	private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeout);

		try {
			return await fetch(url, { ...options, signal: controller.signal });
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') {
				throw new Error(`Request timeout after ${this.timeout}ms`);
			}
			throw error;
		} finally {
			clearTimeout(timeoutId);
		}
	}

	private getHeaders(): Record<string, string> {
		return {
			Authorization: `Bearer ${this.accessToken}`,
			'Content-Type': 'application/json',
			Accept: 'application/json',
			'User-Agent': 'Baileys-Analytics/1.0',
		};
	}

	// tracks shared outbound budget across all tenants against ownerrez's 300 req/5min per-IP limit.
	//
	// KV read-modify-write is not atomic: concurrent workers can read the same counter value
	// and each decrement it independently, causing under-counting under high concurrency.
	// this is intentionally best-effort — the counter provides visibility and mild back-pressure,
	// but actual rate enforcement comes from ownerrez's 429 responses handled in fetchWithRetry.
	//
	// one token is consumed per logical request (not per retry attempt).
	private async consumeToken(): Promise<void> {
		if (!this.cache) return;

		const BUDGET = 260; // conservative buffer below ownerrez's 300 req/5min limit
		const WINDOW_MS = 5 * 60 * 1000;
		const key = 'ownerrez:rate_budget';
		const now = Date.now();

		const state = await this.cache.get<{ tokens: number; windowStart: number }>(key, 'json');

		let tokens: number;
		let windowStart: number;

		if (!state || now - state.windowStart >= WINDOW_MS) {
			tokens = BUDGET - 1;
			windowStart = now;
		} else {
			tokens = state.tokens - 1;
			windowStart = state.windowStart;
		}

		const ttl = Math.max(60, Math.ceil((WINDOW_MS - (now - windowStart)) / 1000));
		try {
			await this.cache.put(key, JSON.stringify({ tokens, windowStart }), { expirationTtl: ttl });
		} catch (error) {
			// KV allows one write/sec per key; concurrent syncs trip it. The budget is
			// advisory, so never fail the actual OwnerRez request over it.
			console.warn('ownerrez rate budget write skipped:', error);
		}
	}

	private async fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
		// consume one token per logical request, before the first attempt only
		await this.consumeToken();

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			const response = await this.fetchWithTimeout(url, options);

			if (response.status === 429 && attempt < maxRetries) {
				// cap the wait well under the 30s request timeout; a longer Retry-After
				// just surfaces as a 429 and the client retries the chunk later
				const retryAfterSec = parseInt(response.headers.get('Retry-After') ?? '', 10);
				const delayMs = Math.min(Number.isFinite(retryAfterSec) ? retryAfterSec * 1000 : 2000 * 2 ** attempt, 10000);
				await new Promise((r) => setTimeout(r, delayMs));
				continue;
			}

			return response;
		}

		throw new Error('Max retries exceeded');
	}

	private async fetchAllPages(url: string, options?: RequestInit): Promise<any[]> {
		const allItems: any[] = [];
		let currentUrl: string | null = url;
		let page = 0;
		let isFirstPage = true;

		const originalParams = new URL(url).searchParams;

		while (currentUrl && page < this.maxPages) {
			const requestOptions: RequestInit = isFirstPage ? { ...options, headers: this.getHeaders() } : { headers: this.getHeaders() };

			const response = await this.fetchWithRetry(currentUrl, requestOptions);

			if (!response.ok) {
				throw new Error(`API request failed: ${response.statusText} (${response.status})`);
			}

			const data = (await response.json()) as any;

			if (Array.isArray(data)) {
				allItems.push(...data);
				break;
			}

			if (data.items && Array.isArray(data.items)) {
				allItems.push(...data.items);
			}

			const nextPage = data.next_page_url || null;
			currentUrl = nextPage ? withOriginalParams(nextPage, originalParams) : null;

			isFirstPage = false;
			page++;
		}

		return allItems;
	}

	async fetchProperties(): Promise<any[]> {
		const params = new URLSearchParams({
			include_tags: 'true',
			include_fields: 'true',
			limit: '100',
		});
		return this.fetchAllPages(`${this.baseUrl}/properties?${params}`);
	}

	async fetchBookings(propertyIds?: string | string[], startDate?: string, endDate?: string): Promise<any[]> {
		const params = new URLSearchParams();

		// ownerrez v2 api requires either property_ids or since_utc
		const ids = Array.isArray(propertyIds) ? propertyIds.join(',') : propertyIds;
		if (ids) {
			params.set('property_ids', ids);
		} else {
			params.set('since_utc', startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString());
		}

		if (startDate) params.set('from', startDate);
		if (endDate) params.set('to', endDate);

		params.set('include_guest', 'true');
		params.set('include_charges', 'true');
		params.set('include_fields', 'true');
		params.set('include_tags', 'true');
		params.set('limit', '100');

		return this.fetchAllPages(`${this.baseUrl}/bookings?${params}`);
	}

	// fetches up to maxPages pages of bookings from resume (null for the start), calling
	// onPage per page. withDetails: false skips guests, charges, fields and tags for
	// callers that only need dates.
	async fetchBookingsChunked(
		propertyIds: string[],
		startDate: string,
		endDate: string,
		resume: PageResume,
		maxPages: number,
		onPage: (items: any[]) => Promise<void>,
		{ withDetails = true }: { withDetails?: boolean } = {},
	): Promise<ChunkResult> {
		const params = new URLSearchParams();
		params.set('property_ids', propertyIds.join(','));
		params.set('from', startDate);
		params.set('to', endDate);
		if (withDetails) {
			params.set('include_guest', 'true');
			params.set('include_charges', 'true');
			params.set('include_fields', 'true');
			params.set('include_tags', 'true');
		}
		params.set('limit', '100');
		applyResume(params, resume);

		return this.fetchPagesChunked(`${this.baseUrl}/bookings?${params}`, maxPages, onPage);
	}

	async fetchGuestsChunked(
		resume: PageResume,
		maxPages: number,
		onPage: (items: any[]) => Promise<void>,
		createdSinceUtc?: string,
	): Promise<ChunkResult> {
		const params = new URLSearchParams({
			include_tags: 'true',
			include_fields: 'true',
			limit: '100',
		});
		applyResume(params, resume);

		if (createdSinceUtc) {
			params.set('created_since_utc', createdSinceUtc);
		} else {
			// midnight, not now: a filter that moved every request would void the cursor
			const now = new Date();
			params.set('created_since_utc', new Date(Date.UTC(now.getUTCFullYear() - 4, now.getUTCMonth(), now.getUTCDate())).toISOString());
		}

		return this.fetchPagesChunked(`${this.baseUrl}/guests?${params}`, maxPages, onPage);
	}

	// fetches up to maxPages pages, processing each via onPage callback.
	// next is null once there are no more pages.
	private async fetchPagesChunked(url: string, maxPages: number, onPage: (items: any[]) => Promise<void>): Promise<ChunkResult> {
		let currentUrl: string | null = url;
		let page = 0;
		let totalItems = 0;

		const originalParams = new URL(url).searchParams;

		while (currentUrl && page < maxPages) {
			const response = await this.fetchWithRetry(currentUrl, { headers: this.getHeaders() });

			if (!response.ok) {
				throw new Error(`API request failed: ${response.statusText} (${response.status})`);
			}

			const data = (await response.json()) as any;

			if (Array.isArray(data)) {
				if (data.length > 0) {
					await onPage(data);
					totalItems += data.length;
				}
				return { totalItems, next: null, nextOffset: null };
			}

			if (data.items && Array.isArray(data.items) && data.items.length > 0) {
				await onPage(data.items);
				totalItems += data.items.length;
			}

			const nextPage = data.next_page_url || null;
			currentUrl = nextPage ? withOriginalParams(nextPage, originalParams) : null;

			page++;
		}

		if (currentUrl) {
			const cursor = new URL(currentUrl).searchParams.get('cursor');
			const nextOffset = Number.parseInt(originalParams.get('offset') || '0', 10) + totalItems;
			return { totalItems, next: cursor ? `c:${cursor}` : `o:${nextOffset}`, nextOffset };
		}

		return { totalItems, next: null, nextOffset: null };
	}

	async fetchBookingDetail(bookingId: string): Promise<any> {
		const params = new URLSearchParams({ include_tags: 'true', include_charges: 'true' });
		const response = await this.fetchWithRetry(`${this.baseUrl}/bookings/${bookingId}?${params}`, { headers: this.getHeaders() });
		if (!response.ok) throw new Error(`Failed to fetch booking detail: ${response.statusText}`);
		return response.json();
	}

	// the guests list API returns full GuestModel including email_addresses, phones, and addresses —
	// no separate per-guest detail calls are needed after this
	async fetchAllGuests(createdSinceUtc?: string): Promise<any[]> {
		const params = new URLSearchParams({
			include_tags: 'true',
			include_fields: 'true',
			limit: '100',
		});

		if (createdSinceUtc) {
			params.set('created_since_utc', createdSinceUtc);
		} else {
			const fourYearsAgo = new Date();
			fourYearsAgo.setFullYear(fourYearsAgo.getFullYear() - 4);
			params.set('created_since_utc', fourYearsAgo.toISOString());
		}

		return this.fetchAllPages(`${this.baseUrl}/guests?${params}`);
	}

	async fetchInquiries(sinceUtc?: string): Promise<any[]> {
		const params = new URLSearchParams({ include_guest: 'true', limit: '100' });

		if (sinceUtc) {
			params.set('since_utc', sinceUtc);
		} else {
			const oneYearAgo = new Date();
			oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
			params.set('since_utc', oneYearAgo.toISOString());
		}

		return this.fetchAllPages(`${this.baseUrl}/inquiries?${params}`);
	}
}
