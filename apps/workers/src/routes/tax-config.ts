import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { createSupabaseClient } from '../services/supabase';

const taxConfig = new Hono<{ Bindings: Env; Variables: { user: any; tenantId: string } }>();

taxConfig.use('/*', authMiddleware);

taxConfig.get('/property-tax-status', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');
	
	const { data: properties } = await supabase
		.from('properties')
		.select('id, name')
		.eq('tenant_id', tenantId)
		.eq('active', true)
		.order('name');
	
	if (!properties) {
		return c.json({ error: 'Failed to fetch properties' }, 500);
	}
	
	const statuses = [];
	const currentMonth = new Date().toISOString().slice(0, 7);
	const last6Months: string[] = [];
	
	for (let i = 0; i < 6; i++) {
		const date = new Date();
		date.setMonth(date.getMonth() - i);
		last6Months.push(date.toISOString().slice(0, 7));
	}
	
	for (const property of properties) {
		const { data: config } = await supabase
			.from('property_tax_configs')
			.select('jurisdictions')
			.eq('property_id', property.id)
			.eq('tenant_id', tenantId)
			.eq('is_active', true)
			.single();
		
		const hasConfig = config && config.jurisdictions && config.jurisdictions.length > 0;
		
		const { data: bookingMonths } = await supabase
			.from('bookings')
			.select('arrival')
			.eq('property_id', property.id)
			.eq('tenant_id', tenantId)
			.gte('arrival', last6Months[5] + '-01')
			.lt('arrival', currentMonth + '-01')
			.not('status', 'in', '["canceled","declined"]');
		
		const monthsWithBookings = [...new Set(
			bookingMonths?.map(b => b.arrival.slice(0, 7)) || []
		)].sort().reverse();
		
		const { data: feeMonths } = await supabase
			.from('platform_fee_entries')
			.select('month')
			.eq('property_id', property.id)
			.eq('tenant_id', tenantId)
			.in('month', last6Months);
		
		const monthsWithFees = [...new Set(
			feeMonths?.map(f => f.month) || []
		)];
		
		const monthsNeedingFees = monthsWithBookings.filter(
			month => last6Months.includes(month)
		);
		
		const missingFeeMonths = monthsNeedingFees.filter(
			month => !monthsWithFees.includes(month)
		);
		
		let feeStatus: 'none' | 'partial' | 'complete' = 'none';
		if (monthsWithFees.length === 0) {
			feeStatus = 'none';
		} else if (missingFeeMonths.length > 0) {
			feeStatus = 'partial';
		} else {
			feeStatus = 'complete';
		}
		
		const { data: lastUpdateConfig } = await supabase
			.from('property_tax_configs')
			.select('updated_at')
			.eq('property_id', property.id)
			.eq('tenant_id', tenantId)
			.order('updated_at', { ascending: false })
			.limit(1)
			.single();
		
		const { data: lastUpdateFees } = await supabase
			.from('platform_fee_entries')
			.select('updated_at')
			.eq('property_id', property.id)
			.eq('tenant_id', tenantId)
			.order('updated_at', { ascending: false })
			.limit(1)
			.single();
		
		const lastUpdated = [lastUpdateConfig?.updated_at, lastUpdateFees?.updated_at]
			.filter(Boolean)
			.sort()
			.pop() || null;
		
		statuses.push({
			propertyId: property.id,
			propertyName: property.name,
			hasConfig,
			hasPlatformFees: monthsWithFees.length > 0,
			feeStatus,
			monthsWithBookings,
			monthsWithFees,
			missingFeeMonths,
			totalBookingMonths: monthsNeedingFees.length,
			totalFeeMonths: monthsWithFees.length,
			lastUpdated
		});
	}
	
	return c.json({ status: 'success', data: statuses });
});

