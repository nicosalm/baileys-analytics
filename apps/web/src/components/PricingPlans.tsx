import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { billingClient } from '@/lib/stripe';
import { useToast } from '@/contexts/toast';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';


interface PricingPlansProps {
  currentPlan?: string;
  onPlanSelect?: () => void;
}

const PLANS = [
  {
    id: 'standard',
    name: 'Standard',
    monthlyPrice: 20,
    yearlyPrice: 192,
    yearlyMonthly: 16,
    features: [
      'Full OwnerRez sync (4 years of data)',
      '5 dashboards with filtering',
      'Comparison mode & seasonal filters',
      'Real-time webhook updates',
      'Cancel anytime',
    ],
  },
];

export const PricingPlans: React.FC<PricingPlansProps> = ({
  currentPlan,
  onPlanSelect
}) => {
  const [yearlyBilling, setYearlyBilling] = useState(true);
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  const handleSelectPlan = async (planId: string) => {
    try {
      setLoading(true);
      await billingClient.createCheckoutSession(planId, yearlyBilling);
      if (onPlanSelect) {
        onPlanSelect();
      }
    } catch (error) {
      addToast('error', 'Failed to start subscription. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* billing toggle */}
      <div className="flex justify-center items-center gap-3 mb-8">
        <span className={`text-sm transition-colors ${!yearlyBilling ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
          Monthly
        </span>
        <Switch checked={yearlyBilling} onCheckedChange={setYearlyBilling} aria-label="Toggle billing cycle" />
        <span className={`text-sm transition-colors ${yearlyBilling ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
          Yearly
        </span>
      </div>

      {/* cards */}
      <div className={PLANS.length === 1 ? 'max-w-sm mx-auto' : 'grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto'}>
        {PLANS.map((plan) => {
          const price = yearlyBilling ? plan.yearlyMonthly : plan.monthlyPrice;

          return (
            <div key={plan.id} className="relative group">
              {/* gradient border glow */}
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-[oklch(0.78_0.08_265)] via-[oklch(0.60_0.10_272)] to-[oklch(0.45_0.12_280)] opacity-80 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="relative bg-card rounded-2xl px-8 py-10 flex flex-col min-h-[480px]">
                {/* plan name */}
                <div className="text-center mb-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-6">
                    {plan.name}
                  </p>

                  {/* price */}
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-5xl font-bold tracking-tight text-foreground">
                      ${price}
                    </span>
                    <span className="text-base text-muted-foreground font-normal">
                      /mo
                    </span>
                  </div>

                  {/* billing context */}
                  <div className="mt-2 h-5">
                    {yearlyBilling
                      ? <p className="text-sm text-success font-medium">${plan.yearlyPrice}/year — save ${plan.monthlyPrice * 12 - plan.yearlyPrice}</p>
                      : <p className="text-sm text-muted-foreground">Billed monthly</p>
                    }
                  </div>
                </div>

                {/* divider */}
                <div className="h-px bg-border mb-8" />

                {/* features */}
                <div className="space-y-3.5 mb-auto">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="mt-0.5 w-4.5 h-4.5 rounded-full bg-success/15 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-success" strokeWidth={2.5} />
                      </div>
                      <span className="text-sm text-foreground/80 leading-snug">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* cta */}
                <div className="mt-10">
                  <Button
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={!!currentPlan || loading}
                    loading={loading}
                    loadingText="Processing..."
                    className="w-full h-11 rounded-full text-sm font-semibold"
                  >
                    {currentPlan ? 'Current Plan' : 'Subscribe'}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
