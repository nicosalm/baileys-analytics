import { api } from './api'
import type { TierSlug } from '@baileys/constants'

export interface SubscriptionInfo {
  status: string
  billing_cycle?: string
  current_period_end?: string
  tier?: string | null
  unit_amount?: number | null
  stripe_price_id?: string | null
}

export interface PendingTier {
  tier: TierSlug
  tierName: string
  monthlyDollars: number | null
  yearlyDollars: number | null
  effectiveAt: string
}

export interface TierStatus {
  propertyCount: number
  currentTier: TierSlug
  currentTierName: string
  currentTierMaxProperties: number | null
  currentMonthlyDollars: number | null
  resolvedTier: TierSlug
  resolvedTierName: string
  resolvedMonthlyDollars: number | null
  resolvedYearlyDollars: number | null
  isOverage: boolean
  needsContactSales: boolean
  upgradeAt: string | null
  billingCycle: 'monthly' | 'yearly'
  pending: PendingTier | null
}

export interface SubscriptionResponse {
  subscription: SubscriptionInfo | null
  tierStatus: TierStatus | null
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
  // returns the combined subscription + tierStatus payload. The two used to be
  // separate endpoints, which raced — when fired in parallel, the banner could
  // appear or disappear depending on which DB write landed first. The combined
  // endpoint is the deterministic version.
  // throws on failure so callers can't mistake an outage for "no subscription"
  async getSubscription() {
    const result = await api.request<SubscriptionResponse>('/billing/subscription')
    if (!result.success) throw new Error(result.error)
    return result.data
  }

  async createCheckoutSession(tier: TierSlug, isYearly: boolean = false) {
    const result = await api.request<{ url: string; sessionId: string }>('/billing/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify({ tier, isYearly }),
    })

    if (!result.success) {
      throw new Error(result.error || 'Failed to create checkout session')
    }

    // redirect to stripe checkout
    if (result.data.url) {
      window.location.href = result.data.url
    }

    return result.data
  }

  async createPortalSession() {
    const result = await api.request<{ url: string }>('/billing/create-portal-session', {
      method: 'POST',
    })

    if (!result.success) {
      throw new Error(result.error || 'Failed to create portal session')
    }

    // redirect to stripe portal
    if (result.data.url) {
      window.location.href = result.data.url
    }

    return result.data
  }

  async getBillingHistory() {
    const result = await api.request<{ history: BillingHistoryEntry[] }>('/billing/history')
    return result.success ? result.data.history : []
  }

  async getUsageMetrics() {
    const result = await api.request<{ metrics: UsageMetric[] }>('/billing/usage')
    return result.success ? result.data.metrics : []
  }
}

export const billingClient = new BillingClient()
