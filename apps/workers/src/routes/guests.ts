import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { cache } from '../middleware/cache';
import { createSupabaseClient } from '../services/supabase';

const guests = new Hono<{ Bindings: Env; Variables: { user: any } }>();

guests.use('/*', authMiddleware);

guests.get('/', cache({ ttl: 3600 }), async (c) => {
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
			guests: [],
			metrics: {
				totalGuests: 0,
				repeatGuests: 0,
				repeatRate: 0,
				avgStayLength: 0,
				avgSpend: 0,
				topSpenders: [],
				guestsBySource: [],
				tagDistribution: []
			}
		});
	}
	
	const startDate = from || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
	const endDate = to || new Date().toISOString().split('T')[0];
	const tagIds = tags ? tags.split(',').filter(Boolean) : [];
	
	const { getGuestsData } = await import('../services/guests');
	
	const currentData = await getGuestsData(
		supabase,
		tenant.id,
		startDate,
		endDate,
		tagIds
	);
	
	if (comparisonFrom && comparisonTo) {
		const previousData = await getGuestsData(
			supabase,
			tenant.id,
			comparisonFrom,
			comparisonTo,
			tagIds
		);
		
		return c.json({
			current: currentData,
			previous: previousData
		});
	}
	
	return c.json(currentData);
});

guests.get('/:guestId/detail', cache({ ttl: 1800 }), async (c) => {
	const guestId = decodeURIComponent(c.req.param('guestId'));
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
	
	const lastUnderscoreIndex = guestId.lastIndexOf('_');
	const name = guestId.substring(0, lastUnderscoreIndex);
	const email = guestId.substring(lastUnderscoreIndex + 1);
	
	let query = supabase
		.from('bookings')
		.select(`
			id,
			arrival,
			departure,
			total_amount,
			platform,
			status,
			guest_name,
			guest_email,
			guest_phone,
			property_id
		`)
		.eq('tenant_id', tenant.id)
		.neq('status', 'canceled');
	
	if (email) {
		query = query
			.ilike('guest_name', name)
			.ilike('guest_email', email);
	} else {
		query = query.ilike('guest_name', name);
	}
	
	const { data: bookings } = await query.order('arrival', { ascending: false });
	
	if (!bookings || bookings.length === 0) {
		return c.json({ error: 'Guest not found' }, 404);
	}
	
	const propertyIds = [...new Set(bookings.map(b => b.property_id))];
	const { data: properties } = await supabase
		.from('properties')
		.select('id, name')
		.in('id', propertyIds);
	
	const propertyMap = new Map<string, string>();
	properties?.forEach(p => propertyMap.set(p.id, p.name));
	
	let totalNights = 0;
	let totalRevenue = 0;
	const propertySet = new Set<string>();
	const platformSet = new Set<string>();
	
	bookings.forEach(booking => {
		totalRevenue += booking.total_amount || 0;
		propertySet.add(booking.property_id);
		platformSet.add(booking.platform || 'Direct');
		
		if (booking.arrival && booking.departure) {
			const nights = Math.ceil(
				(new Date(booking.departure).getTime() - new Date(booking.arrival).getTime()) / 
				(1000 * 60 * 60 * 24)
			);
			totalNights += nights;
		}
	});
	
	const avgNightlyRate = totalNights > 0 ? totalRevenue / totalNights : 0;
	const avgStayLength = bookings.length > 0 ? totalNights / bookings.length : 0;
	
	const monthlySpending = new Map<string, number>();
	bookings.forEach(booking => {
		const month = booking.arrival.substring(0, 7);
		monthlySpending.set(month, (monthlySpending.get(month) || 0) + (booking.total_amount || 0));
	});
	
	const spendingTrend = Array.from(monthlySpending.entries())
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([month, amount]) => ({
			month,
			amount
		}));
	
	return c.json({
		guest: {
			id: guestId,
			name: bookings[0].guest_name,
			email: bookings[0].guest_email,
			phone: bookings[0].guest_phone,
			totalBookings: bookings.length,
			totalSpent: totalRevenue,
			avgStayLength,
			avgNightlyRate,
			properties: Array.from(propertySet).map(id => ({
				id,
				name: propertyMap.get(id) || 'Unknown Property'
			})),
			platforms: Array.from(platformSet),
			firstBooking: bookings[bookings.length - 1].arrival,
			lastBooking: bookings[0].arrival
		},
		bookings: bookings.map(b => ({
			id: b.id,
			arrival: b.arrival,
			departure: b.departure,
			propertyId: b.property_id,
			propertyName: propertyMap.get(b.property_id) || 'Unknown Property',
			totalAmount: b.total_amount,
			platform: b.platform || 'Direct',
			status: b.status,
			nights: b.arrival && b.departure ? Math.ceil(
				(new Date(b.departure).getTime() - new Date(b.arrival).getTime()) / 
				(1000 * 60 * 60 * 24)
			) : 0
		})),
		spendingTrend
	});
});

export { guests };