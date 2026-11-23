import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { TIERS, getTierBySlug, getTierRank, resolveTierForPropertyCount, type Tier, type TierSlug } from '@baileys/constants';
import { countBillableProperties } from './billable-properties';
import { EmailService, type BillingCycle } from './email';

// The rule: at every renewal a subscription is billed for the tier its active property
// count falls in, at the billing cycle the customer prefers. Nothing changes mid-cycle.
//
// - reconcileTier (lazy, DB only) records the change due at the next renewal in pending_*
//   and sends the customer notice and the 20+ ops alert. It runs on /auth/me, the billing
//   read and the cron.
// - reconcileRenewals (cron) pushes the pending price into Stripe shortly before renewal.
//   It looks at every renewal, not just rows with a pending change, so an owner who never
//   opens the app is still billed correctly.
// - The webhook holds the displayed tier until the renewal invoice is paid.
//
// Legacy (pre-tier) subscriptions are left alone; see LEGACY_MIGRATION_TARGET_DATE.

export type { BillingCycle };

// Map a (tier, billing cycle) pair to the env var holding the matching Stripe price id.
// Enterprise is excluded because those deals are quoted and priced by hand.
export const TIER_PRICE_ENV_VARS: Record<Exclude<TierSlug, 'enterprise'>, { monthly: keyof Env; yearly: keyof Env }> = {
	starter: { monthly: 'STRIPE_PRICE_STARTER_MONTHLY', yearly: 'STRIPE_PRICE_STARTER_YEARLY' },
	growth: { monthly: 'STRIPE_PRICE_GROWTH_MONTHLY', yearly: 'STRIPE_PRICE_GROWTH_YEARLY' },
	portfolio: { monthly: 'STRIPE_PRICE_PORTFOLIO_MONTHLY', yearly: 'STRIPE_PRICE_PORTFOLIO_YEARLY' },
};

const AUTO_TIERS: readonly string[] = ['starter', 'growth', 'portfolio'];

// written to the Stripe subscription when the cron pushes a change; the webhook keeps
// showing the old tier, price and cycle until the renewal invoice is paid
export const DEFERRED_TIER_METADATA_KEY = 'deferred_tier_change';

export const CLEARED_PENDING = {
	pending_tier: null,
	pending_price_id: null,
	pending_unit_amount: null,
	pending_effective_at: null,
	pending_notified_at: null,
} as const;

// the cron pushes a change this close to renewal, before Stripe drafts the renewal invoice.
// it runs hourly, so every renewal gets at least one run inside the window
const CRON_LEAD_TIME_MS = 2 * 60 * 60 * 1000;

// how long before renewal the customer hears about a change
export const NOTICE_WINDOW_MS: Record<BillingCycle, number> = {
	monthly: 7 * 24 * 60 * 60 * 1000,
	yearly: 30 * 24 * 60 * 60 * 1000,
};

// a renewal the cron missed by a few runs (deploy, outage) still gets looked at
const MISSED_RENEWAL_GRACE_MS = 6 * 60 * 60 * 1000;

export interface PendingTier {
	tier: TierSlug;
	tierName: string;
	billingCycle: BillingCycle;
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
	// the tier the count falls in, which can be enterprise
	resolvedTier: TierSlug;
	resolvedTierName: string;
	// the tier the next renewal bills; enterprise never applies automatically, so it stays current
	targetTier: TierSlug;
	targetTierName: string;
	targetMonthlyDollars: number | null;
	targetYearlyDollars: number | null;
	// count is above the current tier's limit
	isOverage: boolean;
	change: 'up' | 'down' | null;
	needsContactSales: boolean;
	renewsAt: string;
	billingCycle: BillingCycle;
	targetBillingCycle: BillingCycle;
	pending: PendingTier | null;
}

const cyclePriceCents = (tier: Tier, cycle: BillingCycle) => (cycle === 'yearly' ? tier.yearlyPriceCents : tier.monthlyPriceCents);

