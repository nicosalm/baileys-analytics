import { Hono } from 'hono';
import { z } from 'zod';

import { authMiddleware } from '../middleware/auth';
import { clearCache } from '../middleware/cache';
import { createSupabaseClient } from '../services/supabase';

const seasons = new Hono<{ Bindings: Env; Variables: { user: any; tenantId: string } }>();

seasons.use('/*', authMiddleware);

seasons.get('/', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');
	
	if (!tenantId) {
		return c.json({ error: 'Tenant not found' }, 404);
	}
	
	const { data: seasons, error } = await supabase
		.from('season_configurations')
		.select('*')
		.eq('tenant_id', tenantId)
		.order('start_day');
	
	if (error) {
		return c.json([]);
	}
	
	const formattedSeasons = (seasons || []).map(s => ({
		id: s.id,
		name: s.name,
		startMonth: s.start_month,
		startDay: s.start_day,
		endMonth: s.end_month,
		endDay: s.end_day,
		isActive: s.is_active,
		tenantId: s.tenant_id,
		createdAt: s.created_at,
		updatedAt: s.updated_at
	}));
	
	return c.json(formattedSeasons);
});

seasons.post('/', clearCache('GET:'), async (c) => {
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');
	const body = await c.req.json();
	
	const seasonSchema = z.object({
		name: z.string().min(1),
		startMonth: z.number().int().min(1).max(12),
		startDay: z.number().int().min(1).max(31),
		endMonth: z.number().int().min(1).max(12),
		endDay: z.number().int().min(1).max(31),
		isActive: z.boolean().optional()
	});
	
	const validation = seasonSchema.safeParse(body);
	if (!validation.success) {
		return c.json({ 
			error: validation.error.issues.map((e: any) => e.message).join(', ')
		}, 400);
	}
	
	if (!tenantId) {
		return c.json({ error: 'Tenant not found' }, 404);
	}
	
	// check if there are any active seasons
	const { data: activeSeasons } = await supabase
		.from('season_configurations')
		.select('id')
		.eq('tenant_id', tenantId)
		.eq('is_active', true);
	
	// auto-activate if no active seasons exist
	const shouldActivate = !activeSeasons || activeSeasons.length === 0;
	
	const dbData = {
		tenant_id: tenantId,
		name: body.name,
		start_month: body.startMonth,
		start_day: body.startDay,
		end_month: body.endMonth,
		end_day: body.endDay,
		is_active: body.isActive !== undefined ? body.isActive : shouldActivate
	};
	
	const { data: season, error } = await supabase
		.from('season_configurations')
		.insert(dbData)
		.select()
		.single();
	
	if (error) {
		return c.json({ error: error.message }, 500);
	}
	
	const formattedSeason = season ? {
		id: season.id,
		name: season.name,
		startMonth: season.start_month,
		startDay: season.start_day,
		endMonth: season.end_month,
		endDay: season.end_day,
		isActive: season.is_active,
		tenantId: season.tenant_id,
		createdAt: season.created_at,
		updatedAt: season.updated_at
	} : null;
	
	return c.json(formattedSeason, 201);
});

seasons.put('/:id', clearCache('GET:'), async (c) => {
	const seasonId = c.req.param('id');
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');
	const body = await c.req.json();
	
	const seasonSchema = z.object({
		name: z.string().min(1),
		startMonth: z.number().int().min(1).max(12),
		startDay: z.number().int().min(1).max(31),
		endMonth: z.number().int().min(1).max(12),
		endDay: z.number().int().min(1).max(31),
		isActive: z.boolean()
	});
	
	const validation = seasonSchema.safeParse(body);
	if (!validation.success) {
		return c.json({ 
			error: validation.error.issues.map((e: any) => e.message).join(', ')
		}, 400);
	}
	
	if (!tenantId) {
		return c.json({ error: 'Tenant not found' }, 404);
	}
	
	const dbData = {
		name: body.name,
		start_month: body.startMonth,
		start_day: body.startDay,
		end_month: body.endMonth,
		end_day: body.endDay,
		is_active: body.isActive
	};
	
	const { data: season, error } = await supabase
		.from('season_configurations')
		.update(dbData)
		.eq('id', seasonId)
		.eq('tenant_id', tenantId)
		.select()
		.single();
	
	if (error) {
		return c.json({ error: error.message }, 500);
	}
	
	const formattedSeason = season ? {
		id: season.id,
		name: season.name,
		startMonth: season.start_month,
		startDay: season.start_day,
		endMonth: season.end_month,
		endDay: season.end_day,
		isActive: season.is_active,
		tenantId: season.tenant_id,
		createdAt: season.created_at,
		updatedAt: season.updated_at
	} : null;
	
	return c.json(formattedSeason);
});

