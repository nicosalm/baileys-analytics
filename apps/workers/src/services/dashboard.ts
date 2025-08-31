import { SupabaseClient } from '@supabase/supabase-js';

export interface DashboardData {
	overview: {
		totalProperties: number;
		totalBookings: number;
		occupancyRate: number;
		revenue: number;
	};
	recentBookings: any[];
	propertyMetrics: any[];
}

export class DashboardService {
	constructor(private supabase: SupabaseClient) {}

	async getDashboardData(tenantId: string): Promise<DashboardData> {
		const { count: propertyCount } = await this.supabase
			.from('properties')
			.select('*', { count: 'exact', head: true })
			.eq('tenant_id', tenantId);

		const { data: bookingStats } = await this.supabase
			.from('bookings')
			.select('total_amount, arrival, departure')
			.eq('tenant_id', tenantId)
			.gte('arrival', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString());

		const totalBookings = bookingStats?.length || 0;
		const totalRevenue = bookingStats?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;
		
		const occupiedDays = bookingStats?.reduce((sum, b) => {
			if (b.arrival && b.departure) {
				const days = Math.ceil((new Date(b.departure).getTime() - new Date(b.arrival).getTime()) / (1000 * 60 * 60 * 24));
				return sum + days;
			}
			return sum;
		}, 0) || 0;
		const occupancyRate = (occupiedDays / 365) * 100;

		const { data: recentBookings } = await this.supabase
			.from('bookings')
			.select(`
				id,
				guest_name,
				arrival,
				departure,
				total_amount,
				booking_status,
				properties!inner(name)
			`)
			.eq('tenant_id', tenantId)
			.order('created_at', { ascending: false })
			.limit(10);

		const { data: properties } = await this.supabase
			.from('properties')
			.select(`
				id,
				name,
				bookings(total_amount, arrival, departure)
			`)
			.eq('tenant_id', tenantId);

		const propertyMetrics = properties?.map(p => {
			const bookings = p.bookings || [];
			const bookingCount = bookings.length;
			const totalRevenue = bookings.reduce((sum: number, b: any) => sum + (b.total_amount || 0), 0);
			
			const occupiedDays = bookings.reduce((sum: number, b: any) => {
				if (b.arrival && b.departure) {
					const days = Math.ceil((new Date(b.departure).getTime() - new Date(b.arrival).getTime()) / (1000 * 60 * 60 * 24));
					return sum + days;
				}
				return sum;
			}, 0);
			const occupancyRate = (occupiedDays / 365) * 100;

			return {
				id: p.id,
				name: p.name,
				booking_count: bookingCount,
				total_revenue: totalRevenue,
				occupancy_rate: occupancyRate
			};
		}).sort((a, b) => b.total_revenue - a.total_revenue).slice(0, 5);

		return {
			overview: {
				totalProperties: propertyCount || 0,
				totalBookings,
				occupancyRate,
				revenue: totalRevenue,
			},
			recentBookings: recentBookings?.map((b: any) => ({
				...b,
				property_name: b.properties?.name
			})) || [],
			propertyMetrics: propertyMetrics || [],
		};
	}
}