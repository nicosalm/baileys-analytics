import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { cache } from '../middleware/cache';
import { createSupabaseClient } from '../services/supabase';
import { fetchBlocks } from '../utils/blocks';
import type { AppEnv } from '../types';

const occupancy = new Hono<AppEnv>();

occupancy.use('/*', authMiddleware);

occupancy.get('/daily', cache({ ttl: 3600 }), async (c) => {
	const { from, to, tags } = c.req.query();
	const tenantId = c.get('tenantId');

	if (!tenantId) {
		return c.json([]);
	}

	const startDate = from || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
	const endDate = to || new Date().toISOString().split('T')[0];
	const tagIds = tags ? tags.split(',').filter(Boolean) : [];

	const supabase = createSupabaseClient(c.env);
	const { getDailyOccupancyData } = await import('../services/occupancy');

	const dailyData = await getDailyOccupancyData(supabase, tenantId, startDate, endDate, tagIds);

	return c.json(dailyData);
});

// owner blocks overlapping [from, to], keyed by our property uuid
occupancy.get('/blocks', async (c) => {
	const { from, to } = c.req.query();
	const tenantId = c.get('tenantId');

	if (!tenantId) {
		return c.json([]);
	}
	if (!from || !to) {
		return c.json({ error: 'from and to are required' }, 400);
	}

	return c.json(await fetchBlocks(createSupabaseClient(c.env), tenantId, from, to));
});

export { occupancy };
