import type { ReactNode } from 'react'
import { formatCurrency, formatDateDisplay } from '@baileys/utils'
import { cn } from '@/lib/utils'
import {
  HEALTH,
  PLANS,
  STAGES,
  type AdminError,
  type AdminFilter,
  type AdminSummary,
  type AdminUserRow,
  type Health,
} from '@/lib/admin-overview'

// every number on these widgets is a button that filters the user table to exactly the users it counts
export interface FilterProps {
  isActive: (filter: AdminFilter) => boolean
  onToggle: (filter: AdminFilter) => void
}

const card = 'bg-card rounded-lg border border-border shadow-sm p-5'

const WidgetTitle = ({ title, caption, action }: { title: string; caption?: string; action?: ReactNode }) => (
  <div className="mb-3 flex items-baseline justify-between gap-3">
    <div className="min-w-0">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
    </div>
    {action}
  </div>
)

// a row that filters the table; pressed while its filter is on
const FilterRow = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={cn(
      '-mx-2 block w-[calc(100%+1rem)] cursor-pointer rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/60',
      active && 'bg-primary/10 ring-1 ring-primary/25 hover:bg-primary/10',
    )}
  >
    {children}
  </button>
)

const Bar = ({ value, total, className }: { value: number; total: number; className?: string }) => (
  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
    <div className={cn('h-full rounded-full bg-primary', className)} style={{ width: `${total ? (value / total) * 100 : 0}%` }} />
  </div>
)

const Count = ({ value, of }: { value: number; of?: number }) => (
  <span className="text-sm font-semibold tabular-nums text-foreground">
    {value}
    {of != null && of > 0 && <span className="ml-1 text-xs font-normal text-muted-foreground">({Math.round((value / of) * 100)}%)</span>}
  </span>
)

export const KpiTiles = ({ summary, isActive, onToggle }: { summary: AdminSummary } & FilterProps) => {
  const tiles: Array<{ label: string; value: string; caption: string; filter: AdminFilter }> = [
    { label: 'Paying customers', value: String(summary.paying), caption: 'active, not complimentary', filter: { kind: 'paying' } },
    { label: 'MRR', value: formatCurrency(summary.mrr), caption: 'yearly plans count a twelfth', filter: { kind: 'paying' } },
    { label: 'Prospects', value: String(summary.prospects), caption: 'connected, not subscribed', filter: { kind: 'prospect' } },
    { label: 'Signups', value: String(summary.recentSignups), caption: 'last 7 days', filter: { kind: 'recent' } },
  ]
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {tiles.map((tile) => {
        const active = isActive(tile.filter)
        return (
          <button
            key={tile.label}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(tile.filter)}
            className={cn(
              'cursor-pointer rounded-lg border border-border bg-card px-4 py-3 text-left shadow-sm transition-colors hover:bg-muted/40',
              active && 'border-primary/40 ring-1 ring-primary/25',
            )}
          >
            <p className="text-xs text-muted-foreground">{tile.label}</p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{tile.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{tile.caption}</p>
          </button>
        )
      })}
    </div>
  )
}

export const FunnelWidget = ({ summary, isActive, onToggle }: { summary: AdminSummary } & FilterProps) => {
  const total = summary.funnel.signed_up
  return (
    <section className={card}>
      <WidgetTitle title="Funnel" caption="users who reached each step" />
      <div className="space-y-1">
        {STAGES.map(({ id, label }) => {
          const filter: AdminFilter = { kind: 'stage', value: id }
          return (
            <FilterRow key={id} active={isActive(filter)} onClick={() => onToggle(filter)}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-muted-foreground">{label}</span>
                <Count value={summary.funnel[id]} of={id === 'signed_up' ? undefined : total} />
              </div>
              <Bar value={summary.funnel[id]} total={total} />
            </FilterRow>
          )
        })}
      </div>
    </section>
  )
}

export const PlanWidget = ({ summary, total, isActive, onToggle }: { summary: AdminSummary; total: number } & FilterProps) => (
  <section className={card}>
    <WidgetTitle title="Plans" caption="every user, by current plan" />
    <div className="space-y-1">
      {PLANS.filter(({ id }) => summary.plans[id] > 0).map(({ id, label }) => {
        const filter: AdminFilter = { kind: 'plan', value: id }
        return (
          <FilterRow key={id} active={isActive(filter)} onClick={() => onToggle(filter)}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-muted-foreground">{label}</span>
              <Count value={summary.plans[id]} />
            </div>
            <Bar value={summary.plans[id]} total={total} />
          </FilterRow>
        )
      })}
    </div>
  </section>
)

export const HEALTH_DOT: Record<Health, string> = {
  healthy: 'bg-success',
  quiet: 'bg-warning',
  failing: 'bg-danger',
  not_imported: 'bg-info',
  not_connected: 'bg-muted-foreground/40',
}

export const HealthWidget = ({ summary, isActive, onToggle }: { summary: AdminSummary } & FilterProps) => (
  <section className={card}>
    <WidgetTitle title="Sync health" caption="from each user's latest OwnerRez data" />
    <div className="space-y-1">
      {HEALTH.filter(({ id }) => summary.health[id] > 0).map(({ id, label, hint }) => {
        const filter: AdminFilter = { kind: 'health', value: id }
        return (
          <FilterRow key={id} active={isActive(filter)} onClick={() => onToggle(filter)}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span className={cn('size-2 shrink-0 rounded-full', HEALTH_DOT[id])} aria-hidden />
                <span className="text-xs text-foreground">{label}</span>
                <span className="truncate text-xs text-muted-foreground">{hint}</span>
              </span>
              <Count value={summary.health[id]} />
            </div>
          </FilterRow>
        )
      })}
    </div>
  </section>
)

