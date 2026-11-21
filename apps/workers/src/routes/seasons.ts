import { Hono } from 'hono';
import { z } from 'zod';

import { authMiddleware } from '../middleware/auth';
import { createSupabaseClient } from '../services/supabase';
import { prorateBooking } from '../utils/prorate';
import type { AppEnv } from '../types';

const seasons = new Hono<AppEnv>();

seasons.use('/*', authMiddleware);

// returns the max day in a given month, using a leap year for february so
// feb 29 is accepted. seasons do not carry a year, so we allow the most
// permissive date.
function maxDayInMonth(month: number): number {
	return new Date(2024, month, 0).getDate();
}

const seasonSchema = z.object({
	name: z.string().min(1),
	startMonth: z.number().int().min(1).max(12),
	startDay: z.number().int().min(1).max(31),
	endMonth: z.number().int().min(1).max(12),
	endDay: z.number().int().min(1).max(31),
	isActive: z.boolean().optional()
}).refine(
	d => d.startDay <= maxDayInMonth(d.startMonth),
	{ message: 'startDay is not valid for startMonth', path: ['startDay'] }
).refine(
	d => d.endDay <= maxDayInMonth(d.endMonth),
	{ message: 'endDay is not valid for endMonth', path: ['endDay'] }
);

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

seasons.post('/', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');
	const body = await c.req.json();

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
	
	const { invalidateConfigViews } = await import('../utils/cache');
	await invalidateConfigViews(c.env.CACHE, c.get('tenantId'), 'seasons');

	return c.json(formattedSeason, 201);
});

seasons.put('/:id', async (c) => {
	const seasonId = c.req.param('id');
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');
	const body = await c.req.json();

	const validation = seasonSchema.safeParse(body);
	if (!validation.success) {
		return c.json({ 
			error: validation.error.issues.map((e: any) => e.message).join(', ')
		}, 400);
	}
	
	if (!tenantId) {
		return c.json({ error: 'Tenant not found' }, 404);
	}
	
	const dbData: any = {
		name: body.name,
		start_month: body.startMonth,
		start_day: body.startDay,
		end_month: body.endMonth,
		end_day: body.endDay
	};

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
	
	const { invalidateConfigViews } = await import('../utils/cache');
	await invalidateConfigViews(c.env.CACHE, c.get('tenantId'), 'seasons');

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

seasons.patch('/:id', async (c) => {
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
	
	const { invalidateConfigViews } = await import('../utils/cache');
	await invalidateConfigViews(c.env.CACHE, c.get('tenantId'), 'seasons');

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

seasons.delete('/:id', async (c) => {
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

	const { invalidateConfigViews } = await import('../utils/cache');
	await invalidateConfigViews(c.env.CACHE, c.get('tenantId'), 'seasons');

	return c.json({ success: true });
});

seasons.get('/analysis', async (c) => {
	const { year = new Date().getFullYear().toString() } = c.req.query();
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');
	
	if (!tenantId) {
		return c.json({ error: 'Tenant not found' }, 404);
	}
	
	// overlap query so bookings that span a season boundary contribute nights
	// and revenue to both seasons proportionally
	const [{ data: seasons }, { data: bookings }] = await Promise.all([
		supabase
			.from('season_configurations')
			.select('*')
			.eq('tenant_id', tenantId),
		supabase
			.from('bookings')
			.select('id, arrival, departure, total_amount')
			.eq('tenant_id', tenantId)
			.lte('arrival', `${year}-12-31`)
			.gte('departure', `${year}-01-01`)
			.neq('status', 'canceled')
	]);

	const lastDayOfMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

	const seasonAnalysis = seasons?.map(season => {
		const y = parseInt(year);
		const seasonFrom = `${year}-${String(season.start_month).padStart(2, '0')}-01`;
		const seasonTo = `${year}-${String(season.end_month).padStart(2, '0')}-${String(lastDayOfMonth(y, season.end_month)).padStart(2, '0')}`;

		let revenue = 0;
		let nights = 0;
		let bookingCount = 0;
		for (const b of bookings || []) {
			const pr = prorateBooking(b, seasonFrom, seasonTo);
			if (pr.overlapNights <= 0) continue;
			revenue += pr.revenue;
			nights += pr.overlapNights;
			// count a booking in this season if any of its nights fall in the season window
			bookingCount += 1;
		}

		return {
			...season,
			bookingCount,
			revenue,
			nights,
			averageBookingValue: bookingCount > 0 ? revenue / bookingCount : 0
		};
	});
	
	return c.json({
		year: parseInt(year),
		seasons: seasonAnalysis
	});
});

export { seasons };