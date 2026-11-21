import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { createSupabaseClient } from '../services/supabase';
import type { AppEnv } from '../types';

const properties = new Hono<AppEnv>();

properties.use('/*', authMiddleware);

properties.get('/', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');

	if (!tenantId) {
		return c.json({ error: 'Tenant not found' }, 404);
	}

	const { data: properties, error } = await supabase.from('properties').select('*').eq('tenant_id', tenantId).order('name');

	if (error) {
		return c.json({ error: error.message }, 500);
	}

	return c.json({ properties: properties || [] });
});

export { properties };
