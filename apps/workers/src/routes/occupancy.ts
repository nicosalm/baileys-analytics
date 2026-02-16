import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { cache } from '../middleware/cache';
import { createSupabaseClient } from '../services/supabase';

const occupancy = new Hono<{ Bindings: Env; Variables: { user: any } }>();

occupancy.use('/*', authMiddleware);

occupancy.get('/', cache({ ttl: 3600 }), async (c) => {
	const { from, to, tags, comparisonFrom, comparisonTo } = c.req.query();
	const supabase = createSupabaseClient(c.env);
	const user = c.get('user');
	
	const { data: tenant } = await supabase
		.from('tenants')
		.select('id')
		.eq('user_id', user.id)
		.single();
	
	if (!tenant) {
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
	
	const { getOccupancyData, detectBookingGaps } = await import('../services/occupancy');
	
	const currentData = await getOccupancyData(
		supabase,
		tenant.id,
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
		tenant.id,
		60,
		propertyRates
	);
	
	if (comparisonFrom && comparisonTo) {
		const previousData = await getOccupancyData(
			supabase,
			tenant.id,
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
	const supabase = createSupabaseClient(c.env);
	const user = c.get('user');
	
	const { data: tenant } = await supabase
		.from('tenants')
		.select('id')
		.eq('user_id', user.id)
		.single();
	
	if (!tenant) {
		return c.json([]);
	}
	
	const startDate = from || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
	const endDate = to || new Date().toISOString().split('T')[0];
	const tagIds = tags ? tags.split(',').filter(Boolean) : [];
	
	const { getDailyOccupancyData } = await import('../services/occupancy');
	
	const dailyData = await getDailyOccupancyData(
		supabase,
		tenant.id,
		startDate,
		endDate,
		tagIds
	);
	
	return c.json(dailyData);
});

occupancy.get('/trends', cache({ ttl: 7200 }), async (c) => {
	const { propertyId, months = '12' } = c.req.query();
	const supabase = createSupabaseClient(c.env);
	const user = c.get('user');
	
	const { data: tenant } = await supabase
		.from('tenants')
		.select('id')
		.eq('user_id', user.id)
		.single();
	
	if (!tenant) {
		return c.json({ error: 'Tenant not found' }, 404);
	}
	
	const endDate = new Date();
	const startDate = new Date();
	startDate.setMonth(startDate.getMonth() - parseInt(months));
	
	let query = supabase
		.from('bookings')
		.select('arrival, departure, total_amount, property_id')
		.eq('tenant_id', tenant.id)
		.gte('arrival', startDate.toISOString())
		.lte('arrival', endDate.toISOString());
	
	if (propertyId) {
		query = query.eq('property_id', propertyId);
	}
	
	const { data: bookings } = await query;
	
	const monthlyData: Record<string, any> = {};
	
	bookings?.forEach(booking => {
		if (!booking.arrival) return;
		
		const monthKey = new Date(booking.arrival).toISOString().slice(0, 7);
		
		if (!monthlyData[monthKey]) {
			monthlyData[monthKey] = {
				bookings: 0,
				revenue: 0,
				nights: 0
			};
		}
		
		monthlyData[monthKey].bookings++;
		monthlyData[monthKey].revenue += booking.total_amount || 0;
		
		if (booking.arrival && booking.departure) {
			const nights = Math.ceil(
				(new Date(booking.departure).getTime() - new Date(booking.arrival).getTime()) / 
				(1000 * 60 * 60 * 24)
			);
			monthlyData[monthKey].nights += nights;
		}
	});
	
	const trends = Object.entries(monthlyData)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([month, data]) => {
			const daysInMonth = new Date(
				parseInt(month.split('-')[0]),
				parseInt(month.split('-')[1]),
				0
			).getDate();
			
			return {
				month,
				...data,
				occupancyRate: (data.nights / daysInMonth) * 100,
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