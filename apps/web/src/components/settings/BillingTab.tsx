import { useState, useEffect } from 'react';
import {
  CreditCard, Receipt, ExternalLink,
  AlertCircle, Loader, CheckCircle
} from 'lucide-react';
import { billingClient } from '@/lib/stripe';
import { PricingPlans } from '@/components/PricingPlans';
import { LoadingButton } from '@/components/LoadingButton';
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
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // show free account status for exempt accounts
  if (isExempt) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-6 h-6 text-green-600 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-green-900">Complimentary Access</h3>
              <p className="text-sm text-green-700 mt-1">
                This account has been granted free unlimited access to all features of Baileys Analytics.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Benefits</h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-gray-700">Unlimited properties and bookings</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-gray-700">Full access to all analytics features</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-gray-700">Custom reports and exports</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-gray-700">Priority support</span>
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
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-900">No Active Subscription</h3>
              <p className="text-sm text-yellow-700 mt-1">
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
        return 'bg-green-100 text-green-700';
      case 'trialing':
        return 'bg-blue-100 text-blue-700';
      case 'past_due':
        return 'bg-red-100 text-red-700';
      case 'canceled':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'usd'
    }).format(amount / 100);
  };

  return (
    <div className="space-y-6">
      {/* current plan */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Current Plan</h2>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                Baileys Analytics
              </span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(subscription.status)}`}>
                {subscription.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-gray-900">
              {subscription.billing_cycle === 'yearly' ? '$16' : '$20'}
            </p>
            <p className="text-gray-500 text-sm">
              {subscription.billing_cycle === 'yearly' ? 'per month (billed annually)' : 'per month'}
            </p>
          </div>
        </div>

        {/* subscription details */}
        <div className="border-t border-gray-200 pt-4 space-y-3">
          {subscription.current_period_end && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Current Period Ends</span>
              <span className="font-medium text-gray-900">
                {formatDateDisplay(new Date(subscription.current_period_end))}
              </span>
            </div>
          )}

          {subscription.trial_end && subscription.status === 'trialing' && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Trial Ends</span>
              <span className="font-medium text-gray-900">
                {formatDateDisplay(new Date(subscription.trial_end))}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Properties</span>
            <span className="font-medium text-gray-900">Unlimited</span>
          </div>
        </div>

        {/* manage subscription button */}
        <div className="mt-6">
          <LoadingButton
            onClick={handleManageSubscription}
            loading={portalLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Manage Subscription
          </LoadingButton>
        </div>
      </div>

      {/* payment method */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Payment Method
          </h3>
          <div className="space-y-3">
            {subscription.status === 'trialing' ? (
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-700">
                  Payment method will be required at the end of your trial period.
                </p>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">
                  Manage payment methods in the billing portal.
                </p>
                <button
                  onClick={handleManageSubscription}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Update Payment Method →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* billing history */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Recent Payments
          </h3>
          {billingHistory.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {billingHistory.slice(0, 5).map((payment) => (
                <div
                  key={payment.id}
                  className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {formatPrice(payment.amount)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDateDisplay(new Date(payment.created_at))}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${
                    payment.status === 'paid'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {payment.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-gray-500 text-sm">No payment history yet</p>
            </div>
          )}
        </div>
      </div>

      {/* faq section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Frequently Asked Questions</h3>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-900 mb-1">How do I cancel my subscription?</p>
            <p className="text-sm text-gray-600">
              You can cancel anytime through the billing portal. Your access will continue until the end of your billing period.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 mb-1">Can I switch between monthly and yearly billing?</p>
            <p className="text-sm text-gray-600">
              Yes, you can switch billing cycles anytime through the billing portal. Save 20% with annual billing.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 mb-1">Do you offer refunds?</p>
            <p className="text-sm text-gray-600">
              All payments are non-refundable. The first 30 days cost just $1, so you can try the platform risk-free.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 mb-1">Are there any usage limits?</p>
            <p className="text-sm text-gray-600">
              No. All features, properties, reports, and API calls are unlimited with your subscription.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};