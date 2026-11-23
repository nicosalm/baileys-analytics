// the Admin Dashboard's model. every widget count comes from summarize() and every filter from
// matches(), both over the same derived rows, so clicking a widget always shows exactly the users
// it counted. admin-overview.test.ts holds that invariant.

export interface AdminTenantRow {
  tenant_id: string
  email: string
  company_name: string | null
  created_at: string
  exempt: boolean
  ownerrez_connected: boolean
  first_subscription_at: string | null
  subscription_status: string | null
  tier: string | null
  billing_cycle: string | null
  unit_amount: number | null
  current_period_end: string | null
  cancel_at: string | null
  pending_tier: string | null
  pending_effective_at: string | null
  pending_notified_at: string | null
  preferred_billing_cycle: string | null
  property_count: number
  imported: boolean
  sync_failing: boolean
  last_data_at: string | null
  errors_7d: number
}

export interface AdminError {
  source: 'ownerrez' | 'stripe'
  tenantId: string | null
  at: string
  event: string
  message: string
}

export type Stage = 'signed_up' | 'connected' | 'subscribed' | 'imported'
export type Plan = 'starter' | 'growth' | 'portfolio' | 'legacy' | 'exempt' | 'past_due' | 'cancelled' | 'none'
export type Health = 'healthy' | 'quiet' | 'failing' | 'not_imported' | 'not_connected'

export const STAGES: ReadonlyArray<{ id: Stage; label: string }> = [
  { id: 'signed_up', label: 'Signed up' },
  { id: 'connected', label: 'Connected OwnerRez' },
  { id: 'subscribed', label: 'Subscribed' },
  { id: 'imported', label: 'Imported' },
]

export const PLANS: ReadonlyArray<{ id: Plan; label: string }> = [
  { id: 'starter', label: 'Starter' },
  { id: 'growth', label: 'Growth' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'legacy', label: 'Early supporter' },
  { id: 'exempt', label: 'Complimentary' },
  { id: 'past_due', label: 'Past due' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'none', label: 'No plan' },
]

export const HEALTH: ReadonlyArray<{ id: Health; label: string; hint: string }> = [
  { id: 'healthy', label: 'Healthy', hint: 'data changed in the last 14 days' },
  { id: 'quiet', label: 'Quiet', hint: 'no data change in 14 days' },
  { id: 'failing', label: 'Failing', hint: 'a sync step failed' },
  { id: 'not_imported', label: 'Not imported', hint: 'connected, history not imported yet' },
  { id: 'not_connected', label: 'Not connected', hint: 'OwnerRez not connected' },
]

const DAY = 24 * 60 * 60 * 1000
const QUIET_AFTER_DAYS = 14
const RENEWAL_WINDOW_DAYS = 30
const RECENT_SIGNUP_DAYS = 7
const PAID_TIERS = new Set(['starter', 'growth', 'portfolio', 'legacy'])
const STAGE_RANK: Record<Stage, number> = { signed_up: 0, connected: 1, subscribed: 2, imported: 3 }

export interface AdminUserRow extends AdminTenantRow {
  id: string
  stage: Stage
  // sort keys for the table, so stage and sync health order sensibly instead of alphabetically
  stageRank: number
  healthRank: number
  plan: Plan
  // monthly value in dollars; yearly plans count a twelfth
  mrr: number
  paying: boolean
  prospect: boolean
  recentSignup: boolean
  health: Health
  renewsSoon: boolean
  // what the next renewal changes, such as "Portfolio" or "Growth, yearly"; null when nothing
  upcomingChange: string | null
}

const label = <T extends string>(list: ReadonlyArray<{ id: T; label: string }>, id: T) => list.find((x) => x.id === id)?.label ?? id

export const deriveRow = (row: AdminTenantRow, now: number): AdminUserRow => {
  const status = row.subscription_status
  const hasPlan = row.exempt || status === 'active'
  const paying = !row.exempt && status === 'active'

  const stage: Stage = !row.ownerrez_connected ? 'signed_up' : !hasPlan ? 'connected' : !row.imported ? 'subscribed' : 'imported'

  let plan: Plan = 'none'
  if (row.exempt) plan = 'exempt'
  else if (status === 'active') plan = row.tier && PAID_TIERS.has(row.tier) ? (row.tier as Plan) : 'legacy'
  else if (status === 'past_due' || status === 'unpaid') plan = 'past_due'
  else if (status === 'canceled') plan = 'cancelled'

  const mrr = paying && row.unit_amount ? row.unit_amount / 100 / (row.billing_cycle === 'yearly' ? 12 : 1) : 0

  let health: Health
  if (!row.ownerrez_connected) health = 'not_connected'
  else if (!row.imported) health = 'not_imported'
  else if (row.sync_failing) health = 'failing'
  else if (!row.last_data_at || now - Date.parse(row.last_data_at) > QUIET_AFTER_DAYS * DAY) health = 'quiet'
  else health = 'healthy'

  const renewal = row.current_period_end ? Date.parse(row.current_period_end) : null
  const renewsSoon = paying && renewal != null && renewal >= now && renewal - now <= RENEWAL_WINDOW_DAYS * DAY

  let upcomingChange: string | null = null
  if (paying && row.pending_tier) {
    const tierChanges = row.pending_tier !== row.tier
    const cycle = row.preferred_billing_cycle && row.preferred_billing_cycle !== row.billing_cycle ? row.preferred_billing_cycle : null
    const tierName = label(PLANS, row.pending_tier as Plan)
    upcomingChange = tierChanges ? (cycle ? `${tierName}, ${cycle}` : tierName) : cycle ? `${tierName}, ${cycle}` : null
  }

  return {
    ...row,
    id: row.tenant_id,
    stage,
    stageRank: STAGE_RANK[stage],
    healthRank: HEALTH.findIndex((h) => h.id === health),
    plan,
    mrr,
    paying,
    prospect: stage === 'connected',
    recentSignup: now - Date.parse(row.created_at) <= RECENT_SIGNUP_DAYS * DAY,
    health,
    renewsSoon,
    upcomingChange,
  }
}

