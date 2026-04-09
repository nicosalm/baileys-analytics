import { Hono } from 'hono';
import { z } from 'zod';

import { authMiddleware } from '../middleware/auth';
import { createSupabaseClient } from '../services/supabase';
import { normalizePlatform } from '../utils/platform';
import { csvEscape } from '../utils/csv';
import { TaxCalculator } from '../services/tax-calculator';

const tax = new Hono<{ Bindings: Env; Variables: { user: any; tenantId: string } }>();

tax.use('/*', authMiddleware);

tax.get('/status', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');
	
	const { data: properties } = await supabase
		.from('properties')
		.select('id, name')
		.eq('tenant_id', tenantId)
		.eq('active', true)
		.order('name');
	
	if (!properties) {
		return c.json([]);
	}
	
	const propertyStatuses = await Promise.all(
		properties.map(async (property) => {
			const { data: config } = await supabase
				.from('property_tax_configs')
				.select('*')
				.eq('property_id', property.id)
				.eq('tenant_id', tenantId)
				.eq('is_active', true)
				.single();
			
			return {
				propertyId: property.id,
				propertyName: property.name,
				hasConfig: !!config,
				totalRate: config?.jurisdictions?.reduce((sum: number, j: any) => sum + (j.rate || 0), 0) || 0
			};
		})
	);
	
	return c.json(propertyStatuses);
});

tax.get('/configs', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');
	const propertyId = c.req.query('propertyId');
	
	let query = supabase
		.from('property_tax_configs')
		.select('*')
		.eq('tenant_id', tenantId)
		.order('created_at', { ascending: false });
	
	if (propertyId) {
		query = query.eq('property_id', propertyId);
	}
	
	const { data, error } = await query;
	
	if (error) {
		return c.json({ error: error.message }, 500);
	}
	
	return c.json(data || []);
});

tax.post('/configs', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');
	const body = await c.req.json();
	
	if (body.jurisdictions) {
		const jurisdictionSchema = z.array(z.object({
			name: z.string().min(1),
			rate: z.number().min(0).max(100),
			description: z.string().optional(),
			ownerrezPattern: z.string().optional()
		}));
		const jurisdictionValidation = jurisdictionSchema.safeParse(body.jurisdictions);
		if (!jurisdictionValidation.success) {
			return c.json({ 
				error: 'Invalid jurisdictions: ' + jurisdictionValidation.error.issues.map((e: any) => e.message).join(', ')
			}, 400);
		}
	}
	
	// deduplicate config name if needed
	const { data: existing } = await supabase
		.from('property_tax_configs')
		.select('config_name')
		.eq('property_id', body.propertyId)
		.eq('tenant_id', tenantId);

	let configName = body.configName || 'Default Configuration';
	const existingNames = existing?.map((e: { config_name: string }) => e.config_name) || [];
	if (existingNames.includes(configName)) {
		const timestamp = new Date().toISOString().split('T')[0];
		configName = `${configName} - ${timestamp}`;
	}

	// atomic deactivate + insert via RPC
	const { data: newId, error } = await supabase.rpc('replace_active_tax_config', {
		p_tenant_id: tenantId,
		p_property_id: body.propertyId,
		p_config_name: configName,
		p_jurisdictions: body.jurisdictions || [],
		p_platform_settings: body.platformSettings || {},
		p_effective_from: body.effectiveFrom || new Date().toISOString()
	});

	if (error) {
		return c.json({ error: error.message }, 500);
	}

	// fetch the newly created config
	const { data } = await supabase
		.from('property_tax_configs')
		.select('*')
		.eq('id', newId)
		.single();

	return c.json(data, 201);
});

tax.put('/configs/:id', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');
	const configId = c.req.param('id');
	const body = await c.req.json();
	
	if (body.jurisdictions) {
		const jurisdictionSchema = z.array(z.object({
			name: z.string().min(1),
			rate: z.number().min(0).max(100),
			description: z.string().optional(),
			ownerrezPattern: z.string().optional()
		}));
		const jurisdictionValidation = jurisdictionSchema.safeParse(body.jurisdictions);
		if (!jurisdictionValidation.success) {
			return c.json({ 
				error: 'Invalid jurisdictions: ' + jurisdictionValidation.error.issues.map((e: any) => e.message).join(', ')
			}, 400);
		}
	}
	
	const { data, error } = await supabase
		.from('property_tax_configs')
		.update({
			config_name: body.configName,
			jurisdictions: body.jurisdictions,
			platform_settings: body.platformSettings,
			effective_from: body.effectiveFrom,
			is_active: body.isActive,
			updated_at: new Date().toISOString()
		})
		.eq('id', configId)
		.eq('tenant_id', tenantId)
		.select()
		.single();
	
	if (error) {
		return c.json({ error: error.message }, 500);
	}
	
	if (!data) {
		return c.json({ error: 'Configuration not found' }, 404);
	}
	
	return c.json(data);
});

tax.delete('/configs/:id', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');
	const configId = c.req.param('id');
	
	const { error } = await supabase
		.from('property_tax_configs')
		.delete()
		.eq('id', configId)
		.eq('tenant_id', tenantId);
	
	if (error) {
		return c.json({ error: error.message }, 500);
	}
	
	return c.json({ success: true });
});

