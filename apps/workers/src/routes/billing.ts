import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { createSupabaseClient } from '../services/supabase';
import { StripeService } from '../services/stripe';

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

// get current subscription
billing.get('/subscription', async (c) => {
  try {
    const supabase = createSupabaseClient(c.env);
    const stripeService = new StripeService(c.env, supabase);
    const tenantId = c.get('tenantId');

    // check if tenant is exempt from subscriptions
    const { data: tenant } = await supabase
      .from('tenants')
      .select('subscription_exempt')
      .eq('id', tenantId)
      .single();

    const subscription = await stripeService.getSubscription(tenantId);

    return c.json({
      subscription,
      isExempt: tenant?.subscription_exempt === true
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return c.json({ error: 'Failed to fetch subscription' }, 500);
  }
});

// create checkout session for new subscription or upgrade
billing.post('/create-checkout-session', async (c) => {
  try {
    const supabase = createSupabaseClient(c.env);
    const stripeService = new StripeService(c.env, supabase);
    const tenantId = c.get('tenantId');
    const user = c.get('user');

    const { priceId, isYearly, isFirstMonth } = await c.req.json();

    // single tier pricing - map to yearly or monthly
    const stripePriceId = isYearly ? c.env.STRIPE_PRICE_YEARLY : c.env.STRIPE_PRICE_MONTHLY;

    const successUrl = `${c.env.FRONTEND_URL}/settings?tab=billing&checkout=success`;
    const cancelUrl = `${c.env.FRONTEND_URL}/settings?tab=billing&checkout=cancel`;

    const session = await stripeService.createCheckoutSession(
      tenantId,
      user.email,
      stripePriceId,
      successUrl,
      cancelUrl,
      isFirstMonth
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