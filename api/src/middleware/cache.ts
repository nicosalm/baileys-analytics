import { createMiddleware } from 'hono/factory';
import { responseCachePrefix, sha256Hex } from '../utils/cache';
import type { AppEnv } from '../types';

// caches successful GET responses per tenant. entries are cleared with the tenant's
// booking views (sync, webhooks) so they never outlive the data they were built from.
export function cache({ ttl = 300 }: { ttl?: number } = {}) {
	return createMiddleware<AppEnv>(async (c, next) => {
		const tenantId = c.get('tenantId');
		const kv = c.env.CACHE;
		if (c.req.method !== 'GET' || !tenantId || !kv) {
			return next();
		}

		const url = new URL(c.req.url);
		const cacheKey = responseCachePrefix(tenantId) + (await sha256Hex(url.pathname + url.search));

		const cached = await kv.get(cacheKey, 'json');
		if (cached !== null) {
			return c.json(cached);
		}

		await next();

		if (c.res.status === 200) {
			const body = await c.res.clone().json();
			c.executionCtx.waitUntil(kv.put(cacheKey, JSON.stringify(body), { expirationTtl: ttl }));
		}
	});
}
