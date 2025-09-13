/**
 * Cache utilities for Baileys Analytics
 */

export async function invalidateDashboardCache(
	cache: KVNamespace | undefined,
	userId: string
) {
	if (!cache) return;

	// list all cache keys for this user
	const prefix = `dashboard:${userId}:`;
	
	try {
		const keys = await cache.list({ prefix });
		
		// delete all matching keys
		const deletions = keys.keys.map(key => cache.delete(key.name));
		await Promise.all(deletions);
		
		console.log(`Invalidated ${keys.keys.length} cache entries for user ${userId}`);
	} catch (error) {
		console.error('Failed to invalidate cache:', error);
	}
}

export async function invalidateTenantCache(
	cache: KVNamespace | undefined,
	supabase: any,
	tenantId: string
) {
	if (!cache) return;

	try {
		// get the user id for this tenant
		const { data: tenant } = await supabase
			.from('tenants')
			.select('user_id')
			.eq('id', tenantId)
			.single();

		if (tenant?.user_id) {
			await invalidateDashboardCache(cache, tenant.user_id);
		}
	} catch (error) {
		console.error('Failed to invalidate tenant cache:', error);
	}
}

export function getCacheKey(
	userId: string,
	view: string,
	from: string,
	to: string,
	tags?: string[]
): string {
	return `dashboard:${userId}:${view}:${from}:${to}:${tags?.join(',') || ''}`;
}

export async function getCachedData<T>(
	cache: KVNamespace | undefined,
	key: string
): Promise<T | null> {
	if (!cache) return null;

	try {
		const cached = await cache.get(key, 'json');
		if (cached) {
			return { ...cached, _cached: true } as T;
		}
	} catch (error) {
		console.error('Cache read error:', error);
	}

	return null;
}

export async function setCachedData(
	cache: KVNamespace | undefined,
	key: string,
	data: any,
	ttl: number = 300
): Promise<void> {
	if (!cache) return;

	try {
		await cache.put(key, JSON.stringify(data), {
			expirationTtl: ttl
		});
	} catch (error) {
		console.error('Cache write error:', error);
	}
}