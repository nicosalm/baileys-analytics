import { SupabaseClient } from '@supabase/supabase-js';
import { getBookingIdsForTags } from '../utils/tag-filter';
import { prorateBooking } from '../utils/prorate';
import { fetchBlocks, collectBlockedNights } from '../utils/blocks';

export class MetricsService {
	constructor(private supabase: SupabaseClient) {}

	async calculatePropertyMetrics(
		tenantId: string,
		fromDate: string,
		toDate: string,
		propertyId?: string,
		tagIds?: string[],
		propertyIds?: string[]
	) {
		let propertiesQuery = this.supabase
			.from('properties')
			.select('id, name, internal_code')
			.eq('tenant_id', tenantId)
			.eq('active', true);

		if (propertyId) {
			propertiesQuery = propertiesQuery.eq('id', propertyId);
		} else if (propertyIds?.length) {
			propertiesQuery = propertiesQuery.in('id', propertyIds);
		}
		
		const { data: properties } = await propertiesQuery;

		if (!properties?.length) return [];

		// resolve tag filter once for the whole tenant (it's tenant-scoped, not
		// per-property), so we don't do N redundant lookups inside the map.
		// null from getBookingIdsForTags means "no bookings match". the filter
		// must narrow to empty, otherwise the .in() guard below silently widens
		// every property back to unfiltered.
		let matchedBookingIds: string[] | null = null;
		const tagFilterActive = !!tagIds?.length;
		if (tagFilterActive) {
			matchedBookingIds = await getBookingIdsForTags(this.supabase, tenantId, tagIds!);
		}

		// one blocks fetch for the whole set, then per-property lookup inside the map
		const allPropertyIds = properties.map(p => p.id);
		const blocks = await fetchBlocks(this.supabase, tenantId, fromDate, toDate, allPropertyIds);
		const blockedByProp = collectBlockedNights(blocks, fromDate, toDate);

		const metrics = await Promise.all(
			properties.map(async (property) => {
				const { data: firstBooking } = await this.supabase
					.from('bookings')
					.select('arrival')
					.eq('property_id', property.id)
					.neq('status', 'canceled')
					.order('arrival', { ascending: true })
					.limit(1)
					.single();

				// Available nights = calendar window minus pre-onboarding days and owner blocks.
				// No today-clamp: a future or forward-looking window should show
				// sellable inventory, not zero. Matches the semantic used by
				// services/properties.ts, services/occupancy.ts RPCs, and
				// services/overview.ts.
				let calendarAvailable = 0;
				const startDate = new Date(fromDate);
				const endDate = new Date(toDate);

				if (firstBooking?.arrival) {
					const firstBookingDate = new Date(firstBooking.arrival);
					if (firstBookingDate <= endDate) {
						const effectiveStart = firstBookingDate > startDate ? firstBookingDate : startDate;
						calendarAvailable = Math.ceil(
							(endDate.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)
						) + 1;
					}
				} else {
					calendarAvailable = Math.ceil(
						(endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
					) + 1;
				}
				const blockedNights = blockedByProp.get(property.id) || 0;
				const availableNights = Math.max(0, calendarAvailable - blockedNights);

				// overlap filter so a stay starting before the window and ending inside still counts
				let bookingQuery = this.supabase
					.from('bookings')
					.select('id, arrival, departure, total_amount')
					.eq('property_id', property.id)
					.eq('tenant_id', tenantId)
					.lte('arrival', toDate)
					.gte('departure', fromDate)
					.neq('status', 'canceled');

				if (matchedBookingIds) {
					bookingQuery = bookingQuery.in('id', matchedBookingIds);
				} else if (tagFilterActive) {
					// tag filter matched no bookings; force empty rather than silently widen
					bookingQuery = bookingQuery.in('id', []);
				}

				const { data: bookings } = await bookingQuery;

				// Prorate revenue and overlap-nights to the full window (no today clamp)
				// so numerator and denominator use the same domain.
				let totalRevenue = 0;
				let bookedNights = 0;
				bookings?.forEach(b => {
					const pr = prorateBooking(b, fromDate, toDate);
					totalRevenue += pr.revenue;
					bookedNights += pr.overlapNights;
				});
				const bookingCount = bookings?.length || 0;

				const occupancyRate = availableNights > 0 ? (bookedNights / availableNights) * 100 : 0;
				const avgNightlyRate = bookedNights > 0 ? totalRevenue / bookedNights : 0;
				const avgStayLength = bookingCount > 0 ? bookedNights / bookingCount : 0;

				return {
					propertyId: property.id,
					propertyName: property.name,
					propertyCode: property.internal_code || null,
					revenue: totalRevenue,
					bookings: bookingCount,
					occupancyRate,
					avgNightlyRate,
					avgStayLength,
					bookedNights,
					availableNights,
					blockedNights
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