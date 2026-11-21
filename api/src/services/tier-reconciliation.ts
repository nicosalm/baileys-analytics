import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { TIERS, getTierBySlug, getTierRank, resolveTierForPropertyCount, type Tier, type TierSlug } from '@baileys/constants';

// Map a (tier, billing cycle) pair to the env var holding the matching Stripe
// price id. Single source of truth — routes/billing.ts imports this. Enterprise
// is excluded because those deals are quoted manually and purchased via custom
// price ids, not through the self-serve checkout.
export const TIER_PRICE_ENV_VARS: Record<Exclude<TierSlug, 'enterprise'>, { monthly: keyof Env; yearly: keyof Env }> = {
	starter: { monthly: 'STRIPE_PRICE_STARTER_MONTHLY', yearly: 'STRIPE_PRICE_STARTER_YEARLY' },
	growth: { monthly: 'STRIPE_PRICE_GROWTH_MONTHLY', yearly: 'STRIPE_PRICE_GROWTH_YEARLY' },
	portfolio: { monthly: 'STRIPE_PRICE_PORTFOLIO_MONTHLY', yearly: 'STRIPE_PRICE_PORTFOLIO_YEARLY' },
};

// metadata key written to the Stripe subscription when the cron pushes a
// deferred tier change. the webhook reads this to know it should NOT update the
// displayed tier yet — display flips only when invoice.payment_succeeded fires
// for the new period.
export const DEFERRED_TIER_METADATA_KEY = 'deferred_tier_change';

// minimum lead time before renewal at which the cron is allowed to push the
// new price into Stripe. 2 hours is enough to be safely "before" the renewal
// invoice gets generated, while still letting the cron pick the change up the
// same day if it needs to.
const CRON_LEAD_TIME_MS = 2 * 60 * 60 * 1000;

export interface PendingTier {
	tier: TierSlug;
	tierName: string;
	monthlyDollars: number | null;
	yearlyDollars: number | null;
	effectiveAt: string;
}

export interface TierStatus {
	propertyCount: number;
	currentTier: TierSlug;
	currentTierName: string;
	currentTierMaxProperties: number | null;
	currentMonthlyDollars: number | null;
	resolvedTier: TierSlug;
	resolvedTierName: string;
	resolvedMonthlyDollars: number | null;
	resolvedYearlyDollars: number | null;
	// True when the customer's actual property count exceeds the max of their
	// current paid tier. Always false for legacy customers (we never surface
	// overage for them — that decision is intentional).
	isOverage: boolean;
	// True when the resolved tier is enterprise — we can't auto-upgrade those,
	// they need to contact sales.
	needsContactSales: boolean;
	// ISO date — next renewal, when the auto-upgrade will take effect.
	upgradeAt: string | null;
	// ISO date — when the new price will start being charged. Same as upgradeAt
	// unless billing_cycle == yearly, in which case it's the same renewal date
	// but the customer should know it's a yearly bill.
	billingCycle: 'monthly' | 'yearly';
	// Set when a pending tier row exists in DB. The UI should prefer this for
	// banner copy because it's the deterministic, persisted record of what's
	// about to happen.
	pending: PendingTier | null;
}

const computeMonthlyDollars = (cents: number | null, billingCycle: 'monthly' | 'yearly'): number | null => {
	if (cents == null) return null;
	return Math.round(cents / 100 / (billingCycle === 'yearly' ? 12 : 1));
};

const tierMonthlyCents = (tier: Tier, billingCycle: 'monthly' | 'yearly'): number | null => {
	return billingCycle === 'yearly' ? tier.yearlyPriceCents : tier.monthlyPriceCents;
};

const resolvePriceIdForTier = (env: Env, tier: TierSlug, billingCycle: 'monthly' | 'yearly'): string | null => {
	if (tier === 'enterprise') return null;
	const envVars = TIER_PRICE_ENV_VARS[tier];
	const priceId = env[billingCycle === 'yearly' ? envVars.yearly : envVars.monthly];
	return typeof priceId === 'string' && priceId ? priceId : null;
};

