import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { createSupabaseClient } from '../services/supabase';

const bookings = new Hono<{ Bindings: Env; Variables: { user: any; tenantId: string } }>();

bookings.use('/*', authMiddleware);

bookings.get('/', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');
	const { limit = '50', offset = '0', propertyId, startDate, endDate } = c.req.query();

	if (!tenantId) {
		return c.json({ error: 'Tenant not found' }, 404);
	}
	
	let query = supabase
		.from('bookings')
		.select(`
			*,
			properties!inner(name)
		`)
		.eq('tenant_id', tenantId)
		.order('arrival', { ascending: false })
		.limit(parseInt(limit))
		.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
	
	if (propertyId) {
		query = query.eq('property_id', propertyId);
	}
	
	if (startDate) {
		query = query.gte('arrival', startDate);
	}
	
	if (endDate) {
		query = query.lte('departure', endDate);
	}
	
	const { data: bookings, error } = await query;
	
	if (error) {
		return c.json({ error: error.message }, 500);
	}
	
	return c.json(bookings?.map(b => ({
		...b,
		property_name: b.properties?.name
	})));
});

bookings.get('/:id', async (c) => {
	const bookingId = c.req.param('id');
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');

	if (!tenantId) {
		return c.json({ error: 'Tenant not found' }, 404);
	}
	
	const [bookingResult, chargesResult, tagsResult] = await Promise.all([
		supabase
			.from('bookings')
			.select(`
				*,
				properties!inner(name, address, bedrooms, bathrooms, max_guests)
			`)
			.eq('id', bookingId)
			.eq('tenant_id', tenantId)
			.single(),
		supabase
			.from('booking_charges')
			.select('*')
			.eq('booking_id', bookingId)
			.order('charge_date'),
		supabase
			.from('booking_tags')
			.select(`
				tag_id,
				tags!inner(name, color)
			`)
			.eq('booking_id', bookingId)
	]);
	
	if (bookingResult.error || !bookingResult.data) {
		return c.json({ error: 'Booking not found' }, 404);
	}
	
	const booking = bookingResult.data;
	const nights = booking.arrival && booking.departure
		? Math.ceil((new Date(booking.departure).getTime() - new Date(booking.arrival).getTime()) / (1000 * 60 * 60 * 24))
		: 0;
	
	const avgNightlyRate = nights > 0 ? (booking.total_amount || 0) / nights : 0;
	
	return c.json({
		booking: {
			...booking,
			property_name: booking.properties?.name,
			property_address: booking.properties?.address,
			property_bedrooms: booking.properties?.bedrooms,
			property_bathrooms: booking.properties?.bathrooms,
			property_max_guests: booking.properties?.max_guests,
			nights,
			avgNightlyRate
		},
		charges: chargesResult.data || [],
		tags: tagsResult.data?.map((t: any) => ({
			id: t.tag_id,
			name: t.tags?.name,
			color: t.tags?.color
		})) || []
	});
});

bookings.get('/recent', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');

	if (!tenantId) {
		return c.json({ error: 'Tenant not found' }, 404);
	}
	
	const { data: recentBookings, error } = await supabase
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
	
	if (error) {
		return c.json({ error: error.message }, 500);
	}
	
	return c.json(recentBookings?.map((b: any) => ({
		...b,
		property_name: b.properties?.name
	})));
});

export { bookings };