import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { createSupabaseClient } from '../services/supabase';
import { StripeService } from '../services/stripe';
import { markPendingTierIfNeeded, TIER_PRICE_ENV_VARS } from '../services/tier-reconciliation';
import { countBillableProperties } from '../services/billable-properties';
import { PURCHASABLE_TIER_SLUGS, resolveTierForPropertyCount, type Tier, type TierSlug } from '@baileys/constants';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppEnv } from '../types';

const billing = new Hono<AppEnv>();

// stripe webhook handler (no auth required - uses signature verification)
billing.post('/webhook', async (c) => {
	try {
		const signature = c.req.header('stripe-signature');
		if (!signature) {
			return c.json({ error: 'No signature header' }, 400);
		}

		const payload = await c.req.text();
		const supabase = createSupabaseClient(c.env);
		const stripeService = new StripeService(c.env, supabase);

		const result = await stripeService.handleWebhook(signature, payload);

		return c.json(result);
	} catch (error) {
		console.error('Webhook error:', error);
		// bad signatures are permanent (400, no retry); anything else is ours, so 500 makes Stripe retry
		const isSignatureError = error instanceof Error && error.message === 'Invalid signature';
		return c.json({ error: 'Webhook processing failed' }, isSignatureError ? 400 : 500);
	}
});

// all other billing routes require authentication
billing.use('/*', authMiddleware);

// Combined subscription + tier status read. Returns everything BillingTab
// needs in a single round trip — that's deliberate. The previous split (one
// route mutated state via reconciliation, the other read it) raced when the
// frontend fired both in parallel and the banner appearance was
// non-deterministic. Sequencing fixes the symptom; combining fixes the cause.
billing.get('/subscription', async (c) => {
	try {
		const supabase = createSupabaseClient(c.env);
		const tenantId = c.get('tenantId');

		// exempt tenants short-circuit before any Stripe calls
		const { data: tenant } = await supabase.from('tenants').select('subscription_exempt').eq('id', tenantId).single();

		if (tenant?.subscription_exempt === true) {
			return c.json({
				subscription: null,
				tierStatus: null,
				isExempt: true,
			});
		}

		const stripeService = new StripeService(c.env, supabase);

		// Lazy DB-only reconciliation. Records pending_* if the customer has
		// outgrown their tier and returns the resulting TierStatus in one shot.
		// NEVER touches Stripe — that's the cron's job. This means the displayed
		// subscription stays consistent until the renewal actually happens,
		// eliminating the "wait, am I being charged Portfolio already?" confusion.
		// Wrapped in try/catch so a DB hiccup can't break the billing page.
		let tierStatus = null;
		try {
			tierStatus = await markPendingTierIfNeeded(c.env, supabase, tenantId);
		} catch (err) {
			console.error('markPendingTierIfNeeded failed during /subscription read:', err);
		}

		const subscription = await stripeService.getSubscription(tenantId);

		return c.json({
			subscription,
			tierStatus,
			isExempt: false,
		});
	} catch (error) {
		console.error('Error fetching subscription:', error);
		return c.json({ error: 'Failed to fetch subscription' }, 500);
	}
});

type PlanQuote = { ok: true; propertyCount: number; tier: Tier | null } | { ok: false; code: 'OWNERREZ_NOT_CONNECTED'; error: string };

// the tier comes from the property count, never from the client. a count of 0 has no tier
async function quotePlan(supabase: SupabaseClient, tenantId: string): Promise<PlanQuote> {
	const { data: token } = await supabase
		.from('oauth_tokens')
		.select('id')
		.eq('tenant_id', tenantId)
		.eq('provider', 'ownerrez')
		.maybeSingle();
	if (!token) {
		return { ok: false, code: 'OWNERREZ_NOT_CONNECTED', error: 'Connect OwnerRez before choosing a plan' };
	}
	const propertyCount = await countBillableProperties(supabase, tenantId);
	return { ok: true, propertyCount, tier: propertyCount > 0 ? resolveTierForPropertyCount(propertyCount) : null };
}

billing.get('/quote', async (c) => {
	try {
		const quote = await quotePlan(createSupabaseClient(c.env), c.get('tenantId'));
		if (!quote.ok) return c.json({ error: quote.error, code: quote.code }, 409);
		const { tier } = quote;
		return c.json({
			propertyCount: quote.propertyCount,
			tier: tier?.slug ?? null,
			tierName: tier?.name ?? null,
			monthlyCents: tier?.monthlyPriceCents ?? null,
			yearlyCents: tier?.yearlyPriceCents ?? null,
			needsContactSales: tier?.contactSales === true,
		});
	} catch (error) {
		console.error('Error building plan quote:', error);
		return c.json({ error: 'Failed to count your properties' }, 500);
	}
});

