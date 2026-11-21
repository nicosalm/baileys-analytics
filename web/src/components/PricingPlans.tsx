import type React from 'react'
import { useState } from 'react'
import { Check } from 'lucide-react'
import { TIERS, getTierMonthlyDollars, getTierYearlyDollars, type Tier, type TierSlug } from '@baileys/constants'
import { billingClient } from '@/lib/stripe'
import { useToast } from '@/contexts/toast'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'

const SALES_EMAIL = 'support@baileysanalytics.com'

interface PricingPlansProps {
  currentTier?: TierSlug
}

export const PricingPlans: React.FC<PricingPlansProps> = ({ currentTier }) => {
  const [yearlyBilling, setYearlyBilling] = useState(true)
  const [loadingTier, setLoadingTier] = useState<TierSlug | null>(null)
  const { addToast } = useToast()
  const enterpriseTier = TIERS.find((t) => t.contactSales) ?? null

  const handleSelectTier = async (tier: Tier) => {
    if (tier.contactSales) {
      window.location.href = `mailto:${SALES_EMAIL}?subject=Enterprise%20pricing%20inquiry`
      return
    }
    try {
      setLoadingTier(tier.slug)
      await billingClient.createCheckoutSession(tier.slug, yearlyBilling)
    } catch {
      addToast('error', 'Failed to start subscription. Please try again.')
    } finally {
      setLoadingTier(null)
    }
  }

  return (
    <div className="w-full">
      {/* billing toggle */}
      <div className="flex justify-center items-center gap-3 mb-6">
        <span className={`text-sm transition-colors ${!yearlyBilling ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
          Monthly
        </span>
        <Switch checked={yearlyBilling} onCheckedChange={setYearlyBilling} aria-label="Toggle billing cycle" />
        <span className={`text-sm transition-colors ${yearlyBilling ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
          Yearly
        </span>
      </div>

      {/* price cards - compact, no repeated features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto mb-8">
        {TIERS.filter((t) => !t.contactSales).map((tier) => {
          const isCurrent = currentTier === tier.slug
          const isLoading = loadingTier === tier.slug
          const monthlyDollars = getTierMonthlyDollars(tier, yearlyBilling)
          const yearlyDollars = getTierYearlyDollars(tier)

          return (
            <div
              key={tier.slug}
              className={`bg-card rounded-lg shadow-sm border p-5 flex flex-col items-center transition-colors ${
                isCurrent ? 'border-primary/40 ring-1 ring-primary/20' : ''
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-semibold text-foreground">{tier.name}</h3>
                {isCurrent && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                    Current
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-4">{tier.tagline}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold tracking-tight text-foreground">${monthlyDollars}</span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 h-4 mb-4">
                {yearlyBilling && yearlyDollars != null ? `$${yearlyDollars} billed yearly` : 'Billed monthly'}
              </p>
              <Button
                onClick={() => handleSelectTier(tier)}
                disabled={isCurrent || isLoading}
                loading={isLoading}
                loadingText="Processing..."
                className="w-full"
                size="sm"
              >
                {isCurrent ? 'Current plan' : 'Subscribe'}
              </Button>
            </div>
          )
        })}
      </div>

      {/* features listed once */}
      <div className="max-w-2xl mx-auto mb-8">
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">Included in every plan</p>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2">
          {TIERS[0].features.map((feature) => (
            <div key={feature} className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-success mt-0.5 flex-shrink-0" strokeWidth={2.5} />
              <span className="text-xs text-foreground/80 leading-snug">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* enterprise callout */}
      {enterpriseTier && (
        <div className="max-w-3xl mx-auto">
          <div
            className={`bg-card rounded-lg shadow-sm border p-5 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left transition-colors ${
              currentTier === enterpriseTier.slug ? 'border-primary/40 ring-1 ring-primary/20' : ''
            }`}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 justify-center sm:justify-start mb-1">
                <h3 className="text-base font-semibold text-foreground">Enterprise</h3>
                {currentTier === enterpriseTier.slug && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                    Current
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">20+ properties with custom pricing, dedicated onboarding, and roadmap input.</p>
            </div>
            <Button onClick={() => handleSelectTier(enterpriseTier)} variant="outline" size="sm" className="whitespace-nowrap">
              Contact us
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
