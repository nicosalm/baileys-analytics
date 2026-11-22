import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { AppEnv } from '../types';

let state: { connected: boolean; propertyCount: number; subscriptionStatus?: string };
const createCheckoutSession = vi.fn(async (..._args: unknown[]) => ({ sessionId: 'cs_1', url: 'https://checkout.stripe.test/cs_1' }));
const confirmCheckout = vi.fn(async (..._args: unknown[]): Promise<'not_found' | 'pending' | 'active'> => 'active');

vi.mock('../services/supabase', () => ({ createSupabaseClient: () => fakeSupabase() }));
vi.mock('../middleware/auth', () => ({
	authMiddleware: async (c: any, next: any) => {
		c.set('user', { id: 'user_a', email: 'owner@example.com' });
		c.set('tenantId', 'tenant_a');
		await next();
	},
}));
vi.mock('../services/stripe', () => ({
	StripeService: class {
		createCheckoutSession = createCheckoutSession;
		confirmCheckout = confirmCheckout;
	},
}));

function fakeSupabase() {
	return {
		from: (table: string) => {
			const q: any = {
				select: () => q,
				eq: () => q,
				is: () => q,
				maybeSingle: async () => {
					if (table === 'oauth_tokens') return { data: state.connected ? { id: 'tok' } : null };
					if (table === 'subscriptions') return { data: state.subscriptionStatus ? { status: state.subscriptionStatus } : null };
					return { data: null };
				},
				then: (resolve: any) => resolve(table === 'properties' ? { count: state.propertyCount, error: null } : { data: null, error: null }),
			};
			return q;
		},
	};
}

const { billing } = await import('./billing');

const env = {
	FRONTEND_URL: 'https://app.test',
	STRIPE_PRICE_STARTER_MONTHLY: 'price_starter_m',
	STRIPE_PRICE_STARTER_YEARLY: 'price_starter_y',
	STRIPE_PRICE_GROWTH_MONTHLY: 'price_growth_m',
	STRIPE_PRICE_GROWTH_YEARLY: 'price_growth_y',
	STRIPE_PRICE_PORTFOLIO_MONTHLY: 'price_portfolio_m',
	STRIPE_PRICE_PORTFOLIO_YEARLY: 'price_portfolio_y',
} as unknown as Env;

const app = new Hono<AppEnv>().route('/api/billing', billing);
const getQuote = () => app.request('/api/billing/quote', {}, env);
const post = (path: string, body: unknown) =>
	app.request(`/api/billing/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, env);

beforeEach(() => {
	state = { connected: true, propertyCount: 7 };
	createCheckoutSession.mockClear();
	confirmCheckout.mockClear();
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('GET /billing/quote', () => {
	it('needs an OwnerRez connection', async () => {
		state.connected = false;
		const res = await getQuote();
		expect(res.status).toBe(409);
		expect(((await res.json()) as any).code).toBe('OWNERREZ_NOT_CONNECTED');
	});

	it('prices the tier that matches the property count', async () => {
		const res = await getQuote();
		expect(await res.json()).toEqual({
			propertyCount: 7,
			tier: 'growth',
			tierName: 'Growth',
			monthlyCents: 3900,
			yearlyCents: 39900,
			needsContactSales: false,
		});
	});

	it('has no tier when OwnerRez has no active properties', async () => {
		state.propertyCount = 0;
		expect(((await (await getQuote()).json()) as any).tier).toBeNull();
	});

	it('sends 20 or more properties to sales', async () => {
		state.propertyCount = 25;
		expect((await (await getQuote()).json()) as any).toMatchObject({ tier: 'enterprise', needsContactSales: true, monthlyCents: null });
	});
});

describe('POST /billing/create-checkout-session', () => {
	it('charges the tier for the property count', async () => {
		const res = await post('create-checkout-session', { isYearly: false });
		expect(res.status).toBe(200);
		expect(createCheckoutSession).toHaveBeenCalledWith(
			'tenant_a',
			'owner@example.com',
			'price_growth_m',
			'https://app.test/dashboard/overview?checkout_session={CHECKOUT_SESSION_ID}',
			'https://app.test/dashboard/overview?checkout=cancel',
			{ tier: 'growth', property_count: '7' },
		);
	});

	it('ignores a tier sent by the client', async () => {
		state.propertyCount = 15;
		await post('create-checkout-session', { tier: 'starter', isYearly: true });
		expect(createCheckoutSession.mock.calls[0][2]).toBe('price_portfolio_y');
	});

	it.each([
		['no active properties', { propertyCount: 0 }, 'NO_PROPERTIES'],
		['20 or more properties', { propertyCount: 20 }, 'CONTACT_SALES'],
		['no OwnerRez connection', { connected: false }, 'OWNERREZ_NOT_CONNECTED'],
		['an existing subscription', { subscriptionStatus: 'active' }, 'ALREADY_SUBSCRIBED'],
		['a past due subscription', { subscriptionStatus: 'past_due' }, 'ALREADY_SUBSCRIBED'],
	])('refuses %s without calling Stripe', async (_label, patch, code) => {
		Object.assign(state, patch);
		const res = await post('create-checkout-session', { isYearly: false });
		expect(res.status).toBe(409);
		expect(((await res.json()) as any).code).toBe(code);
		expect(createCheckoutSession).not.toHaveBeenCalled();
	});

	it('lets a cancelled customer subscribe again', async () => {
		state.subscriptionStatus = 'canceled';
		expect((await post('create-checkout-session', { isYearly: false })).status).toBe(200);
	});
});

describe('POST /billing/confirm-checkout', () => {
	it('rejects something that is not a checkout session id', async () => {
		expect((await post('confirm-checkout', { sessionId: 'sub_1' })).status).toBe(400);
		expect(confirmCheckout).not.toHaveBeenCalled();
	});

	it('returns 404 for a session that belongs to someone else', async () => {
		confirmCheckout.mockResolvedValueOnce('not_found');
		expect((await post('confirm-checkout', { sessionId: 'cs_other' })).status).toBe(404);
	});

	it('reports whether the plan is active yet', async () => {
		expect(await (await post('confirm-checkout', { sessionId: 'cs_1' })).json()).toEqual({ hasActivePlan: true });
		expect(confirmCheckout).toHaveBeenCalledWith('tenant_a', 'cs_1');

		confirmCheckout.mockResolvedValueOnce('pending');
		expect(await (await post('confirm-checkout', { sessionId: 'cs_1' })).json()).toEqual({ hasActivePlan: false });
	});
});
