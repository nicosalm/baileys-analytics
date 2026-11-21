import type { Context, Next } from 'hono';
import { createSupabaseClient } from '../services/supabase';
import type { AppEnv } from '../types';

// subscription statuses that allow access
const ACTIVE_STATUSES = ['active'];

// public routes that don't require subscription
const PUBLIC_ROUTES = ['/api/auth', '/api/billing', '/api/oauth', '/api/webhooks', '/api/waitlist', '/health'];

// check if route is public
function isPublicRoute(path: string): boolean {
	return PUBLIC_ROUTES.some((route) => path.startsWith(route));
}

export const subscriptionMiddleware = async (c: Context<AppEnv>, next: Next) => {
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
	const { data: tenant } = await supabase.from('tenants').select('subscription_exempt').eq('id', tenantId).single();

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
		const { data: tenant } = await supabase.from('tenants').select('created_at').eq('id', tenantId).single();

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
		return c.json(
			{
				error: 'No active subscription',
				code: 'SUBSCRIPTION_REQUIRED',
				redirectTo: '/settings?tab=billing',
			},
			403,
		);
	}

	// check if subscription is active
	// stripe manages lifecycle transitions via webhooks — we trust the status field
	if (!ACTIVE_STATUSES.includes(subscription.status)) {
		return c.json(
			{
				error: 'Subscription is not active',
				code: 'SUBSCRIPTION_INACTIVE',
				status: subscription.status,
				redirectTo: '/settings?tab=billing',
			},
			403,
		);
	}

	// subscription is valid, continue
	return next();
};
