// Subscription tier definitions. Single source of truth for the pricing page,
// checkout flow, and reconciliation job. Stripe price IDs live in worker env vars
// because they differ between test and live mode.

export type TierSlug = 'starter' | 'growth' | 'portfolio' | 'enterprise';

export interface Tier {
  slug: TierSlug;
  name: string;
  tagline: string;
  minProperties: number;
  // null = unlimited (enterprise)
  maxProperties: number | null;
  // null = contact sales (enterprise)
  monthlyPriceCents: number | null;
  yearlyPriceCents: number | null;
  features: string[];
  contactSales: boolean;
}

export const TIERS: readonly Tier[] = [
  {
    slug: 'starter',
    name: 'Starter',
    tagline: '1–4 properties',
    minProperties: 1,
    maxProperties: 4,
    monthlyPriceCents: 2000,
    yearlyPriceCents: 19900,
    features: [
      '4 years of OwnerRez history, synced automatically',
      '5 dashboards, filter by date, property, or tag',
      'Pacing, ADR, occupancy heatmap & gap alerts',
      'P&L by property, revenue goals & RevPAN calculator',
      'Click into any month, property, or guest',
      'Period comparisons, season filters & live updates',
    ],
    contactSales: false,
  },
  {
    slug: 'growth',
    name: 'Growth',
    tagline: '5–9 properties',
    minProperties: 5,
    maxProperties: 9,
    monthlyPriceCents: 3900,
    yearlyPriceCents: 39900,
    features: [
      '4 years of OwnerRez history, synced automatically',
      '5 dashboards, filter by date, property, or tag',
      'Pacing, ADR, occupancy heatmap & gap alerts',
      'P&L by property, revenue goals & RevPAN calculator',
      'Click into any month, property, or guest',
      'Period comparisons, season filters & live updates',
    ],
    contactSales: false,
  },
  {
    slug: 'portfolio',
    name: 'Portfolio',
    tagline: '10–19 properties',
    minProperties: 10,
    maxProperties: 19,
    monthlyPriceCents: 7900,
    yearlyPriceCents: 79900,
    features: [
      '4 years of OwnerRez history, synced automatically',
      '5 dashboards, filter by date, property, or tag',
      'Pacing, ADR, occupancy heatmap & gap alerts',
      'P&L by property, revenue goals & RevPAN calculator',
      'Click into any month, property, or guest',
      'Period comparisons, season filters & live updates',
    ],
    contactSales: false,
  },
  {
    slug: 'enterprise',
    name: 'Enterprise',
    tagline: '20+ properties',
    minProperties: 20,
    maxProperties: null,
    monthlyPriceCents: null,
    yearlyPriceCents: null,
    features: [
      'Everything in Portfolio, with unlimited properties',
      'Custom invoicing and volume-based pricing',
      'Dedicated onboarding and data migration help',
      'Priority support from the founding team',
      'Flexible contracts and billing terms',
      '**Direct input on what we build next!**',
    ],
    contactSales: true,
  },
] as const;

export const PURCHASABLE_TIER_SLUGS: readonly TierSlug[] = ['starter', 'growth', 'portfolio'];

// Soft deadline for completing the legacy → tiered-pricing migration.
//
// Context: we launched with a single flat plan, then introduced tiered pricing
// two days later. Every pre-tier subscriber has subscriptions.tier = 'legacy'
// and is intentionally invisible to the tier reconciliation machinery — no
// overage banner, no pending row, no automatic Stripe price change. The
// optics of auto-migrating day-old subscribers into a higher tier without
// notice are terrible, so we don't.
//
// Migration is HUMAN-DRIVEN, not date-gated in code. Nothing flips
// automatically on this date. The process is:
//   1. Email every legacy subscriber with their projected new price and
//      effective date
//   2. Give them a grace window to respond / opt out / port to a real tier
//   3. Ops updates subscriptions.tier from 'legacy' to the appropriate
//      purchasable slug (starter/growth/portfolio) based on property count
//   4. Reconciliation machinery picks them up on the next /subscription read
//      and queues a pending upgrade for their next renewal as normal
//
// This constant is a reminder — grep for it to find migration-related code
// paths and to anchor the "we should have finished this by now" conversation.
// It is not referenced by any runtime logic.
export const LEGACY_MIGRATION_TARGET_DATE = '2027-04-11';

export function getTierBySlug(slug: string): Tier | undefined {
  return TIERS.find((t) => t.slug === slug);
}

// Resolve which tier a property count falls into. Used by the reconciliation job
// to determine whether a customer has outgrown their current plan. Counts below
// the smallest tier minimum (e.g. 0 properties during initial sync) clamp to
// starter so we never misclassify a sync-in-progress account as enterprise.
export function resolveTierForPropertyCount(count: number): Tier {
  if (count < TIERS[0].minProperties) return TIERS[0];
  for (const tier of TIERS) {
    if (count >= tier.minProperties && (tier.maxProperties === null || count <= tier.maxProperties)) {
      return tier;
    }
  }
  return TIERS[TIERS.length - 1];
}

// Returns the index of a tier in the TIERS array, used to compare ordering.
// Lower index = smaller tier. Used by reconciliation to enforce
// "only auto-upgrade, never auto-downgrade".
export function getTierRank(slug: TierSlug): number {
  return TIERS.findIndex((t) => t.slug === slug);
}

// Per-month price in whole dollars for display. Returns null for contact-sales
// tiers (no fixed price). When yearly is true, divides the yearly cents by 12
// so the displayed monthly figure reflects the discounted annual rate.
export function getTierMonthlyDollars(tier: Tier, yearly: boolean): number | null {
  const cents = yearly ? tier.yearlyPriceCents : tier.monthlyPriceCents;
  if (cents == null) return null;
  return Math.round(cents / 100 / (yearly ? 12 : 1));
}

// Yearly total in whole dollars. Null for contact-sales tiers.
export function getTierYearlyDollars(tier: Tier): number | null {
  return tier.yearlyPriceCents != null ? Math.round(tier.yearlyPriceCents / 100) : null;
}
