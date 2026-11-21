import { Hono } from 'hono';
import { createSupabaseClient } from '../services/supabase';

const health = new Hono<{ Bindings: Env }>();

health.get('/', async (c) => {
	const checks = {
		worker: 'healthy',
		database: 'unknown',
		cache: 'unknown',
		timestamp: new Date().toISOString(),
	};

	try {
		const supabase = createSupabaseClient(c.env);
		const { error } = await supabase.from('tenants').select('id').limit(1);
		checks.database = error ? 'unhealthy' : 'healthy';
	} catch {
		checks.database = 'unhealthy';
	}

	if (c.env.CACHE) {
		try {
			const testKey = 'health-check';
			// KV rejects TTLs under 60s
			await c.env.CACHE.put(testKey, 'test', { expirationTtl: 60 });
			const value = await c.env.CACHE.get(testKey);
			checks.cache = value === 'test' ? 'healthy' : 'unhealthy';
		} catch (error) {
			// KV allows one write/sec per key; a 429 means overlapping checks, not an outage
			checks.cache = String(error).includes('429') ? 'healthy' : 'unhealthy';
		}
	} else {
		checks.cache = 'not configured';
	}

	const { timestamp: _, ...services } = checks;
	const allHealthy = Object.values(services).every((v) => v === 'healthy');

	return c.json(checks, allHealthy ? 200 : 503);
});

// removed: unauthenticated metrics endpoint leaked aggregate business data

export { health };
