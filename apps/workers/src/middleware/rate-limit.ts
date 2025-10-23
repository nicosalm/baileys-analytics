import { Context, Next } from 'hono';

interface RateLimitOptions {
	windowMs?: number;  // time window in milliseconds
	max?: number;       // max requests per window
	keyGenerator?: (c: Context) => string;
}

export function rateLimit(options: RateLimitOptions = {}) {
	const { 
		windowMs = 60000,  // 1 minute default
		max = 100,         // 100 requests per minute default
		keyGenerator = (c) => c.req.header('CF-Connecting-IP') || 'global'
	} = options;
	
	return async function rateLimitMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
		// skip rate limiting if kv is not available
		if (!c.env.CACHE) {
			return next();
		}
		
		const key = `ratelimit:${keyGenerator(c)}`;
		const now = Date.now();
		
		// get current count
		const data = await c.env.CACHE.get(key, 'json') as { count: number; resetAt: number } | null;
		
		if (!data || data.resetAt < now) {
			// new window
			await c.env.CACHE.put(key, JSON.stringify({ 
				count: 1, 
				resetAt: now + windowMs 
			}), { 
				expirationTtl: Math.ceil(windowMs / 1000) 
			});
			return next();
		}
		
		if (data.count >= max) {
			return c.json({ 
				error: 'Too many requests', 
				retryAfter: Math.ceil((data.resetAt - now) / 1000) 
			}, 429);
		}
		
		// increment count
		// KV requires minimum TTL of 60 seconds
		const ttl = Math.max(60, Math.ceil((data.resetAt - now) / 1000));
		await c.env.CACHE.put(key, JSON.stringify({
			count: data.count + 1,
			resetAt: data.resetAt
		}), {
			expirationTtl: ttl
		});
		
		return next();
	};
}

// strict rate limit for expensive operations
export function strictRateLimit() {
	return rateLimit({
		windowMs: 300000,  // 5 minutes
		max: 10            // 10 requests per 5 minutes
	});
}