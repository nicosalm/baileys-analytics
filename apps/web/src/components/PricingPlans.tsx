import React, { useState } from 'react';
import { CheckCircle, Zap, Building, Rocket } from 'lucide-react';
import { billingClient } from '@/lib/stripe';
import { useToast } from '@/contexts/toast';
import { LoadingButton } from './LoadingButton';

interface PricingPlansProps {
  currentPlan?: string;
  onPlanSelect?: () => void;
}

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    icon: Zap,
    monthlyPrice: 19,
    yearlyPrice: 182.40,  // True 20% off: $19 * 12 * 0.8
    yearlyMonthly: 15.20,  // $182.40 / 12
    description: '1-3 properties',
    features: [
      'Core analytics dashboard',
      'Real-time sync',
      'Monthly & yearly views',
      'Email support'
    ],
    color: 'gray'
  },
  {
    id: 'professional',
    name: 'Professional',
    icon: Building,
    monthlyPrice: 49,
    yearlyPrice: 470.40,  // True 20% off: $49 * 12 * 0.8
    yearlyMonthly: 39.20,  // $470.40 / 12
    description: '4-15 properties',
    features: [
      'Everything in Starter',
      'Advanced tax tracking & reports',
      'Guest history & analytics',
      'Occupancy gap detection',
      'Priority support'
    ],
    popular: true,
    color: 'blue'
  },
  {
    id: 'scale',
    name: 'Scale',
    icon: Rocket,
    monthlyPrice: 99,
    yearlyPrice: 950.40,  // True 20% off: $99 * 12 * 0.8
    yearlyMonthly: 79.20,  // $950.40 / 12
    description: '16+ properties',
    customPricing: true,
    features: [
      'Everything in Pro',
      'Custom integrations',
      'White-label options',
      'Dedicated account manager',
      'SLA & phone support'
    ],
    color: 'gradient'
  }
];

export const PricingPlans: React.FC<PricingPlansProps> = ({
  currentPlan,
  onPlanSelect
}) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const { addToast } = useToast();

  const handleSelectPlan = async (planId: string) => {
    try {
      setLoadingPlan(planId);

      // check if this is user's first subscription (no currentPlan means first time)
      const isFirstSubscription = !currentPlan;

      // create checkout session
      await billingClient.createCheckoutSession(
        planId,
        billingCycle === 'yearly',
        isFirstSubscription // only $1 for first-time subscribers
      );

      if (onPlanSelect) {
        onPlanSelect();
      }
    } catch (error) {
      addToast('error', 'Failed to start subscription process. Please try again.');
    } finally {
      setLoadingPlan(null);
    }
  };

  const getButtonText = (planId: string) => {
    if (currentPlan === planId) return 'Current Plan';
    if (loadingPlan === planId) return 'Processing...';
    if (!currentPlan) return 'Get Started - $1'; // first-time users
    return 'Switch Plan'; // existing users changing plans
  };

  return (
    <div className="space-y-8">
      {/* special offer banner for new users */}
      {!currentPlan && (
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-3">
            <div className="text-3xl font-bold">$1</div>
            <div className="text-left">
              <div className="font-semibold">First Month Special</div>
              <div className="text-sm opacity-90">Full access to all features</div>
            </div>
          </div>
        </div>
      )}

      {/* billing cycle toggle */}
      <div className="flex justify-center">
        <div className="bg-gray-100 p-1 rounded-lg inline-flex">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              billingCycle === 'monthly'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              billingCycle === 'yearly'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Yearly
            <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* pricing cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isCurrentPlan = currentPlan === plan.id;

          return (
            <div
              key={plan.id}
              className={`relative bg-white rounded-2xl shadow-lg border ${
                plan.popular
                  ? 'border-2 border-blue-500'
                  : 'border border-gray-200'
              } p-8 hover:shadow-xl transition-all`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <div className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                    <Zap className="w-3 h-3 mr-1" />
                    MOST POPULAR
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {plan.name}
                  </h3>
                  <div className="text-4xl font-bold mb-2 mt-4">
                    ${ billingCycle === 'yearly'
                      ? plan.yearlyMonthly.toFixed(plan.yearlyMonthly % 1 === 0 ? 0 : 2)
                      : plan.monthlyPrice }
                    {plan.customPricing && '+'}
                    <span className="text-lg text-gray-500 font-normal">/mo</span>
                  </div>
                  <p className="text-gray-600 mb-2">{plan.description}</p>
                  {billingCycle === 'yearly' ? (
                    <p className="text-sm text-green-600">
                      ${plan.yearlyPrice.toFixed(plan.yearlyPrice % 1 === 0 ? 0 : 2)}/year
                      {!plan.customPricing && ` (save $${(plan.monthlyPrice * 12 - plan.yearlyPrice).toFixed(2)})`}
                      {plan.customPricing && ' starting'}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400">
                      ${plan.monthlyPrice * 12} billed monthly
                      {plan.customPricing && ' - Custom pricing available'}
                    </p>
                  )}
                </div>

                <ul className="space-y-3 mb-8 text-left">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                      <span className={`text-sm ${feature.startsWith('Everything') ? 'font-medium' : ''}`}>{feature}</span>
                    </li>
                  ))}
                </ul>

                <LoadingButton
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={isCurrentPlan || loadingPlan !== null}
                  loading={loadingPlan === plan.id}
                  className={`block w-full py-3 rounded-full font-medium transition-all ${
                    isCurrentPlan
                      ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                      : plan.popular
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-lg transform hover:scale-105'
                      : plan.color === 'gradient'
                      ? 'bg-gray-900 text-white hover:bg-gray-800'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {getButtonText(plan.id)}
                </LoadingButton>
              </div>
            </div>
          );
        })}
      </div>

      {/* pricing notice */}
      <div className="text-center space-y-2">
        <p className="text-sm text-gray-500">{billingCycle === 'yearly' ? 'Prices shown are billed annually' : 'Save 20% with annual billing'}</p>
        <p className="text-sm text-gray-500">
          {!currentPlan
            ? '$1 for your first month, then regular pricing. Cancel anytime.'
            : 'Changes take effect immediately and are prorated. Cancel anytime.'}
        </p>
      </div>
    </div>
  );
};