tax.get('/jurisdictions', async (c) => {
	return c.json({
		status: 'success',
		data: {
			types: ['state', 'county', 'city', 'district'],
			suggestions: {
				state: { name: 'State Tax', rate: 6.0 },
				county: { name: 'County Tax', rate: 1.0 },
				city: { name: 'City Tax', rate: 1.5 },
				district: { name: 'Special District', rate: 0.5 }
			}
		}
	});
});

tax.get('/platforms', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');
	const propertyId = c.req.query('propertyId');
	
	if (!propertyId) {
		return c.json({ error: 'Property ID required' }, 400);
	}
	
	const { data, error } = await supabase
		.from('bookings')
		.select('platform')
		.eq('tenant_id', tenantId)
		.eq('property_id', propertyId)
		.not('platform', 'is', null);
	
	if (error) {
		console.error('Error fetching platforms:', error);
		return c.json({ 
			error: error.message
		}, 500);
	}
	
	const platformSet = new Set<string>();
	data?.forEach(b => {
		if (b.platform) {
			platformSet.add(b.platform);
		}
	});
	
	const platforms = Array.from(platformSet).sort();
	
	return c.json(platforms);
});

tax.get('/auto-detect', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');
	const propertyId = c.req.query('propertyId');
	
	if (!propertyId) {
		return c.json({ error: 'Property ID required' }, 400);
	}
	
	const sixMonthsAgo = new Date();
	sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
	
	const { data: taxCharges } = await supabase
		.from('booking_charges')
		.select(`
			description,
			amount,
			booking_id,
			bookings!inner(
				total_amount,
				property_id,
				tenant_id,
				arrival,
				status
			)
		`)
		.eq('type', 'tax')
		.eq('bookings.property_id', propertyId)
		.eq('bookings.tenant_id', tenantId)
		.gte('bookings.arrival', sixMonthsAgo.toISOString())
		.neq('bookings.status', 'canceled')
		.not('description', 'is', null)
		.neq('description', '');
	
	if (!taxCharges || taxCharges.length === 0) {
		return c.json({
			jurisdictions: [],
			message: 'No tax data found. Import more bookings to enable auto-detection.'
		});
	}
	
	const taxGroups = new Map();
	
	taxCharges.forEach((charge: any) => {
		const description = charge.description;
		const amount = charge.amount;
		const bookingTotal = charge.bookings.total_amount;
		
		if (!taxGroups.has(description)) {
			taxGroups.set(description, {
				name: description,
				totalAmount: 0,
				totalBookingAmount: 0,
				count: 0
			});
		}
		
		const group = taxGroups.get(description);
		group.totalAmount += amount;
		group.totalBookingAmount += bookingTotal;
		group.count++;
	});
	
	const jurisdictions = Array.from(taxGroups.values()).map((group: any) => {
		const avgRate = (group.totalAmount / group.totalBookingAmount) * 100;

		return {
			name: group.name,
			rate: avgRate,
			ownerrezName: group.name,
			pattern: group.name
		};
	}).sort((a, b) => b.rate - a.rate);

	const totalRate = jurisdictions.reduce((sum, j) => sum + j.rate, 0);
	
	return c.json({
		jurisdictions,
		summary: {
			totalRate,
			jurisdictionCount: jurisdictions.length,
			hasExistingConfig: false,
			detectionConfidence: jurisdictions.length > 0 ? 'high' : 'low'
		},
		recommendations: generateRecommendations(jurisdictions, totalRate)
	});
});

function generateRecommendations(jurisdictions: any[], totalRate: number): string[] {
	const recommendations = [];
	
	if (jurisdictions.length === 0) {
		recommendations.push('Import more recent bookings to enable automatic tax detection');
		return recommendations;
	}
	
	if (totalRate < 5) {
		recommendations.push('Total tax rate seems low. Verify all jurisdictions are captured.');
	} else if (totalRate > 20) {
		recommendations.push('Total tax rate seems high. Review for potential duplicates.');
	}
	
	if (jurisdictions.length > 2) {
		recommendations.push('Multiple tax jurisdictions detected. Configure platform remittance settings for accurate reporting.');
	}
	
	return recommendations;
}

tax.post('/calculate', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');
	const body = await c.req.json();

	if (!body.propertyId) {
		return c.json({ error: 'Property ID is required' }, 400);
	}

	const { bookingId, propertyId, amount } = body;

	const calculator = new TaxCalculator(supabase);

	const { data: taxConfig } = await supabase
		.from('property_tax_configs')
		.select('*')
		.eq('property_id', propertyId)
		.eq('tenant_id', tenantId)
		.eq('is_active', true)
		.single();

	if (!taxConfig) {
		return c.json({
			totalTax: 0,
			ownerRemitted: 0,
			platformRemitted: 0,
			breakdown: []
		});
	}

	// bookingId must belong to the caller's tenant — previously the lookup
	// was scoped only by id, which let any authenticated user run tax math
	// against other tenants' booking amounts
	const booking = bookingId ? await supabase
		.from('bookings')
		.select('*')
		.eq('id', bookingId)
		.eq('tenant_id', tenantId)
		.single()
		.then(r => r.data) : { total_amount: amount, platform: 'Unassigned' };

	if (!booking) {
		return c.json({ error: 'Booking not found' }, 404);
	}

	const result = await calculator.calculateBookingTax(booking, taxConfig, null);
	return c.json(result);
});

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