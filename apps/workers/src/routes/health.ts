import { Hono } from 'hono';
import { createSupabaseClient } from '../services/supabase';

const health = new Hono<{ Bindings: Env }>();

health.get('/', async (c) => {
	const checks = {
		worker: 'healthy',
		database: 'unknown',
		cache: 'unknown',
		timestamp: new Date().toISOString()
	};
	
	try {
		const supabase = createSupabaseClient(c.env);
		const { error } = await supabase.from('tenants').select('id').limit(1);
		checks.database = error ? 'unhealthy' : 'healthy';
	} catch {
		checks.database = 'unhealthy';
	}
	
	try {
		const testKey = 'health-check';
		await c.env.CACHE.put(testKey, 'test', { expirationTtl: 10 });
		const value = await c.env.CACHE.get(testKey);
		checks.cache = value === 'test' ? 'healthy' : 'unhealthy';
	} catch {
		checks.cache = 'unhealthy';
	}
	
	const allHealthy = Object.values(checks)
		.filter(v => typeof v === 'string' && v !== 'timestamp')
		.every(v => v === 'healthy');
	
	return c.json(checks, allHealthy ? 200 : 503);
});

health.get('/metrics', async (c) => {
	const supabase = createSupabaseClient(c.env);
	
	const [tenants, properties, bookings] = await Promise.all([
		supabase.from('tenants').select('id', { count: 'exact', head: true }),
		supabase.from('properties').select('id', { count: 'exact', head: true }),
		supabase.from('bookings').select('id', { count: 'exact', head: true })
	]);
	
	return c.json({
		counts: {
			tenants: tenants.count || 0,
			properties: properties.count || 0,
			bookings: bookings.count || 0
		},
		timestamp: new Date().toISOString()
	});
});

export { health };