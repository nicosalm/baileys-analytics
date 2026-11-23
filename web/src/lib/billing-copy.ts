import { formatDateDisplay } from '@baileys/utils'
import type { PendingTier, TierStatus } from './stripe'

export interface UpcomingChange {
  kind: 'up' | 'down' | 'cycle' | 'contact'
  title: string
  body: string
}

const pluralProperties = (count: number) => `${count} active ${count === 1 ? 'property' : 'properties'}`

const pendingPrice = (pending: PendingTier) =>
  pending.billingCycle === 'yearly' ? `$${pending.yearlyDollars}/year` : `$${pending.monthlyDollars}/mo`

// banner copy for the Billing tab: what the next renewal changes, or null when nothing does
export const describeUpcomingChange = (status: TierStatus): UpcomingChange | null => {
  if (status.needsContactSales) {
    return {
      kind: 'contact',
      title: pluralProperties(status.propertyCount),
      body: `Portfolios of 20 or more properties get custom pricing. You stay on ${status.currentTierName} until we set that up together.`,
    }
  }

  const { pending } = status
  if (!pending) return null

  const date = formatDateDisplay(pending.effectiveAt)
  const price = pendingPrice(pending)

  if (pending.tier === status.currentTier) {
    return {
      kind: 'cycle',
      title: `Switching to ${pending.billingCycle} billing`,
      body: `Your billing switches to ${pending.billingCycle} at your renewal on ${date}, at ${price}. Nothing changes before then.`,
    }
  }

  const direction = status.change === 'down' ? 'down' : 'up'
  const cycleNote = pending.billingCycle !== status.billingCycle ? ` with ${pending.billingCycle} billing` : ''
  return {
    kind: direction,
    title: `Your plan moves ${direction} to ${pending.tierName}`,
    body: `You have ${pluralProperties(status.propertyCount)}, so ${pending.tierName} starts at your renewal on ${date}${cycleNote}, at ${price}. Nothing changes before then.`,
  }
}
