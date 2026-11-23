import { describe, it, expect } from 'vitest'
import {
  applyFilters,
  deriveRow,
  HEALTH,
  matches,
  PLANS,
  signupsByDay,
  STAGES,
  summarize,
  type AdminFilter,
  type AdminTenantRow,
} from './admin-overview'

const NOW = Date.parse('2026-11-23T12:00:00Z')
const DAY = 24 * 60 * 60 * 1000
const iso = (offsetDays: number) => new Date(NOW + offsetDays * DAY).toISOString()

const base: AdminTenantRow = {
  tenant_id: 't',
  email: 'owner@example.com',
  company_name: null,
  created_at: iso(-100),
  exempt: false,
  ownerrez_connected: false,
  first_subscription_at: null,
  subscription_status: null,
  tier: null,
  billing_cycle: null,
  unit_amount: null,
  current_period_end: null,
  cancel_at: null,
  pending_tier: null,
  pending_effective_at: null,
  pending_notified_at: null,
  preferred_billing_cycle: null,
  property_count: 0,
  imported: false,
  sync_failing: false,
  last_data_at: null,
  errors_7d: 0,
}

const row = (id: string, patch: Partial<AdminTenantRow>) => deriveRow({ ...base, tenant_id: id, ...patch }, NOW)

const paying = { ownerrez_connected: true, imported: true, subscription_status: 'active', last_data_at: iso(-1) }

// one of every kind of tenant the dashboard has to tell apart
const rows = [
  row('new', { created_at: iso(-2) }),
  row('prospect', { ownerrez_connected: true, property_count: 3, created_at: iso(-3) }),
  row('importing', { ...paying, imported: false, tier: 'starter', billing_cycle: 'monthly', unit_amount: 2000 }),
  row('growth', { ...paying, tier: 'growth', billing_cycle: 'monthly', unit_amount: 3900, current_period_end: iso(8) }),
  row('portfolio-up', {
    ...paying,
    tier: 'growth',
    billing_cycle: 'monthly',
    unit_amount: 3900,
    current_period_end: iso(5),
    pending_tier: 'portfolio',
    errors_7d: 2,
  }),
  row('legacy-yearly', { ...paying, tier: 'legacy', billing_cycle: 'yearly', unit_amount: 19200, current_period_end: iso(200) }),
  row('quiet', { ...paying, tier: 'starter', billing_cycle: 'monthly', unit_amount: 2000, last_data_at: iso(-40) }),
  row('failing', { ...paying, tier: 'starter', billing_cycle: 'monthly', unit_amount: 2000, sync_failing: true }),
  row('exempt', { ownerrez_connected: true, imported: true, exempt: true, last_data_at: iso(-1) }),
  row('lapsed', { ownerrez_connected: true, imported: true, subscription_status: 'canceled', tier: 'growth' }),
  row('past-due', { ownerrez_connected: true, imported: true, subscription_status: 'past_due', tier: 'growth' }),
]

describe('deriveRow', () => {
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]))

  it.each([
    ['new', 'signed_up'],
    ['prospect', 'connected'],
    ['importing', 'subscribed'],
    ['growth', 'imported'],
    ['exempt', 'imported'],
    ['lapsed', 'connected'],
  ])('puts %s at stage %s', (id, stage) => {
    expect(byId[id].stage).toBe(stage)
  })

  it.each([
    ['growth', 'growth'],
    ['legacy-yearly', 'legacy'],
    ['exempt', 'exempt'],
    ['lapsed', 'cancelled'],
    ['past-due', 'past_due'],
    ['prospect', 'none'],
  ])('labels %s with plan %s', (id, plan) => {
    expect(byId[id].plan).toBe(plan)
  })

  it('counts a twelfth of a yearly price toward MRR, and nothing for free or lapsed accounts', () => {
    expect(byId['legacy-yearly'].mrr).toBe(16)
    expect(byId.growth.mrr).toBe(39)
    expect(byId.exempt.mrr).toBe(0)
    expect(byId.lapsed.mrr).toBe(0)
  })

  it.each([
    ['new', 'not_connected'],
    ['prospect', 'not_imported'],
    ['growth', 'healthy'],
    ['quiet', 'quiet'],
    ['failing', 'failing'],
  ])('rates %s sync health as %s', (id, health) => {
    expect(byId[id].health).toBe(health)
  })

  it('flags renewals in the next 30 days and names the change they bring', () => {
    expect(byId.growth.renewsSoon).toBe(true)
    expect(byId['legacy-yearly'].renewsSoon).toBe(false)
    expect(byId['portfolio-up'].upcomingChange).toBe('Portfolio')
    expect(byId.growth.upcomingChange).toBeNull()
  })

  it('describes a billing cycle switch', () => {
    const switching = row('switch', {
      ...paying,
      tier: 'growth',
      billing_cycle: 'monthly',
      pending_tier: 'growth',
      preferred_billing_cycle: 'yearly',
    })
    expect(switching.upcomingChange).toBe('Growth, yearly')
  })
})

describe('every widget number matches the users it filters to', () => {
  const summary = summarize(rows)
  const widgets: Array<[string, number, AdminFilter]> = [
    ['paying customers', summary.paying, { kind: 'paying' }],
    ['prospects', summary.prospects, { kind: 'prospect' }],
    ['recent signups', summary.recentSignups, { kind: 'recent' }],
    ['renewing soon', summary.renewing, { kind: 'renewing' }],
    ['users with errors', summary.withErrors, { kind: 'errors' }],
    ...STAGES.map(({ id }) => [`funnel ${id}`, summary.funnel[id], { kind: 'stage', value: id }] as [string, number, AdminFilter]),
    ...PLANS.map(({ id }) => [`plan ${id}`, summary.plans[id], { kind: 'plan', value: id }] as [string, number, AdminFilter]),
    ...HEALTH.map(({ id }) => [`health ${id}`, summary.health[id], { kind: 'health', value: id }] as [string, number, AdminFilter]),
  ]

  it.each(widgets)('%s', (_name, count, filter) => {
    expect(count).toBe(rows.filter((r) => matches(r, filter)).length)
  })

  it('MRR is the sum over the paying customers the tile filters to', () => {
    const payingRows = applyFilters(rows, [{ kind: 'paying' }])
    expect(summary.mrr).toBe(Math.round(payingRows.reduce((s, r) => s + r.mrr, 0)))
  })

  it('plan mix and sync health each account for every user exactly once', () => {
    const total = rows.length
    expect(Object.values(summary.plans).reduce((a, b) => a + b, 0)).toBe(total)
    expect(Object.values(summary.health).reduce((a, b) => a + b, 0)).toBe(total)
  })

  it('the funnel only narrows', () => {
    const steps = STAGES.map(({ id }) => summary.funnel[id])
    expect(steps[0]).toBe(rows.length)
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeLessThanOrEqual(steps[i - 1])
  })
})

describe('applyFilters', () => {
  it('combines filters with AND', () => {
    expect(applyFilters(rows, [{ kind: 'paying' }, { kind: 'renewing' }]).map((r) => r.id)).toEqual(['growth', 'portfolio-up'])
  })
})

describe('signupsByDay', () => {
  it('buckets the last N days, including empty ones', () => {
    const days = signupsByDay(rows, 7, NOW)
    expect(days).toHaveLength(7)
    expect(days.reduce((s, d) => s + d.count, 0)).toBe(2)
  })
})
