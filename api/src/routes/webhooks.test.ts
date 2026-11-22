import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { AppEnv } from '../types';

// crypto.subtle.timingSafeEqual is a Workers extension; node lacks it
if (!(crypto.subtle as any).timingSafeEqual) {
	(crypto.subtle as any).timingSafeEqual = (a: Uint8Array, b: Uint8Array) => a.byteLength === b.byteLength && a.every((v, i) => v === b[i]);
}

let tenant: { subscription_exempt: boolean; first_subscription_at: string | null };
let hasSubscriptionRow: boolean;

vi.mock('../services/supabase', () => ({ createSupabaseClient: () => fakeSupabase() }));

// enough Supabase for the webhook front door; the background handlers are not run
function fakeSupabase() {
	return {
		from: (table: string) => {
			const q: any = {
				select: () => q,
				eq: () => q,
				update: () => q,
				insert: async () => ({ error: null }),
				single: async () => (table === 'tenants' ? { data: { id: 'tenant_a' } } : { data: null }),
				maybeSingle: async () => {
					if (table === 'tenants') return { data: tenant };
					if (table === 'subscriptions') return { data: hasSubscriptionRow ? { id: 'sub_row' } : null };
					return { data: null };
				},
				then: (resolve: any) => resolve({ error: null }),
			};
			return q;
		},
	};
}

const { webhooks } = await import('./webhooks');

const env = { OWNERREZ_WEBHOOK_USER: 'hook', OWNERREZ_WEBHOOK_PASSWORD: 'secret' } as unknown as Env;
const app = new Hono<AppEnv>().route('/api/webhooks', webhooks);
let waitUntil: ReturnType<typeof vi.fn>;

const deliver = (entity_type: string, action = 'entity_update') =>
	app.request(
		'/api/webhooks/ownerrez',
		{
			method: 'POST',
			headers: { Authorization: `Basic ${btoa('hook:secret')}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: `evt_${Math.random()}`, user_id: 42, action, entity_type, entity_id: 1, entity: { id: 1 } }),
		},
		env,
		{ waitUntil, passThroughOnException: () => {}, props: {} } as unknown as ExecutionContext,
	);

beforeEach(() => {
	tenant = { subscription_exempt: false, first_subscription_at: null };
	hasSubscriptionRow = false;
	waitUntil = vi.fn((p: Promise<unknown>) => p.catch(() => {}));
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('OwnerRez webhooks for a tenant that has never paid', () => {
	it('keeps the property list current', async () => {
		const res = await deliver('property');
		expect(await res.json()).toEqual({ status: 'success' });
		expect(waitUntil).toHaveBeenCalled();
	});

	it.each(['booking', 'guest', 'inquiry'])('ignores %s events', async (entityType) => {
		const res = await deliver(entityType);
		expect(await res.json()).toEqual({ status: 'ignored', reason: 'not_subscribed' });
		expect(waitUntil).not.toHaveBeenCalled();
	});

	it('still handles a revoked authorization', async () => {
		await deliver('api_application', 'application_authorization_revoked');
		expect(waitUntil).toHaveBeenCalled();
	});
});

describe('OwnerRez webhooks for paying, former or exempt tenants', () => {
	it.each([
		['a subscriber', () => (hasSubscriptionRow = true)],
		['a former customer', () => (tenant.first_subscription_at = '2026-04-01T00:00:00Z')],
		['an exempt account', () => (tenant.subscription_exempt = true)],
	])('processes booking events for %s', async (_label, arrange) => {
		arrange();
		const res = await deliver('booking');
		expect(await res.json()).toEqual({ status: 'success' });
		expect(waitUntil).toHaveBeenCalled();
	});
});
