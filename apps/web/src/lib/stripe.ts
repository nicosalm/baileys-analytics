import { loadStripe, Stripe } from '@stripe/stripe-js';
import { api } from './api';

let stripePromise: Promise<Stripe | null>;

// initialize stripe with publishable key
export const getStripe = () => {
  if (!stripePromise) {
    const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      console.error('Missing Stripe publishable key');
      return Promise.resolve(null);
    }
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
};

// billing api client
class BillingClient {
  async getSubscription() {
    const result = await api.request<{ subscription: any; isExempt: boolean }>('/billing/subscription');
    return result.success ? result.data : null;
  }

  async isTrialEligible() {
    const result = await api.request<{ isEligible: boolean }>('/billing/trial-eligible');
    return result.success ? result.data.isEligible : false;
  }

  async createCheckoutSession(priceId: string, isYearly: boolean = false, isFirstMonth: boolean = false) {
    const result = await api.request<{ url: string; sessionId: string }>('/billing/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify({ priceId, isYearly, isFirstMonth })
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to create checkout session');
    }

    // redirect to stripe checkout
    if (result.data.url) {
      window.location.href = result.data.url;
    }

    return result.data;
  }

  async createPortalSession() {
    const result = await api.request<{ url: string }>('/billing/create-portal-session', {
      method: 'POST'
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to create portal session');
    }

    // redirect to stripe portal
    if (result.data.url) {
      window.location.href = result.data.url;
    }

    return result.data;
  }

  async getBillingHistory() {
    const result = await api.request<{ history: any[] }>('/billing/history');
    return result.success ? result.data.history : [];
  }

  async getUsageMetrics() {
    const result = await api.request<{ metrics: any[] }>('/billing/usage');
    return result.success ? result.data.metrics : [];
  }

  async getPlans() {
    const result = await api.request<{ plans: any[] }>('/billing/plans');
    return result.success ? result.data.plans : [];
  }
}

export const billingClient = new BillingClient();