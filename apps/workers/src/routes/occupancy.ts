import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { cache } from '../middleware/cache';
import { createSupabaseClient } from '../services/supabase';
import { bucketBooking, effectiveDaysInMonth } from '../utils/prorate';

const occupancy = new Hono<{ Bindings: Env; Variables: { user: any; tenantId: string } }>();

occupancy.use('/*', authMiddleware);

occupancy.get('/', cache({ ttl: 3600 }), async (c) => {
	const { from, to, tags, comparisonFrom, comparisonTo } = c.req.query();
	const tenantId = c.get('tenantId');

	if (!tenantId) {
		return c.json({
			overall: 0,
			byProperty: [],
			byMonth: [],
			bookedNights: 0,
			availableNights: 0
		});
	}

	const startDate = from || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
	const endDate = to || new Date().toISOString().split('T')[0];
	const tagIds = tags ? tags.split(',').filter(Boolean) : [];

	const supabase = createSupabaseClient(c.env);
	const { getOccupancyData, detectBookingGaps } = await import('../services/occupancy');

	const currentData = await getOccupancyData(
		supabase,
		tenantId,
		startDate,
		endDate,
		tagIds
	);

	// build per-property avg nightly rate map from current occupancy data
	const propertyRates = new Map<string, number>();
	for (const p of currentData.byProperty) {
		if (p.avgNightlyRate > 0) {
			propertyRates.set(p.propertyId, p.avgNightlyRate);
		}
	}

	// detect booking gaps for the next 60 days
	const bookingGaps = await detectBookingGaps(
		supabase,
		tenantId,
		60,
		propertyRates
	);

	if (comparisonFrom && comparisonTo) {
		const previousData = await getOccupancyData(
			supabase,
			tenantId,
			comparisonFrom,
			comparisonTo,
			tagIds
		);

		return c.json({
			current: { ...currentData, gaps: bookingGaps },
			previous: previousData
		});
	}

	return c.json({ ...currentData, gaps: bookingGaps });
});

occupancy.get('/daily', cache({ ttl: 3600 }), async (c) => {
	const { from, to, tags } = c.req.query();
	const tenantId = c.get('tenantId');

	if (!tenantId) {
		return c.json([]);
	}

	const startDate = from || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
	const endDate = to || new Date().toISOString().split('T')[0];
	const tagIds = tags ? tags.split(',').filter(Boolean) : [];

	const supabase = createSupabaseClient(c.env);
	const { getDailyOccupancyData } = await import('../services/occupancy');

	const dailyData = await getDailyOccupancyData(
		supabase,
		tenantId,
		startDate,
		endDate,
		tagIds
	);

	return c.json(dailyData);
});

occupancy.get('/trends', cache({ ttl: 7200 }), async (c) => {
	const { propertyId, months = '12' } = c.req.query();
	const tenantId = c.get('tenantId');

	if (!tenantId) {
		return c.json({ error: 'Tenant not found' }, 404);
	}

	const supabase = createSupabaseClient(c.env);
	
	const endDate = new Date();
	const startDate = new Date();
	// UTC month arithmetic so non-UTC runtimes don't shift the boundary by a day
	startDate.setUTCMonth(startDate.getUTCMonth() - parseInt(months));

	// overlap query so a booking starting in month N-1 that spans into month N
	// contributes its in-period nights to both months' revenue/occupancy numbers.
	const periodFromStr = startDate.toISOString().slice(0, 10);
	const periodToStr = endDate.toISOString().slice(0, 10);

	let query = supabase
		.from('bookings')
		.select('id, arrival, departure, total_amount, property_id')
		.eq('tenant_id', tenantId)
		.lte('arrival', periodToStr)
		.gte('departure', periodFromStr)
		.neq('status', 'canceled');

	if (propertyId) {
		query = query.eq('property_id', propertyId);
	}

	const { data: bookings } = await query;

	const monthlyData: Record<string, { bookings: number; revenue: number; nights: number }> = {};

	bookings?.forEach(booking => {
		if (!booking.arrival) return;

		// revenue and nights split across every month the booking overlaps
		for (const bkt of bucketBooking(booking, periodFromStr, periodToStr, 'month')) {
			if (!monthlyData[bkt.key]) {
				monthlyData[bkt.key] = { bookings: 0, revenue: 0, nights: 0 };
			}
			monthlyData[bkt.key].revenue += bkt.revenue;
			monthlyData[bkt.key].nights += bkt.nights;
		}

		// booking count attributed to arrival month only
		const arrivalMonth = new Date(booking.arrival).toISOString().slice(0, 7);
		if (!monthlyData[arrivalMonth]) {
			monthlyData[arrivalMonth] = { bookings: 0, revenue: 0, nights: 0 };
		}
		monthlyData[arrivalMonth].bookings++;
	});
	
	const trends = Object.entries(monthlyData)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([month, data]) => {
			// Denominator clipped to the trailing window so the partial edge
			// months (the earliest and the current month) aren't divided by
			// their full calendar length.
			const [y, m] = month.split('-').map(Number);
			const daysInMonth = effectiveDaysInMonth(y, m - 1, periodFromStr, periodToStr);
			return {
				month,
				...data,
				occupancyRate: daysInMonth > 0 ? (data.nights / daysInMonth) * 100 : 0,
				averageBookingValue: data.bookings > 0 ? data.revenue / data.bookings : 0
			};
		});
	
	return c.json({
		period: { 
			startDate: startDate.toISOString(), 
			endDate: endDate.toISOString() 
		},
		trends
	});
});

export { occupancy };