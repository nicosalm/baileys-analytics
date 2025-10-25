import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { billingClient } from '@/lib/stripe';
import { PricingPlans } from './PricingPlans';
import { LoadingState } from './LoadingState';

interface SubscriptionGateProps {
  children: React.ReactNode;
}

export const SubscriptionGate: React.FC<SubscriptionGateProps> = ({ children }) => {
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
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
      const data = await billingClient.getSubscription();
      setSubscriptionData(data);
    } catch (error) {
      // on error, assume no subscription to show pricing
      setSubscriptionData(null);
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

  // check if account is exempt or has active subscription
  const isExempt = subscriptionData?.isExempt === true;
  const subscription = subscriptionData?.subscription;
  const hasActiveSubscription = subscription &&
    ['active', 'trialing'].includes(subscription.status);

  // allow access if exempt or has active subscription
  if (!isExempt && !hasActiveSubscription) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          {/* header */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Subscribe to continue</h2>
            <p className="text-gray-600 text-sm mb-4">
              $1 for the first month, then $20/month or $192/year. Cancel anytime.
            </p>
            <div className="text-sm text-gray-600">
              <p className="mb-1">What's included:</p>
              <ul className="space-y-1 ml-4">
                <li>• Track revenue and bookings across all your properties</li>
                <li>• See occupancy rates and availability</li>
                <li>• Export financial reports</li>
                <li>• Sync with OwnerRez</li>
              </ul>
            </div>
          </div>

          {/* pricing plans */}
          <PricingPlans onPlanSelect={checkSubscription} />
        </div>
      </div>
    );
  }

  // subscription is active, allow access
  return <>{children}</>;
};