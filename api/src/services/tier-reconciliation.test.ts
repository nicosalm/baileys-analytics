import { describe, it, expect, vi, beforeEach } from 'vitest';
import { memorySupabase } from '../test-support/memory-supabase';

const sendTierChangeNotice = vi.fn(async (..._args: unknown[]) => true);
const sendOpsAlert = vi.fn(async (..._args: unknown[]) => true);

vi.mock('./email', async (importOriginal) => ({
	...(await importOriginal<typeof import('./email')>()),
	EmailService: class {
		sendTierChangeNotice = sendTierChangeNotice;
		sendOpsAlert = sendOpsAlert;
	},
}));

const { getTierStatus, reconcileTier, reconcileRenewals, DEFERRED_TIER_METADATA_KEY } = await import('./tier-reconciliation');

const NOW = Date.parse('2026-11-22T12:00:00Z');
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const iso = (ms: number) => new Date(ms).toISOString();

const env = {
	RESEND_API_KEY: 're_test',
	STRIPE_PRICE_STARTER_MONTHLY: 'price_starter_m',
	STRIPE_PRICE_STARTER_YEARLY: 'price_starter_y',
	STRIPE_PRICE_GROWTH_MONTHLY: 'price_growth_m',
	STRIPE_PRICE_GROWTH_YEARLY: 'price_growth_y',
	STRIPE_PRICE_PORTFOLIO_MONTHLY: 'price_portfolio_m',
	STRIPE_PRICE_PORTFOLIO_YEARLY: 'price_portfolio_y',
} as unknown as Env;

const PRICE_CENTS: Record<string, Record<string, number>> = {
	starter: { monthly: 2000, yearly: 19900 },
	growth: { monthly: 3900, yearly: 39900 },
	portfolio: { monthly: 7900, yearly: 79900 },
};

interface Seed {
	tenantId?: string;
	tier?: string;
	cycle?: 'monthly' | 'yearly';
	properties?: number;
	renewsIn?: number;
	preferred?: 'monthly' | 'yearly' | null;
	status?: string;
	exempt?: boolean;
}

let tables: Record<string, any[]>;

function seed(s: Seed = {}) {
	const tenantId = s.tenantId ?? 't1';
	const tier = s.tier ?? 'growth';
	const cycle = s.cycle ?? 'monthly';
	tables.tenants.push({ id: tenantId, subscription_exempt: s.exempt ?? false, email: `${tenantId}@example.com` });
	tables.subscriptions.push({
		tenant_id: tenantId,
		stripe_subscription_id: `sub_${tenantId}`,
		status: s.status ?? 'active',
		tier,
		billing_cycle: cycle,
		unit_amount: PRICE_CENTS[tier]?.[cycle] ?? 2000,
		current_period_end: iso(NOW + (s.renewsIn ?? 20 * DAY)),
		preferred_billing_cycle: s.preferred ?? null,
		pending_tier: null,
		pending_price_id: null,
		pending_unit_amount: null,
		pending_effective_at: null,
		pending_notified_at: null,
		contact_sales_notified_at: null,
	});
	setProperties(tenantId, s.properties ?? 7);
}

function setProperties(tenantId: string, count: number) {
	tables.properties = tables.properties.filter((p) => p.tenant_id !== tenantId);
	for (let i = 0; i < count; i++) tables.properties.push({ tenant_id: tenantId, active: true, deleted_at: null });
}

const sub = (tenantId = 't1') => tables.subscriptions.find((s) => s.tenant_id === tenantId);
const db = () => memorySupabase(tables);

