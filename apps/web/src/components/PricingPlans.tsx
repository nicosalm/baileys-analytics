import React, { useState } from 'react';
import { CheckCircle, Zap } from 'lucide-react';
import { billingClient } from '@/lib/stripe';
import { useToast } from '@/contexts/toast';
import { LoadingButton } from './LoadingButton';

interface PricingPlansProps {
  currentPlan?: string;
  onPlanSelect?: () => void;
}

const plan = {
  id: 'standard',
  name: 'Baileys Analytics',
  monthlyPrice: 20,
  yearlyPrice: 192,  // 20% off: $20 * 12 * 0.8
  yearlyMonthly: 16,  // $192 / 12
  description: 'Complete vacation rental analytics',
  features: [
    'Full analytics dashboard',
    'Real-time OwnerRez sync',
    'Financial & occupancy insights',
    'Guest history & analytics',
    'Advanced tax tracking',
    'Custom reports & exports',
    'Season analysis',
    'Email support'
  ]
};

export const PricingPlans: React.FC<PricingPlansProps> = ({
  currentPlan,
  onPlanSelect
}) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  const handleSelectPlan = async () => {
    try {
      setLoading(true);

      // check if this is user's first subscription (no currentPlan means first time)
      const isFirstSubscription = !currentPlan;

      // create checkout session
      await billingClient.createCheckoutSession(
        plan.id,
        billingCycle === 'yearly',
        isFirstSubscription // only $1 for first-time subscribers
      );

      if (onPlanSelect) {
        onPlanSelect();
      }
    } catch (error) {
      addToast('error', 'Failed to start subscription process. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getButtonText = () => {
    if (currentPlan) return 'Current Plan';
    if (loading) return 'Processing...';
    return 'Get Started - $1'; // first-time users
  };

  const price = billingCycle === 'yearly' ? plan.yearlyMonthly : plan.monthlyPrice;
  const totalYearly = plan.yearlyPrice;
  const savings = plan.monthlyPrice * 12 - plan.yearlyPrice;

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

      {/* single pricing card */}
      <div className="max-w-md mx-auto">
        <div className="relative bg-white rounded-2xl shadow-xl border-2 border-blue-500 p-8">
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
            <div className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
              <Zap className="w-3 h-3 mr-1" />
              SINGLE PLAN
            </div>
          </div>

          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {plan.name}
              </h3>
              <div className="text-5xl font-bold mb-2">
                ${price}
                <span className="text-lg text-gray-500 font-normal">/mo</span>
              </div>
              <p className="text-gray-600 mb-2">{plan.description}</p>
              {billingCycle === 'yearly' ? (
                <p className="text-sm text-green-600">
                  ${totalYearly}/year (save ${savings})
                </p>
              ) : (
                <p className="text-sm text-gray-400">
                  ${plan.monthlyPrice * 12} billed monthly
                </p>
              )}
            </div>

            <ul className="space-y-3 mb-8 text-left">
              {plan.features.map((feature, index) => (
                <li key={index} className="flex items-start">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>

            <LoadingButton
              onClick={handleSelectPlan}
              disabled={!!currentPlan || loading}
              loading={loading}
              className={`block w-full py-3 rounded-full font-medium transition-all ${
                currentPlan
                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-lg transform hover:scale-105'
              }`}
            >
              {getButtonText()}
            </LoadingButton>
          </div>
        </div>
      </div>

      {/* pricing notice */}
      <div className="text-center space-y-2">
        <p className="text-sm text-gray-500">
          {billingCycle === 'yearly' ? 'Billed annually' : 'Save 20% with annual billing'}
        </p>
        <p className="text-sm text-gray-500">
          {!currentPlan
            ? '$1 for your first month, then regular pricing. Cancel anytime.'
            : 'Changes take effect immediately. Cancel anytime.'}
        </p>
      </div>
    </div>
  );
};
