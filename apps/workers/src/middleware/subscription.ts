import { Context, Next } from 'hono';
import { createSupabaseClient } from '../services/supabase';

// subscription statuses that allow access
const ACTIVE_STATUSES = ['active', 'trialing'];

// public routes that don't require subscription
const PUBLIC_ROUTES = [
  '/api/auth',
  '/api/billing',
  '/api/oauth',
  '/api/webhooks',
  '/api/waitlist',
  '/health'
];

// check if route is public
function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some(route => path.startsWith(route));
}

export const subscriptionMiddleware = async (c: Context<{ Bindings: Env; Variables: { user: any; tenantId: string } }>, next: Next) => {
  // skip subscription check for public routes
  const path = c.req.path;
  if (isPublicRoute(path)) {
    return next();
  }

  // anonymous/demo users bypass subscription checks
  const user = c.get('user');
  if (user?.is_anonymous) {
    return next();
  }

  // get tenant id from context (set by auth middleware)
  const tenantId = c.get('tenantId');

  // if no tenant, allow access (user needs to connect ownerrez first)
  if (!tenantId) {
    return next();
  }

  const supabase = createSupabaseClient(c.env);

  // check if tenant is exempt from subscription requirements (free accounts)
  const { data: tenant } = await supabase
    .from('tenants')
    .select('subscription_exempt')
    .eq('id', tenantId)
    .single();

  if (tenant?.subscription_exempt === true) {
    // exempt accounts bypass all subscription checks
    return next();
  }

  // check subscription status
  const { data: subscription, error } = await supabase
    .from('subscriptions')
    .select('status, current_period_end, trial_end')
    .eq('tenant_id', tenantId)
    .single();

  // if no subscription found, check if tenant is new (allow grace period)
  if (!subscription || error) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('created_at')
      .eq('id', tenantId)
      .single();

    if (tenant) {
      const createdAt = new Date(tenant.created_at);
      const now = new Date();
      const daysSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

      // allow 1-day grace period for new accounts to set up billing
      if (daysSinceCreation <= 1) {
        return next();
      }
    }

    // no subscription and past grace period
    return c.json({
      error: 'No active subscription',
      code: 'SUBSCRIPTION_REQUIRED',
      redirectTo: '/settings?tab=billing'
    }, 403);
  }

  // check if subscription is active
  if (!ACTIVE_STATUSES.includes(subscription.status)) {
    return c.json({
      error: 'Subscription is not active',
      code: 'SUBSCRIPTION_INACTIVE',
      status: subscription.status,
      redirectTo: '/settings?tab=billing'
    }, 403);
  }

  // check if subscription period has ended
  if (subscription.current_period_end) {
    const periodEnd = new Date(subscription.current_period_end);
    if (periodEnd < new Date()) {
      return c.json({
        error: 'Subscription has expired',
        code: 'SUBSCRIPTION_EXPIRED',
        expiredAt: subscription.current_period_end,
        redirectTo: '/settings?tab=billing'
      }, 403);
    }
  }

  // check if trial has ended
  if (subscription.status === 'trialing' && subscription.trial_end) {
    const trialEnd = new Date(subscription.trial_end);
    if (trialEnd < new Date()) {
      return c.json({
        error: 'Trial period has ended',
        code: 'TRIAL_EXPIRED',
        trialEndedAt: subscription.trial_end,
        redirectTo: '/settings?tab=billing'
      }, 403);
    }
  }

  // subscription is valid, continue
  return next();
};