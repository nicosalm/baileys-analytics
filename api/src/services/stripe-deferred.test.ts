import { describe, it, expect, vi, beforeEach } from 'vitest';
import { memorySupabase } from '../test-support/memory-supabase';

const sendWelcomeEmail = vi.fn(async (..._args: unknown[]) => true);
vi.mock('./email', async (importOriginal) => ({
	...(await importOriginal<typeof import('./email')>()),
	EmailService: class {
		sendWelcomeEmail = sendWelcomeEmail;
	},
}));

const { StripeService } = await import('./stripe');

// crypto.subtle.timingSafeEqual is a Workers extension; node lacks it
if (!(crypto.subtle as any).timingSafeEqual) {
	(crypto.subtle as any).timingSafeEqual = (a: Uint8Array, b: Uint8Array) => a.byteLength === b.byteLength && a.every((v, i) => v === b[i]);
}

const SECRET = 'whsec_test';
const env = { STRIPE_SECRET_KEY: 'sk_test', STRIPE_WEBHOOK_SECRET: SECRET, RESEND_API_KEY: 're_test' } as Env;
const PERIOD_END = Math.floor(Date.parse('2026-12-03T00:00:00Z') / 1000);

async function sign(payload: string) {
	const t = Math.floor(Date.now() / 1000);
	const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`));
	return `t=${t},v1=${Array.from(new Uint8Array(sig))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('')}`;
}

const price = (tier: string, interval: 'month' | 'year', unit_amount: number) => ({
	id: `price_${tier}_${interval === 'year' ? 'y' : 'm'}`,
	unit_amount,
	recurring: { interval },
	metadata: { tier },
});

// the live subscription after the cron pushed a deferred change
const liveSubscription = (p: ReturnType<typeof price>, deferredTier: string) => ({
	id: 'sub_1',
	customer: 'cus_1',
	status: 'active',
	metadata: { tenant_id: 't1', deferred_tier_change: deferredTier },
	items: { data: [{ id: 'si_1', current_period_start: PERIOD_END - 2592000, current_period_end: PERIOD_END, price: p }] },
	trial_start: null,
	trial_end: null,
	cancel_at: null,
	canceled_at: null,
});

let tables: Record<string, any[]>;
let live: any;
const stripeUpdate = vi.fn(async (..._args: unknown[]) => ({}));

function service() {
	const s = new StripeService(env, memorySupabase(tables));
	(s as any).stripe = { subscriptions: { retrieve: async () => live, update: stripeUpdate } };
	return s;
}

async function deliver(type: string, object: unknown) {
	const payload = JSON.stringify({ id: `evt_${type}_${Math.random()}`, type, data: { object } });
	return service().handleWebhook(await sign(payload), payload);
}

beforeEach(() => {
	stripeUpdate.mockClear();
	sendWelcomeEmail.mockClear();
	tables = {
		tenants: [{ id: 't1', email: 'owner@example.com', first_subscription_at: '2026-04-01T00:00:00Z' }],
		stripe_customers: [{ tenant_id: 't1', stripe_customer_id: 'cus_1' }],
		stripe_webhook_events: [],
		billing_history: [],
		subscriptions: [
			{
				tenant_id: 't1',
				stripe_subscription_id: 'sub_1',
				status: 'active',
				tier: 'growth',
				billing_cycle: 'monthly',
				unit_amount: 3900,
				stripe_price_id: 'price_growth_m',
				preferred_billing_cycle: null,
				pending_tier: 'starter',
				pending_price_id: 'price_starter_m',
				pending_unit_amount: 2000,
				pending_effective_at: new Date(PERIOD_END * 1000).toISOString(),
				pending_notified_at: '2026-11-26T00:00:00Z',
			},
		],
	};
});

const row = () => tables.subscriptions[0];

describe('deferred plan changes', () => {
	it('keeps showing the old tier after a pushed downgrade, then switches once the invoice is paid', async () => {
		live = liveSubscription(price('starter', 'month', 2000), 'starter');
		await deliver('customer.subscription.updated', live);
		expect(row()).toMatchObject({ tier: 'growth', unit_amount: 3900, stripe_price_id: 'price_growth_m', pending_tier: 'starter' });

		await deliver('invoice.payment_succeeded', { id: 'in_1', customer: 'cus_1', amount_paid: 2000, currency: 'usd' });
		expect(row()).toMatchObject({
			tier: 'starter',
			unit_amount: 2000,
			stripe_price_id: 'price_starter_m',
			billing_cycle: 'monthly',
			pending_tier: null,
			pending_price_id: null,
			pending_notified_at: null,
		});
		expect(stripeUpdate).toHaveBeenCalledWith('sub_1', { metadata: { tenant_id: 't1', deferred_tier_change: null } });
	});

	it('holds a switch to yearly billing until the invoice is paid', async () => {
		Object.assign(row(), {
			preferred_billing_cycle: 'yearly',
			pending_tier: 'growth',
			pending_price_id: 'price_growth_y',
			pending_unit_amount: 39900,
		});
		live = liveSubscription(price('growth', 'year', 39900), 'growth');
		await deliver('customer.subscription.updated', live);
		expect(row()).toMatchObject({ billing_cycle: 'monthly', unit_amount: 3900, preferred_billing_cycle: 'yearly' });

		await deliver('invoice.payment_succeeded', { id: 'in_2', customer: 'cus_1', amount_paid: 39900, currency: 'usd' });
		expect(row()).toMatchObject({
			tier: 'growth',
			billing_cycle: 'yearly',
			unit_amount: 39900,
			stripe_price_id: 'price_growth_y',
			preferred_billing_cycle: null,
			pending_tier: null,
		});
	});

	it('clears the pending change and preferred cycle when the subscription is cancelled', async () => {
		row().preferred_billing_cycle = 'yearly';
		await deliver('customer.subscription.deleted', {
			id: 'sub_1',
			metadata: { tenant_id: 't1' },
			canceled_at: PERIOD_END,
			ended_at: PERIOD_END,
		});
		expect(row()).toMatchObject({ status: 'canceled', pending_tier: null, pending_notified_at: null, preferred_billing_cycle: null });
	});
});

describe('welcome email', () => {
	const subscription = (status: string) => ({
		...liveSubscription(price('growth', 'month', 3900), 'growth'),
		status,
		metadata: { tenant_id: 't1' },
	});

	beforeEach(() => {
		tables.tenants[0].first_subscription_at = null;
		tables.subscriptions = [];
	});

	it('goes out once, when the first subscription becomes active', async () => {
		await deliver('customer.subscription.created', subscription('active'));
		await deliver('customer.subscription.updated', subscription('active'));
		expect(sendWelcomeEmail).toHaveBeenCalledTimes(1);
		expect(sendWelcomeEmail).toHaveBeenCalledWith('owner@example.com');
		expect(tables.tenants[0].first_subscription_at).not.toBeNull();
	});

	it('waits while Checkout reports the subscription as incomplete', async () => {
		await deliver('customer.subscription.created', subscription('incomplete'));
		expect(sendWelcomeEmail).not.toHaveBeenCalled();
		expect(tables.tenants[0].first_subscription_at).toBeNull();

		await deliver('customer.subscription.updated', subscription('active'));
		expect(sendWelcomeEmail).toHaveBeenCalledTimes(1);
	});

	it('is not sent again to a returning customer', async () => {
		tables.tenants[0].first_subscription_at = '2026-04-01T00:00:00Z';
		await deliver('customer.subscription.created', subscription('active'));
		expect(sendWelcomeEmail).not.toHaveBeenCalled();
	});
});
