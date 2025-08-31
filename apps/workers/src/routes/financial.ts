import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { createSupabaseClient } from '../services/supabase';

const financial = new Hono<{ Bindings: Env; Variables: { user: any } }>();

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
		.select('total_amount, arrival, platform')
		.eq('tenant_id', tenant.id)
		.gte('arrival', startDate)
		.lte('arrival', endDate)
		.neq('status', 'canceled');
	
	const totalRevenue = bookings?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;
	const platformFees = totalRevenue * 0.03;
	const tax = totalRevenue * 0.08;
	
	const metrics = {
		revenue: totalRevenue,
		expenses: platformFees,
		tax: tax,
		netIncome: totalRevenue - platformFees - tax
	};
	
	if (comparisonFrom && comparisonTo) {
		const { data: compBookings } = await supabase
			.from('bookings')
			.select('total_amount')
			.eq('tenant_id', tenant.id)
			.gte('arrival', comparisonFrom)
			.lte('arrival', comparisonTo)
			.neq('status', 'canceled');
		
		const compRevenue = compBookings?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;
		const compFees = compRevenue * 0.03;
		const compTax = compRevenue * 0.08;
		
		return c.json({
			pl: {
				metrics,
				previous: {
					revenue: compRevenue,
					expenses: compFees,
					tax: compTax,
					netIncome: compRevenue - compFees - compTax
				}
			}
		});
	}
	
	return c.json({
		pl: {
			metrics
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

financial.get('/platform-fees', async (c) => {
	const { startDate, endDate } = c.req.query();
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
		.from('platform_fee_entries')
		.select('*')
		.eq('tenant_id', tenant.id)
		.order('date', { ascending: false });
	
	if (startDate) {
		query = query.gte('date', startDate);
	}
	
	if (endDate) {
		query = query.lte('date', endDate);
	}
	
	const { data: fees } = await query;
	
	const totalFees = fees?.reduce((sum, f) => sum + (f.amount || 0), 0) || 0;
	const feesByPlatform: Record<string, number> = {};
	
	fees?.forEach(fee => {
		if (fee.platform) {
			feesByPlatform[fee.platform] = (feesByPlatform[fee.platform] || 0) + (fee.amount || 0);
		}
	});
	
	return c.json({
		totalFees,
		feeCount: fees?.length || 0,
		feesByPlatform,
		fees: fees || []
	});
});

export { financial };