taxConfig.get('/platform-remittance-config', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');
	
	const { data: configs } = await supabase
		.from('tenant_platform_configs')
		.select('*')
		.eq('tenant_id', tenantId);
	
	if (configs && configs.length > 0) {
		const transformed = configs.map(row => ({
			platform: row.platform,
			remitsOccupancyTax: row.remits_occupancy_tax,
			remitsOnGuestFees: row.remits_on_guest_fees,
			jurisdictions: row.jurisdictions,
			notes: row.notes
		}));
		
		return c.json({ 
			status: 'success', 
			data: transformed, 
			source: 'custom' 
		});
	}
	
	const defaultSuggestions = [
		{
			platform: 'airbnb',
			remitsOccupancyTax: true,
			remitsOnGuestFees: true,
			notes: 'Airbnb remittance varies by jurisdiction - verify with local authorities'
		},
		{
			platform: 'vrbo',
			remitsOccupancyTax: false,
			remitsOnGuestFees: false,
			notes: 'VRBO remittance varies by location - verify with local tax authority'
		},
		{
			platform: 'booking.com',
			remitsOccupancyTax: false,
			remitsOnGuestFees: false,
			notes: 'Booking.com remittance policies vary - check your agreement'
		},
		{
			platform: 'direct',
			remitsOccupancyTax: false,
			remitsOnGuestFees: false,
			notes: 'Direct bookings - owner responsible for all tax remittance'
		}
	];
	
	return c.json({ 
		status: 'success', 
		data: defaultSuggestions, 
		source: 'suggestions',
		message: 'These are suggestions only. Please verify with your local tax authority.'
	});
});

taxConfig.post('/platform-remittance-config', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');
	const { configs } = await c.req.json();
	
	if (!configs || !Array.isArray(configs)) {
		return c.json({ error: 'Invalid configuration' }, 400);
	}
	
	const { error: deleteError } = await supabase
		.from('tenant_platform_configs')
		.delete()
		.eq('tenant_id', tenantId);
	
	if (deleteError) {
		return c.json({ error: 'Failed to update configuration' }, 500);
	}
	
	for (const config of configs) {
		const { error } = await supabase
			.from('tenant_platform_configs')
			.insert({
				tenant_id: tenantId,
				platform: config.platform,
				remits_occupancy_tax: config.remitsOccupancyTax,
				remits_on_guest_fees: config.remitsOnGuestFees,
				jurisdictions: config.jurisdictions || null,
				notes: config.notes || null
			});
		
		if (error) {
			return c.json({ error: 'Failed to update configuration' }, 500);
		}
	}
	
	return c.json({ 
		status: 'success', 
		message: 'Platform remittance configuration updated'
	});
});

taxConfig.get('/property-tax-configs', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');
	
	if (!tenantId) {
		return c.json({ status: 'error', error: 'Tenant not found' }, 404);
	}
	
	const { data: configs, error } = await supabase
		.from('property_tax_configs')
		.select(`
			*,
			properties!inner(name, address)
		`)
		.eq('tenant_id', tenantId)
		.order('created_at', { ascending: false });
	
	if (error) {
		return c.json({ status: 'success', data: [] });
	}
	
	const formattedConfigs = configs?.map(config => ({
		id: config.id,
		propertyId: config.property_id,
		propertyName: config.properties?.name || '',
		propertyAddress: config.properties?.address || '',
		configName: config.config_name,
		jurisdictions: config.jurisdictions || [],
		platformSettings: config.platform_settings || {},
		effectiveFrom: config.effective_from,
		effectiveTo: config.effective_to,
		isActive: config.is_active,
		createdAt: config.created_at,
		updatedAt: config.updated_at
	})) || [];
	
	return c.json({ status: 'success', data: formattedConfigs });
});

taxConfig.put('/property-tax-configs/:id', async (c) => {
	const configId = c.req.param('id');
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');
	const body = await c.req.json();
	
	const { data: config, error } = await supabase
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
		return c.json({ status: 'error', error: error.message }, 500);
	}
	
	if (!config) {
		return c.json({ status: 'error', error: 'Config not found' }, 404);
	}
	
	return c.json({ status: 'success', data: config });
});

