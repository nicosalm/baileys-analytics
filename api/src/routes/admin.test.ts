import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { AppEnv } from '../types';

let userEmail: string;
const queried: string[] = [];

const TABLES: Record<string, unknown[]> = {
	admin_tenant_overview: [{ tenant_id: 't1', email: 'owner@example.com', property_count: 7 }],
	webhook_events: [
		{ tenant_id: 't1', created_at: '2026-11-20T10:00:00Z', entity_type: 'booking', action: 'entity_update', processing_error: 'timeout' },
	],
	stripe_webhook_events: [
		{ tenant_id: null, created_at: '2026-11-21T10:00:00Z', event_type: 'invoice.payment_failed', processing_error: 'db down' },
	],
};

vi.mock('../services/supabase', () => ({
	createSupabaseClient: () => ({
		from: (table: string) => {
			queried.push(table);
			const q: any = {
				select: () => q,
				not: () => q,
				order: () => q,
				limit: () => q,
				then: (resolve: any) => resolve({ data: TABLES[table] ?? [], error: null }),
			};
			return q;
		},
	}),
}));
vi.mock('../middleware/auth', () => ({
	authMiddleware: async (c: any, next: any) => {
		c.set('user', { id: 'u1', email: userEmail });
		await next();
	},
}));

const { admin } = await import('./admin');
const app = new Hono<AppEnv>().route('/api/admin', admin);
const env = { ADMIN_EMAILS: 'boss@example.com' } as unknown as Env;
const getOverview = () => app.request('/api/admin/overview', {}, env);

beforeEach(() => {
	userEmail = 'boss@example.com';
	queried.length = 0;
});

describe('GET /admin/overview', () => {
	it('hides itself from non-admins', async () => {
		userEmail = 'owner@example.com';
		expect((await getOverview()).status).toBe(404);
		expect(queried).toEqual([]);
	});

	it('returns one row per tenant from the overview view', async () => {
		const body = (await (await getOverview()).json()) as any;
		expect(body.tenants).toEqual(TABLES.admin_tenant_overview);
		expect(queried).toContain('admin_tenant_overview');
	});

	it('merges OwnerRez and Stripe failures, newest first', async () => {
		const body = (await (await getOverview()).json()) as any;
		expect(body.errors).toEqual([
			{ source: 'stripe', tenantId: null, at: '2026-11-21T10:00:00Z', event: 'invoice.payment_failed', message: 'db down' },
			{ source: 'ownerrez', tenantId: 't1', at: '2026-11-20T10:00:00Z', event: 'booking entity_update', message: 'timeout' },
		]);
	});
});
