import { Hono } from 'hono';
import { z } from 'zod';

import { authMiddleware } from '../middleware/auth';
import { createSupabaseClient } from '../services/supabase';

const goals = new Hono<{ Bindings: Env; Variables: { user: any; tenantId: string } }>();

goals.use('/*', authMiddleware);

goals.get('/', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');

	if (!tenantId) {
		return c.json({ error: 'Tenant not found' }, 404);
	}

	const { data: goalsData, error } = await supabase
		.from('goals')
		.select('*')
		.eq('tenant_id', tenantId);

	if (error) {
		return c.json([]);
	}

	const formatted = (goalsData || []).map(g => ({
		id: g.id,
		metricKey: g.metric_key,
		targetValue: Number(g.target_value),
		isEnabled: g.is_enabled
	}));

	return c.json(formatted);
});

goals.put('/', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');
	const body = await c.req.json();

	const goalsSchema = z.array(z.object({
		metricKey: z.string().min(1),
		targetValue: z.number().min(0),
		isEnabled: z.boolean()
	}));

	const validation = goalsSchema.safeParse(body);
	if (!validation.success) {
		return c.json({
			error: validation.error.issues.map((e: any) => e.message).join(', ')
		}, 400);
	}

	if (!tenantId) {
		return c.json({ error: 'Tenant not found' }, 404);
	}

	const upsertData = validation.data.map(g => ({
		tenant_id: tenantId,
		metric_key: g.metricKey,
		target_value: g.targetValue,
		is_enabled: g.isEnabled,
		updated_at: new Date().toISOString()
	}));

	const { data: upserted, error } = await supabase
		.from('goals')
		.upsert(upsertData, {
			onConflict: 'tenant_id,metric_key',
			ignoreDuplicates: false
		})
		.select();

	if (error) {
		return c.json({ error: error.message }, 500);
	}

	const formatted = (upserted || []).map(g => ({
		id: g.id,
		metricKey: g.metric_key,
		targetValue: Number(g.target_value),
		isEnabled: g.is_enabled
	}));

	return c.json(formatted);
});

export { goals };
