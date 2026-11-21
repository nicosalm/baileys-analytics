// every key is namespaced by tenant id, never user id: demo sessions are separate anonymous
// users that share one tenant, and webhooks arrive with only a tenant id.

export const DASHBOARD_TTL_SECONDS = 1800;
export const PACING_TTL_SECONDS = 3600;

const BOOKING_VIEWS = ['overview', 'financial', 'occupancy', 'guests', 'guests-cancelled', 'guests-inquiries', 'properties', 'pacing'];

const CONFIG_VIEW_DEPS = {
	seasons: ['overview', 'occupancy', 'pacing'],
	goals: ['overview'],
	operatingExpenses: ['financial', 'properties', 'overview'],
	platformFees: ['financial', 'overview'],
	tags: BOOKING_VIEWS,
	propertyGroups: [],
} satisfies Record<string, string[]>;

export type ConfigType = keyof typeof CONFIG_VIEW_DEPS;

export function responseCachePrefix(tenantId: string): string {
	return `resp:${tenantId}:`;
}

async function deleteByPrefix(cache: KVNamespace, prefix: string): Promise<void> {
	let cursor: string | undefined;
	do {
		const page = await cache.list({ prefix, cursor });
		await Promise.all(page.keys.map(key => cache.delete(key.name)));
		cursor = page.list_complete ? undefined : page.cursor;
	} while (cursor);
}

async function invalidateViews(cache: KVNamespace | undefined, tenantId: string, views: string[]): Promise<void> {
	if (!cache || views.length === 0) return;
	try {
		await Promise.all(views.map(view => deleteByPrefix(cache, `dashboard:${tenantId}:${view}:`)));
	} catch (error) {
		console.error('cache invalidation failed:', error);
	}
}

export async function invalidateBookingViews(cache: KVNamespace | undefined, tenantId: string): Promise<void> {
	if (!cache) return;
	await Promise.all([
		invalidateViews(cache, tenantId, BOOKING_VIEWS),
		deleteByPrefix(cache, responseCachePrefix(tenantId)).catch(error => console.error('cache invalidation failed:', error)),
	]);
}

export async function invalidateConfigViews(cache: KVNamespace | undefined, tenantId: string, configType: ConfigType): Promise<void> {
	await invalidateViews(cache, tenantId, CONFIG_VIEW_DEPS[configType]);
}

// KV keys are limited to 512 bytes, so long filter suffixes are hashed
export async function buildDashboardCacheKey(
	tenantId: string,
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

	const prefix = `dashboard:${tenantId}:${view}:${from}:${to}`;
	if (prefix.length + 1 + suffix.length <= 480) {
		return `${prefix}:${suffix}`;
	}
	return `${prefix}:h_${await sha256Hex(suffix)}`;
}

export async function sha256Hex(input: string): Promise<string> {
	const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
	return [...new Uint8Array(hash)]
		.map(b => b.toString(16).padStart(2, '0'))
		.join('')
		.slice(0, 32);
}
