import { Context, Next } from 'hono';

interface CacheOptions {
	ttl?: number;
	key?: (c: Context) => string;
	condition?: (c: Context) => boolean;
}

export function cache(options: CacheOptions = {}) {
	const { ttl = 300, key, condition } = options;
	
	return async function cacheMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
		if (condition && !condition(c)) {
			return next();
		}
		
		const cacheKey = key ? key(c) : `${c.req.method}:${c.req.url}`;
		
		if (c.req.method === 'GET') {
			const cached = await c.env.CACHE.get(cacheKey);
			if (cached) {
				const data = JSON.parse(cached);
				return c.json(data.body, data.status);
			}
		}
		
		await next();
		
		if (c.req.method === 'GET' && c.res.status === 200) {
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
		
		if (c.res.status >= 200 && c.res.status < 300) {
			const keys = await c.env.CACHE.list({ prefix: pattern });
			await Promise.all(keys.keys.map(key => c.env.CACHE.delete(key.name)));
		}
	};
}