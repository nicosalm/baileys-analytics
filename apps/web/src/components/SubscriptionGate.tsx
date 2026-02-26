import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { billingClient } from '@/lib/stripe';
import { useAuth } from '@/contexts/auth';
import { PricingPlans } from './PricingPlans';
import { LoadingState } from './LoadingState';
import { Footer } from './Footer';
import { Button } from '@/components/ui/button';
import { BRAND } from '@/constants';

interface SubscriptionGateProps {
  children: React.ReactNode;
}

export const SubscriptionGate: React.FC<SubscriptionGateProps> = ({ children }) => {
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

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
      // In dev mode, bypass subscription check if backend is unreachable
      if (import.meta.env.DEV) {
        console.warn('[SubscriptionGate] Backend unreachable — bypassing subscription check in dev mode');
        setSubscriptionData({ isExempt: true });
      } else {
        // on error in production, assume no subscription to show pricing
        setSubscriptionData(null);
      }
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
    const handleLogout = async () => {
      await logout();
      navigate('/');
    };

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* header */}
        <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex justify-between items-center">
              <Link to="/" className="flex items-center hover:opacity-80 transition-opacity">
                <img src="/baileysanalytics.svg" alt={BRAND.name} className="w-9 h-9" />
                <span className="text-xl font-semibold text-gray-900 ml-3">{BRAND.name}</span>
              </Link>
              <Button variant="ghost" onClick={handleLogout} className="text-gray-600 hover:text-gray-800 text-sm">
                <LogOut className="w-4 h-4" />
                Logout
              </Button>
            </div>
          </div>
        </header>

        {/* main content */}
        <div className="flex-1 flex items-center justify-center py-12 px-4">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Get started</h2>
              <p className="text-gray-600">Unlock your vacation rental analytics.</p>
            </div>
            <PricingPlans onPlanSelect={checkSubscription} />
          </div>
        </div>

        <Footer />
      </div>
    );
  }

  // subscription is active, allow access
  return <>{children}</>;
};
