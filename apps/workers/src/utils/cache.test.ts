import { describe, it, expect } from 'vitest';
import { buildDashboardCacheKey, invalidateBookingViews, invalidateConfigViews, responseCachePrefix } from './cache';

// paginates list() with a stable cursor like KV, so invalidation must follow it
function kv(pageSize = 2) {
	const store = new Map<string, string>();
	return {
		store,
		put: async (k: string, v: string) => {
			store.set(k, v);
		},
		get: async (k: string) => store.get(k) ?? null,
		delete: async (k: string) => {
			store.delete(k);
		},
		list: async ({ prefix, cursor }: { prefix: string; cursor?: string }) => {
			const names = [...store.keys()].filter((k) => k.startsWith(prefix) && (!cursor || k > cursor)).sort();
			const page = names.slice(0, pageSize);
			return {
				keys: page.map((name) => ({ name })),
				list_complete: names.length <= pageSize,
				cursor: page.at(-1),
			};
		},
	};
}

const A = 'tenant-a';
const B = 'tenant-b';

describe('dashboard cache', () => {
	it('namespaces keys by tenant', async () => {
		const key = await buildDashboardCacheKey(A, 'overview', '2026-01-01', '2026-12-31');
		expect(key.startsWith(`dashboard:${A}:overview:`)).toBe(true);
	});

	it('hashes long filter suffixes to stay under the KV key limit', async () => {
		const properties = Array.from({ length: 20 }, (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`);
		const key = await buildDashboardCacheKey(A, 'overview', '2026-01-01', '2026-12-31', { properties });
		expect(key.length).toBeLessThan(512);
		expect(key).toContain(':h_');
	});

	it('clears every page of a tenant and leaves other tenants alone', async () => {
		const cache = kv();
		for (let i = 0; i < 5; i++) {
			await cache.put(`dashboard:${A}:overview:${i}`, '{}');
			await cache.put(`dashboard:${B}:overview:${i}`, '{}');
		}
		await cache.put(`${responseCachePrefix(A)}x`, '{}');
		await cache.put(`${responseCachePrefix(B)}x`, '{}');

		await invalidateBookingViews(cache as unknown as KVNamespace, A);

		const remaining = [...cache.store.keys()];
		expect(remaining.filter((k) => k.includes(A))).toEqual([]);
		expect(remaining.filter((k) => k.includes(B))).toHaveLength(6);
	});

	it('config changes only clear the views that depend on them', async () => {
		const cache = kv();
		await cache.put(`dashboard:${A}:overview:x`, '{}');
		await cache.put(`dashboard:${A}:financial:x`, '{}');

		await invalidateConfigViews(cache as unknown as KVNamespace, A, 'goals');

		expect([...cache.store.keys()]).toEqual([`dashboard:${A}:financial:x`]);
	});
});
