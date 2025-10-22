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
              Get Started with Baileys Analytics
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Complete vacation rental analytics for just $20/month.
              Start with $1 for your first 30 days.
            </p>
          </div>

          {/* pricing plans */}
          <PricingPlans onPlanSelect={checkSubscription} />

          {/* additional info */}
          <div className="mt-12 bg-blue-50 rounded-xl p-6 max-w-2xl mx-auto">
            <h3 className="font-semibold text-blue-900 mb-2">how it works:</h3>
            <ol className="space-y-2 text-sm text-blue-800">
              <li>1. subscribe to get full access to all features</li>
              <li>2. pay just $1 for your first 30 days</li>
              <li>3. after 30 days, regular pricing applies ($20/month or $192/year)</li>
              <li>4. cancel anytime from settings</li>
            </ol>
          </div>

          {/* link to settings */}
          <div className="text-center mt-8">
            <a href="/settings?tab=billing" className="text-sm text-gray-600 hover:text-gray-900">
              need to update payment details? go to settings →
            </a>
          </div>
        </div>
      </div>
    );
  }

  // subscription is active, allow access
  return <>{children}</>;
};