// Returns null when the customer should be invisible to reconciliation:
// no subscription, cancelled/past_due, exempt, legacy during grandfather,
// missing period data, trialing (defer until conversion), or zero properties
// (sync hasn't completed).
export async function getTierStatus(supabase: SupabaseClient, tenantId: string): Promise<TierStatus | null> {
	// exempt tenants are entirely outside the billing system
	const { data: tenant } = await supabase.from('tenants').select('subscription_exempt').eq('id', tenantId).single();
	if (tenant?.subscription_exempt === true) return null;

	const { data: subscription } = await supabase.from('subscriptions').select('*').eq('tenant_id', tenantId).single();
	if (!subscription) return null;
	// trialing customers haven't converted yet — defer all tier judgments until
	// they become active. they'll get the right tier when their first invoice
	// is generated post-trial.
	if (subscription.status !== 'active') return null;
	if (!subscription.current_period_end) return null;

	// Legacy customers (everyone who subscribed before tiered pricing launched)
	// are intentionally invisible to this machinery — no overage banner, no
	// pending row, no cron push. Migration is human-driven: ops emails the
	// customer with their new price, then updates subscriptions.tier from
	// 'legacy' to the appropriate purchasable slug. Once that DB flip happens,
	// reconciliation picks them up on the next /subscription read automatically.
	// See LEGACY_MIGRATION_TARGET_DATE in packages/constants/src/tiers.ts.
	const currentTierSlug = subscription.tier as TierSlug | 'legacy' | null;
	if (!currentTierSlug || currentTierSlug === 'legacy') return null;
	const currentTier = getTierBySlug(currentTierSlug);
	if (!currentTier) return null;

	// count active, non-deleted properties
	const { count } = await supabase
		.from('properties')
		.select('id', { count: 'exact', head: true })
		.eq('tenant_id', tenantId)
		.eq('active', true)
		.is('deleted_at', null);
	const propertyCount = count ?? 0;

	// skip during initial sync — wait for at least one property to exist before
	// making any tier judgments
	if (propertyCount === 0) return null;

	const resolvedTier = resolveTierForPropertyCount(propertyCount);
	const billingCycle: 'monthly' | 'yearly' = subscription.billing_cycle === 'yearly' ? 'yearly' : 'monthly';

	// overage = property count exceeds the current tier's max AND the resolved
	// tier is strictly higher (rank-wise) than the current tier. The rank check
	// enforces "only auto-upgrade, never auto-downgrade".
	const isOverage =
		currentTier.maxProperties !== null &&
		propertyCount > currentTier.maxProperties &&
		getTierRank(resolvedTier.slug) > getTierRank(currentTier.slug);

	// bring along whatever pending row already exists in the DB so the UI can
	// render a deterministic banner. trust the DB — pending is updated by
	// markPendingTierIfNeeded on the same code path that produces this result.
	let pending: PendingTier | null = null;
	if (subscription.pending_tier && subscription.pending_effective_at) {
		const pendingTierObj = getTierBySlug(subscription.pending_tier as string);
		if (pendingTierObj) {
			pending = {
				tier: pendingTierObj.slug,
				tierName: pendingTierObj.name,
				monthlyDollars: computeMonthlyDollars(subscription.pending_unit_amount, billingCycle),
				yearlyDollars: pendingTierObj.yearlyPriceCents != null ? Math.round(pendingTierObj.yearlyPriceCents / 100) : null,
				effectiveAt: subscription.pending_effective_at,
			};
		}
	}

	return {
		propertyCount,
		currentTier: currentTier.slug,
		currentTierName: currentTier.name,
		currentTierMaxProperties: currentTier.maxProperties,
		currentMonthlyDollars: computeMonthlyDollars(subscription.unit_amount, billingCycle),
		resolvedTier: resolvedTier.slug,
		resolvedTierName: resolvedTier.name,
		resolvedMonthlyDollars: computeMonthlyDollars(tierMonthlyCents(resolvedTier, billingCycle), billingCycle),
		resolvedYearlyDollars: resolvedTier.yearlyPriceCents != null ? Math.round(resolvedTier.yearlyPriceCents / 100) : null,
		isOverage,
		needsContactSales: resolvedTier.slug === 'enterprise',
		upgradeAt: subscription.current_period_end,
		billingCycle,
		pending,
	};
}

