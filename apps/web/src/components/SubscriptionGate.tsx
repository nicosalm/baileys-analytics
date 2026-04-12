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
import { LogoCube } from '@/components/LogoCube';

interface SubscriptionGateProps {
  children: React.ReactNode;
}

export const SubscriptionGate: React.FC<SubscriptionGateProps> = ({ children }) => {
  const [subscriptionData, setSubscriptionData] = useState<{ subscription?: { status: string } | null; isExempt?: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, state } = useAuth();

  // demo users bypass subscription gate entirely
  if (state.status === 'authenticated' && state.user.isDemo) {
    return <>{children}</>;
  }

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
    subscription.status === 'active';

  // allow access if exempt or has active subscription
  if (!isExempt && !hasActiveSubscription) {
    const handleLogout = async () => {
      await logout();
      navigate('/');
    };

    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* header */}
        <header className="bg-background/80 backdrop-blur-sm border-b">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4">
            <div className="flex justify-between items-center">
              <Link to="/" className="flex items-center">
                <LogoCube />
                <span className="text-xl font-semibold text-foreground ml-3">{BRAND.name}</span>
              </Link>
              <Button variant="ghost" onClick={handleLogout} className="text-muted-foreground hover:text-foreground text-sm">
                <LogOut className="w-4 h-4" />
                Logout
              </Button>
            </div>
          </div>
        </header>

        {/* main content */}
        <div className="flex-1 flex items-start justify-center py-12 px-4">
          <div className="w-full max-w-6xl">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-2">Get started</h2>
              <p className="text-muted-foreground">Unlock financial clarity for your rentals.</p>
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
