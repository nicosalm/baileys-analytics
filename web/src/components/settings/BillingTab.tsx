import { useState, useEffect } from 'react'
import { CalendarClock, ExternalLink, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react'
import { LoadingState } from '@/components/LoadingState'
import { billingClient, type BillingCycle, type SubscriptionInfo, type TierStatus } from '@/lib/stripe'
import { describeUpcomingChange, type UpcomingChange } from '@/lib/billing-copy'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { PlanStep } from '@/components/onboarding/PlanStep'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/contexts/toast'
import { formatDateDisplay, formatCurrency } from '@baileys/utils'
import { getTierBySlug } from '@baileys/constants'
import { SettingsSection, SettingsRow } from './SettingsSection'

// customers from before the tier launch have no tier slug and stay on their original
// flat stripe price until ops migrates them (see LEGACY_MIGRATION_TARGET_DATE in
// packages/constants/src/tiers.ts). the same branch covers the window after signup
// before the tier column is backfilled.
const resolvePlanDisplay = (subscription: SubscriptionInfo) => {
  const isYearly = subscription.billing_cycle === 'yearly'
  const tier = subscription.tier ? getTierBySlug(subscription.tier) : undefined

  const monthlyDollars = subscription.unit_amount != null ? Math.round(subscription.unit_amount / 100 / (isYearly ? 12 : 1)) : null
  const totalCharge = subscription.unit_amount != null ? Math.round(subscription.unit_amount / 100) : null

  return { planName: tier?.name ?? 'Baileys Analytics', isLegacy: !tier, monthlyDollars, totalCharge, isYearly }
}

const UPCOMING_ICON: Record<UpcomingChange['kind'], LucideIcon> = {
  up: TrendingUp,
  down: TrendingDown,
  cycle: CalendarClock,
  contact: TrendingUp,
}

const CYCLES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
] as const

interface BillingHistoryEntry {
  id: string
  amount: number
  status: string
  created_at: string
}

const STATUS_VARIANT: Record<string, 'success' | 'danger' | 'warning' | 'neutral'> = {
  active: 'success',
  trialing: 'neutral',
  past_due: 'danger',
  unpaid: 'danger',
  incomplete: 'warning',
}

const PAYMENT_COLUMNS: Column<BillingHistoryEntry>[] = [
  { key: 'created_at', header: 'Date', render: (p) => formatDateDisplay(p.created_at) },
  {
    key: 'amount',
    header: 'Amount',
    align: 'right',
    render: (p) => <span className="tabular-nums">{formatCurrency(p.amount / 100)}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    align: 'right',
    render: (p) => (
      <Badge variant={p.status === 'paid' ? 'success' : 'danger'} className="capitalize">
        {p.status}
      </Badge>
    ),
  },
]