const monthlyDollars = (cents: number | null, cycle: BillingCycle): number | null =>
	cents == null ? null : Math.round(cents / 100 / (cycle === 'yearly' ? 12 : 1));

const yearlyDollars = (tier: Tier) => (tier.yearlyPriceCents != null ? Math.round(tier.yearlyPriceCents / 100) : null);

const resolvePriceId = (env: Env, tier: TierSlug, cycle: BillingCycle): string | null => {
	if (tier === 'enterprise') return null;
	const priceId = env[TIER_PRICE_ENV_VARS[tier][cycle]];
	return typeof priceId === 'string' && priceId ? priceId : null;
};

const asCycle = (value: unknown): BillingCycle => (value === 'yearly' ? 'yearly' : 'monthly');

// null when the subscription is outside automatic tiering: none, not active, exempt,
// legacy, enterprise-priced, or no properties synced yet
export async function getTierStatus(supabase: SupabaseClient, tenantId: string): Promise<TierStatus | null> {
	const { data: tenant } = await supabase.from('tenants').select('subscription_exempt').eq('id', tenantId).maybeSingle();
	if (tenant?.subscription_exempt === true) return null;

	const { data: subscription } = await supabase.from('subscriptions').select('*').eq('tenant_id', tenantId).maybeSingle();
	if (!subscription || subscription.status !== 'active' || !subscription.current_period_end) return null;
	if (!AUTO_TIERS.includes(subscription.tier)) return null;
	const currentTier = getTierBySlug(subscription.tier);
	if (!currentTier) return null;

	const propertyCount = await countBillableProperties(supabase, tenantId);
	if (propertyCount === 0) return null;

	const resolvedTier = resolveTierForPropertyCount(propertyCount);
	const needsContactSales = resolvedTier.contactSales;
	const targetTier = needsContactSales ? currentTier : resolvedTier;
	const billingCycle = asCycle(subscription.billing_cycle);
	const targetBillingCycle = subscription.preferred_billing_cycle ? asCycle(subscription.preferred_billing_cycle) : billingCycle;
	const rankChange = getTierRank(targetTier.slug) - getTierRank(currentTier.slug);

	const pendingTier = subscription.pending_tier && subscription.pending_effective_at ? getTierBySlug(subscription.pending_tier) : undefined;

	return {
		propertyCount,
		currentTier: currentTier.slug,
		currentTierName: currentTier.name,
		currentTierMaxProperties: currentTier.maxProperties,
		currentMonthlyDollars: monthlyDollars(subscription.unit_amount, billingCycle),
		resolvedTier: resolvedTier.slug,
		resolvedTierName: resolvedTier.name,
		targetTier: targetTier.slug,
		targetTierName: targetTier.name,
		targetMonthlyDollars: monthlyDollars(cyclePriceCents(targetTier, targetBillingCycle), targetBillingCycle),
		targetYearlyDollars: yearlyDollars(targetTier),
		isOverage: currentTier.maxProperties !== null && propertyCount > currentTier.maxProperties,
		change: rankChange > 0 ? 'up' : rankChange < 0 ? 'down' : null,
		needsContactSales,
		renewsAt: subscription.current_period_end,
		billingCycle,
		targetBillingCycle,
		pending: pendingTier
			? {
					tier: pendingTier.slug,
					tierName: pendingTier.name,
					billingCycle: targetBillingCycle,
					monthlyDollars: monthlyDollars(subscription.pending_unit_amount, targetBillingCycle),
					yearlyDollars: yearlyDollars(pendingTier),
					effectiveAt: subscription.pending_effective_at,
				}
			: null,
	};
}

const priceLabel = (pending: PendingTier) =>
	pending.billingCycle === 'yearly' ? `$${pending.yearlyDollars} a year` : `$${pending.monthlyDollars} a month`;

