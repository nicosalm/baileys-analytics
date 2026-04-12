import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { TIERS, getTierMonthlyDollars, getTierYearlyDollars, type Tier, type TierSlug } from '@baileys/constants';
import { billingClient } from '@/lib/stripe';
import { useToast } from '@/contexts/toast';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { renderInlineBold } from '@/utils/inline-bold';

const SALES_EMAIL = 'support@baileysanalytics.com';

interface PricingPlansProps {
  currentTier?: TierSlug;
  onPlanSelect?: () => void;
}

export const PricingPlans: React.FC<PricingPlansProps> = ({
  currentTier,
  onPlanSelect,
}) => {
  const [yearlyBilling, setYearlyBilling] = useState(true);
  const [loadingTier, setLoadingTier] = useState<TierSlug | null>(null);
  const { addToast } = useToast();

  const handleSelectTier = async (tier: Tier) => {
    if (tier.contactSales) {
      window.location.href = `mailto:${SALES_EMAIL}?subject=Enterprise%20pricing%20inquiry`;
      return;
    }
    try {
      setLoadingTier(tier.slug);
      await billingClient.createCheckoutSession(tier.slug, yearlyBilling);
      onPlanSelect?.();
    } catch {
      addToast('error', 'Failed to start subscription. Please try again.');
    } finally {
      setLoadingTier(null);
    }
  };

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

      {/* cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {TIERS.map((tier) => {
          const isCurrent = currentTier === tier.slug;
          const isLoading = loadingTier === tier.slug;
          const isContact = tier.contactSales;
          const monthlyDollars = getTierMonthlyDollars(tier, yearlyBilling);
          const yearlyDollars = getTierYearlyDollars(tier);

          return (
            <div
              key={tier.slug}
              className={`bg-card rounded-lg shadow-sm border p-5 flex flex-col transition-colors ${
                isCurrent ? 'border-primary/40 ring-1 ring-primary/20' : ''
              }`}
            >
              {/* header */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-base font-semibold text-foreground">{tier.name}</h3>
                  {isCurrent && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{tier.tagline}</p>
              </div>

              {/* price */}
              <div className="mb-4">
                {isContact || monthlyDollars == null ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold tracking-tight text-foreground">Custom</span>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold tracking-tight text-foreground">
                      ${monthlyDollars}
                    </span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1 h-4">
                  {isContact
                    ? 'Quoted per account'
                    : yearlyBilling && yearlyDollars != null
                      ? `$${yearlyDollars} billed yearly`
                      : 'Billed monthly'}
                </p>
              </div>

              <div className="h-px bg-border mb-4" />

              {/* features */}
              <ul className="space-y-2 mb-5 flex-1">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-success mt-0.5 flex-shrink-0" strokeWidth={2.5} />
                    <span className="text-xs text-foreground/80 leading-snug">{renderInlineBold(feature, 'font-semibold text-foreground')}</span>
                  </li>
                ))}
              </ul>

              {/* cta */}
              <Button
                onClick={() => handleSelectTier(tier)}
                disabled={isCurrent || isLoading}
                loading={isLoading}
                loadingText="Processing..."
                variant={isContact ? 'outline' : 'default'}
                className="w-full"
                size="sm"
              >
                {isCurrent ? 'Current plan' : isContact ? 'Contact sales' : 'Subscribe'}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
