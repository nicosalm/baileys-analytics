import { Hono } from 'hono';

import { authMiddleware } from '../middleware/auth';
import { createSupabaseClient } from '../services/supabase';
import { normalizePlatform } from '../utils/platform';
import { csvEscape } from '../utils/csv';
import type { AppEnv } from '../types';

const tax = new Hono<AppEnv>();

tax.use('/*', authMiddleware);

tax.get('/export', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');
	const from = c.req.query('from');
	const to = c.req.query('to');

	if (!from || !to) {
		return c.json({ error: 'Date range (from, to) required' }, 400);
	}

	// Get all bookings with tax charges in date range
	const { data: bookings } = await supabase
		.from('bookings')
		.select(`
			id,
			ownerrez_booking_id,
			arrival,
			departure,
			platform,
			total_amount,
			properties!inner(id, name),
			booking_charges(amount, type, description)
		`)
		.eq('tenant_id', tenantId)
		.gte('arrival', from)
		.lte('arrival', to)
		.neq('status', 'canceled')
		.order('arrival');

	if (!bookings) {
		return c.json({ error: 'No bookings found' }, 404);
	}

	// Build CSV
	const headers = [
		'Property',
		'Check-in Date',
		'Check-out Date',
		'Platform',
		'Booking Total',
		'Taxes Collected',
		'Tax Description'
	];

	const rows = bookings.flatMap((booking: any) => {
		const taxCharges = booking.booking_charges?.filter((c: any) => c.type === 'tax') || [];

		if (taxCharges.length === 0) {
			return [{
				property: booking.properties.name,
				checkin: booking.arrival,
				checkout: booking.departure,
				platform: normalizePlatform(booking.platform),
				total: booking.total_amount || 0,
				taxes: 0,
				description: 'No taxes recorded'
			}];
		}

		return taxCharges.map((charge: any) => ({
			property: booking.properties.name,
			checkin: booking.arrival,
			checkout: booking.departure,
			platform: normalizePlatform(booking.platform),
			total: booking.total_amount || 0,
			taxes: charge.amount || 0,
			description: charge.description || 'Tax'
		}));
	});

	// Calculate totals
	const totalRevenue = bookings.reduce((sum: number, b: any) => sum + (b.total_amount || 0), 0);
	const totalTaxes = rows.reduce((sum: number, r: any) => sum + (r.taxes || 0), 0);

	// Add summary rows
	rows.push({
		property: '',
		checkin: '',
		checkout: '',
		platform: '',
		total: '',
		taxes: '',
		description: ''
	});
	rows.push({
		property: 'TOTAL',
		checkin: '',
		checkout: '',
		platform: '',
		total: totalRevenue,
		taxes: totalTaxes,
		description: `Effective Rate: ${totalRevenue > 0 ? ((totalTaxes / totalRevenue) * 100).toFixed(2) : 0}%`
	});

	// Generate CSV — every cell is routed through csvEscape which handles
	// both standard rfc4180 quoting and formula injection defense.
	const csvLines = [
		headers.join(','),
		...rows.map(row =>
			[
				csvEscape(row.property),
				csvEscape(row.checkin),
				csvEscape(row.checkout),
				csvEscape(row.platform),
				csvEscape(row.total),
				csvEscape(row.taxes),
				csvEscape(row.description)
			].join(',')
		)
	];

	const csv = csvLines.join('\n');

	return c.text(csv, 200, {
		'Content-Type': 'text/csv',
		'Content-Disposition': `attachment; filename="tax-report-${from}-to-${to}.csv"`
	});
});

export { tax };