export type AdminFilter =
  | { kind: 'stage'; value: Stage }
  | { kind: 'plan'; value: Plan }
  | { kind: 'health'; value: Health }
  | { kind: 'paying' }
  | { kind: 'prospect' }
  | { kind: 'recent' }
  | { kind: 'renewing' }
  | { kind: 'errors' }

export const matches = (row: AdminUserRow, filter: AdminFilter): boolean => {
  switch (filter.kind) {
    // the funnel counts everyone who got at least this far
    case 'stage':
      return STAGE_RANK[row.stage] >= STAGE_RANK[filter.value]
    case 'plan':
      return row.plan === filter.value
    case 'health':
      return row.health === filter.value
    case 'paying':
      return row.paying
    case 'prospect':
      return row.prospect
    case 'recent':
      return row.recentSignup
    case 'renewing':
      return row.renewsSoon
    case 'errors':
      return row.errors_7d > 0
  }
}

export const applyFilters = (rows: AdminUserRow[], filters: AdminFilter[]) => rows.filter((row) => filters.every((f) => matches(row, f)))

export const filterKey = (f: AdminFilter) => ('value' in f ? `${f.kind}:${f.value}` : f.kind)

export const filterLabel = (f: AdminFilter): string => {
  switch (f.kind) {
    case 'stage':
      return `Reached: ${label(STAGES, f.value)}`
    case 'plan':
      return `Plan: ${label(PLANS, f.value)}`
    case 'health':
      return `Sync: ${label(HEALTH, f.value)}`
    case 'paying':
      return 'Paying customers'
    case 'prospect':
      return 'Prospects'
    case 'recent':
      return 'Signed up in the last 7 days'
    case 'renewing':
      return 'Renewing in 30 days'
    case 'errors':
      return 'Errors in the last 7 days'
  }
}

export interface AdminSummary {
  paying: number
  mrr: number
  prospects: number
  recentSignups: number
  funnel: Record<Stage, number>
  plans: Record<Plan, number>
  health: Record<Health, number>
  renewing: number
  withErrors: number
  errors7d: number
}

const countWhere = (rows: AdminUserRow[], filter: AdminFilter) => rows.filter((r) => matches(r, filter)).length

export const summarize = (rows: AdminUserRow[]): AdminSummary => ({
  paying: countWhere(rows, { kind: 'paying' }),
  mrr: Math.round(rows.filter((r) => r.paying).reduce((sum, r) => sum + r.mrr, 0)),
  prospects: countWhere(rows, { kind: 'prospect' }),
  recentSignups: countWhere(rows, { kind: 'recent' }),
  funnel: Object.fromEntries(STAGES.map(({ id }) => [id, countWhere(rows, { kind: 'stage', value: id })])) as Record<Stage, number>,
  plans: Object.fromEntries(PLANS.map(({ id }) => [id, countWhere(rows, { kind: 'plan', value: id })])) as Record<Plan, number>,
  health: Object.fromEntries(HEALTH.map(({ id }) => [id, countWhere(rows, { kind: 'health', value: id })])) as Record<Health, number>,
  renewing: countWhere(rows, { kind: 'renewing' }),
  withErrors: countWhere(rows, { kind: 'errors' }),
  errors7d: rows.reduce((sum, r) => sum + r.errors_7d, 0),
})

// daily signups for the trend chart, oldest first
export const signupsByDay = (rows: AdminUserRow[], days: number, now: number): Array<{ date: string; count: number }> => {
  const counts = new Map<string, number>()
  for (let i = days - 1; i >= 0; i--) counts.set(new Date(now - i * DAY).toISOString().slice(0, 10), 0)
  for (const row of rows) {
    const day = row.created_at.slice(0, 10)
    if (counts.has(day)) counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  return [...counts].map(([date, count]) => ({ date, count }))
}
