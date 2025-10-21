import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { createSupabaseClient } from '../services/supabase';

const platformFees = new Hono<{ Bindings: Env; Variables: { user: any } }>();

platformFees.use('/*', authMiddleware);

const bulkFeeSchema = z.object({
	year: z.number().int().min(2020).max(2100),
	month: z.number().int().min(1).max(12),
	fees: z.array(z.object({
		platform: z.string().min(1).max(50),
		amount: z.number().min(0),
		notes: z.string().optional()
	}))
});

const bookingFeeSchema = z.object({
	booking_id: z.string().uuid(),
	platform: z.string().min(1).max(50),
	amount: z.number().min(0),
	notes: z.string().optional()
});

platformFees.post('/bulk', async (c) => {
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

	const body = await c.req.json();
	const validation = bulkFeeSchema.safeParse(body);

	if (!validation.success) {
		return c.json({
			error: 'Invalid input',
			details: validation.error.issues
		}, 400);
	}

	const { year, month, fees } = validation.data;

	await supabase
		.from('platform_guest_fees')
		.delete()
		.eq('tenant_id', tenant.id)
		.eq('year', year)
		.eq('month', month)
		.is('booking_id', null);

	const entries = fees.map(fee => ({
		tenant_id: tenant.id,
		platform: fee.platform,
		amount: fee.amount,
		year,
		month,
		notes: fee.notes || null,
		booking_id: null
	}));

	const { data, error } = await supabase
		.from('platform_guest_fees')
		.insert(entries)
		.select();

	if (error) {
		console.error('Failed to save platform fees:', error);
		return c.json({ error: 'Failed to save platform fees' }, 500);
	}

	return c.json({ success: true, data });
});

const singleFeeSchema = z.object({
	propertyId: z.string().optional(),
	platform: z.string().min(1).max(50),
	month: z.string().regex(/^\d{4}-\d{2}$/), // "2025-10"
	feeAmount: z.number().min(0),
	platformTaxRemitted: z.number().min(0).optional(),
	notes: z.string().optional()
});

platformFees.post('/', async (c) => {
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

	const body = await c.req.json();
	const validation = singleFeeSchema.safeParse(body);

	if (!validation.success) {
		return c.json({
			error: 'Invalid input',
			details: validation.error.issues
		}, 400);
	}

	const { platform, month, feeAmount, platformTaxRemitted, notes } = validation.data;
	const [year, monthNum] = month.split('-');

	await supabase
		.from('platform_guest_fees')
		.delete()
		.eq('tenant_id', tenant.id)
		.eq('platform', platform)
		.eq('year', parseInt(year))
		.eq('month', parseInt(monthNum))
		.is('booking_id', null);

	const { data, error } = await supabase
		.from('platform_guest_fees')
		.insert({
			tenant_id: tenant.id,
			platform,
			amount: feeAmount,
			year: parseInt(year),
			month: parseInt(monthNum),
			notes: notes || null,
			booking_id: null
		})
		.select()
		.single();

	if (error) {
		console.error('Failed to save platform fee:', error);
		return c.json({ error: 'Failed to save platform fee' }, 500);
	}

	return c.json({ success: true, data });
});

platformFees.post('/booking', async (c) => {
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

	const body = await c.req.json();
	const validation = bookingFeeSchema.safeParse(body);

	if (!validation.success) {
		return c.json({
			error: 'Invalid input',
			details: validation.error.issues
		}, 400);
	}

	const { booking_id, platform, amount, notes } = validation.data;

	const { data: booking } = await supabase
		.from('bookings')
		.select('id')
		.eq('id', booking_id)
		.eq('tenant_id', tenant.id)
		.single();

	if (!booking) {
		return c.json({ error: 'Booking not found' }, 404);
	}

	await supabase
		.from('platform_guest_fees')
		.delete()
		.eq('booking_id', booking_id);

	const { data, error } = await supabase
		.from('platform_guest_fees')
		.insert({
			tenant_id: tenant.id,
			booking_id,
			platform,
			amount,
			notes: notes || null,
			year: null,
			month: null
		})
		.select()
		.single();

	if (error) {
		console.error('Failed to save booking fee:', error);
		return c.json({ error: 'Failed to save booking fee' }, 500);
	}

	return c.json({ success: true, data });
});

platformFees.get('/', async (c) => {
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

	const yearParam = c.req.query('year');
	const monthParam = c.req.query('month'); // could be "10" or "2025-10"
	const bookingId = c.req.query('booking_id');
	const propertyId = c.req.query('property');

	let query = supabase
		.from('platform_guest_fees')
		.select('*')
		.eq('tenant_id', tenant.id);

	if (bookingId) {
		query = query.eq('booking_id', bookingId);
	} else if (monthParam) {
		// support both "YYYY-MM" format and separate year/month params
		if (monthParam.includes('-')) {
			const [year, month] = monthParam.split('-');
			query = query
				.eq('year', parseInt(year))
				.eq('month', parseInt(month))
				.is('booking_id', null);
		} else if (yearParam) {
			query = query
				.eq('year', parseInt(yearParam))
				.eq('month', parseInt(monthParam))
				.is('booking_id', null);
		}
	}

	const { data, error } = await query.order('created_at', { ascending: false });

	if (error) {
		console.error('Failed to fetch platform fees:', error);
		return c.json({ error: 'Failed to fetch platform fees' }, 500);
	}

	return c.json({ success: true, data });
});

platformFees.delete('/:id', async (c) => {
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

	const id = c.req.param('id');

	const { error } = await supabase
		.from('platform_guest_fees')
		.delete()
		.eq('id', id)
		.eq('tenant_id', tenant.id);

	if (error) {
		console.error('Failed to delete platform fee:', error);
		return c.json({ error: 'Failed to delete platform fee' }, 500);
	}

	return c.json({ success: true });
});

export { platformFees };
