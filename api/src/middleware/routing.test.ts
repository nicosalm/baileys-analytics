import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { AppEnv } from '../types';

// Fake Supabase: one user per bearer token, one tenant per user, subscription status per tenant.
const USERS: Record<string, { id: string }> = { tok_a: { id: 'user_a' }, tok_b: { id: 'user_b' } };
const TENANT_BY_USER: Record<string, string> = { user_a: 'tenant_a', user_b: 'tenant_b' };
let subscriptionStatus: Record<string, string | undefined>;
let oauthStates: Record<string, { tenant_id: string; user_id: string; expires_at: string }>;
let getUserCalls = 0;

vi.mock('../services/supabase', () => ({ createSupabaseClient: () => fakeSupabase() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => fakeSupabase() }));

function fakeSupabase() {
	return {
		auth: {
			getUser: async (token: string) => {
				getUserCalls++;
				return { data: { user: USERS[token] ?? null }, error: USERS[token] ? null : { message: 'bad' } };
			},
		},
		from: (table: string) => {
			const filters: Record<string, any> = {};
			const q: any = {
				select: () => q,
				insert: () => q,
				delete: () => q,
				eq: (col: string, val: any) => {
					filters[col] = val;
					return q;
				},
				then: (resolve: any) => resolve({ error: null }),
				maybeSingle: async () => q.single(),
				single: async () => {
					if (table === 'tenants' && filters.user_id) return { data: { id: TENANT_BY_USER[filters.user_id] } };
					if (table === 'tenants') return { data: { subscription_exempt: false, created_at: new Date().toISOString() } };
					if (table === 'subscriptions') {
						const status = subscriptionStatus[filters.tenant_id];
						return status ? { data: { status } } : { data: null, error: { message: 'none' } };
					}
					if (table === 'oauth_states') {
						const row = oauthStates[filters.id];
						return row ? { data: row, error: null } : { data: null, error: { message: 'none' } };
					}
					return { data: null };
				},
			};
			return q;
		},
	};
}

const { authMiddleware } = await import('./auth');
const { subscriptionMiddleware, PAID_SYNC_PATHS } = await import('./subscription');
const { oauth } = await import('../routes/oauth');

// Mirrors index.ts: app-level auth + subscription check, sub-app with its own auth.
function buildApp() {
	const app = new Hono<AppEnv>();
	app.use('/api/bookings/*', authMiddleware, subscriptionMiddleware);
	app.use('/api/bookings', authMiddleware, subscriptionMiddleware);
	app.use('/api/oauth/*', authMiddleware);

	PAID_SYNC_PATHS.forEach((path) => {
		app.use(path, authMiddleware, subscriptionMiddleware);
	});

	const sync = new Hono<AppEnv>();
	sync.use('/*', authMiddleware);
	sync.post('/*', (c) => c.json({ ok: true }));
	app.route('/api/sync', sync);

	const bookings = new Hono<AppEnv>();
	bookings.use('/*', authMiddleware);
	bookings.get('/', (c) => c.json({ tenantId: c.get('tenantId') }));
	app.route('/api/bookings', bookings);
	app.route('/api/oauth', oauth);
	return app;
}

const env = { FRONTEND_URL: 'https://app.test', OWNERREZ_CLIENT_ID: 'c', OWNERREZ_CLIENT_SECRET: 's' } as Env;
const get = (path: string, token?: string) => buildApp().request(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} }, env);

describe('dashboard route middleware ordering', () => {
	beforeEach(() => {
		getUserCalls = 0;
		subscriptionStatus = { tenant_a: 'active', tenant_b: 'canceled' };
		oauthStates = {};
	});

	it('serves a subscribed tenant and authenticates only once', async () => {
		const res = await get('/api/bookings', 'tok_a');
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ tenantId: 'tenant_a' });
		expect(getUserCalls).toBe(1);
	});

	it('blocks a tenant whose subscription is no longer active', async () => {
		const res = await get('/api/bookings', 'tok_b');
		expect(res.status).toBe(403);
		expect(((await res.json()) as any).code).toBe('SUBSCRIPTION_INACTIVE');
	});

	it('blocks a tenant with no subscription, including one created today', async () => {
		subscriptionStatus.tenant_a = undefined;
		const res = await get('/api/bookings', 'tok_a');
		expect(res.status).toBe(403);
		expect(((await res.json()) as any).code).toBe('SUBSCRIPTION_REQUIRED');
	});

	it('still rejects unauthenticated requests', async () => {
		expect((await get('/api/bookings')).status).toBe(401);
	});
});

describe('sync gating before payment', () => {
	beforeEach(() => {
		subscriptionStatus = { tenant_a: 'active', tenant_b: undefined };
	});

	const postSync = (step: string, token: string) =>
		buildApp().request(`/api/sync/${step}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }, env);

	it('lets an unpaid tenant sync its property list for a quote', async () => {
		expect((await postSync('properties', 'tok_b')).status).toBe(200);
	});

	it.each(['bookings', 'guests', 'inquiries', 'complete', 'reset'])('blocks /sync/%s until the tenant pays', async (step) => {
		const res = await postSync(step, 'tok_b');
		expect(res.status).toBe(403);
		expect(((await res.json()) as any).code).toBe('SUBSCRIPTION_REQUIRED');
	});

	it('runs the full import for a paying tenant', async () => {
		expect((await postSync('bookings', 'tok_a')).status).toBe(200);
	});
});

describe('oauth callback state ownership', () => {
	beforeEach(() => {
		oauthStates = {
			state_a: { tenant_id: 'tenant_a', user_id: 'user_a', expires_at: new Date(Date.now() + 60_000).toISOString() },
		};
	});

	const postCallback = (token: string) =>
		buildApp().request(
			'/api/oauth/callback',
			{
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ code: 'tc_x', state: 'state_a' }),
			},
			env,
		);

	it('rejects a state issued to a different user', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		const res = await postCallback('tok_b');
		expect(res.status).toBe(400);
		expect(fetchSpy).not.toHaveBeenCalled();
		fetchSpy.mockRestore();
	});

	it('lets the owning user through to the token exchange', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 400 }));
		await postCallback('tok_a');
		expect(fetchSpy).toHaveBeenCalledWith('https://api.ownerrez.com/oauth/access_token', expect.anything());
		fetchSpy.mockRestore();
	});
});
