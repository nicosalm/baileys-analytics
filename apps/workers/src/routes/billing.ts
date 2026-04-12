import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { createSupabaseClient } from '../services/supabase';
import { StripeService } from '../services/stripe';
import { markPendingTierIfNeeded, TIER_PRICE_ENV_VARS } from '../services/tier-reconciliation';
import { PURCHASABLE_TIER_SLUGS, type TierSlug } from '@baileys/constants';

const billing = new Hono<{ Bindings: Env; Variables: { user: any; tenantId: string } }>();

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
    return c.json({ error: 'Webhook processing failed' }, 400);
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
    const { data: tenant } = await supabase
      .from('tenants')
      .select('subscription_exempt')
      .eq('id', tenantId)
      .single();

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

// create checkout session for new subscription
billing.post('/create-checkout-session', async (c) => {
  try {
    const supabase = createSupabaseClient(c.env);
    const stripeService = new StripeService(c.env, supabase);
    const tenantId = c.get('tenantId');
    const user = c.get('user');

    const { tier, isYearly } = await c.req.json<{ tier?: string; isYearly?: boolean }>();

    if (!tier || !PURCHASABLE_TIER_SLUGS.includes(tier as TierSlug)) {
      return c.json({ error: 'Invalid or non-purchasable tier' }, 400);
    }

    const envVars = TIER_PRICE_ENV_VARS[tier as Exclude<TierSlug, 'enterprise'>];
    const stripePriceId = c.env[isYearly ? envVars.yearly : envVars.monthly];

    if (typeof stripePriceId !== 'string' || !stripePriceId) {
      console.error(`Missing Stripe price env var for tier=${tier} yearly=${isYearly}`);
      return c.json({ error: 'Tier not yet configured' }, 500);
    }

    const successUrl = `${c.env.FRONTEND_URL}/settings?tab=billing&checkout=success`;
    const cancelUrl = `${c.env.FRONTEND_URL}/settings?tab=billing&checkout=cancel`;

    const session = await stripeService.createCheckoutSession(
      tenantId,
      user.email,
      stripePriceId,
      successUrl,
      cancelUrl,
    );

    return c.json(session);
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return c.json({ error: 'Failed to create checkout session' }, 500);
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
