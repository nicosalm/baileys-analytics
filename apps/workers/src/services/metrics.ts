import { SupabaseClient } from '@supabase/supabase-js';

export class MetricsService {
	constructor(private supabase: SupabaseClient) {}

	async calculatePropertyMetrics(
		tenantId: string,
		fromDate: string,
		toDate: string,
		propertyId?: string,
		tagIds?: string[]
	) {
		let propertiesQuery = this.supabase
			.from('properties')
			.select('id, name')
			.eq('tenant_id', tenantId)
			.eq('active', true);
		
		if (propertyId) {
			propertiesQuery = propertiesQuery.eq('id', propertyId);
		}
		
		const { data: properties } = await propertiesQuery;

		if (!properties?.length) return [];

		const metrics = await Promise.all(
			properties.map(async (property) => {
				const { data: firstBooking } = await this.supabase
					.from('bookings')
					.select('arrival')
					.eq('property_id', property.id)
					.neq('booking_status', 'canceled')
					.order('arrival', { ascending: true })
					.limit(1)
					.single();

				let availableNights = 0;
				const startDate = new Date(fromDate);
				const endDate = new Date(toDate);
				const today = new Date();
				const effectiveEnd = endDate > today ? today : endDate;

				if (firstBooking?.arrival) {
					const firstBookingDate = new Date(firstBooking.arrival);
					if (firstBookingDate <= effectiveEnd) {
						const effectiveStart = firstBookingDate > startDate ? firstBookingDate : startDate;
						availableNights = Math.ceil(
							(effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)
						) + 1;
					}
				} else {
					availableNights = Math.ceil(
						(effectiveEnd.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
					) + 1;
				}

				let bookingQuery = this.supabase
					.from('bookings')
					.select('id, arrival, departure, total_amount')
					.eq('property_id', property.id)
					.eq('tenant_id', tenantId)
					.gte('arrival', fromDate)
					.lte('arrival', toDate)
					.neq('booking_status', 'canceled');

				if (tagIds?.length) {
					const { data: taggedBookings } = await this.supabase
						.from('booking_tags')
						.select('booking_id')
						.in('tag_id', tagIds);
					
					const bookingIds = taggedBookings?.map(t => t.booking_id) || [];
					if (bookingIds.length) {
						bookingQuery = bookingQuery.in('id', bookingIds);
					}
				}

				const { data: bookings } = await bookingQuery;

				const totalRevenue = bookings?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;
				const bookingCount = bookings?.length || 0;

				let bookedNights = 0;
				bookings?.forEach(booking => {
					if (booking.arrival && booking.departure) {
						const arrival = new Date(booking.arrival);
						const departure = new Date(booking.departure);
						const effectiveArrival = arrival < startDate ? startDate : arrival;
						const effectiveDeparture = departure > effectiveEnd ? effectiveEnd : departure;
						
						if (effectiveArrival <= effectiveDeparture) {
							bookedNights += Math.ceil(
								(effectiveDeparture.getTime() - effectiveArrival.getTime()) / (1000 * 60 * 60 * 24)
							);
						}
					}
				});

				const occupancyRate = availableNights > 0 ? (bookedNights / availableNights) * 100 : 0;
				const avgNightlyRate = bookedNights > 0 ? totalRevenue / bookedNights : 0;
				const avgStayLength = bookingCount > 0 ? bookedNights / bookingCount : 0;

				return {
					propertyId: property.id,
					propertyName: property.name,
					revenue: totalRevenue,
					bookings: bookingCount,
					occupancyRate,
					avgNightlyRate,
					avgStayLength,
					bookedNights,
					availableNights
				};
			})
		);

		return metrics.sort((a, b) => b.revenue - a.revenue);
	}

	async calculateComparativeMetrics(
		tenantId: string,
		currentFrom: string,
		currentTo: string,
		comparisonFrom: string,
		comparisonTo: string
	) {
		const [currentMetrics, comparisonMetrics] = await Promise.all([
			this.calculatePropertyMetrics(tenantId, currentFrom, currentTo),
			this.calculatePropertyMetrics(tenantId, comparisonFrom, comparisonTo)
		]);

		const comparisonMap = new Map(
			comparisonMetrics.map(m => [m.propertyId, m])
		);

		return currentMetrics.map(current => {
			const previous = comparisonMap.get(current.propertyId);
			
			if (!previous) {
				return { ...current, comparison: null };
			}

			return {
				...current,
				comparison: {
					revenueChange: previous.revenue > 0 
						? ((current.revenue - previous.revenue) / previous.revenue) * 100 
						: 0,
					bookingsChange: previous.bookings > 0
						? ((current.bookings - previous.bookings) / previous.bookings) * 100
						: 0,
					occupancyChange: current.occupancyRate - previous.occupancyRate,
					avgNightlyRateChange: previous.avgNightlyRate > 0
						? ((current.avgNightlyRate - previous.avgNightlyRate) / previous.avgNightlyRate) * 100
						: 0,
					previousRevenue: previous.revenue,
					previousBookings: previous.bookings,
					previousOccupancy: previous.occupancyRate
				}
			};
		});
	}
}