// claims a notification flag before sending so two concurrent runs can't both send,
// and releases it if the send fails so the next run retries
async function notifyOnce(
	supabase: SupabaseClient,
	tenantId: string,
	column: 'pending_notified_at' | 'contact_sales_notified_at',
	send: () => Promise<boolean>,
): Promise<void> {
	const { data: claimed } = await supabase
		.from('subscriptions')
		.update({ [column]: new Date().toISOString() })
		.eq('tenant_id', tenantId)
		.is(column, null)
		.select('tenant_id');
	if (!claimed?.length) return;
	if (!(await send())) {
		await supabase
			.from('subscriptions')
			.update({ [column]: null })
			.eq('tenant_id', tenantId);
	}
}

async function tenantEmail(supabase: SupabaseClient, tenantId: string): Promise<string | null> {
	const { data } = await supabase.from('tenants').select('email').eq('id', tenantId).maybeSingle();
	return data?.email || null;
}

// Records the change due at the next renewal (or clears a stale one) and sends any notice
// that is due. Never touches Stripe. Returns the status and the price the renewal should bill.
export async function reconcileTier(
	env: Env,
	supabase: SupabaseClient,
	tenantId: string,
	now = Date.now(),
): Promise<{ status: TierStatus | null; pendingPriceId: string | null }> {
	const status = await getTierStatus(supabase, tenantId);
	const { data: sub } = await supabase
		.from('subscriptions')
		.select('pending_tier, pending_price_id, pending_effective_at, pending_notified_at, contact_sales_notified_at, current_period_end')
		.eq('tenant_id', tenantId)
		.maybeSingle();
	if (!sub) return { status, pendingPriceId: null };

	const email = env.RESEND_API_KEY ? new EmailService(env.RESEND_API_KEY) : null;

	if (status?.needsContactSales) {
		if (email && !sub.contact_sales_notified_at) {
			await notifyOnce(supabase, tenantId, 'contact_sales_notified_at', () =>
				email.sendOpsAlert(
					`${status.propertyCount} properties on ${status.currentTierName}: enterprise pricing`,
					`Tenant ${tenantId} has ${status.propertyCount} active properties and is still billed ${status.currentTierName} (${status.billingCycle}). Plans don't change automatically above 19 properties, so reach out about enterprise pricing.`,
				),
			);
		}
	} else if (sub.contact_sales_notified_at) {
		await supabase.from('subscriptions').update({ contact_sales_notified_at: null }).eq('tenant_id', tenantId);
	}

	const hasChange = status != null && (status.change !== null || status.targetBillingCycle !== status.billingCycle);
	if (!status || !hasChange) {
		if (sub.pending_tier != null || sub.pending_notified_at != null) {
			await supabase.from('subscriptions').update(CLEARED_PENDING).eq('tenant_id', tenantId);
		}
		if (status) status.pending = null;
		return { status, pendingPriceId: null };
	}

	const pendingPriceId = resolvePriceId(env, status.targetTier, status.targetBillingCycle);
	const targetTier = getTierBySlug(status.targetTier);
	if (!pendingPriceId || !targetTier) {
		console.error(`reconcileTier: missing price env var for tier=${status.targetTier} cycle=${status.targetBillingCycle}`);
		return { status, pendingPriceId: null };
	}

	let notified = !!sub.pending_notified_at;
	// a new change, or the same change carried to a later renewal, gets its own notice
	if (sub.pending_price_id !== pendingPriceId || sub.pending_effective_at !== sub.current_period_end) {
		const pendingUnitAmount = cyclePriceCents(targetTier, status.targetBillingCycle);
		await supabase
			.from('subscriptions')
			.update({
				pending_tier: targetTier.slug,
				pending_price_id: pendingPriceId,
				pending_unit_amount: pendingUnitAmount,
				pending_effective_at: sub.current_period_end,
				pending_notified_at: null,
			})
			.eq('tenant_id', tenantId);
		notified = false;
		status.pending = {
			tier: targetTier.slug,
			tierName: targetTier.name,
			billingCycle: status.targetBillingCycle,
			monthlyDollars: monthlyDollars(pendingUnitAmount, status.targetBillingCycle),
			yearlyDollars: yearlyDollars(targetTier),
			effectiveAt: sub.current_period_end,
		};
	}

	const pending = status.pending;
	const withinNotice = pending && new Date(pending.effectiveAt).getTime() - now <= NOTICE_WINDOW_MS[status.billingCycle];
	if (email && pending && withinNotice && !notified) {
		const to = await tenantEmail(supabase, tenantId);
		if (to) {
			await notifyOnce(supabase, tenantId, 'pending_notified_at', () =>
				email.sendTierChangeNotice(to, {
					propertyCount: status.propertyCount,
					fromTierName: status.currentTierName,
					toTierName: pending.tierName,
					fromCycle: status.billingCycle,
					toCycle: pending.billingCycle,
					priceLabel: priceLabel(pending),
					effectiveAt: pending.effectiveAt,
				}),
			);
		}
	}

	return { status, pendingPriceId };
}

