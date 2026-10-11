import Stripe from 'stripe';
import { createSupabaseClient } from './services/supabase';
import { applyPendingTierUpgrades } from './services/tier-reconciliation';
import { purgePendingDeletions } from './services/account-deletion';

// Cloudflare Workers cron entrypoint. Wired in wrangler.toml under [triggers].
// Currently runs every 6 hours and applies pending tier upgrades to Stripe
// when their renewal is within the lead-time window. The cron is the ONLY
// thing that mutates Stripe in the tier auto-upgrade flow — read paths and
// the lazy reconciliation only touch our own DB.
export async function scheduled(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  ctx.waitUntil(runPendingTierUpgrades(env, event.cron));
  // finishes account deletions whose inline purge ran out of time or hit a lock
  ctx.waitUntil(purgePendingDeletions(createSupabaseClient(env), 60_000));
}

async function runPendingTierUpgrades(env: Env, cronExpression: string): Promise<void> {
  const supabase = createSupabaseClient(env);
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-10-29.clover',
    httpClient: Stripe.createFetchHttpClient(),
  });

  try {
    const result = await applyPendingTierUpgrades(supabase, stripe);
    if (result.applied > 0 || result.errors > 0) {
      console.log(
        `[cron ${cronExpression}] applyPendingTierUpgrades applied=${result.applied} skipped=${result.skipped} errors=${result.errors}`
      );
    }
  } catch (err) {
    console.error(`[cron ${cronExpression}] applyPendingTierUpgrades crashed`, err);
  }
}
