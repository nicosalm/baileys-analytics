import { OWNERREZ_API } from '../constants';

export class OwnerRezService {
	private baseUrl = OWNERREZ_API.BASE_URL;
	private clientId: string;
	private clientSecret: string;
	private username: string;
	private timeout: number = 10000; // 10 second timeout for external apis

	constructor(clientId: string, clientSecret: string, username: string) {
		this.clientId = clientId;
		this.clientSecret = clientSecret;
		this.username = username;
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

	private getAuthHeader(): string {
		const auth = btoa(`${this.clientId}:${this.clientSecret}`);
		return `Basic ${auth}`;
	}

	async fetchProperties(): Promise<any[]> {
		const headers: Record<string, string> = {
			'Authorization': this.getAuthHeader(),
			'Content-Type': 'application/json',
			'Accept': 'application/json',
			'User-Agent': 'Baileys-Analytics/1.0'
		};

		if (this.username) {
			headers['Username'] = this.username;
		}

		const response = await this.fetchWithTimeout(`${this.baseUrl}/properties`, {
			headers
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch properties: ${response.statusText}`);
		}

		const data = await response.json() as any;
		return data.items || [];
	}

	async fetchBookings(propertyId?: string, startDate?: string, endDate?: string): Promise<any[]> {
		const params = new URLSearchParams();
		if (propertyId) params.append('property_id', propertyId);
		if (startDate) params.append('arrival_start', startDate);
		if (endDate) params.append('arrival_end', endDate);

		const headers: Record<string, string> = {
			'Authorization': this.getAuthHeader(),
			'Content-Type': 'application/json',
			'Accept': 'application/json',
			'User-Agent': 'Baileys-Analytics/1.0'
		};

		if (this.username) {
			headers['Username'] = this.username;
		}

		const response = await this.fetchWithTimeout(`${this.baseUrl}/bookings?${params.toString()}`, {
			headers
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch bookings: ${response.statusText}`);
		}

		const data = await response.json() as any;
		return data.items || [];
	}

	async fetchBookingDetail(bookingId: string): Promise<any> {
		const headers: Record<string, string> = {
			'Authorization': this.getAuthHeader(),
			'Content-Type': 'application/json',
			'Accept': 'application/json',
			'User-Agent': 'Baileys-Analytics/1.0'
		};

		if (this.username) {
			headers['Username'] = this.username;
		}

		const response = await this.fetchWithTimeout(`${this.baseUrl}/bookings/${bookingId}`, {
			headers
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch booking detail: ${response.statusText}`);
		}

		return await response.json();
	}

	async fetchGuests(bookingIds: string[]): Promise<any[]> {
		const headers: Record<string, string> = {
			'Authorization': this.getAuthHeader(),
			'Content-Type': 'application/json',
			'Accept': 'application/json',
			'User-Agent': 'Baileys-Analytics/1.0'
		};

		if (this.username) {
			headers['Username'] = this.username;
		}

		const response = await this.fetchWithTimeout(`${this.baseUrl}/guests`, {
			method: 'POST',
			headers,
			body: JSON.stringify({ booking_ids: bookingIds })
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch guests: ${response.statusText}`);
		}

		const data = await response.json() as any;
		return data.items || [];
	}

	async searchGuests(query: string): Promise<any[]> {
		const params = new URLSearchParams({ q: query, limit: '5' });

		const headers: Record<string, string> = {
			'Authorization': this.getAuthHeader(),
			'Content-Type': 'application/json',
			'Accept': 'application/json',
			'User-Agent': 'Baileys-Analytics/1.0'
		};

		if (this.username) {
			headers['Username'] = this.username;
		}

		const response = await this.fetchWithTimeout(`${this.baseUrl}/guests?${params.toString()}`, {
			headers
		});

		if (!response.ok) {
			throw new Error(`Failed to search guests: ${response.statusText}`);
		}

		const data = await response.json() as any;
		return data.items || [];
	}
}
