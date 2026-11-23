import { describe, it, expect } from 'vitest'
import { formatDateDisplay } from '@baileys/utils'
import { describeUpcomingChange } from './billing-copy'
import type { TierStatus } from './stripe'

const RENEWAL = '2026-12-03T00:00:00.000Z'
const date = formatDateDisplay(RENEWAL)

const status = (patch: Partial<TierStatus> = {}): TierStatus => ({
  propertyCount: 7,
  currentTier: 'growth',
  currentTierName: 'Growth',
  currentTierMaxProperties: 9,
  currentMonthlyDollars: 39,
  resolvedTier: 'growth',
  resolvedTierName: 'Growth',
  targetTier: 'growth',
  targetTierName: 'Growth',
  targetMonthlyDollars: 39,
  targetYearlyDollars: 399,
  isOverage: false,
  change: null,
  needsContactSales: false,
  renewsAt: RENEWAL,
  billingCycle: 'monthly',
  targetBillingCycle: 'monthly',
  pending: null,
  ...patch,
})

describe('describeUpcomingChange', () => {
  it('says nothing when the renewal changes nothing', () => {
    expect(describeUpcomingChange(status())).toBeNull()
  })

  it('describes an upgrade', () => {
    const change = describeUpcomingChange(
      status({
        propertyCount: 12,
        change: 'up',
        pending: {
          tier: 'portfolio',
          tierName: 'Portfolio',
          billingCycle: 'monthly',
          monthlyDollars: 79,
          yearlyDollars: 799,
          effectiveAt: RENEWAL,
        },
      }),
    )
    expect(change).toEqual({
      kind: 'up',
      title: 'Your plan moves up to Portfolio',
      body: `You have 12 active properties, so Portfolio starts at your renewal on ${date}, at $79/mo. Nothing changes before then.`,
    })
  })

  it('describes a downgrade with yearly billing', () => {
    const change = describeUpcomingChange(
      status({
        propertyCount: 1,
        change: 'down',
        billingCycle: 'yearly',
        pending: {
          tier: 'starter',
          tierName: 'Starter',
          billingCycle: 'yearly',
          monthlyDollars: 17,
          yearlyDollars: 199,
          effectiveAt: RENEWAL,
        },
      }),
    )
    expect(change?.kind).toBe('down')
    expect(change?.body).toBe(
      `You have 1 active property, so Starter starts at your renewal on ${date}, at $199/year. Nothing changes before then.`,
    )
  })

  it('mentions a cycle switch that rides along with a tier change', () => {
    const change = describeUpcomingChange(
      status({
        propertyCount: 12,
        change: 'up',
        targetBillingCycle: 'yearly',
        pending: {
          tier: 'portfolio',
          tierName: 'Portfolio',
          billingCycle: 'yearly',
          monthlyDollars: 67,
          yearlyDollars: 799,
          effectiveAt: RENEWAL,
        },
      }),
    )
    expect(change?.body).toContain(`on ${date} with yearly billing, at $799/year`)
  })

  it('describes a cycle switch on its own', () => {
    const change = describeUpcomingChange(
      status({
        targetBillingCycle: 'yearly',
        pending: {
          tier: 'growth',
          tierName: 'Growth',
          billingCycle: 'yearly',
          monthlyDollars: 33,
          yearlyDollars: 399,
          effectiveAt: RENEWAL,
        },
      }),
    )
    expect(change).toEqual({
      kind: 'cycle',
      title: 'Switching to yearly billing',
      body: `Your billing switches to yearly at your renewal on ${date}, at $399/year. Nothing changes before then.`,
    })
  })

  it('points 20 or more properties to sales', () => {
    const change = describeUpcomingChange(
      status({ propertyCount: 24, currentTier: 'portfolio', currentTierName: 'Portfolio', needsContactSales: true }),
    )
    expect(change).toEqual({
      kind: 'contact',
      title: '24 active properties',
      body: 'Portfolios of 20 or more properties get custom pricing. You stay on Portfolio until we set that up together.',
    })
  })
})
