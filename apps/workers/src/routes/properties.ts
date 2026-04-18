import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { createSupabaseClient } from '../services/supabase';
import { prorateBooking, isArrivalInPeriod } from '../utils/prorate';

const properties = new Hono<{ Bindings: Env; Variables: { user: any; tenantId: string } }>();

properties.use('/*', authMiddleware);

properties.get('/metrics', async (c) => {
	const { from, to, tags, comparisonFrom, comparisonTo, filterPropertyIds: filterPropParam } = c.req.query();
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');

	if (!tenantId) {
		return c.json({ error: 'Tenant not found' }, 404);
	}

	const { MetricsService } = await import('../services/metrics');
	const metricsService = new MetricsService(supabase);

	const fromDate = from || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
	const toDate = to || new Date().toISOString().split('T')[0];
	const tagIds = tags?.split(',').filter(Boolean);
	const propertyIds = filterPropParam?.split(',').filter(Boolean);

	if (comparisonFrom && comparisonTo) {
		const metrics = await metricsService.calculateComparativeMetrics(
			tenantId,
			fromDate,
			toDate,
			comparisonFrom,
			comparisonTo
		);
		return c.json({ metrics, comparison: true });
	}

	const metrics = await metricsService.calculatePropertyMetrics(
		tenantId,
		fromDate,
		toDate,
		undefined,
		tagIds,
		propertyIds
	);

	return c.json({ metrics });
});

properties.get('/', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');

	if (!tenantId) {
		return c.json({ error: 'Tenant not found' }, 404);
	}

	const { data: properties, error } = await supabase
		.from('properties')
		.select('*')
		.eq('tenant_id', tenantId)
		.order('name');
	
	if (error) {
		return c.json({ error: error.message }, 500);
	}
	
	return c.json({ properties: properties || [] });
});

properties.get('/:id', async (c) => {
	const propertyId = c.req.param('id');
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');

	if (!tenantId) {
		return c.json({ error: 'Tenant not found' }, 404);
	}

	const { data: property, error } = await supabase
		.from('properties')
		.select('*')
		.eq('id', propertyId)
		.eq('tenant_id', tenantId)
		.single();
	
	if (error || !property) {
		return c.json({ error: 'Property not found' }, 404);
	}
	
	return c.json(property);
});

properties.get('/:id/metrics', async (c) => {
	const propertyId = c.req.param('id');
	const { from, to } = c.req.query();
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');

	if (!tenantId) {
		return c.json({ error: 'Tenant not found' }, 404);
	}
	
	const { MetricsService } = await import('../services/metrics');
	const metricsService = new MetricsService(supabase);
	
	const fromDate = from || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
	const toDate = to || new Date().toISOString().split('T')[0];
	
	const metrics = await metricsService.calculatePropertyMetrics(
		tenantId,
		fromDate,
		toDate,
		propertyId
	);
	
	return c.json(metrics[0] || {
		propertyId,
		propertyName: '',
		revenue: 0,
		bookings: 0,
		occupancyRate: 0,
		avgNightlyRate: 0,
		avgStayLength: 0,
		bookedNights: 0,
		availableNights: 0
	});
});

properties.get('/:propertyId/month/:year/:month', async (c) => {
	const propertyId = c.req.param('propertyId');
	const year = c.req.param('year');
	const month = c.req.param('month');
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');

	if (!tenantId) {
		return c.json({ error: 'Tenant not found' }, 404);
	}
	
	const monthPadded = month.padStart(2, '0');
	const yearInt = parseInt(year);
	const monthInt = parseInt(month);
	
	const startDate = `${year}-${monthPadded}-01`;
	const lastDay = new Date(yearInt, monthInt, 0).getDate();
	const endDate = `${year}-${monthPadded}-${lastDay.toString().padStart(2, '0')}`;
	
	const { data: property } = await supabase
		.from('properties')
		.select('id, name')
		.eq('id', propertyId)
		.eq('tenant_id', tenantId)
		.single();
	
	if (!property) {
		return c.json({ error: 'Property not found' }, 404);
	}
	
	const { data: bookings } = await supabase
		.from('bookings')
		.select(`
			id,
			guest_name,
			arrival,
			departure,
			total_amount,
			status,
			booking_charges!inner(
				amount,
				type
			)
		`)
		.eq('property_id', propertyId)
		.eq('tenant_id', tenantId)
		.lte('arrival', endDate)
		.gt('departure', startDate)
		.neq('status', 'canceled');
	
	let summary = {
		revenue: 0,
		tax: 0,
		bookings: 0,
		nights: 0,
		avgNightlyRate: 0
	};
	
	const detailedBookings = [];
	
	if (bookings) {
		for (const booking of bookings) {
			const pr = prorateBooking(booking, startDate, endDate);

			// full booking tax, attributed only to the period containing the arrival
			const taxRaw = booking.booking_charges
				?.filter((c: any) => c.type === 'tax')
				.reduce((sum: number, c: any) => sum + (c.amount || 0), 0) || 0;
			const taxAmount = isArrivalInPeriod(booking, startDate, endDate) ? taxRaw : 0;

			summary.revenue += pr.revenue;
			summary.tax += taxAmount;
			summary.bookings++;
			summary.nights += pr.overlapNights;

			detailedBookings.push({
				id: booking.id,
				guestName: booking.guest_name,
				arrival: booking.arrival,
				departure: booking.departure,
				nights: pr.overlapNights,
				totalAmount: pr.revenue,
				fullBookingAmount: booking.total_amount,
				taxAmount,
				status: booking.status
			});
		}
		
		if (summary.nights > 0) {
			summary.avgNightlyRate = summary.revenue / summary.nights;
		}
	}
	
	return c.json({
		property: {
			id: property.id,
			name: property.name
		},
		summary,
		bookings: detailedBookings
	});
});

export { properties };