export const BillingTab = () => {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [billingHistory, setBillingHistory] = useState<BillingHistoryEntry[]>([])
  const [tierStatus, setTierStatus] = useState<TierStatus | null>(null)
  const [isExempt, setIsExempt] = useState(false)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)
  const [cycleSaving, setCycleSaving] = useState(false)
  const { addToast } = useToast()

  useEffect(() => {
    loadBillingData()
  }, [])

  const loadBillingData = async () => {
    setLoading(true)
    try {
      // subscription and tier status come from one endpoint so the overage banner cannot race
      const [subData, history] = await Promise.all([billingClient.getSubscription(), billingClient.getBillingHistory()])

      setSubscription(subData?.subscription || null)
      setIsExempt(subData?.isExempt || false)
      setTierStatus(subData?.tierStatus || null)
      setBillingHistory(history)
    } catch {
      addToast('error', 'Failed to load billing')
    } finally {
      setLoading(false)
    }
  }

  const handleManageSubscription = async () => {
    setPortalLoading(true)
    try {
      await billingClient.createPortalSession()
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Failed to open the billing portal')
    } finally {
      setPortalLoading(false)
    }
  }

  if (loading) {
    return <LoadingState />
  }

  if (isExempt) {
    return (
      <SettingsSection title="Plan" action={<Badge variant="success">Complimentary</Badge>}>
        <SettingsRow label="Price">No charge</SettingsRow>
        <SettingsRow label="Properties">Unlimited</SettingsRow>
      </SettingsSection>
    )
  }

  if (!subscription || subscription.status === 'canceled') {
    return (
      <div className="space-y-6">
        <SettingsSection
          title="Plan"
          description="Subscribe to keep using the dashboards. Your plan is set by your active OwnerRez properties."
          action={<Badge variant="warning">No active subscription</Badge>}
        />
        <PlanStep className="max-w-md" />
      </div>
    )
  }

  const { planName, isLegacy, monthlyDollars, totalCharge, isYearly } = resolvePlanDisplay(subscription)

  // legacy customers have no tier status, so they get no banner and no cycle toggle
  const upcoming = tierStatus ? describeUpcomingChange(tierStatus) : null
  const UpcomingIcon = upcoming ? UPCOMING_ICON[upcoming.kind] : null

  const propertiesLabel = tierStatus
    ? tierStatus.currentTierMaxProperties != null
      ? `${tierStatus.propertyCount} of ${tierStatus.currentTierMaxProperties}`
      : `${tierStatus.propertyCount}`
    : 'Unlimited'

  const handleCycleChange = async (cycle: BillingCycle) => {
    if (cycleSaving || cycle === tierStatus?.targetBillingCycle) return
    setCycleSaving(true)
    try {
      setTierStatus(await billingClient.setBillingCycle(cycle))
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Failed to change billing')
    } finally {
      setCycleSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {upcoming && UpcomingIcon && (
        <div className="bg-info-subtle border border-info/30 rounded-lg p-4 flex items-start gap-3">
          <UpcomingIcon className="w-5 h-5 text-info mt-0.5 flex-shrink-0" aria-hidden />
          <div className="text-sm text-info-fg space-y-1">
            <p className="font-semibold">{upcoming.title}</p>
            <p>
              {upcoming.body}
              {upcoming.kind === 'contact' && (
                <>
                  {' '}
                  <a
                    href="mailto:support@baileysanalytics.com?subject=Enterprise%20pricing%20inquiry"
                    className="font-medium underline underline-offset-2"
                  >
                    Contact us
                  </a>
                </>
              )}
            </p>
          </div>
        </div>
      )}

      <SettingsSection
        title="Plan"
        action={
          <Button variant="outline" size="sm" onClick={handleManageSubscription} loading={portalLoading}>
            <ExternalLink className="w-3.5 h-3.5" />
            Manage in Stripe
          </Button>
        }
      >
        <SettingsRow label="Plan">
          {planName}
          {isLegacy && <Badge variant="neutral">Early supporter</Badge>}
          <Badge variant={STATUS_VARIANT[subscription.status] ?? 'neutral'} className="capitalize">
            {subscription.status.replace('_', ' ')}
          </Badge>
        </SettingsRow>
        {totalCharge != null && (
          <SettingsRow label="Price">
            <span className="tabular-nums">
              {isYearly ? `$${totalCharge}/year` : `$${monthlyDollars}/month`}
              {isYearly && monthlyDollars != null && <span className="text-muted-foreground font-normal"> (${monthlyDollars}/mo)</span>}
            </span>
          </SettingsRow>
        )}
        {tierStatus && (
          <SettingsRow label="Billing">
            <SegmentedControl value={tierStatus.targetBillingCycle} onChange={handleCycleChange} options={CYCLES} label="Billing cycle" />
            {tierStatus.targetBillingCycle !== tierStatus.billingCycle && (
              <span className="text-xs text-muted-foreground font-normal">Switches at renewal</span>
            )}
          </SettingsRow>
        )}
        {subscription.current_period_end && <SettingsRow label="Renews">{formatDateDisplay(subscription.current_period_end)}</SettingsRow>}
        <SettingsRow label="Properties">
          <span className="tabular-nums">{propertiesLabel}</span>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Payments" flush>
        <DataTable bare data={billingHistory.slice(0, 5)} columns={PAYMENT_COLUMNS} getRowId={(p) => p.id} emptyMessage="No payments yet" />
      </SettingsSection>
    </div>
  )
}
