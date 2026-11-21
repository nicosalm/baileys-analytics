import { Hono } from 'hono';
import type { Context } from 'hono';
import { createSupabaseClient } from '../services/supabase';

// set at deploy time with `wrangler deploy --var COMMIT_SHA:<sha>`; absent only in tests
export const commitOf = (env: Env) => env.COMMIT_SHA || 'unknown';

// liveness probe: answers without touching any dependency
export const ping = (c: Context<{ Bindings: Env }>) => {
	c.header('Cache-Control', 'no-store');
	return c.json({ ping: 'pong', commit: commitOf(c.env) });
};

const health = new Hono<{ Bindings: Env }>();

health.get('/', async (c) => {
	const checks = {
		worker: 'healthy',
		database: 'unknown',
		cache: 'unknown',
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

	const allHealthy = Object.values(checks).every((v) => v === 'healthy');

	c.header('Cache-Control', 'no-store');
	return c.json(
		{
			status: allHealthy ? 'ok' : 'degraded',
			...checks,
			commit: commitOf(c.env),
			timestamp: new Date().toISOString(),
		},
		allHealthy ? 200 : 503,
	);
});

// removed: unauthenticated metrics endpoint leaked aggregate business data

export { health };
