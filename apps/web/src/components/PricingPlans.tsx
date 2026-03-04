import React, { useState, useEffect } from 'react';
import { CheckCircle } from 'lucide-react';
import { billingClient } from '@/lib/stripe';
import { useToast } from '@/contexts/toast';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from './LoadingState';
import { BRAND } from '@/constants';

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
      'Full OwnerRez sync (3 years of data)',
      '6 dashboards with filtering',
      'Exportable PDF reports',
      'Cancel anytime',
    ],
  },
];

export const PricingPlans: React.FC<PricingPlansProps> = ({
  currentPlan,
  onPlanSelect
}) => {
  const [yearlyBilling, setYearlyBilling] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isTrialEligible, setIsTrialEligible] = useState(false);
  const [checkingEligibility, setCheckingEligibility] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    const checkEligibility = async () => {
      try {
        const eligible = await billingClient.isTrialEligible();
        setIsTrialEligible(eligible);
      } catch (error) {
        console.error('Failed to check trial eligibility:', error);
        setIsTrialEligible(false);
      } finally {
        setCheckingEligibility(false);
      }
    };
    checkEligibility();
  }, []);

  const handleSelectPlan = async (planId: string) => {
    try {
      setLoading(true);
      await billingClient.createCheckoutSession(
        planId,
        yearlyBilling,
        isTrialEligible
      );
      if (onPlanSelect) {
        onPlanSelect();
      }
    } catch (error) {
      addToast('error', 'Failed to start subscription. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingEligibility) {
    return (
      <div className="flex justify-center py-12">
        <LoadingState message="Loading..." size="md" />
      </div>
    );
  }

  return (
    <div className={PLANS.length === 1 ? 'max-w-md mx-auto' : 'grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto'}>
      {/* billing toggle */}
      <div className={`flex justify-center items-center gap-4 mb-6 ${PLANS.length > 1 ? 'col-span-full' : ''}`}>
        <span className={`text-sm font-medium ${!yearlyBilling ? 'text-foreground' : 'text-muted-foreground'}`}>
          Monthly
        </span>
        <Switch checked={yearlyBilling} onCheckedChange={setYearlyBilling} aria-label="Toggle billing cycle" />
        <span className={`text-sm font-medium flex items-center gap-1.5 ${yearlyBilling ? 'text-foreground' : 'text-muted-foreground'}`}>
          Yearly
          <Badge variant="secondary" className="bg-success-subtle text-success-fg">
            Save 20%
          </Badge>
        </span>
      </div>

      {PLANS.map((plan) => {
        const price = yearlyBilling ? plan.yearlyMonthly : plan.monthlyPrice;

        return (
          <div key={plan.id} className="bg-card rounded-2xl border-2 border-primary p-8">
            <div className="text-center mb-6">
              <div className="text-4xl md:text-5xl font-bold text-foreground mb-1">
                ${price}<span className="text-xl text-muted-foreground font-normal">/mo</span>
              </div>
              {yearlyBilling && <p className="text-sm text-success">${plan.yearlyPrice}/year, save ${plan.monthlyPrice * 12 - plan.yearlyPrice}</p>}
              {!yearlyBilling && <p className="text-sm text-muted-foreground">Billed monthly</p>}
            </div>

            <div className="space-y-2 mb-8">
              {plan.features.map((feature, index) => (
                <div key={index} className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-success mr-3 flex-shrink-0" />
                  <span className="text-sm text-foreground">{feature}</span>
                </div>
              ))}
            </div>

            <Button
              onClick={() => handleSelectPlan(plan.id)}
              disabled={!!currentPlan || loading}
              loading={loading}
              loadingText="Processing..."
              className={`w-full py-3 text-center rounded-lg font-medium transition-opacity cursor-pointer ${
                currentPlan
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : `${BRAND.buttonGradient} text-white hover:opacity-90`
              }`}
            >
              {currentPlan ? 'Current Plan' : isTrialEligible ? 'Start $1 Trial' : 'Subscribe'}
            </Button>

            {isTrialEligible && (
              <p className="text-center text-xs text-muted-foreground mt-4">
                $1 for 30 days, then {yearlyBilling ? `$${plan.yearlyPrice}/year` : `$${plan.monthlyPrice}/month`}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};
