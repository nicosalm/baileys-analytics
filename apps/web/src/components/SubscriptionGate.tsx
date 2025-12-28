import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 transition-colors mb-6">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to home
            </Link>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Subscribe to continue</h2>
            <p className="text-gray-600">Choose your billing cycle to get started.</p>
          </div>
          <PricingPlans onPlanSelect={checkSubscription} />
        </div>
      </div>
    );
  }

  // subscription is active, allow access
  return <>{children}</>;
};