beforeEach(() => {
	tables = { tenants: [], subscriptions: [], properties: [] };
	sendTierChangeNotice.mockClear();
	sendOpsAlert.mockClear();
	sendTierChangeNotice.mockResolvedValue(true);
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('getTierStatus', () => {
	it.each([
		['growth', 12, 'up', 'portfolio'],
		['growth', 3, 'down', 'starter'],
		['growth', 7, null, 'growth'],
		['starter', 9, 'up', 'growth'],
	])('%s with %i properties changes %s to %s', async (tier, properties, change, targetTier) => {
		seed({ tier, properties });
		const status = await getTierStatus(db(), 't1');
		expect(status).toMatchObject({ change, targetTier, propertyCount: properties });
	});

	it('flags 20 or more properties for sales without changing the tier', async () => {
		seed({ tier: 'portfolio', properties: 25 });
		expect(await getTierStatus(db(), 't1')).toMatchObject({
			change: null,
			targetTier: 'portfolio',
			resolvedTier: 'enterprise',
			needsContactSales: true,
			isOverage: true,
		});
	});

	it('counts only active, undeleted properties', async () => {
		seed({ properties: 5 });
		tables.properties.push(
			{ tenant_id: 't1', active: false, deleted_at: null },
			{ tenant_id: 't1', active: true, deleted_at: '2026-10-01' },
		);
		expect((await getTierStatus(db(), 't1'))?.propertyCount).toBe(5);
	});

	it('targets the preferred billing cycle', async () => {
		seed({ preferred: 'yearly' });
		expect(await getTierStatus(db(), 't1')).toMatchObject({
			change: null,
			billingCycle: 'monthly',
			targetBillingCycle: 'yearly',
			targetMonthlyDollars: 33,
		});
	});

	it.each([
		['a legacy subscription', { tier: 'legacy' }],
		['an exempt tenant', { exempt: true }],
		['a cancelled subscription', { status: 'canceled' }],
		['a tenant with no properties yet', { properties: 0 }],
	])('ignores %s', async (_label, s) => {
		seed(s as Seed);
		expect(await getTierStatus(db(), 't1')).toBeNull();
	});
});

describe('reconcileTier', () => {
	it('records a downgrade for the next renewal', async () => {
		seed({ properties: 3 });
		const { pendingPriceId } = await reconcileTier(env, db(), 't1', NOW);
		expect(pendingPriceId).toBe('price_starter_m');
		expect(sub()).toMatchObject({
			pending_tier: 'starter',
			pending_price_id: 'price_starter_m',
			pending_unit_amount: 2000,
			pending_effective_at: sub().current_period_end,
		});
	});

	it('clears the pending change once the count is back in range', async () => {
		seed({ properties: 12 });
		await reconcileTier(env, db(), 't1', NOW);
		setProperties('t1', 7);
		const { status } = await reconcileTier(env, db(), 't1', NOW);
		expect(status?.pending).toBeNull();
		expect(sub().pending_tier).toBeNull();
	});

	it('prices a cycle switch on the same tier', async () => {
		seed({ preferred: 'yearly' });
		const { status, pendingPriceId } = await reconcileTier(env, db(), 't1', NOW);
		expect(pendingPriceId).toBe('price_growth_y');
		expect(status?.pending).toMatchObject({ tier: 'growth', billingCycle: 'yearly', yearlyDollars: 399 });
	});

	it('emails the customer once inside the notice window', async () => {
		seed({ properties: 12, renewsIn: 5 * DAY });
		await reconcileTier(env, db(), 't1', NOW);
		await reconcileTier(env, db(), 't1', NOW);
		expect(sendTierChangeNotice).toHaveBeenCalledTimes(1);
		expect(sendTierChangeNotice).toHaveBeenCalledWith('t1@example.com', {
			propertyCount: 12,
			fromTierName: 'Growth',
			toTierName: 'Portfolio',
			fromCycle: 'monthly',
			toCycle: 'monthly',
			priceLabel: '$79 a month',
			effectiveAt: sub().current_period_end,
		});
		expect(sub().pending_notified_at).not.toBeNull();
	});

	it('waits for the notice window before emailing', async () => {
		seed({ properties: 12, renewsIn: 20 * DAY });
		await reconcileTier(env, db(), 't1', NOW);
		expect(sendTierChangeNotice).not.toHaveBeenCalled();
		expect(sub().pending_tier).toBe('portfolio');
	});

	it('gives yearly customers 30 days of notice', async () => {
		seed({ cycle: 'yearly', properties: 3, renewsIn: 25 * DAY });
		await reconcileTier(env, db(), 't1', NOW);
		expect(sendTierChangeNotice).toHaveBeenCalledWith('t1@example.com', expect.objectContaining({ priceLabel: '$199 a year' }));
	});

	it('emails again when the pending change itself changes', async () => {
		seed({ properties: 12, renewsIn: 5 * DAY });
		await reconcileTier(env, db(), 't1', NOW);
		setProperties('t1', 3);
		await reconcileTier(env, db(), 't1', NOW);
		expect(sendTierChangeNotice).toHaveBeenCalledTimes(2);
		expect(sendTierChangeNotice.mock.calls[1][1]).toMatchObject({ toTierName: 'Starter' });
	});

	it('retries the notice on the next run when sending fails', async () => {
		seed({ properties: 12, renewsIn: 5 * DAY });
		sendTierChangeNotice.mockResolvedValueOnce(false);
		await reconcileTier(env, db(), 't1', NOW);
		expect(sub().pending_notified_at).toBeNull();
		await reconcileTier(env, db(), 't1', NOW);
		expect(sendTierChangeNotice).toHaveBeenCalledTimes(2);
		expect(sub().pending_notified_at).not.toBeNull();
	});

	it('moves a stale pending change to the current renewal and notifies again', async () => {
		seed({ properties: 12, renewsIn: 5 * DAY });
		await reconcileTier(env, db(), 't1', NOW);
		// the renewal passed without the change being applied, so the period moved on
		sub().current_period_end = iso(NOW + 35 * DAY);
		await reconcileTier(env, db(), 't1', NOW + 30 * DAY);
		expect(sub().pending_effective_at).toBe(sub().current_period_end);
		expect(sendTierChangeNotice).toHaveBeenCalledTimes(2);
	});

	it('alerts ops once when a tenant reaches 20 properties, and again after it drops back and returns', async () => {
		seed({ tier: 'portfolio', properties: 22 });
		await reconcileTier(env, db(), 't1', NOW);
		await reconcileTier(env, db(), 't1', NOW);
		expect(sendOpsAlert).toHaveBeenCalledTimes(1);
		expect(sendTierChangeNotice).not.toHaveBeenCalled();

		setProperties('t1', 15);
		await reconcileTier(env, db(), 't1', NOW);
		expect(sub().contact_sales_notified_at).toBeNull();

		setProperties('t1', 21);
		await reconcileTier(env, db(), 't1', NOW);
		expect(sendOpsAlert).toHaveBeenCalledTimes(2);
	});

	it('leaves legacy subscriptions alone', async () => {
		seed({ tier: 'legacy', properties: 30, renewsIn: 2 * DAY });
		const { status, pendingPriceId } = await reconcileTier(env, db(), 't1', NOW);
		expect(status).toBeNull();
		expect(pendingPriceId).toBeNull();
		expect(sendTierChangeNotice).not.toHaveBeenCalled();
		expect(sendOpsAlert).not.toHaveBeenCalled();
	});
});

function fakeStripe(live: Record<string, { priceId: string; renewsIn: number; fail?: boolean }>) {
	const update = vi.fn(async (..._args: unknown[]) => ({}));
	const retrieve = vi.fn(async (id: string) => {
		const sub = live[id];
		if (!sub || sub.fail) throw new Error('stripe unavailable');
		return {
			metadata: { tenant_id: id.replace('sub_', '') },
			items: { data: [{ id: `si_${id}`, current_period_end: (NOW + sub.renewsIn) / 1000, price: { id: sub.priceId } }] },
		};
	});
	return { stripe: { subscriptions: { retrieve, update } } as any, retrieve, update };
}

describe('reconcileRenewals', () => {
	it('reprices a renewal that never had a pending row', async () => {
		seed({ properties: 12, renewsIn: HOUR });
		const { stripe, update } = fakeStripe({ sub_t1: { priceId: 'price_growth_m', renewsIn: HOUR } });
		expect(await reconcileRenewals(env, db(), stripe, NOW)).toEqual({ applied: 1, skipped: 0, errors: 0 });
		expect(update).toHaveBeenCalledWith('sub_t1', {
			items: [{ id: 'si_sub_t1', price: 'price_portfolio_m' }],
			proration_behavior: 'none',
			billing_cycle_anchor: 'unchanged',
			metadata: { tenant_id: 't1', [DEFERRED_TIER_METADATA_KEY]: 'portfolio' },
		});
	});

	it('applies a downgrade at renewal', async () => {
		seed({ properties: 3, renewsIn: HOUR });
		const { stripe, update } = fakeStripe({ sub_t1: { priceId: 'price_growth_m', renewsIn: HOUR } });
		await reconcileRenewals(env, db(), stripe, NOW);
		expect(update.mock.calls[0][1]).toMatchObject({ items: [{ price: 'price_starter_m' }], billing_cycle_anchor: 'unchanged' });
	});

	it('starts the new cycle now when switching between monthly and yearly', async () => {
		seed({ preferred: 'yearly', renewsIn: HOUR });
		const { stripe, update } = fakeStripe({ sub_t1: { priceId: 'price_growth_m', renewsIn: HOUR } });
		await reconcileRenewals(env, db(), stripe, NOW);
		expect(update.mock.calls[0][1]).toMatchObject({
			items: [{ price: 'price_growth_y' }],
			billing_cycle_anchor: 'now',
			proration_behavior: 'none',
		});
	});

	it('records the change but leaves Stripe alone outside the lead window', async () => {
		seed({ properties: 12, renewsIn: 3 * DAY });
		const { stripe, retrieve, update } = fakeStripe({ sub_t1: { priceId: 'price_growth_m', renewsIn: 3 * DAY } });
		expect(await reconcileRenewals(env, db(), stripe, NOW)).toEqual({ applied: 0, skipped: 1, errors: 0 });
		expect(retrieve).not.toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
		expect(sub().pending_tier).toBe('portfolio');
		expect(sendTierChangeNotice).toHaveBeenCalledTimes(1);
	});

	it('trusts the live renewal date over our copy', async () => {
		seed({ properties: 12, renewsIn: HOUR });
		const { stripe, update } = fakeStripe({ sub_t1: { priceId: 'price_growth_m', renewsIn: 30 * DAY } });
		await reconcileRenewals(env, db(), stripe, NOW);
		expect(update).not.toHaveBeenCalled();
	});

	it('does not push twice once Stripe is on the target price', async () => {
		seed({ properties: 12, renewsIn: HOUR });
		const { stripe, update } = fakeStripe({ sub_t1: { priceId: 'price_portfolio_m', renewsIn: HOUR } });
		await reconcileRenewals(env, db(), stripe, NOW);
		expect(update).not.toHaveBeenCalled();
		expect(sub().pending_tier).toBe('portfolio');
	});

	it('leaves Stripe alone when nothing changes', async () => {
		seed({ properties: 7, renewsIn: HOUR });
		const { stripe, retrieve } = fakeStripe({ sub_t1: { priceId: 'price_growth_m', renewsIn: HOUR } });
		expect(await reconcileRenewals(env, db(), stripe, NOW)).toEqual({ applied: 0, skipped: 1, errors: 0 });
		expect(retrieve).not.toHaveBeenCalled();
	});

	it('skips legacy, exempt and far-off renewals without asking Stripe', async () => {
		seed({ tenantId: 'legacy', tier: 'legacy', properties: 12, renewsIn: HOUR });
		seed({ tenantId: 'exempt', exempt: true, properties: 12, renewsIn: HOUR });
		seed({ tenantId: 'later', properties: 12, renewsIn: 60 * DAY });
		const { stripe, retrieve } = fakeStripe({});
		const result = await reconcileRenewals(env, db(), stripe, NOW);
		expect(result.applied).toBe(0);
		expect(retrieve).not.toHaveBeenCalled();
		expect(sub('later').pending_tier).toBeNull();
	});

	it('keeps going after one subscription fails', async () => {
		seed({ tenantId: 'bad', properties: 12, renewsIn: HOUR });
		seed({ tenantId: 'good', properties: 12, renewsIn: HOUR });
		const { stripe, update } = fakeStripe({
			sub_bad: { priceId: 'price_growth_m', renewsIn: HOUR, fail: true },
			sub_good: { priceId: 'price_growth_m', renewsIn: HOUR },
		});
		expect(await reconcileRenewals(env, db(), stripe, NOW)).toEqual({ applied: 1, skipped: 0, errors: 1 });
		expect(update).toHaveBeenCalledWith('sub_good', expect.anything());
	});

	it('still catches a renewal the cron missed by a few hours', async () => {
		seed({ properties: 12, renewsIn: -2 * HOUR });
		const { stripe, retrieve } = fakeStripe({ sub_t1: { priceId: 'price_growth_m', renewsIn: 30 * DAY } });
		await reconcileRenewals(env, db(), stripe, NOW);
		// our copy is stale; the live subscription has already renewed, so nothing is pushed
		expect(retrieve).toHaveBeenCalledTimes(1);
	});
});
