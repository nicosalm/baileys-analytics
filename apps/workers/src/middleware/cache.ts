import { Context, Next } from 'hono';

interface CacheOptions {
	ttl?: number;
	key?: (c: Context) => string;
	condition?: (c: Context) => boolean;
}

// the default cache key MUST include the tenant id to prevent cross-tenant
// response leakage. if the tenant id is not set (e.g. public route, or auth
// middleware has not run yet), skip caching entirely rather than risk a leak.
export function cache(options: CacheOptions = {}) {
	const { ttl = 300, key, condition } = options;

	return async function cacheMiddleware(c: Context<{ Bindings: Env; Variables: { user: any; tenantId: string } }>, next: Next) {
		if (condition && !condition(c)) {
			return next();
		}

		let cacheKey: string | null;
		if (key) {
			cacheKey = key(c);
		} else {
			const tenantId = c.get('tenantId');
			cacheKey = tenantId ? `${c.req.method}:${tenantId}:${c.req.url}` : null;
		}

		if (!cacheKey) {
			return next();
		}

		if (c.req.method === 'GET' && c.env.CACHE) {
			const cached = await c.env.CACHE.get(cacheKey);
			if (cached) {
				const data = JSON.parse(cached);
				return c.json(data.body, data.status);
			}
		}

		await next();

		if (c.req.method === 'GET' && c.res.status === 200 && c.env.CACHE) {
			const response = c.res.clone();
			const body = await response.json();

			await c.env.CACHE.put(
				cacheKey,
				JSON.stringify({ body, status: response.status }),
				{ expirationTtl: ttl }
			);
		}
	};
}

export function clearCache(pattern: string) {
	return async function clearCacheMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
		await next();
		
		if (c.res.status >= 200 && c.res.status < 300 && c.env.CACHE) {
			const keys = await c.env.CACHE.list({ prefix: pattern });
			await Promise.all(keys.keys.map(key => c.env.CACHE!.delete(key.name)));
		}
	};
}