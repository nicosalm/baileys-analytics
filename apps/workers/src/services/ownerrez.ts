import { OWNERREZ_API } from '../constants';

export class OwnerRezService {
	private baseUrl = OWNERREZ_API.BASE_URL;
	private accessToken?: string;
	private clientId?: string;
	private clientSecret?: string;
	private username?: string;
	private timeout: number = 10000;
	private maxPages: number = 50;

	constructor(accessTokenOrClientId: string, clientSecret?: string, username?: string) {
		if (clientSecret) {
			this.clientId = accessTokenOrClientId;
			this.clientSecret = clientSecret;
			this.username = username;
		} else {
			this.accessToken = accessTokenOrClientId;
		}
	}

	private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeout);
		
		try {
			const response = await fetch(url, {
				...options,
				signal: controller.signal
			});
			return response;
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
		const headers: Record<string, string> = {
			'Authorization': this.getAuthHeader(),
			'Content-Type': 'application/json',
			'Accept': 'application/json',
			'User-Agent': 'Baileys-Analytics/1.0'
		};

		if (this.username && !this.accessToken) {
			headers['Username'] = this.username;
		}

		return headers;
	}

	private async fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			const response = await this.fetchWithTimeout(url, options);

			if (response.status === 429 && attempt < maxRetries) {
				// respect Retry-After header, fallback to exponential backoff
				const retryAfter = response.headers.get('Retry-After');
				const delayMs = retryAfter
					? parseInt(retryAfter, 10) * 1000
					: Math.min(2000 * Math.pow(2, attempt), 30000);
				await new Promise(r => setTimeout(r, delayMs));
				continue;
			}

			return response;
		}

		// unreachable, but satisfies TS
		throw new Error('Max retries exceeded');
	}

	private async fetchAllPages(url: string, options?: RequestInit): Promise<any[]> {
		const allItems: any[] = [];
		let currentUrl: string | null = url;
		let page = 0;
		let isFirstPage = true;

		const originalUrl = new URL(url);
		const originalParams = originalUrl.searchParams;

		while (currentUrl && page < this.maxPages) {
			const requestOptions: RequestInit = isFirstPage
				? { ...options, headers: this.getHeaders() }
				: { headers: this.getHeaders() };

			const response = await this.fetchWithRetry(currentUrl, requestOptions);

			if (!response.ok) {
				throw new Error(`API request failed: ${response.statusText} (${response.status})`);
			}

			const data = await response.json() as any;

			if (Array.isArray(data)) {
				allItems.push(...data);
				break;
			}

			if (data.items && Array.isArray(data.items)) {
				allItems.push(...data.items);
			}

			const nextPage = data.next_page_url || null;
			if (nextPage) {
				const nextUrl = nextPage.startsWith('/')
					? new URL(`https://api.ownerrez.com${nextPage}`)
					: new URL(nextPage);

				for (const [key, value] of originalParams) {
					if (!nextUrl.searchParams.has(key)) {
						nextUrl.searchParams.set(key, value);
					}
				}
				currentUrl = nextUrl.toString();
			} else {
				currentUrl = null;
			}
			isFirstPage = false;
			page++;
		}

		return allItems;
	}

	private getAuthHeader(): string {
		if (this.accessToken) {
			return `Bearer ${this.accessToken}`;
		} else if (this.clientId && this.clientSecret) {
			const auth = btoa(`${this.clientId}:${this.clientSecret}`);
			return `Basic ${auth}`;
		}
		throw new Error('No authentication method available');
	}

	async fetchProperties(): Promise<any[]> {
		const params = new URLSearchParams();
		params.append('include_tags', 'true');
		params.append('include_fields', 'true');
		params.append('limit', '100');

		return this.fetchAllPages(`${this.baseUrl}/properties?${params.toString()}`);
	}

	async fetchBookings(propertyIds?: string | string[], startDate?: string, endDate?: string): Promise<any[]> {
		const params = new URLSearchParams();

		// ownerrez v2 api requires either property_ids or since_utc
		const ids = Array.isArray(propertyIds) ? propertyIds.join(',') : propertyIds;
		if (ids) {
			params.append('property_ids', ids);
		} else {
			const sinceDate = startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
			params.append('since_utc', sinceDate);
		}

		if (startDate) params.append('from', startDate);
		if (endDate) params.append('to', endDate);

		params.append('include_guest', 'true');
		params.append('include_charges', 'true');
		params.append('include_fields', 'true');
		params.append('include_tags', 'true');
		params.append('limit', '100');

		return this.fetchAllPages(`${this.baseUrl}/bookings?${params.toString()}`);
	}

	async fetchBookingDetail(bookingId: string): Promise<any> {
		const params = new URLSearchParams();
		params.append('include_tags', 'true');
		params.append('include_charges', 'true');
		const response = await this.fetchWithRetry(`${this.baseUrl}/bookings/${bookingId}?${params.toString()}`, {
			headers: this.getHeaders()
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch booking detail: ${response.statusText}`);
		}

		return await response.json();
	}

	async fetchGuestDetail(guestId: string): Promise<any> {
		const response = await this.fetchWithRetry(`${this.baseUrl}/guests/${guestId}`, {
			headers: this.getHeaders()
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch guest detail: ${response.statusText}`);
		}

		return await response.json();
	}

	async fetchGuests(bookingIds: string[]): Promise<any[]> {
		const params = new URLSearchParams();
		params.append('include_tags', 'true');
		params.append('include_fields', 'true');

		return this.fetchAllPages(`${this.baseUrl}/guests?${params.toString()}`, {
			method: 'POST',
			body: JSON.stringify({ booking_ids: bookingIds })
		});
	}

	async fetchAllGuests(createdSinceUtc?: string): Promise<any[]> {
		const params = new URLSearchParams();
		params.append('include_tags', 'true');
		params.append('include_fields', 'true');
		params.append('limit', '100');

		// default to 4 years ago if not specified
		if (createdSinceUtc) {
			params.append('created_since_utc', createdSinceUtc);
		} else {
			const fourYearsAgo = new Date();
			fourYearsAgo.setFullYear(fourYearsAgo.getFullYear() - 4);
			params.append('created_since_utc', fourYearsAgo.toISOString());
		}

		return this.fetchAllPages(`${this.baseUrl}/guests?${params.toString()}`);
	}

	async fetchInquiries(sinceUtc?: string): Promise<any[]> {
		const params = new URLSearchParams();
		params.append('include_guest', 'true');
		params.append('limit', '100');
		if (sinceUtc) {
			params.append('since_utc', sinceUtc);
		} else {
			const oneYearAgo = new Date();
			oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
			params.append('since_utc', oneYearAgo.toISOString());
		}

		return this.fetchAllPages(`${this.baseUrl}/inquiries?${params.toString()}`);
	}

	async searchGuests(query: string): Promise<any[]> {
		const params = new URLSearchParams({ q: query, limit: '5' });

		const response = await this.fetchWithTimeout(`${this.baseUrl}/guests?${params.toString()}`, {
			headers: this.getHeaders()
		});

		if (!response.ok) {
			throw new Error(`Failed to search guests: ${response.statusText}`);
		}

		const data = await response.json() as any;
		return data.items || [];
	}
}