// create checkout session for new subscription. the client only picks the billing cycle
billing.post('/create-checkout-session', async (c) => {
	try {
		const supabase = createSupabaseClient(c.env);
		const stripeService = new StripeService(c.env, supabase);
		const tenantId = c.get('tenantId');
		const user = c.get('user');

		const { isYearly } = await c.req.json<{ isYearly?: boolean }>();

		if (!user.email) {
			return c.json({ error: 'An account with an email address is required to subscribe' }, 400);
		}

		// a second checkout would double-bill; the plan follows the property count from here on
		const { data: existing } = await supabase.from('subscriptions').select('status').eq('tenant_id', tenantId).maybeSingle();
		if (existing && ['active', 'trialing', 'past_due'].includes(existing.status)) {
			return c.json(
				{
					error: 'You already have a subscription. Your plan follows your property count automatically.',
					code: 'ALREADY_SUBSCRIBED',
				},
				409,
			);
		}

		const quote = await quotePlan(supabase, tenantId);
		if (!quote.ok) return c.json({ error: quote.error, code: quote.code }, 409);
		const { tier, propertyCount } = quote;
		if (!tier) {
			return c.json({ error: 'No active properties found in OwnerRez', code: 'NO_PROPERTIES' }, 409);
		}
		if (tier.contactSales) {
			return c.json({ error: 'Portfolios of 20 or more properties are priced individually', code: 'CONTACT_SALES' }, 409);
		}

		const envVars = TIER_PRICE_ENV_VARS[tier.slug as Exclude<TierSlug, 'enterprise'>];
		const stripePriceId = c.env[isYearly ? envVars.yearly : envVars.monthly];

		if (typeof stripePriceId !== 'string' || !stripePriceId) {
			console.error(`Missing Stripe price env var for tier=${tier.slug} yearly=${isYearly}`);
			return c.json({ error: 'Tier not yet configured' }, 500);
		}

		// stripe fills in {CHECKOUT_SESSION_ID}; the dashboard confirms the session in case the webhook is late
		const successUrl = `${c.env.FRONTEND_URL}/dashboard/overview?checkout_session={CHECKOUT_SESSION_ID}`;
		const cancelUrl = `${c.env.FRONTEND_URL}/dashboard/overview?checkout=cancel`;

		const session = await stripeService.createCheckoutSession(tenantId, user.email, stripePriceId, successUrl, cancelUrl, {
			tier: tier.slug,
			property_count: String(propertyCount),
		});

		return c.json(session);
	} catch (error) {
		console.error('Error creating checkout session:', error);
		return c.json({ error: 'Failed to create checkout session' }, 500);
	}
});

billing.post('/confirm-checkout', async (c) => {
	try {
		const { sessionId } = await c.req.json<{ sessionId?: string }>();
		if (!sessionId?.startsWith('cs_')) {
			return c.json({ error: 'Invalid checkout session' }, 400);
		}
		const supabase = createSupabaseClient(c.env);
		const result = await new StripeService(c.env, supabase).confirmCheckout(c.get('tenantId'), sessionId);
		if (result === 'not_found') {
			return c.json({ error: 'Checkout session not found', code: 'CHECKOUT_NOT_FOUND' }, 404);
		}
		return c.json({ hasActivePlan: result === 'active' });
	} catch (error) {
		console.error('Error confirming checkout session:', error);
		return c.json({ error: 'Failed to confirm checkout' }, 500);
	}
});

// switches between monthly and yearly at the next renewal; the cron applies it with the tier
billing.post('/billing-cycle', async (c) => {
	try {
		const { cycle } = await c.req.json<{ cycle?: string }>();
		if (cycle !== 'monthly' && cycle !== 'yearly') {
			return c.json({ error: 'Billing cycle must be monthly or yearly' }, 400);
		}
		const supabase = createSupabaseClient(c.env);
		const tenantId = c.get('tenantId');

		const { data: sub } = await supabase
			.from('subscriptions')
			.select('status, tier, billing_cycle')
			.eq('tenant_id', tenantId)
			.maybeSingle();
		if (!sub || sub.status !== 'active') {
			return c.json({ error: 'No active subscription', code: 'NO_SUBSCRIPTION' }, 409);
		}
		if (!PURCHASABLE_TIER_SLUGS.includes(sub.tier as TierSlug)) {
			return c.json(
				{
					error: 'Early supporter plans keep their original billing. Email support@baileysanalytics.com to change it.',
					code: 'LEGACY_PLAN',
				},
				409,
			);
		}

		await supabase
			.from('subscriptions')
			.update({ preferred_billing_cycle: cycle === sub.billing_cycle ? null : cycle })
			.eq('tenant_id', tenantId);

		return c.json({ tierStatus: await markPendingTierIfNeeded(c.env, supabase, tenantId) });
	} catch (error) {
		console.error('Error changing billing cycle:', error);
		return c.json({ error: 'Failed to change billing cycle' }, 500);
	}
});

// create customer portal session for managing subscription
billing.post('/create-portal-session', async (c) => {
	try {
		const supabase = createSupabaseClient(c.env);
		const stripeService = new StripeService(c.env, supabase);
		const tenantId = c.get('tenantId');

		const returnUrl = `${c.env.FRONTEND_URL}/settings?tab=billing`;

		const session = await stripeService.createPortalSession(tenantId, returnUrl);

		return c.json(session);
	} catch (error) {
		console.error('Error creating portal session:', error);
		return c.json({ error: 'Failed to create portal session' }, 500);
	}
});

// get billing history
billing.get('/history', async (c) => {
	try {
		const supabase = createSupabaseClient(c.env);
		const tenantId = c.get('tenantId');

		const { data: history, error } = await supabase
			.from('billing_history')
			.select('*')
			.eq('tenant_id', tenantId)
			.order('created_at', { ascending: false })
			.limit(50);

		if (error) throw error;

		return c.json({ history: history || [] });
	} catch (error) {
		console.error('Error fetching billing history:', error);
		return c.json({ error: 'Failed to fetch billing history' }, 500);
	}
});

// get usage metrics
billing.get('/usage', async (c) => {
	try {
		const supabase = createSupabaseClient(c.env);
		const stripeService = new StripeService(c.env, supabase);
		const tenantId = c.get('tenantId');

		const metrics = await stripeService.getUsageMetrics(tenantId);

		return c.json({ metrics });
	} catch (error) {
		console.error('Error fetching usage metrics:', error);
		return c.json({ error: 'Failed to fetch usage metrics' }, 500);
	}
});

export { billing };
