export class OwnerRezService {
	private baseUrl = 'https://api.ownerreservations.com/v2';
	private clientId: string;
	private clientSecret: string;
	private username: string;

	constructor(clientId: string, clientSecret: string, username: string) {
		this.clientId = clientId;
		this.clientSecret = clientSecret;
		this.username = username;
	}

	private getAuthHeader(): string {
		const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
		return `Basic ${auth}`;
	}

	async fetchProperties(): Promise<any[]> {
		const headers: Record<string, string> = {
			'Authorization': this.getAuthHeader(),
			'Content-Type': 'application/json',
			'Accept': 'application/json'
		};

		if (this.username) {
			headers['Username'] = this.username;
		}

		const response = await fetch(`${this.baseUrl}/properties`, {
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
			'Accept': 'application/json'
		};

		if (this.username) {
			headers['Username'] = this.username;
		}

		const response = await fetch(`${this.baseUrl}/bookings?${params.toString()}`, {
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
			'Accept': 'application/json'
		};

		if (this.username) {
			headers['Username'] = this.username;
		}

		const response = await fetch(`${this.baseUrl}/bookings/${bookingId}`, {
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
			'Accept': 'application/json'
		};

		if (this.username) {
			headers['Username'] = this.username;
		}

		const response = await fetch(`${this.baseUrl}/guests`, {
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
			'Accept': 'application/json'
		};

		if (this.username) {
			headers['Username'] = this.username;
		}

		const response = await fetch(`${this.baseUrl}/guests?${params.toString()}`, {
			headers
		});

		if (!response.ok) {
			throw new Error(`Failed to search guests: ${response.statusText}`);
		}

		const data = await response.json() as any;
		return data.items || [];
	}
}
