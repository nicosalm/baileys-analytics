import { useState, useEffect } from 'react'
import { ExternalLink, AlertCircle, CheckCircle, Sparkles, TrendingUp } from 'lucide-react'
import { LoadingState } from '@/components/LoadingState'
import { billingClient, type SubscriptionInfo, type TierStatus, type PendingTier } from '@/lib/stripe'
import { PricingPlans } from '@/components/PricingPlans'
import { Button } from '@/components/ui/button'
import { useToast } from '@/contexts/toast'
import { formatDateDisplay, formatCurrency } from '@baileys/utils'
import { getTierBySlug } from '@baileys/constants'

// Resolve display name and per-month dollar amount for the current plan.
// Legacy customers (pre-tier launch) are shown as "Early Supporter" with the
// actual Stripe unit_amount — they stay on their original flat price until
// ops manually migrates them via a DB tier update (see
// LEGACY_MIGRATION_TARGET_DATE in packages/constants/src/tiers.ts). This
// branch also covers the brief window after signup before lazy backfill
// writes the tier column, and silently survives Stripe-side mode mismatches
// in local dev.
const resolvePlanDisplay = (subscription: SubscriptionInfo) => {
  const isYearly = subscription.billing_cycle === 'yearly'
  const tierSlug = subscription.tier
  const tier = tierSlug ? getTierBySlug(tierSlug) : undefined

  const planName = tier?.name ?? 'Baileys Analytics'
  const isLegacy = !tier

  const monthlyDollars = subscription.unit_amount != null ? Math.round(subscription.unit_amount / 100 / (isYearly ? 12 : 1)) : null
  const totalCharge = subscription.unit_amount != null ? Math.round(subscription.unit_amount / 100) : null

  return { planName, isLegacy, monthlyDollars, totalCharge, isYearly }
}

interface BillingHistoryEntry {
  id: string
  amount: number
  status: string
  created_at: string
}

