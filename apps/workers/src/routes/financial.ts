import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { createSupabaseClient } from '../services/supabase';
import { normalizePlatform } from '../utils/platform';

const financial = new Hono<{ Bindings: Env; Variables: { user: any; tenantId: string } }>();

financial.use('/*', authMiddleware);

financial.get('/', async (c) => {
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
			pl: {
				metrics: {
					revenue: 0,
					expenses: 0,
					tax: 0,
					netIncome: 0
				}
			}
		});
	}
	
	const startDate = from || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
	const endDate = to || new Date().toISOString().split('T')[0];
	
	const { data: bookings } = await supabase
		.from('bookings')
		.select('total_amount, arrival, platform, guest_listing_site_fee, host_service_fee')
		.eq('tenant_id', tenant.id)
		.gte('arrival', startDate)
		.lte('arrival', endDate)
		.neq('status', 'canceled');

	const totalRevenue = bookings?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;
	const guestFees = bookings?.reduce((s, b) => s + (b.guest_listing_site_fee || 0), 0) || 0;
	const hostFees = bookings?.reduce((s, b) => s + (b.host_service_fee || 0), 0) || 0;
	const tax = totalRevenue * 0.08;

	const metrics = {
		revenue: totalRevenue,
		expenses: hostFees,
		tax: tax,
		netIncome: totalRevenue - hostFees - tax
	};

	const feesBreakdown = { guestFees, hostFees, guestFeesEstimated: true };

	if (comparisonFrom && comparisonTo) {
		const { data: compBookings } = await supabase
			.from('bookings')
			.select('total_amount, guest_listing_site_fee, host_service_fee')
			.eq('tenant_id', tenant.id)
			.gte('arrival', comparisonFrom)
			.lte('arrival', comparisonTo)
			.neq('status', 'canceled');

		const compRevenue = compBookings?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;
		const compHostFees = compBookings?.reduce((s, b) => s + (b.host_service_fee || 0), 0) || 0;
		const compTax = compRevenue * 0.08;

		return c.json({
			pl: {
				metrics,
				feesBreakdown,
				previous: {
					revenue: compRevenue,
					expenses: compHostFees,
					tax: compTax,
					netIncome: compRevenue - compHostFees - compTax
				}
			}
		});
	}

	return c.json({
		pl: {
			metrics,
			feesBreakdown
		}
	});
});

financial.get('/overview', async (c) => {
	const { year = new Date().getFullYear().toString(), propertyId } = c.req.query();
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
	
	let query = supabase
		.from('bookings')
		.select('total_amount, arrival, departure, property_id')
		.eq('tenant_id', tenant.id)
		.gte('arrival', `${year}-01-01`)
		.lte('arrival', `${year}-12-31`);
	
	if (propertyId) {
		query = query.eq('property_id', propertyId);
	}
	
	const { data: bookings } = await query;
	
	const monthlyRevenue: Record<string, number> = {};
	const propertyRevenue: Record<string, number> = {};
	let totalRevenue = 0;
	
	bookings?.forEach(booking => {
		const amount = booking.total_amount || 0;
		totalRevenue += amount;
		
		const month = new Date(booking.arrival).toISOString().slice(0, 7);
		monthlyRevenue[month] = (monthlyRevenue[month] || 0) + amount;
		
		if (booking.property_id) {
			propertyRevenue[booking.property_id] = (propertyRevenue[booking.property_id] || 0) + amount;
		}
	});
	
	const averageBookingValue = bookings?.length ? totalRevenue / bookings.length : 0;
	const monthlyAverage = totalRevenue / 12;
	
	return c.json({
		year: parseInt(year),
		totalRevenue,
		totalBookings: bookings?.length || 0,
		averageBookingValue,
		monthlyAverage,
		monthlyRevenue,
		propertyRevenue
	});
});

financial.get('/tax-summary', async (c) => {
	const { year = new Date().getFullYear().toString(), quarter, propertyId } = c.req.query();
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
	
	const { TaxService } = await import('../services/tax');
	const taxService = new TaxService(supabase);
	
	const taxData = await taxService.calculateTaxes(
		tenant.id,
		parseInt(year),
		quarter ? parseInt(quarter) : undefined,
		propertyId
	);
	
	return c.json(taxData);
});

financial.get('/tax-remittance', async (c) => {
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
	
	const { TaxService } = await import('../services/tax');
	const taxService = new TaxService(supabase);
	
	const schedule = await taxService.getRemittanceSchedule(tenant.id);
	
	return c.json({ schedule });
});

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