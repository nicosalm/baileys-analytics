import type { Context, Next } from 'hono';
import type { AppEnv } from '../types';

interface RateLimitOptions {
	windowMs?: number; // time window in milliseconds
	max?: number; // max requests per window
	keyGenerator?: (c: Context<AppEnv>) => string;
}

export function rateLimit(options: RateLimitOptions = {}) {
	const {
		windowMs = 60000, // 1 minute default
		max = 100, // 100 requests per minute default
		// signed-in user first: requests through the site's /api proxy can all arrive
		// with the proxy's IP, which would put every visitor in one bucket
		keyGenerator = (c) => c.get('user')?.id ?? c.req.header('CF-Connecting-IP') ?? 'global',
	} = options;

	// each limiter gets its own bucket; a shared per-IP key let sync traffic
	// exhaust the checkout and account-delete limits
	const bucket = `${windowMs}:${max}`;

	return async function rateLimitMiddleware(c: Context<AppEnv>, next: Next) {
		// skip rate limiting if kv is not available
		if (!c.env.CACHE) {
			return next();
		}

		const key = `ratelimit:${bucket}:${c.req.routePath}:${keyGenerator(c)}`;
		const now = Date.now();

		// get current count
		const data = (await c.env.CACHE.get(key, 'json')) as { count: number; resetAt: number } | null;

		if (!data || data.resetAt < now) {
			// new window
			await c.env.CACHE.put(
				key,
				JSON.stringify({
					count: 1,
					resetAt: now + windowMs,
				}),
				{
					expirationTtl: Math.ceil(windowMs / 1000),
				},
			);
			return next();
		}

		if (data.count >= max) {
			return c.json(
				{
					error: 'Too many requests',
					retryAfter: Math.ceil((data.resetAt - now) / 1000),
				},
				429,
			);
		}

		// increment count
		// KV requires minimum TTL of 60 seconds
		const ttl = Math.max(60, Math.ceil((data.resetAt - now) / 1000));
		await c.env.CACHE.put(
			key,
			JSON.stringify({
				count: data.count + 1,
				resetAt: data.resetAt,
			}),
			{
				expirationTtl: ttl,
			},
		);

		return next();
	};
}
