import { useState, useEffect } from 'react';
import {
  ExternalLink,
  AlertCircle, CheckCircle
} from 'lucide-react';
import { LoadingState } from '@/components/LoadingState';
import { billingClient } from '@/lib/stripe';
import { PricingPlans } from '@/components/PricingPlans';
import { Button } from '@/components/ui/button';
import { useToast } from '@/contexts/toast';
import { formatDateDisplay } from '@baileys/utils';

export const BillingTab = () => {
  const [subscription, setSubscription] = useState<any>(null);
  const [billingHistory, setBillingHistory] = useState<any[]>([]);
  const [isExempt, setIsExempt] = useState(false);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    loadBillingData();
  }, []);

  const loadBillingData = async () => {
    setLoading(true);
    try {
      const [subData, history] = await Promise.all([
        billingClient.getSubscription(),
        billingClient.getBillingHistory()
      ]);

      setSubscription(subData?.subscription || null);
      setIsExempt(subData?.isExempt || false);
      setBillingHistory(history);
    } catch (error) {
      addToast('error', 'Failed to load billing information');
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      await billingClient.createPortalSession();
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Failed to open billing portal');
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) {
    return <LoadingState />;
  }

  // show free account status for exempt accounts
  if (isExempt) {
    return (
      <div className="space-y-6">
        <div className="bg-success-subtle border border-success/30 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-6 h-6 text-success mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-success-fg">Complimentary Access</h3>
              <p className="text-sm text-success-fg mt-1">
                This account has been granted free unlimited access to all features of Baileys Analytics.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Account Benefits</h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
              <span className="text-sm text-foreground">Unlimited properties and bookings</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
              <span className="text-sm text-foreground">Full access to all analytics features</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
              <span className="text-sm text-foreground">Custom reports and exports</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
              <span className="text-sm text-foreground">Priority support</span>
            </li>
          </ul>
        </div>
      </div>
    );
  }

  // show pricing plans if no subscription
  if (!subscription || subscription.status === 'canceled') {
    return (
      <div className="space-y-6">
        <div className="bg-warning-subtle border border-warning/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-warning mt-0.5" />
            <div>
              <h3 className="font-semibold text-warning-fg">No Active Subscription</h3>
              <p className="text-sm text-warning-fg mt-1">
                Choose a plan below to unlock all features and continue using the platform.
              </p>
            </div>
          </div>
        </div>

        <PricingPlans onPlanSelect={loadBillingData} />
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-success-subtle text-success-fg';
      case 'trialing':
        return 'bg-info-subtle text-info-fg';
      case 'past_due':
        return 'bg-danger-subtle text-danger-fg';
      case 'canceled':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'usd'
    }).format(amount / 100);
  };

  return (
    <div className="space-y-4">
      {/* current plan with payment info */}
      <div className="bg-card rounded-lg shadow-sm border p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Current Plan</h3>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-sm font-medium bg-info-subtle text-info-fg">
                Baileys Analytics
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(subscription.status)}`}>
                {subscription.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-foreground">
              {subscription.billing_cycle === 'yearly' ? '$16' : '$20'}
            </p>
            <p className="text-muted-foreground text-xs">
              {subscription.billing_cycle === 'yearly' ? '/mo (billed annually)' : '/month'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm border-t border-border/60 pt-4">
          {subscription.current_period_end && (
            <div>
              <span className="text-muted-foreground">Renews</span>
              <p className="font-medium text-foreground">
                {formatDateDisplay(subscription.current_period_end)}
              </p>
            </div>
          )}
          {subscription.trial_end && subscription.status === 'trialing' && (
            <div>
              <span className="text-muted-foreground">Trial Ends</span>
              <p className="font-medium text-foreground">
                {formatDateDisplay(subscription.trial_end)}
              </p>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Payment</span>
            <p className="font-medium text-foreground">
              {subscription.status === 'trialing' ? 'Required after trial' : 'Via Stripe'}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Properties</span>
            <p className="font-medium text-foreground">Unlimited</p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border/60">
          <Button onClick={handleManageSubscription} loading={portalLoading}>
            <ExternalLink className="w-4 h-4" />
            Manage Subscription
          </Button>
        </div>
      </div>

      {/* billing history */}
      <div className="bg-card rounded-lg shadow-sm border p-5">
        <h3 className="text-lg font-semibold text-foreground mb-3">Recent Payments</h3>
        {billingHistory.length > 0 ? (
          <div className="space-y-2">
            {billingHistory.slice(0, 5).map((payment) => (
              <div
                key={payment.id}
                className="flex justify-between items-center py-2 border-b border-border/60 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {formatPrice(payment.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateDisplay(payment.created_at)}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  payment.status === 'paid'
                    ? 'bg-success-subtle text-success-fg'
                    : 'bg-danger-subtle text-danger-fg'
                }`}>
                  {payment.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-muted/40 rounded-lg p-3 text-center">
            <p className="text-muted-foreground text-sm">No payment history yet</p>
          </div>
        )}
      </div>
    </div>
  );
};