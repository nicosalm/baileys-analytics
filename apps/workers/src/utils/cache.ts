/**
 * Cache utilities for Baileys Analytics
 */

// dashboard view TTLs (seconds)
const DASHBOARD_TTL: Record<string, number> = {
	overview: 1800,    // 30 min — booking-dependent, changes on sync
	financial: 1800,   // 30 min
	occupancy: 1800,   // 30 min
	guests: 1800,      // 30 min
	properties: 1800,  // 30 min
};

// config/static data TTLs — only change on explicit user save
export const CONFIG_TTL = {
	properties: 86400,        // 24h — changes on sync only
	seasons: 86400,           // 24h — changes on explicit save
	taxConfigs: 86400,        // 24h — changes on explicit save
	expenseTemplates: 86400,  // 24h — changes on explicit save
};

export function getDashboardTtl(view: string): number {
	return DASHBOARD_TTL[view] ?? 1800;
}

// views that depend on booking data (invalidated on sync/webhook)
const BOOKING_VIEWS = ['overview', 'financial', 'occupancy', 'guests', 'guests-cancelled', 'guests-inquiries', 'properties', 'pacing'];

// views affected by each config type
const CONFIG_VIEW_DEPS: Record<string, string[]> = {
	seasons: ['overview', 'occupancy', 'pacing'],
	goals: ['overview'],
	operatingExpenses: ['financial', 'properties', 'overview'],
	platformFees: ['financial', 'overview'],
	tags: BOOKING_VIEWS,
	propertyGroups: [],
};

export async function invalidateDashboardCache(
	cache: KVNamespace | undefined,
	userId: string,
	views?: string[]
) {
	if (!cache) return;

	try {
		if (views) {
			// targeted: only invalidate specific views
			const deletions = views.map(view => {
				const prefix = `dashboard:${userId}:${view}:`;
				return cache.list({ prefix }).then(keys =>
					Promise.all(keys.keys.map(key => cache.delete(key.name)))
				);
			});
			await Promise.all(deletions);
		} else {
			// full invalidation (backwards-compatible)
			const prefix = `dashboard:${userId}:`;
			const keys = await cache.list({ prefix });
			await Promise.all(keys.keys.map(key => cache.delete(key.name)));
		}
	} catch (error) {
		console.error('Failed to invalidate cache:', error);
	}
}

// invalidate only booking-dependent views (for sync/webhook)
export async function invalidateBookingViews(
	cache: KVNamespace | undefined,
	userId: string
) {
	return invalidateDashboardCache(cache, userId, BOOKING_VIEWS);
}

// invalidate views affected by a config change
export async function invalidateConfigViews(
	cache: KVNamespace | undefined,
	userId: string,
	configType: keyof typeof CONFIG_VIEW_DEPS
) {
	const views = CONFIG_VIEW_DEPS[configType];
	if (views) {
		return invalidateDashboardCache(cache, userId, views);
	}
	return invalidateDashboardCache(cache, userId);
}

// invalidate a specific config cache key
export async function invalidateConfigCache(
	cache: KVNamespace | undefined,
	userId: string,
	configType: string
) {
	if (!cache) return;
	try {
		await cache.delete(`config:${userId}:${configType}`);
	} catch (error) {
		console.error('Failed to invalidate config cache:', error);
	}
}

export async function invalidateTenantCache(
	cache: KVNamespace | undefined,
	supabase: any,
	tenantId: string
) {
	if (!cache) return;

	try {
		const { data: tenant } = await supabase
			.from('tenants')
			.select('user_id')
			.eq('id', tenantId)
			.single();

		if (tenant?.user_id) {
			await invalidateBookingViews(cache, tenant.user_id);
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

// KV keys are limited to 512 bytes. When filter params (property UUIDs, tags,
// comparison dates) push past that, hash the variable segments into a short hex
// digest so the key stays well under the limit.
export async function buildDashboardCacheKey(
	userId: string,
	view: string,
	from: string,
	to: string,
	extras: {
		tags?: string[];
		properties?: string[];
		comparisonFrom?: string;
		comparisonTo?: string;
	} = {}
): Promise<string> {
	const suffix = [
		extras.tags?.join(',') || '',
		extras.properties?.join(',') || '',
		extras.comparisonFrom || '',
		extras.comparisonTo || '',
	].join(':');

	// only hash when the full key would risk exceeding the 512-byte limit
	const prefix = `dashboard:${userId}:${view}:${from}:${to}`;
	if (prefix.length + 1 + suffix.length <= 480) {
		return `${prefix}:${suffix}`;
	}

	const hash = await crypto.subtle.digest(
		'SHA-256',
		new TextEncoder().encode(suffix)
	);
	const hex = [...new Uint8Array(hash)]
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');
	return `${prefix}:h_${hex.slice(0, 32)}`;
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
	ttl: number = 1800
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
