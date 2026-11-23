import { useCallback, useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { TIERS, getTierBySlug, getTierMonthlyDollars, getTierYearlyDollars } from '@baileys/constants'
import { api } from '@/lib/api'
import { billingClient, BillingError, type PlanQuote } from '@/lib/stripe'
import { useAuth } from '@/contexts/auth'
import { useToast } from '@/contexts/toast'
import { Button } from '@/components/ui/button'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { LoadingState } from '@/components/LoadingState'
import { cn } from '@/lib/utils'
import { useConnectOwnerRez } from './use-connect-ownerrez'

type QuoteState = { status: 'loading' } | { status: 'ready'; quote: PlanQuote } | { status: 'not_connected' } | { status: 'error' }

const CYCLES = [
  { value: 'yearly', label: 'Yearly' },
  { value: 'monthly', label: 'Monthly' },
] as const

const cardClass = 'rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8'

// prices the plan from the owner's active OwnerRez properties; the only choice left is the billing cycle
export const PlanStep = ({ className }: { className?: string }) => {
  const [state, setState] = useState<QuoteState>({ status: 'loading' })
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('yearly')
  const [submitting, setSubmitting] = useState(false)
  const { refreshUser } = useAuth()
  const { addToast } = useToast()
  const { connect, connecting } = useConnectOwnerRez()

  const loadQuote = useCallback(async () => {
    setState({ status: 'loading' })
    // read the property list from OwnerRez first so the count is current
    const synced = await api.request('/sync/properties', { method: 'POST' })
    try {
      const quote = await billingClient.getQuote()
      // an empty count after a failed read means OwnerRez was never asked
      setState(!synced.success && quote.propertyCount === 0 ? { status: 'error' } : { status: 'ready', quote })
    } catch (err) {
      setState(err instanceof BillingError && err.code === 'OWNERREZ_NOT_CONNECTED' ? { status: 'not_connected' } : { status: 'error' })
    }
  }, [])

  useEffect(() => {
    loadQuote()
  }, [loadQuote])

  const handleSubscribe = async () => {
    setSubmitting(true)
    try {
      // redirects to Stripe on success, so the button keeps its spinner
      await billingClient.createCheckoutSession(cycle === 'yearly')
    } catch (err) {
      setSubmitting(false)
      const code = err instanceof BillingError ? err.code : undefined
      if (code === 'ALREADY_SUBSCRIBED') {
        await refreshUser()
      } else if (code === 'NO_PROPERTIES' || code === 'CONTACT_SALES') {
        // the count changed since the quote
        loadQuote()
      } else {
        addToast('error', 'Could not start checkout. Please try again.')
      }
    }
  }

  if (state.status === 'loading') {
    return (
      <div className={cn(cardClass, className)}>
        <LoadingState message="Counting your OwnerRez properties" />
      </div>
    )
  }

  if (state.status === 'not_connected') {
    return (
      <div className={cn(cardClass, className)}>
        <h2 className="text-xl font-semibold text-foreground">Connect OwnerRez</h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Your plan is priced by how many active properties you have, so Baileys needs to read your OwnerRez account first.
        </p>
        <Button onClick={connect} loading={connecting} loadingText="Connecting..." className="mt-6 w-full">
          Connect OwnerRez
        </Button>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className={cn(cardClass, className)}>
        <h2 className="text-xl font-semibold text-foreground">We couldn't count your properties</h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">OwnerRez didn't answer. This is usually temporary.</p>
        <Button onClick={loadQuote} variant="outline" className="mt-6 w-full">
          Try again
        </Button>
      </div>
    )
  }

  const { quote } = state
  const tier = quote.tier ? getTierBySlug(quote.tier) : undefined
  const propertyLabel = `${quote.propertyCount} active ${quote.propertyCount === 1 ? 'property' : 'properties'}`

  if (!tier) {
    return (
      <div className={cn(cardClass, className)}>
        <h2 className="text-xl font-semibold text-foreground">No active properties found</h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Your OwnerRez account has no active properties yet. Add or activate one in OwnerRez, then check again.
        </p>
        <Button onClick={loadQuote} variant="outline" className="mt-6 w-full">
          Check again
        </Button>
      </div>
    )
  }

  if (quote.needsContactSales) {
    return (
      <div className={cn(cardClass, className)}>
        <h2 className="text-xl font-semibold text-foreground">Let's set up your plan together</h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          We found {propertyLabel} in OwnerRez. Portfolios of 20 or more properties get custom pricing and help with onboarding.
        </p>
        <Button asChild className="mt-6 w-full">
          <a href={`mailto:support@baileysanalytics.com?subject=${encodeURIComponent(`Pricing for ${quote.propertyCount} properties`)}`}>
            Contact us
          </a>
        </Button>
      </div>
    )
  }

  const yearly = cycle === 'yearly'

  return (
    <div className={cn(cardClass, className)}>
      <h2 className="text-xl font-semibold text-foreground">{tier.name} plan</h2>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
        We found {propertyLabel} in OwnerRez, which puts you on {tier.name} ({tier.tagline}).
      </p>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-foreground">
            <span className="text-3xl font-semibold tabular-nums">${getTierMonthlyDollars(tier, yearly)}</span>
            <span className="text-sm text-muted-foreground"> /mo</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {yearly ? `$${getTierYearlyDollars(tier)} billed yearly` : 'Billed monthly'}
          </p>
        </div>
        <SegmentedControl value={cycle} onChange={setCycle} options={CYCLES} label="Billing cycle" />
      </div>

      <Button onClick={handleSubscribe} loading={submitting} loadingText="Opening checkout..." className="mt-6 w-full">
        Continue to payment
      </Button>

      <ul className="mt-6 space-y-2 border-t border-border pt-6">
        {TIERS[0].features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
            <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {feature}
          </li>
        ))}
      </ul>

      <p className="mt-6 text-xs text-muted-foreground leading-relaxed">
        Properties marked inactive in OwnerRez don't count. If you add or remove properties later, your plan moves up or down at your next
        renewal, and we email you before it happens.
      </p>
    </div>
  )
}