// Lazy DB-only reconciliation. Called on the /subscription read path. Writes
// pending_* columns to record an upcoming tier change, but never touches
// Stripe — that's the cron's job. Idempotent: if the pending row already
// matches the resolved state, this is a no-op. If overage has cleared, this
// removes any stale pending row. Returns the freshly-computed TierStatus
// (with the in-memory pending field updated to reflect the write) so callers
// can serve it directly without a second getTierStatus round trip.
export async function markPendingTierIfNeeded(env: Env, supabase: SupabaseClient, tenantId: string): Promise<TierStatus | null> {
	const status = await getTierStatus(supabase, tenantId);

	// load current pending state for comparison. we need this even when status
	// is null so we can clean up stale pending rows for tenants who became
	// exempt, downgraded their property count, etc.
	const { data: sub } = await supabase
		.from('subscriptions')
		.select('pending_tier, pending_price_id, current_period_end')
		.eq('tenant_id', tenantId)
		.single();
	if (!sub) return status;

	const clearPending = async (): Promise<void> => {
		if (sub.pending_tier == null) return;
		await supabase
			.from('subscriptions')
			.update({
				pending_tier: null,
				pending_price_id: null,
				pending_unit_amount: null,
				pending_effective_at: null,
			})
			.eq('tenant_id', tenantId);
	};

	// no status, no overage, or contact-sales (we can't auto-upgrade enterprise)
	// → clear any stale pending row
	if (!status?.isOverage || status.needsContactSales) {
		await clearPending();
		if (status) status.pending = null;
		return status;
	}

	const newPriceId = resolvePriceIdForTier(env, status.resolvedTier, status.billingCycle);
	if (!newPriceId) {
		console.error(`markPendingTier: missing price env var for tier=${status.resolvedTier} cycle=${status.billingCycle}`);
		return status;
	}

	// already pending the right tier on the right price → no-op. status.pending
	// is already populated from the DB read inside getTierStatus.
	if (sub.pending_tier === status.resolvedTier && sub.pending_price_id === newPriceId) {
		return status;
	}

	const tierObj = getTierBySlug(status.resolvedTier);
	if (!tierObj) return status;
	const newUnitAmount = status.billingCycle === 'yearly' ? tierObj.yearlyPriceCents : tierObj.monthlyPriceCents;

	await supabase
		.from('subscriptions')
		.update({
			pending_tier: status.resolvedTier,
			pending_price_id: newPriceId,
			pending_unit_amount: newUnitAmount,
			pending_effective_at: sub.current_period_end,
		})
		.eq('tenant_id', tenantId);

	// patch the in-memory status so callers see the write we just made without
	// needing to re-query.
	status.pending = {
		tier: tierObj.slug,
		tierName: tierObj.name,
		monthlyDollars: computeMonthlyDollars(newUnitAmount, status.billingCycle),
		yearlyDollars: tierObj.yearlyPriceCents != null ? Math.round(tierObj.yearlyPriceCents / 100) : null,
		effectiveAt: sub.current_period_end,
	};

	return status;
}

interface PendingApplyResult {
	applied: number;
	skipped: number;
	errors: number;
}

