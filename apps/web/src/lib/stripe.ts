import { api } from './api';

interface SubscriptionResponse {
  subscription: {
    status: string
    billing_cycle?: string
    current_period_end?: string
  } | null
  isExempt: boolean
}

interface BillingHistoryEntry {
  id: string
  amount: number
  status: string
  created_at: string
}

interface UsageMetric {
  name: string
  value: number
  limit?: number
}

// billing api client
class BillingClient {
  async getSubscription() {
    const result = await api.request<SubscriptionResponse>('/billing/subscription');
    return result.success ? result.data : null;
  }

  async createCheckoutSession(priceId: string, isYearly: boolean = false) {
    const result = await api.request<{ url: string; sessionId: string }>('/billing/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify({ priceId, isYearly })
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
    const result = await api.request<{ history: BillingHistoryEntry[] }>('/billing/history');
    return result.success ? result.data.history : [];
  }

  async getUsageMetrics() {
    const result = await api.request<{ metrics: UsageMetric[] }>('/billing/usage');
    return result.success ? result.data.metrics : [];
  }

}

export const billingClient = new BillingClient();
