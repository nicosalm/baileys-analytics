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

    const subscription = await stripeService.getSubscription(tenantId);

    return c.json({ subscription });
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

    // map plan to price id
    let stripePriceId: string;
    if (priceId === 'starter') {
      stripePriceId = isYearly ? c.env.STRIPE_PRICE_STARTER_YEARLY : c.env.STRIPE_PRICE_STARTER_MONTHLY;
    } else if (priceId === 'professional') {
      stripePriceId = isYearly ? c.env.STRIPE_PRICE_PROFESSIONAL_YEARLY : c.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY;
    } else if (priceId === 'scale') {
      stripePriceId = isYearly ? c.env.STRIPE_PRICE_SCALE_YEARLY : c.env.STRIPE_PRICE_SCALE_MONTHLY;
    } else {
      return c.json({ error: 'Invalid price ID' }, 400);
    }

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

// get available plans
billing.get('/plans', async (c) => {
  try {
    const supabase = createSupabaseClient(c.env);

    const { data: plans, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price_monthly', { ascending: true });

    if (error) throw error;

    return c.json({ plans: plans || [] });
  } catch (error) {
    console.error('Error fetching plans:', error);
    return c.json({ error: 'Failed to fetch plans' }, 500);
  }
});

export { billing };