// the read paths only need the status
export async function markPendingTierIfNeeded(env: Env, supabase: SupabaseClient, tenantId: string): Promise<TierStatus | null> {
	return (await reconcileTier(env, supabase, tenantId)).status;
}

interface RenewalResult {
	applied: number;
	skipped: number;
	errors: number;
}

// Cron entrypoint. Reconciles every automatic-tier subscription renewing within the longest
// notice window (sending notices as they come due), and pushes the pending price into Stripe
// for those inside the lead window.
export async function reconcileRenewals(env: Env, supabase: SupabaseClient, stripe: Stripe, now = Date.now()): Promise<RenewalResult> {
	const result: RenewalResult = { applied: 0, skipped: 0, errors: 0 };

	const { data: renewing, error } = await supabase
		.from('subscriptions')
		.select('tenant_id, stripe_subscription_id')
		.eq('status', 'active')
		.in('tier', AUTO_TIERS as string[])
		.gte('current_period_end', new Date(now - MISSED_RENEWAL_GRACE_MS).toISOString())
		.lte('current_period_end', new Date(now + NOTICE_WINDOW_MS.yearly).toISOString());

	if (error) {
		console.error('reconcileRenewals: failed to query renewing subscriptions', error);
		return result;
	}

	for (const sub of renewing ?? []) {
		try {
			const { status, pendingPriceId } = await reconcileTier(env, supabase, sub.tenant_id, now);
			if (!status?.pending || !pendingPriceId || !sub.stripe_subscription_id) {
				result.skipped++;
				continue;
			}
			// cheap check against our copy of the renewal date before asking Stripe
			if (new Date(status.renewsAt).getTime() - now > CRON_LEAD_TIME_MS) {
				result.skipped++;
				continue;
			}

			const live = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
			const item = live.items.data[0];
			const liveRenewalMs = item?.current_period_end != null ? item.current_period_end * 1000 : null;
			if (!item || liveRenewalMs == null || liveRenewalMs - now > CRON_LEAD_TIME_MS) {
				result.skipped++;
				continue;
			}
			// already pushed on an earlier run; the webhook promotes it once the invoice is paid
			if (item.price.id === pendingPriceId) {
				result.skipped++;
				continue;
			}

			// a change between monthly and yearly starts the new cycle now, which is at most the
			// lead time early. otherwise the price swaps with no proration and bills at renewal
			const cycleChanges = status.targetBillingCycle !== status.billingCycle;
			await stripe.subscriptions.update(sub.stripe_subscription_id, {
				items: [{ id: item.id, price: pendingPriceId }],
				proration_behavior: 'none',
				billing_cycle_anchor: cycleChanges ? 'now' : 'unchanged',
				metadata: { ...(live.metadata ?? {}), [DEFERRED_TIER_METADATA_KEY]: status.pending.tier },
			});
			result.applied++;
		} catch (err) {
			console.error(`reconcileRenewals: failed for ${sub.tenant_id}`, err);
			result.errors++;
		}
	}

	return result;
}

// helpers re-exported for tests/admin tooling
export { TIERS };
