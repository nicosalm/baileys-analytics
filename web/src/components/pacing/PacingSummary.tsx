import { ChevronRight } from 'lucide-react'
import { formatCurrency, formatPercentage } from '@baileys/utils'
import { usePacing } from '@/hooks/use-api'
import { PaceDelta, pctChange } from './PaceDelta'
import { hasPriorYear, sumBuckets } from './summary'

const BAR_HEIGHT = 32

export function PacingSummary({ tagIds, propertyIds, onOpen }: { tagIds?: string[]; propertyIds?: string[]; onOpen: () => void }) {
  const { data } = usePacing(tagIds, propertyIds)
  const months = data?.months ?? []
  if (!months.length || !hasPriorYear(months)) return null

  const now = sumBuckets(months, 'current')
  const then = sumBuckets(months, 'priorAtThisPoint')

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full flex flex-wrap items-center gap-x-8 gap-y-4 bg-card px-5 py-4 rounded-lg border border-border shadow-sm text-left transition-[background-color,box-shadow] duration-200 hover:shadow-md hover:bg-muted/30 cursor-pointer"
    >
      <span className="flex flex-col gap-2 mr-auto">
        <span className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">Booking pace</span>
          <span className="text-xs text-muted-foreground">{data?.window.label} vs. last year</span>
        </span>
        <span className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <span className="flex items-baseline gap-1.5">
            <span className="text-xs text-muted-foreground">Occupancy</span>
            <span className="text-sm font-semibold tabular-nums">{formatPercentage(now.occupancy, 1)}</span>
            <PaceDelta value={now.occupancy - then.occupancy} />
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="text-xs text-muted-foreground">Revenue</span>
            <span className="text-sm font-semibold tabular-nums">{formatCurrency(now.revenue)}</span>
            <PaceDelta value={pctChange(now.revenue, then.revenue)} unit="%" />
          </span>
        </span>
      </span>

      <span className="flex items-end gap-2" aria-hidden>
        {months.map((m) => {
          const current = Math.min(m.current.occupancy, 1)
          const prior = Math.min(m.priorAtThisPoint.occupancy, 1)
          return (
            <span
              key={m.month}
              className="flex flex-col items-center gap-1"
              title={`${m.label}: ${formatPercentage(m.current.occupancy * 100, 1)} booked, ${formatPercentage(m.priorAtThisPoint.occupancy * 100, 1)} last year at this point`}
            >
              <span className="relative w-3 rounded-sm bg-muted" style={{ height: BAR_HEIGHT }}>
                <span className="absolute inset-x-0 bottom-0 rounded-sm bg-primary" style={{ height: current * BAR_HEIGHT }} />
                {prior > 0 && (
                  <span className="absolute -inset-x-1 h-0.5 rounded-full bg-foreground/60" style={{ bottom: prior * BAR_HEIGHT }} />
                )}
              </span>
              <span className="text-[10px] leading-none text-muted-foreground">{m.label.slice(0, 3)}</span>
            </span>
          )
        })}
      </span>

      <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
    </button>
  )
}
