import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { createSupabaseClient } from '../services/supabase';
import type { AppEnv } from '../types';

const bookings = new Hono<AppEnv>();

bookings.use('/*', authMiddleware);

// max rows per /bookings request. the frontend useBookingsForRange hook
// currently asks for 1000 at a time; anything above that is rejected so a
// malicious client cannot ask for millions of rows and exhaust the worker.
const BOOKINGS_MAX_LIMIT = 1000;
const BOOKINGS_DEFAULT_LIMIT = 50;
const BOOKINGS_MAX_OFFSET = 100000;

bookings.get('/', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');
	const { limit: limitParam, offset: offsetParam, propertyId, startDate, endDate } = c.req.query();

	if (!tenantId) {
		return c.json({ error: 'Tenant not found' }, 404);
	}

	// clamp pagination params: non-numeric or out-of-range values fall back to
	// the defaults rather than NaN (which supabase-js would forward as undefined).
	const rawLimit = Number.parseInt(limitParam ?? '', 10);
	const limit = Number.isFinite(rawLimit) && rawLimit > 0
		? Math.min(rawLimit, BOOKINGS_MAX_LIMIT)
		: BOOKINGS_DEFAULT_LIMIT;

	const rawOffset = Number.parseInt(offsetParam ?? '', 10);
	const offset = Number.isFinite(rawOffset) && rawOffset >= 0
		? Math.min(rawOffset, BOOKINGS_MAX_OFFSET)
		: 0;

	let query = supabase
		.from('bookings')
		.select(`
			*,
			properties!inner(name)
		`)
		.eq('tenant_id', tenantId)
		.order('arrival', { ascending: false })
		.limit(limit)
		.range(offset, offset + limit - 1);
	
	if (propertyId) {
		query = query.eq('property_id', propertyId);
	}
	
	if (startDate && endDate) {
		// Overlap logic: booking touches range if arrival <= endDate AND departure >= startDate
		query = query.lte('arrival', endDate).gte('departure', startDate);
	} else if (startDate) {
		query = query.gte('arrival', startDate);
	} else if (endDate) {
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

bookings.get('/earliest-date', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');

	const { data, error } = await supabase
		.from('bookings')
		.select('arrival')
		.eq('tenant_id', tenantId)
		.neq('status', 'canceled')
		.order('arrival', { ascending: true })
		.limit(1)
		.single();

	if (error || !data) {
		return c.json({ earliestDate: null });
	}

	return c.json({ earliestDate: data.arrival });
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
				properties!inner(name, address, bedrooms, bathrooms, max_guests),
				guests(id, email, phone)
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

	const guestContact = (booking as any).guests;
	let guestTags: { id: string; name: string; color?: string }[] = [];
	if (guestContact?.id) {
		const { data: guestTagRows } = await supabase
			.from('guest_tags')
			.select('tag_id, tags!inner(name, color)')
			.eq('guest_id', guestContact.id);
		guestTags = (guestTagRows || []).map((t: any) => ({
			id: t.tag_id,
			name: t.tags?.name,
			color: t.tags?.color
		}));
	}

	return c.json({
		booking: {
			...booking,
			guest_email: guestContact?.email || booking.guest_email || null,
			guest_phone: guestContact?.phone || booking.guest_phone || null,
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
		})) || [],
		guestTags
	});
});

export { bookings };