// Cron entrypoint. Finds subscriptions whose pending tier should now be pushed
// into Stripe and updates them. Tags each Stripe subscription with metadata so
// the resulting webhook knows to suppress the displayed tier change until the
// new period invoice is paid.
export async function applyPendingTierUpgrades(supabase: SupabaseClient, stripe: Stripe): Promise<PendingApplyResult> {
	const result: PendingApplyResult = { applied: 0, skipped: 0, errors: 0 };

	// window: pending_effective_at is when the row was created (= the
	// current_period_end at the time of detection). actual renewal happens at
	// current_period_end of the LIVE sub, which may have shifted. we look for
	// anything whose recorded effective_at is within CRON_LEAD_TIME_MS of now,
	// then re-check the live sub before pushing.
	const cutoff = new Date(Date.now() + CRON_LEAD_TIME_MS).toISOString();

	const { data: dueSubs, error } = await supabase
		.from('subscriptions')
		.select('tenant_id, stripe_subscription_id, pending_tier, pending_price_id, pending_effective_at')
		.not('pending_tier', 'is', null)
		.lte('pending_effective_at', cutoff);

	if (error) {
		console.error('applyPendingTierUpgrades: failed to query pending subs', error);
		return result;
	}
	if (!dueSubs || dueSubs.length === 0) return result;

	for (const sub of dueSubs) {
		if (!sub.stripe_subscription_id || !sub.pending_price_id || !sub.pending_tier) {
			result.skipped++;
			continue;
		}

		try {
			// re-validate against the live sub. property counts may have changed
			// since the pending row was created (customer removed a unit, etc.).
			const status = await getTierStatus(supabase, sub.tenant_id);
			if (!status?.isOverage || status.resolvedTier !== sub.pending_tier) {
				// no longer applicable. clear pending and move on.
				await supabase
					.from('subscriptions')
					.update({
						pending_tier: null,
						pending_price_id: null,
						pending_unit_amount: null,
						pending_effective_at: null,
					})
					.eq('tenant_id', sub.tenant_id);
				result.skipped++;
				continue;
			}

			let live: Stripe.Subscription;
			try {
				live = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
			} catch (err) {
				console.error(`applyPendingTier: retrieve failed for ${sub.tenant_id}`, err);
				result.errors++;
				continue;
			}

			// only push within the lead-time window relative to the LIVE renewal
			// date — protects against the recorded effective_at being stale.
			// stripe SDK v19+ moved current_period_end to SubscriptionItem
			const liveItem = live.items.data[0];
			const liveRenewalMs = liveItem?.current_period_end != null ? liveItem.current_period_end * 1000 : null;
			if (liveRenewalMs == null || liveRenewalMs - Date.now() > CRON_LEAD_TIME_MS) {
				// not yet within the lead window — leave for next cron tick
				result.skipped++;
				continue;
			}

			const itemId = live.items.data[0]?.id;
			const currentPriceId = live.items.data[0]?.price.id;
			if (!itemId) {
				result.skipped++;
				continue;
			}

			// Stripe already on the target price? could happen if a portal change
			// beat us to it. clear pending so we don't keep retrying.
			if (currentPriceId === sub.pending_price_id) {
				await supabase
					.from('subscriptions')
					.update({
						pending_tier: null,
						pending_price_id: null,
						pending_unit_amount: null,
						pending_effective_at: null,
					})
					.eq('tenant_id', sub.tenant_id);
				result.skipped++;
				continue;
			}

			// push the new price. proration_behavior: 'none' + billing_cycle_anchor
			// 'unchanged' makes the change invisible until the next renewal. the
			// metadata flag tells the webhook to NOT advance the displayed tier
			// until the next invoice clears.
			await stripe.subscriptions.update(sub.stripe_subscription_id, {
				items: [{ id: itemId, price: sub.pending_price_id }],
				proration_behavior: 'none',
				billing_cycle_anchor: 'unchanged',
				metadata: {
					...(live.metadata ?? {}),
					[DEFERRED_TIER_METADATA_KEY]: sub.pending_tier,
				},
			});

			result.applied++;
		} catch (err) {
			console.error(`applyPendingTier: failed for ${sub.tenant_id}`, err);
			result.errors++;
		}
	}

	return result;
}

// helpers re-exported for tests/admin tooling
export { TIERS };
