import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { createSupabaseClient } from '../services/supabase';
import { normalizePlatform } from '../utils/platform';

const financial = new Hono<{ Bindings: Env; Variables: { user: any; tenantId: string } }>();

financial.use('/*', authMiddleware);

financial.get('/charges-export', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');
	const from = c.req.query('from');
	const to = c.req.query('to');

	if (!from || !to) {
		return c.json({ error: 'Date range (from, to) required' }, 400);
	}

	const { data: bookings } = await supabase
		.from('bookings')
		.select(`
			id,
			arrival,
			departure,
			platform,
			guest_name,
			properties!inner(id, name),
			booking_charges(type, description, amount, is_taxable)
		`)
		.eq('tenant_id', tenantId)
		.gte('arrival', from)
		.lte('arrival', to)
		.neq('status', 'canceled')
		.order('arrival');

	const headers = [
		'Guest Name',
		'Property',
		'Platform',
		'Arrival',
		'Departure',
		'Charge Type',
		'Description',
		'Amount',
		'Is Taxable'
	];

	const rows = (bookings || []).flatMap((booking: any) => {
		const charges = booking.booking_charges || [];
		if (charges.length === 0) return [];

		return charges.map((charge: any) => [
			`"${(booking.guest_name || 'Unknown').replace(/"/g, '""')}"`,
			`"${booking.properties.name.replace(/"/g, '""')}"`,
			`"${normalizePlatform(booking.platform)}"`,
			booking.arrival,
			booking.departure,
			charge.type || '',
			`"${(charge.description || '').replace(/"/g, '""')}"`,
			charge.amount || 0,
			charge.is_taxable ? 'Yes' : 'No'
		].join(','));
	});

	const csv = [headers.join(','), ...rows].join('\n');

	return c.text(csv, 200, {
		'Content-Type': 'text/csv',
		'Content-Disposition': `attachment; filename="charge-composition-${from}-to-${to}.csv"`
	});
});

export { financial };