export const BillingTab = () => {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [billingHistory, setBillingHistory] = useState<BillingHistoryEntry[]>([])
  const [tierStatus, setTierStatus] = useState<TierStatus | null>(null)
  const [isExempt, setIsExempt] = useState(false)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)
  const { addToast } = useToast()

  useEffect(() => {
    loadBillingData()
  }, [])

  const loadBillingData = async () => {
    setLoading(true)
    try {
      // Single combined endpoint for sub + tier status — eliminates the race
      // where the previous parallel calls could land in either order and the
      // overage banner blinked depending on timing. History stays parallel
      // because it doesn't share state with the others.
      const [subData, history] = await Promise.all([billingClient.getSubscription(), billingClient.getBillingHistory()])

      setSubscription(subData?.subscription || null)
      setIsExempt(subData?.isExempt || false)
      setTierStatus(subData?.tierStatus || null)
      setBillingHistory(history)
    } catch (error) {
      addToast('error', 'Failed to load billing information')
    } finally {
      setLoading(false)
    }
  }

  const handleManageSubscription = async () => {
    setPortalLoading(true)
    try {
      await billingClient.createPortalSession()
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Failed to open billing portal')
    } finally {
      setPortalLoading(false)
    }
  }

  if (loading) {
    return <LoadingState />
  }

  // show free account status for exempt accounts
  if (isExempt) {
    return (
      <div className="space-y-6">
        <div className="bg-success-subtle border border-success/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-success-fg">Complimentary Access</h3>
              <p className="text-sm text-success-fg mt-1">
                This account has been granted free unlimited access to all features of Baileys Analytics.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg shadow-sm border p-5">
          <h3 className="text-lg font-semibold text-foreground mb-4">Account Benefits</h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
              <span className="text-sm text-foreground">Unlimited properties and bookings</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
              <span className="text-sm text-foreground">Full access to all analytics features</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
              <span className="text-sm text-foreground">Priority support</span>
            </li>
          </ul>
        </div>
      </div>
    )
  }

  // show pricing plans if no subscription
  if (!subscription || subscription.status === 'canceled') {
    return (
      <div className="space-y-6">
        <div className="bg-warning-subtle border border-warning/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-warning mt-0.5" />
            <div>
              <h3 className="font-semibold text-warning-fg">No Active Subscription</h3>
              <p className="text-sm text-warning-fg mt-1">Choose a plan below to keep using your dashboards.</p>
            </div>
          </div>
        </div>

        <PricingPlans />
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-success-subtle text-success-fg'
      case 'past_due':
        return 'bg-danger-subtle text-danger-fg'
      case 'canceled':
        return 'bg-muted text-muted-foreground'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const { planName, isLegacy, monthlyDollars, totalCharge, isYearly } = resolvePlanDisplay(subscription)

  // overage banner: shows for non-legacy customers whose property count has
  // outgrown their tier. legacy customers stay invisible to the tier system
  // entirely (tierStatus is null for them). Prefer the pending row when set —
  // it's the deterministic record of "the change has been queued, here's
  // what's coming." Falling back to the live status fields covers the brief
  // window before the first /subscription read writes the pending row.
  const showOverage = tierStatus?.isOverage === true
  const pending: PendingTier | null = tierStatus?.pending ?? null

  // properties row: real count vs. tier limit when we know both. Falls back to
  // "Unlimited" for legacy/exempt/contact-sales paths where we don't have a
  // numeric cap to render.
  const propertiesLabel = tierStatus
    ? tierStatus.currentTierMaxProperties != null
      ? `${tierStatus.propertyCount} / ${tierStatus.currentTierMaxProperties}`
      : `${tierStatus.propertyCount}`
    : 'Unlimited'

  const targetTierName = pending?.tierName ?? tierStatus?.resolvedTierName
  const targetYearlyDollars = pending?.yearlyDollars ?? tierStatus?.resolvedYearlyDollars
  const targetMonthlyDollars = pending?.monthlyDollars ?? tierStatus?.resolvedMonthlyDollars
  const effectiveAt = pending?.effectiveAt ?? tierStatus?.upgradeAt

  return (
    <div className="space-y-6">
      {showOverage && tierStatus && (
        <div className="bg-info-subtle border border-info/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-info mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-info-fg">You've outgrown {tierStatus.currentTierName}</h3>
              {tierStatus.needsContactSales ? (
                <p className="text-sm text-info-fg mt-1">
                  You now have {tierStatus.propertyCount} properties, which is above the {tierStatus.currentTierName} limit. Get in touch to
                  set up an Enterprise plan tailored to your portfolio.
                </p>
              ) : (
                <>
                  <p className="text-sm text-info-fg mt-1">
                    You now have {tierStatus.propertyCount} properties. Your plan will move to{' '}
                    <span className="font-semibold">{targetTierName}</span>
                    {tierStatus.billingCycle === 'yearly' && targetYearlyDollars != null ? (
                      <>
                        {' '}
                        (${targetYearlyDollars}/year{targetMonthlyDollars != null ? `, about $${targetMonthlyDollars}/mo` : ''})
                      </>
                    ) : targetMonthlyDollars != null ? (
                      <> (${targetMonthlyDollars}/mo)</>
                    ) : null}{' '}
                    on your next renewal
                    {effectiveAt && <> on {formatDateDisplay(effectiveAt)}</>}.
                  </p>
                  <p className="text-xs text-info-fg/80 mt-1">
                    No charges happen now. You'll keep paying your current rate until renewal day.
                  </p>
                </>
              )}
              {tierStatus.needsContactSales && (
                <div className="mt-3">
                  <a
                    href="mailto:support@baileysanalytics.com?subject=Enterprise%20pricing%20inquiry"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-info-fg underline underline-offset-2"
                  >
                    Contact us
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* current plan with payment info */}
      <div className="bg-card rounded-lg shadow-sm border p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Current Plan</h3>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-info-subtle text-info-fg">
                {planName}
              </span>
              {isLegacy && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-900 border border-amber-300/60 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-400/30"
                  title="Thank you for being one of our first subscribers."
                >
                  <Sparkles className="w-3 h-3" strokeWidth={2.5} />
                  Early Supporter
                </span>
              )}
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(subscription.status)}`}
              >
                {subscription.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>
          <div className="text-right">
            {isYearly && totalCharge != null ? (
              <>
                <p className="text-2xl font-bold text-foreground">${totalCharge}</p>
                <p className="text-muted-foreground text-xs">/year{monthlyDollars != null && <> (${monthlyDollars}/mo)</>}</p>
              </>
            ) : monthlyDollars != null ? (
              <>
                <p className="text-2xl font-bold text-foreground">${monthlyDollars}</p>
                <p className="text-muted-foreground text-xs">/month</p>
              </>
            ) : (
              <p className="text-muted-foreground text-xs">Manage in Stripe</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm border-t border-border/60 pt-4">
          {subscription.current_period_end && (
            <div>
              <span className="text-muted-foreground">Renews</span>
              <p className="font-medium text-foreground">{formatDateDisplay(subscription.current_period_end)}</p>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Payment</span>
            <p className="font-medium text-foreground">Via Stripe</p>
          </div>
          <div>
            <span className="text-muted-foreground">Properties</span>
            <p className="font-medium text-foreground">{propertiesLabel}</p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border/60">
          <Button onClick={handleManageSubscription} loading={portalLoading}>
            <ExternalLink className="w-4 h-4" />
            Manage Subscription
          </Button>
        </div>
      </div>

      {/* billing history */}
      <div className="bg-card rounded-lg shadow-sm border p-5">
        <h3 className="text-lg font-semibold text-foreground mb-3">Recent Payments</h3>
        {billingHistory.length > 0 ? (
          <div className="space-y-2">
            {billingHistory.slice(0, 5).map((payment) => (
              <div key={payment.id} className="flex justify-between items-center py-2 border-b border-border/60 last:border-0">
                <div>
                  <p className="text-sm font-medium text-foreground">{formatCurrency(payment.amount / 100)}</p>
                  <p className="text-xs text-muted-foreground">{formatDateDisplay(payment.created_at)}</p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    payment.status === 'paid' ? 'bg-success-subtle text-success-fg' : 'bg-danger-subtle text-danger-fg'
                  }`}
                >
                  {payment.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-muted/40 rounded-lg p-3 text-center">
            <p className="text-muted-foreground text-sm">No payment history yet</p>
          </div>
        )}
      </div>
    </div>
  )
}
