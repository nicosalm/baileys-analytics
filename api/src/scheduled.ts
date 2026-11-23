import Stripe from 'stripe';
import { createSupabaseClient } from './services/supabase';
import { reconcileRenewals } from './services/tier-reconciliation';
import { purgePendingDeletions } from './services/account-deletion';
import { purgeStaleDemoUsers } from './services/demo-users';

// Cloudflare Workers cron entrypoint, wired in wrangler.toml under [triggers] to run hourly.
// It reconciles upcoming renewals with the property count and is the only thing that changes
// prices in Stripe; read paths and the lazy reconciliation only touch our own DB.
export async function scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
	ctx.waitUntil(runRenewalReconciliation(env, event.cron));
	// finishes account deletions whose inline purge ran out of time or hit a lock
	ctx.waitUntil(purgePendingDeletions(createSupabaseClient(env), 60_000));
	ctx.waitUntil(runDemoUserCleanup(env, event.cron));
}

async function runDemoUserCleanup(env: Env, cronExpression: string): Promise<void> {
	const deleted = await purgeStaleDemoUsers(createSupabaseClient(env), 60_000);
	if (deleted > 0) console.log(`[cron ${cronExpression}] purgeStaleDemoUsers deleted=${deleted}`);
}

async function runRenewalReconciliation(env: Env, cronExpression: string): Promise<void> {
	const supabase = createSupabaseClient(env);
	const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
		apiVersion: '2025-10-29.clover',
		httpClient: Stripe.createFetchHttpClient(),
	});

	try {
		const result = await reconcileRenewals(env, supabase, stripe);
		if (result.applied > 0 || result.errors > 0) {
			console.log(`[cron ${cronExpression}] reconcileRenewals applied=${result.applied} skipped=${result.skipped} errors=${result.errors}`);
		}
	} catch (err) {
		console.error(`[cron ${cronExpression}] reconcileRenewals crashed`, err);
	}
}