seasons.patch('/:id', clearCache('GET:'), async (c) => {
	const seasonId = c.req.param('id');
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');
	const body = await c.req.json();
	
	const patchSchema = z.object({
		isActive: z.boolean()
	}).partial();
	
	const validation = patchSchema.safeParse(body);
	if (!validation.success) {
		return c.json({ 
			error: validation.error.issues.map((e: any) => e.message).join(', ')
		}, 400);
	}
	
	if (!tenantId) {
		return c.json({ error: 'Tenant not found' }, 404);
	}
	
	const dbData: any = {};
	if (body.isActive !== undefined) {
		dbData.is_active = body.isActive;
	}
	
	const { data: season, error } = await supabase
		.from('season_configurations')
		.update(dbData)
		.eq('id', seasonId)
		.eq('tenant_id', tenantId)
		.select()
		.single();
	
	if (error) {
		return c.json({ error: error.message }, 500);
	}
	
	const formattedSeason = season ? {
		id: season.id,
		name: season.name,
		startMonth: season.start_month,
		startDay: season.start_day,
		endMonth: season.end_month,
		endDay: season.end_day,
		isActive: season.is_active,
		tenantId: season.tenant_id,
		createdAt: season.created_at,
		updatedAt: season.updated_at
	} : null;
	
	return c.json(formattedSeason);
});

seasons.delete('/:id', clearCache('GET:'), async (c) => {
	const seasonId = c.req.param('id');
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');
	
	if (!tenantId) {
		return c.json({ error: 'Tenant not found' }, 404);
	}
	
	const { error } = await supabase
		.from('season_configurations')
		.delete()
		.eq('id', seasonId)
		.eq('tenant_id', tenantId);
	
	if (error) {
		return c.json({ error: error.message }, 500);
	}
	
	return c.json({ success: true });
});

seasons.get('/analysis', async (c) => {
	const { year = new Date().getFullYear().toString() } = c.req.query();
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');
	
	if (!tenantId) {
		return c.json({ error: 'Tenant not found' }, 404);
	}
	
	const [{ data: seasons }, { data: bookings }] = await Promise.all([
		supabase
			.from('season_configurations')
			.select('*')
			.eq('tenant_id', tenantId),
		supabase
			.from('bookings')
			.select('arrival, departure, total_amount')
			.eq('tenant_id', tenantId)
			.gte('arrival', `${year}-01-01`)
			.lte('arrival', `${year}-12-31`)
	]);
	
	const seasonAnalysis = seasons?.map(season => {
		const seasonBookings = bookings?.filter(booking => {
			if (!booking.arrival) return false;
			const arrivalMonth = new Date(booking.arrival).getMonth() + 1;
			return arrivalMonth >= season.start_month && arrivalMonth <= season.end_month;
		}) || [];
		
		const revenue = seasonBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
		const nights = seasonBookings.reduce((sum, b) => {
			if (b.arrival && b.departure) {
				return sum + Math.ceil(
					(new Date(b.departure).getTime() - new Date(b.arrival).getTime()) / 
					(1000 * 60 * 60 * 24)
				);
			}
			return sum;
		}, 0);
		
		return {
			...season,
			bookingCount: seasonBookings.length,
			revenue,
			nights,
			averageBookingValue: seasonBookings.length > 0 ? revenue / seasonBookings.length : 0
		};
	});
	
	return c.json({
		year: parseInt(year),
		seasons: seasonAnalysis
	});
});

export { seasons };