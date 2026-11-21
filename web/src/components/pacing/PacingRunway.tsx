import { useMemo, useState } from 'react'
import { Activity, ChevronDown } from 'lucide-react'
import { formatCurrency, formatPercentage } from '@baileys/utils'
import type { PacingBucket, PacingMonthSummary } from '@/hooks/use-api'
import { usePacing } from '@/hooks/use-api'
import { usePropertyIds, useTagIds } from '@/hooks/use-dashboard-utils'
import { StateWrapper } from '@/components/StateWrapper'
import { cn } from '@/lib/utils'
import { PaceCurveChart } from './PaceCurveChart'
import { PaceDelta, pctChange } from './PaceDelta'
import { PropertyPacingTable } from './PropertyPacingTable'
import { hasPriorYear, sumBuckets } from './summary'

const pct = (n: number) => formatPercentage(n, 1)

function SummaryStat({ label, value, delta }: { label: string; value: string; delta: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
      {delta}
    </div>
  )
}

function MonthColumn({ month, selected, onSelect }: { month: PacingMonthSummary; selected: boolean; onSelect: () => void }) {
  const occupancy = month.current.occupancy * 100
  const finalLastYear = month.priorFinal.occupancy * 100
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      title={`Last year finished at ${pct(finalLastYear)}`}
      className={cn(
        'min-w-[92px] rounded-lg border p-3 text-left transition-colors cursor-pointer',
        selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40',
      )}
    >
      <span className="block text-xs text-muted-foreground">{month.label}</span>
      <span className="block mt-1 text-lg font-semibold tabular-nums">{pct(occupancy)}</span>
      <span className="relative block mt-2 h-1 rounded-full bg-muted" aria-hidden>
        <span className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${Math.min(occupancy, 100)}%` }} />
        {finalLastYear > 0 && (
          <span
            className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-foreground/50"
            style={{ left: `${Math.min(finalLastYear, 100)}%` }}
          />
        )}
      </span>
      <PaceDelta value={month.paceDelta} className="mt-2" />
    </button>
  )
}

function MonthComparison({ month }: { month: PacingMonthSummary }) {
  const rows: { label: string; pick: (b: PacingBucket) => number; format: (n: number) => string; delta: 'pts' | '%' }[] = [
    { label: 'Occupancy', pick: (b) => b.occupancy * 100, format: pct, delta: 'pts' },
    { label: 'Revenue', pick: (b) => b.revenue, format: formatCurrency, delta: '%' },
    { label: 'ADR', pick: (b) => b.adr, format: (n) => (n > 0 ? formatCurrency(n) : '—'), delta: '%' },
  ]

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-xs text-muted-foreground">
          <th className="py-2 text-left font-medium">{month.label}</th>
          <th className="py-2 px-2 text-right font-medium">Now</th>
          <th className="py-2 px-2 text-right font-medium">Last yr now</th>
          <th className="py-2 pl-2 text-right font-medium">Last yr final</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ label, pick, format, delta }) => {
          const now = pick(month.current)
          const then = pick(month.priorAtThisPoint)
          return (
            <tr key={label} className="border-b border-border/50 last:border-0">
              <td className="py-2.5 text-muted-foreground">{label}</td>
              <td className="py-2.5 px-2 text-right">
                <span className="block font-medium tabular-nums">{format(now)}</span>
                <PaceDelta value={delta === 'pts' ? now - then : pctChange(now, then)} unit={delta} />
              </td>
              <td className="py-2.5 px-2 text-right tabular-nums text-muted-foreground align-top">{format(then)}</td>
              <td className="py-2.5 pl-2 text-right tabular-nums text-muted-foreground align-top">{format(pick(month.priorFinal))}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export const PacingRunway = () => {
  const tagIds = useTagIds()
  const propertyIds = usePropertyIds()
  const { data, error, isLoading } = usePacing(tagIds, propertyIds)
  const [expanded, setExpanded] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)

  const months = data?.months ?? []

  // opens on the month that is furthest behind last year
  const selected = useMemo(() => {
    if (!months.length) return null
    return months.find((m) => m.month === selectedMonth) ?? months.reduce((a, b) => (a.paceDelta < b.paceDelta ? a : b))
  }, [months, selectedMonth])

  const summary = useMemo(() => {
    if (!months.length) return null
    const now = sumBuckets(months, 'current')
    const then = sumBuckets(months, 'priorAtThisPoint')
    return { now, then }
  }, [months])

  const detail = selected ? data?.details?.[selected.month] : undefined
  const ready = !isLoading && !error && months.length > 0 && hasPriorYear(months)
  // nothing on the books this year or last year at this point, so there is nothing to compare
  const empty = ready && summary !== null && summary.now.occupancy === 0 && summary.then.occupancy === 0
  const open = expanded && !empty

  return (
    <section className="bg-card rounded-lg shadow-sm border border-border">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={open}
        disabled={empty}
        className="w-full flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 text-left cursor-pointer disabled:cursor-default"
      >
        <span className="flex items-center gap-2 mr-auto">
          <Activity className="w-4 h-4 text-muted-foreground" aria-hidden />
          <span className="font-semibold">Booking pace</span>
          {data?.window && <span className="text-sm text-muted-foreground">{data.window.label} vs. last year</span>}
        </span>
        {empty && <span className="text-sm text-muted-foreground">No bookings yet</span>}
        {ready && summary && !empty && (
          <span className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
            <SummaryStat
              label="Occupancy"
              value={pct(summary.now.occupancy)}
              delta={<PaceDelta value={summary.now.occupancy - summary.then.occupancy} />}
            />
            <SummaryStat
              label="Revenue"
              value={formatCurrency(summary.now.revenue)}
              delta={<PaceDelta value={pctChange(summary.now.revenue, summary.then.revenue)} unit="%" />}
            />
            <SummaryStat
              label="ADR"
              value={summary.now.adr > 0 ? formatCurrency(summary.now.adr) : '—'}
              delta={<PaceDelta value={pctChange(summary.now.adr, summary.then.adr)} unit="%" />}
            />
          </span>
        )}
        {!empty && (
          <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', !expanded && '-rotate-90')} aria-hidden />
        )}
      </button>

      {open && (
        <div className="border-t border-border px-5 pb-5">
          {!ready ? (
            <StateWrapper
              loading={isLoading}
              error={error}
              empty={!isLoading && !error}
              loadingMessage="Loading pacing"
              emptyMessage={months.length ? 'Not enough booking history yet' : 'No upcoming months to pace'}
              emptySubMessage={
                months.length ? 'Pacing compares against the same point last year, so it needs a year of bookings.' : undefined
              }
              minHeight={100}
              className="py-8"
            >
              <div />
            </StateWrapper>
          ) : (
            <>
              <div className="flex gap-2 overflow-x-auto py-4">
                {months.map((m) => (
                  <MonthColumn key={m.month} month={m} selected={m.month === selected?.month} onSelect={() => setSelectedMonth(m.month)} />
                ))}
              </div>

              {selected && detail && (
                <div className="space-y-6">
                  {detail.curve.length > 2 ? (
                    <div className="grid gap-6 lg:grid-cols-5">
                      <div className="lg:col-span-3 h-72">
                        <PaceCurveChart month={selected} curve={detail.curve} todayDaysOut={detail.todayDaysOut} />
                      </div>
                      <div className="lg:col-span-2">
                        <MonthComparison month={selected} />
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-xl">
                      <MonthComparison month={selected} />
                    </div>
                  )}

                  {detail.byProperty.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-1">{selected.label} by property</h4>
                      <PropertyPacingTable key={selected.month} properties={detail.byProperty} />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}