export const RenewalsWidget = ({
  rows,
  summary,
  isActive,
  onToggle,
  onSelect,
}: { rows: AdminUserRow[]; summary: AdminSummary; onSelect: (id: string) => void } & FilterProps) => {
  const renewing = rows.filter((r) => r.renewsSoon).sort((a, b) => (a.current_period_end ?? '').localeCompare(b.current_period_end ?? ''))
  const filter: AdminFilter = { kind: 'renewing' }
  return (
    <section className={card}>
      <WidgetTitle
        title="Renewals"
        caption="paying customers renewing in the next 30 days"
        action={
          <FilterChip active={isActive(filter)} onClick={() => onToggle(filter)}>
            {summary.renewing} renewing
          </FilterChip>
        }
      />
      {renewing.length === 0 ? (
        <p className="text-sm text-muted-foreground">No renewals in the next 30 days.</p>
      ) : (
        <ul className="divide-y divide-border">
          {renewing.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onSelect(r.id)}
                className="-mx-2 flex w-[calc(100%+1rem)] cursor-pointer items-baseline justify-between gap-3 rounded-md px-2 py-2 text-left hover:bg-muted/60"
              >
                <span className="min-w-0 truncate text-sm text-foreground">{r.company_name || r.email}</span>
                <span className="shrink-0 text-right text-xs text-muted-foreground">
                  {r.current_period_end && formatDateDisplay(r.current_period_end)}
                  {r.upcomingChange ? (
                    <span className="ml-2 font-medium text-foreground">
                      to {r.upcomingChange}
                      {!r.pending_notified_at && <span className="ml-1 font-normal text-muted-foreground">(not emailed)</span>}
                    </span>
                  ) : (
                    <span className="ml-2">no change</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export const ErrorsWidget = ({
  errors,
  summary,
  emailById,
  now,
  isActive,
  onToggle,
  onSelect,
}: {
  errors: AdminError[]
  summary: AdminSummary
  emailById: Map<string, string>
  now: number
  onSelect: (id: string) => void
} & FilterProps) => {
  const filter: AdminFilter = { kind: 'errors' }
  const recent = errors.slice(0, 8)
  return (
    <section className={card}>
      <WidgetTitle
        title="Errors"
        caption={`${summary.errors7d} failed webhook events in the last 7 days`}
        action={
          <FilterChip active={isActive(filter)} onClick={() => onToggle(filter)}>
            {summary.withErrors} {summary.withErrors === 1 ? 'user' : 'users'}
          </FilterChip>
        }
      />
      {recent.length === 0 ? (
        <p className="text-sm text-muted-foreground">No failed webhook events.</p>
      ) : (
        <ul className="divide-y divide-border">
          {recent.map((e) => {
            const who = e.tenantId ? (emailById.get(e.tenantId) ?? 'deleted user') : 'no user'
            const content = (
              <>
                <span className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
                  <span className="truncate">
                    {e.source === 'stripe' ? 'Stripe' : 'OwnerRez'} · {e.event || 'event'} · {who}
                  </span>
                  <span className="shrink-0 tabular-nums" title={new Date(e.at).toLocaleString()}>
                    {timeAgo(e.at, now)}
                  </span>
                </span>
                <span className="mt-0.5 block truncate font-mono text-xs text-danger-fg">{e.message}</span>
              </>
            )
            return (
              <li key={`${e.source}-${e.at}-${e.message}`}>
                {e.tenantId && emailById.has(e.tenantId) ? (
                  <button
                    type="button"
                    onClick={() => onSelect(e.tenantId as string)}
                    className="-mx-2 block w-[calc(100%+1rem)] cursor-pointer rounded-md px-2 py-2 text-left hover:bg-muted/60"
                  >
                    {content}
                  </button>
                ) : (
                  <div className="py-2">{content}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export const SignupsWidget = ({ days }: { days: Array<{ date: string; count: number }> }) => {
  const max = Math.max(1, ...days.map((d) => d.count))
  const total = days.reduce((s, d) => s + d.count, 0)
  return (
    <section className={card}>
      <WidgetTitle title="Signups" caption={`${total} in the last ${days.length} days`} />
      <div className="flex h-24 items-end gap-[3px]" role="img" aria-label={`Daily signups over the last ${days.length} days`}>
        {days.map((d) => (
          <div
            key={d.date}
            title={`${formatDateDisplay(d.date)}: ${d.count}`}
            className={cn('flex-1 rounded-sm', d.count ? 'bg-primary' : 'bg-muted')}
            style={{ height: d.count ? `${Math.max(8, (d.count / max) * 100)}%` : '4px' }}
          />
        ))}
      </div>
    </section>
  )
}

export const FilterChip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={cn(
      'shrink-0 cursor-pointer rounded-md border px-2 py-0.5 text-xs font-medium tabular-nums transition-colors',
      active ? 'border-primary/40 bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground',
    )}
  >
    {children}
  </button>
)

export const timeAgo = (iso: string, now: number): string => {
  const minutes = Math.round((now - Date.parse(iso)) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return days < 45 ? `${days}d ago` : formatDateDisplay(iso)
}
