import React, { useState, useEffect } from 'react';
import { CheckCircle } from 'lucide-react';
import { billingClient } from '@/lib/stripe';
import { useToast } from '@/contexts/toast';
import { LoadingButton } from './LoadingButton';
import { LoadingState } from './LoadingState';
import { BRAND } from '@/constants';

interface PricingPlansProps {
  currentPlan?: string;
  onPlanSelect?: () => void;
}

const plan = {
  id: 'standard',
  monthlyPrice: 20,
  yearlyPrice: 192,
  yearlyMonthly: 16,
  features: [
    'Full OwnerRez sync (3 years of data)',
    '6 dashboards with filtering',
    'Exportable PDF reports',
    'Cancel anytime'
  ]
};

export const PricingPlans: React.FC<PricingPlansProps> = ({
  currentPlan,
  onPlanSelect
}) => {
  const [yearlyBilling, setYearlyBilling] = useState(true);
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

  const handleSelectPlan = async () => {
    try {
      setLoading(true);
      await billingClient.createCheckoutSession(
        plan.id,
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

  const price = yearlyBilling ? plan.yearlyMonthly : plan.monthlyPrice;

  if (checkingEligibility) {
    return (
      <div className="flex justify-center py-12">
        <LoadingState message="Loading..." size="md" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      {/* billing toggle */}
      <div className="flex justify-center items-center gap-4 mb-8">
        <span className={`text-sm font-medium ${!yearlyBilling ? 'text-gray-900' : 'text-gray-500'}`}>
          Monthly
        </span>
        <button
          onClick={() => setYearlyBilling(!yearlyBilling)}
          aria-label="Toggle billing cycle"
          className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${yearlyBilling ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
        <span className={`text-sm font-medium ${yearlyBilling ? 'text-gray-900' : 'text-gray-500'}`}>
          Yearly
          <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
            Save 20%
          </span>
        </span>
      </div>

      {/* pricing card */}
      <div className="bg-white rounded-2xl border-2 border-blue-500 p-8">
        <div className="text-center mb-6">
          <div className="text-4xl md:text-5xl font-bold text-gray-900 mb-1">
            ${price}<span className="text-xl text-gray-500 font-normal">/mo</span>
          </div>
          {yearlyBilling && <p className="text-sm text-green-600">$192/year, save $48</p>}
          {!yearlyBilling && <p className="text-sm text-gray-500">Billed monthly</p>}
        </div>

        <div className="space-y-3 mb-8">
          {plan.features.map((feature, index) => (
            <div key={index} className="flex items-center">
              <CheckCircle className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
              <span className="text-sm text-gray-700">{feature}</span>
            </div>
          ))}
        </div>

        <LoadingButton
          onClick={handleSelectPlan}
          disabled={!!currentPlan || loading}
          loading={loading}
          loadingText="Processing..."
          className={`w-full py-3 text-center rounded-lg font-medium transition-opacity cursor-pointer ${
            currentPlan
              ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
              : `${BRAND.buttonGradient} text-white hover:opacity-90`
          }`}
        >
          {currentPlan ? 'Current Plan' : isTrialEligible ? 'Start $1 Trial' : 'Subscribe'}
        </LoadingButton>

        {isTrialEligible && (
          <p className="text-center text-xs text-gray-500 mt-4">
            $1 for 30 days, then {yearlyBilling ? '$192/year' : '$20/month'}
          </p>
        )}
      </div>
    </div>
  );
};
