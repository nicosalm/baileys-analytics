import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { billingClient } from '@/lib/stripe';
import { PricingPlans } from './PricingPlans';
import { LoadingState } from './LoadingState';
import { AlertCircle } from 'lucide-react';

interface SubscriptionGateProps {
  children: React.ReactNode;
}

export const SubscriptionGate: React.FC<SubscriptionGateProps> = ({ children }) => {
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  // pages that don't require subscription
  const publicPaths = ['/settings', '/login', '/signup', '/forgot-password', '/reset-password'];
  const isPublicPath = publicPaths.some(path => location.pathname.startsWith(path));

  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    try {
      const sub = await billingClient.getSubscription();
      setSubscription(sub);
    } catch (error) {
      console.error('Error checking subscription:', error);
      // on error, assume no subscription to show pricing
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  };

  // always allow access to settings page so they can manage billing
  if (isPublicPath) {
    return <>{children}</>;
  }

  if (loading) {
    return <LoadingState fullScreen />;
  }

  // check if subscription exists and is active
  const hasActiveSubscription = subscription &&
    ['active', 'trialing'].includes(subscription.status);

  if (!hasActiveSubscription) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 py-12">
        <div className="max-w-6xl mx-auto px-6">
          {/* header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl mb-4">
              <AlertCircle className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Choose Your Plan to Get Started
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Select the plan that best fits your property portfolio.
              Just $1 for your first month, then regular pricing.
            </p>
          </div>

          {/* pricing plans */}
          <PricingPlans onPlanSelect={checkSubscription} />

          {/* additional info */}
          <div className="mt-12 bg-blue-50 rounded-xl p-6 max-w-2xl mx-auto">
            <h3 className="font-semibold text-blue-900 mb-2">How it works:</h3>
            <ol className="space-y-2 text-sm text-blue-800">
              <li>1. Choose your plan based on your property count</li>
              <li>2. Pay $1 to access the full dashboard for your first month</li>
              <li>3. After 30 days, you'll be charged the regular monthly or yearly rate</li>
              <li>4. Change or cancel your plan anytime from Settings</li>
            </ol>
          </div>

          {/* link to settings if they want to check something */}
          <div className="text-center mt-8">
            <a href="/settings?tab=billing" className="text-sm text-gray-600 hover:text-gray-900">
              Need to update payment details? Go to Settings →
            </a>
          </div>
        </div>
      </div>
    );
  }

  // subscription is active, allow access
  return <>{children}</>;
};