taxConfig.post('/property-tax-configs', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');
	const body = await c.req.json();
	
	const { data: config, error } = await supabase
		.from('property_tax_configs')
		.insert({
			tenant_id: tenantId,
			property_id: body.propertyId,
			config_name: body.configName,
			jurisdictions: body.jurisdictions || [],
			platform_settings: body.platformSettings || {},
			effective_from: body.effectiveFrom,
			is_active: body.isActive ?? true,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		})
		.select()
		.single();
	
	if (error) {
		return c.json({ status: 'error', error: error.message }, 500);
	}
	
	return c.json({ status: 'success', data: config }, 201);
});

taxConfig.delete('/property-tax-configs/:id', async (c) => {
	const configId = c.req.param('id');
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');
	
	const { error } = await supabase
		.from('property_tax_configs')
		.delete()
		.eq('id', configId)
		.eq('tenant_id', tenantId);
	
	if (error) {
		return c.json({ status: 'error', error: error.message }, 500);
	}
	
	return c.json({ status: 'success', message: 'Config deleted successfully' });
});

taxConfig.get('/tax-jurisdictions', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');
	
	const { data: taxData, error } = await supabase
		.from('booking_charges')
		.select(`
			description,
			amount,
			bookings!inner(
				property_id,
				total_amount,
				status,
				properties!inner(
					id,
					name
				)
			)
		`)
		.eq('type', 'tax')
		.eq('bookings.tenant_id', tenantId)
		.neq('bookings.status', 'canceled')
		.not('description', 'is', null)
		.neq('description', '');
	
	if (error) {
		return c.json({ error: 'Failed to fetch tax data' }, 500);
	}
	
	const propertiesMap = new Map();
	
	taxData?.forEach((charge: any) => {
		const propertyId = charge.bookings.property_id;
		const propertyName = charge.bookings.properties.name;
		const description = charge.description;
		const amount = charge.amount;
		const bookingAmount = charge.bookings.total_amount;
		
		if (!propertiesMap.has(propertyId)) {
			propertiesMap.set(propertyId, {
				propertyId,
				propertyName,
				jurisdictions: new Map()
			});
		}
		
		const property = propertiesMap.get(propertyId);
		
		if (!property.jurisdictions.has(description)) {
			property.jurisdictions.set(description, {
				description,
				occurrences: 0,
				totalAmount: 0,
				bookingTotals: []
			});
		}
		
		const jurisdiction = property.jurisdictions.get(description);
		jurisdiction.occurrences++;
		jurisdiction.totalAmount += amount;
		jurisdiction.bookingTotals.push(bookingAmount);
	});
	
	const detectedJurisdictions = Array.from(propertiesMap.values()).map((property: any) => {
		const jurisdictions = Array.from(property.jurisdictions.values()).map((j: any) => {
			const avgBookingAmount = j.bookingTotals.reduce((a: number, b: number) => a + b, 0) / j.bookingTotals.length;
			const estimatedRate = avgBookingAmount > 0 ? (j.totalAmount / j.occurrences / avgBookingAmount) * 100 : 0;
			
			const type = j.description.toLowerCase().includes('state') ? 'state' :
						  j.description.toLowerCase().includes('county') ? 'county' :
						  j.description.toLowerCase().includes('city') || j.description.toLowerCase().includes('local') ? 'local' :
						  'other';
			
			return {
				name: j.description,
				type,
				rate: Math.round(estimatedRate * 100) / 100,
				occurrences: j.occurrences,
				confidence: j.occurrences > 10 ? 'high' : j.occurrences > 5 ? 'medium' : 'low'
			};
		}).sort((a: any, b: any) => b.occurrences - a.occurrences);
		
		return {
			propertyId: property.propertyId,
			propertyName: property.propertyName,
			jurisdictions
		};
	});
	
	return c.json({
		status: 'success',
		data: detectedJurisdictions
	});
});

export { taxConfig };