import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend } from 'recharts'
import { TrendingUp, TrendingDown, Minus, Activity, Home, ChevronRight, ChevronDown, AlertCircle } from 'lucide-react'
import { formatPercentage, formatCurrency, cn } from '@baileys/utils'
import { usePacing } from '@/hooks/use-api'
import type { PacingMonthSummary, PacingProperty, PacingCurvePoint } from '@/hooks/use-api'
import { useTagIds, usePropertyIds } from '@/hooks/use-dashboard-utils'
import { useModal } from '@/contexts/modal'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/Pagination'
import { ChartWrapper } from '@/components/ChartWrapper'
import { StateWrapper } from '@/components/StateWrapper'
import { METRIC_COLORS, CHART_INFRA } from '@/lib/theme'
import type { TooltipContentProps } from 'recharts'

// --- month card ---

function PaceIndicator({ delta }: { delta: number }) {
  if (Math.abs(delta) < 0.5) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground">
        <Minus className="w-3 h-3" /> even
      </span>
    )
  }

  const ahead = delta > 0
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-xs font-semibold',
      ahead ? 'text-success' : 'text-danger'
    )}>
      {ahead
        ? <TrendingUp className="w-3 h-3" />
        : <TrendingDown className="w-3 h-3" />
      }
      {Math.abs(delta).toFixed(1)} pts {ahead ? 'ahead' : 'behind'}
    </span>
  )
}

function MonthCard({
  month,
  isSelected,
  onClick,
}: {
  month: PacingMonthSummary
  isSelected: boolean
  onClick: () => void
}) {
  const occupancyPct = month.current.occupancy * 100
  const priorPct = month.priorFinal.occupancy * 100
  const curAdr = month.current.bookedNights > 0
    ? month.current.revenue / month.current.bookedNights : 0
  const priorAdr = month.priorAtThisPoint.bookedNights > 0
    ? month.priorAtThisPoint.revenue / month.priorAtThisPoint.bookedNights : 0

  // absolute gap vs last year at this point (only meaningful when behind)
  const nightsGap = month.priorAtThisPoint.bookedNights - month.current.bookedNights
  const revenueGap = month.priorAtThisPoint.revenue - month.current.revenue
  const isBehind = month.paceDelta < -0.5 && (nightsGap > 0 || revenueGap > 0)

  // color coding by pace delta
  const borderColor = month.paceDelta > 2
    ? 'border-success/50'
    : month.paceDelta < -5
      ? 'border-danger/50'
      : month.paceDelta < -1
        ? 'border-warning/50'
        : 'border-border'

  return (
    <button
      onClick={onClick}
      aria-pressed={isSelected}
      className={cn(
        'rounded-lg border-2 p-4 text-left transition-all duration-200',
        'cursor-pointer min-w-[160px] flex-shrink-0',
        borderColor,
        isSelected
          ? 'bg-primary/5 ring-2 ring-primary shadow-md'
          : 'bg-card hover:shadow-md hover:bg-muted/30',
      )}
    >
      <div className="text-xs font-medium text-muted-foreground mb-2">{month.label}</div>

      <div className="text-2xl font-bold mb-1">{formatPercentage(occupancyPct, 0)}</div>
      <div className="text-xs text-muted-foreground mb-3">
        {month.current.bookedNights}/{month.totalAvailableNights} nights
      </div>

      <PaceIndicator delta={month.paceDelta} />

      {isBehind && (
        <div className="text-[11px] text-danger font-medium mt-1">
          {nightsGap > 0 && `${nightsGap} nts`}
          {nightsGap > 0 && revenueGap > 0 && ' · '}
          {revenueGap > 0 && formatCurrency(revenueGap)}
          {' to catch up'}
        </div>
      )}

      <div className="text-xs text-muted-foreground mt-1">
        Last yr at this point: {formatPercentage(month.priorAtThisPoint.occupancy * 100, 0)}
      </div>

      {curAdr > 0 && (
        <div className="text-xs text-muted-foreground mt-1">
          ADR: {formatCurrency(curAdr)}{priorAdr > 0 && ` vs ${formatCurrency(priorAdr)}`}
        </div>
      )}

      {/* mini progress bar: current occupancy vs prior year final */}
      <div className="mt-3 relative">
        <div className="w-full bg-muted rounded-full h-1.5">
          <div
            className={cn(
              'h-1.5 rounded-full transition-all',
              occupancyPct >= 70 ? 'bg-success' : occupancyPct >= 50 ? 'bg-warning' : 'bg-danger'
            )}
            style={{ width: `${Math.min(occupancyPct, 100)}%` }}
          />
        </div>
        {/* prior year final marker */}
        {priorPct > 0 && (
          <div
            className="absolute top-0 w-0.5 h-1.5 bg-muted-foreground/50 rounded-full"
            style={{ left: `${Math.min(priorPct, 100)}%` }}
            title={`Last year final: ${formatPercentage(priorPct, 0)}`}
          />
        )}
      </div>
    </button>
  )
}

// --- booking curve tooltip ---

type CurveMode = 'nights' | 'revenue' | 'adr'

function formatCurveValue(value: number | null | undefined, mode: CurveMode): string {
  if (value == null) return '—'
  if (mode === 'nights') return `${value} nights`
  return formatCurrency(value)
}

// turn a signed daysOut offset into a readable label (never produces duplicates since
// it preserves the raw day count — used as XAxis tickFormatter so each data point keeps
// its own X position)
function formatDaysOut(daysOut: number): string {
  if (daysOut === 0) return 'Start'
  const absDays = Math.abs(daysOut)
  const sign = daysOut < 0 ? '-' : '+'
  if (absDays < 30) return `${sign}${absDays}d`
  if (absDays < 365) {
    const weeks = Math.round(absDays / 7)
    return `${sign}${weeks}w`
  }
  return `${sign}${(absDays / 365).toFixed(1)}y`
}

function formatCalendarDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function CurveTooltip({
  active, payload, label, mode, monthStart,
}: Partial<TooltipContentProps<number, string>> & { mode?: CurveMode; monthStart?: Date }) {
  if (!active || !payload?.length) return null

  const curveMode = mode ?? 'nights'
  const thisYear = payload.find(p => p.name === 'This year')?.value as number | null | undefined
  const lastYear = payload.find(p => p.name === 'Last year')?.value as number | null | undefined

  // label is the formatted daysOut from labelFormatter; find the raw value from payload
  const rawDaysOut = payload[0]?.payload?.daysOut as number | undefined

  // compute the calendar date each series corresponds to (prior line is one year back)
  let thisYearDate: string | null = null
  let lastYearDate: string | null = null
  if (monthStart && rawDaysOut != null) {
    const MS = 24 * 60 * 60 * 1000
    const cur = new Date(monthStart.getTime() + rawDaysOut * MS)
    const prior = new Date(cur.getFullYear() - 1, cur.getMonth(), cur.getDate())
    thisYearDate = formatCalendarDate(cur)
    lastYearDate = formatCalendarDate(prior)
  }

  // delta summary — mirrors the "Total" row on RevenueChartTooltip
  let deltaText: string | null = null
  let deltaPositive = false
  if (thisYear != null && lastYear != null) {
    const diff = thisYear - lastYear
    deltaPositive = diff >= 0
    const sign = diff > 0 ? '+' : ''
    if (curveMode === 'nights') {
      deltaText = `${sign}${Math.round(diff)} nts`
    } else {
      deltaText = `${sign}${formatCurrency(diff)}`
    }
    if (lastYear !== 0) {
      const pct = (diff / lastYear) * 100
      deltaText += ` (${sign}${pct.toFixed(1)}%)`
    }
  }

  return (
    <div className="bg-card p-3 rounded-lg shadow-lg border border-border">
      <div className="mb-2">
        {thisYearDate ? (
          <>
            <p className="font-semibold text-sm">{thisYearDate}</p>
            <p className="text-[11px] text-muted-foreground">{label} from month start</p>
          </>
        ) : (
          <p className="font-semibold text-sm">{label}</p>
        )}
      </div>
      <div className="space-y-1 text-xs">
        {payload.map(entry => {
          const isLast = entry.name === 'Last year'
          return (
            <div key={entry.name} className="flex justify-between gap-4">
              <div className="flex items-center gap-1">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-muted-foreground">
                  {entry.name}
                  {isLast && lastYearDate && (
                    <span className="text-muted-foreground/70"> · {lastYearDate}</span>
                  )}
                  :
                </span>
              </div>
              <span className="font-medium">
                {formatCurveValue(entry.value as number | null | undefined, curveMode)}
              </span>
            </div>
          )
        })}
        {deltaText && (
          <div className="pt-1 mt-1 border-t border-border">
            <div className="flex justify-between gap-4 font-semibold">
              <span>Delta:</span>
              <span className={deltaPositive ? 'text-success' : 'text-danger'}>{deltaText}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// --- detail panel ---

const PROPERTIES_PER_PAGE = 15

function PacingDetail({
  month,
  byProperty,
  curve,
  todayDaysOut,
}: {
  month: PacingMonthSummary
  byProperty: PacingProperty[]
  curve: PacingCurvePoint[]
  todayDaysOut: number
}) {
  const { openModal } = useModal()
  const [propertyPage, setPropertyPage] = useState(1)
  const [curveMode, setCurveMode] = useState<CurveMode>('nights')
  const totalPages = Math.ceil(byProperty.length / PROPERTIES_PER_PAGE)
  const pagedProperties = byProperty.slice(
    (propertyPage - 1) * PROPERTIES_PER_PAGE,
    propertyPage * PROPERTIES_PER_PAGE
  )

  // target month start as a local Date, used by the tooltip to resolve daysOut → calendar date
  const targetMonthStart = useMemo(() => {
    const [y, m] = month.month.split('-').map(Number)
    return new Date(y, m - 1, 1)
  }, [month.month])

  const chartData = useMemo(() => curve.map(pt => {
    // ADR is null until nights > 0 so recharts skips those points
    let thisYear: number | null
    let lastYear: number | null
    if (curveMode === 'nights') {
      thisYear = pt.currentNights
      lastYear = pt.priorNights
    } else if (curveMode === 'revenue') {
      thisYear = pt.currentRevenue
      lastYear = pt.priorRevenue
    } else {
      thisYear = pt.currentNights > 0 ? pt.currentRevenue / pt.currentNights : null
      lastYear = pt.priorNights > 0 ? pt.priorRevenue / pt.priorNights : null
    }

    return {
      daysOut: pt.daysOut,
      'This year': thisYear,
      'Last year': lastYear,
    }
  }), [curve, curveMode])

  const maxValue = useMemo(() => {
    let max = 0
    for (const pt of chartData) {
      const cur = pt['This year']
      const prev = pt['Last year']
      if (cur != null && cur > max) max = cur
      if (prev != null && prev > max) max = prev
    }
    return max
  }, [chartData])

  return (
    <div className="space-y-6">
      {/* booking curve chart */}
      {curve.length > 2 && (
        <ChartWrapper
          title={`Booking Pace: ${month.label}`}
          subtitle={curveMode === 'nights'
            ? 'How bookings accumulated over time vs last year'
            : curveMode === 'revenue'
              ? 'How revenue accumulated over time vs last year'
              : 'How the average rate evolved as bookings came in vs last year'
          }
          icon={Activity}
          height={320}
          noData={chartData.length === 0}
          noDataMessage="Not enough booking data to show a pace curve"
          actions={
            <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
              {(['nights', 'revenue', 'adr'] as const).map(mode => (
                <Button
                  key={mode}
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurveMode(mode)}
                  className={curveMode === mode
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                  }
                >
                  {mode === 'adr' ? 'ADR' : mode === 'nights' ? 'Nights' : 'Revenue'}
                </Button>
              ))}
            </div>
          }
        >
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_INFRA.grid} />
            <XAxis
              type="number"
              dataKey="daysOut"
              domain={['dataMin', 'dataMax']}
              stroke={CHART_INFRA.axis}
              tick={{ fill: CHART_INFRA.axis, fontSize: 11 }}
              tickFormatter={formatDaysOut}
            />
            <YAxis
              stroke={CHART_INFRA.axis}
              tick={{ fill: CHART_INFRA.axis }}
              domain={[0, Math.ceil(maxValue * 1.1) || 10]}
              tickFormatter={curveMode === 'nights'
                ? undefined
                : (v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : Math.round(v)}`
              }
              label={{
                value: curveMode === 'nights' ? 'Booked nights' : curveMode === 'revenue' ? 'Revenue' : 'ADR',
                angle: -90,
                position: 'insideLeft',
                fill: CHART_INFRA.axis,
                fontSize: 12,
                offset: 0,
              }}
            />
            <Tooltip
              content={<CurveTooltip mode={curveMode} monthStart={targetMonthStart} />}
              labelFormatter={(label) => formatDaysOut(Number(label))}
              isAnimationActive={false}
            />
            <Legend />
            <ReferenceLine
              x={todayDaysOut}
              stroke={CHART_INFRA.reference}
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: 'Today',
                position: 'insideTopRight',
                fill: CHART_INFRA.reference,
                fontSize: 11,
                fontWeight: 600,
              }}
            />
            <Line
              type="monotone"
              dataKey="This year"
              stroke={METRIC_COLORS.occupancy}
              strokeWidth={3}
              dot={{ fill: METRIC_COLORS.occupancy, r: 2.5, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: METRIC_COLORS.occupancy }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="Last year"
              stroke={CHART_INFRA.comparison}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: CHART_INFRA.comparison, r: 2, strokeWidth: 0 }}
              activeDot={{ r: 4, fill: CHART_INFRA.comparison }}
              connectNulls
            />
          </LineChart>
        </ChartWrapper>
      )}

      {/* summary rows */}
      {(() => {
        const curAdr = month.current.bookedNights > 0
          ? month.current.revenue / month.current.bookedNights : 0
        const priorPtAdr = month.priorAtThisPoint.bookedNights > 0
          ? month.priorAtThisPoint.revenue / month.priorAtThisPoint.bookedNights : 0
        const adrDelta = priorPtAdr > 0
          ? ((curAdr - priorPtAdr) / priorPtAdr) * 100 : 0

        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard
                label="Current pace"
                value={formatPercentage(month.current.occupancy * 100, 1)}
                sub={`${month.current.bookedNights} nights`}
              />
              <SummaryCard
                label="Last year at this point"
                value={formatPercentage(month.priorAtThisPoint.occupancy * 100, 1)}
                sub={`${month.priorAtThisPoint.bookedNights} nights`}
              />
              <SummaryCard
                label="Last year final"
                value={formatPercentage(month.priorFinal.occupancy * 100, 1)}
                sub={`${month.priorFinal.bookedNights} nights`}
              />
              <SummaryCard
                label="Revenue pace"
                value={formatCurrency(month.current.revenue)}
                sub={`Last yr: ${formatCurrency(month.priorAtThisPoint.revenue)}`}
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard
                label="ADR (current)"
                value={formatCurrency(curAdr)}
                sub={`Last yr: ${formatCurrency(priorPtAdr)}`}
              />
              <SummaryCard
                label="ADR change"
                value={`${adrDelta > 0 ? '+' : ''}${adrDelta.toFixed(1)}%`}
                sub={priorPtAdr > 0
                  ? adrDelta > 5 ? 'Higher rate may be slowing bookings'
                    : adrDelta < -5 ? 'Lower rate, check if volume offsets'
                    : 'Rates tracking close to last year'
                  : 'No prior year data'
                }
              />
              <SummaryCard
                label="RevPAR"
                value={formatCurrency(month.totalAvailableNights > 0
                  ? month.current.revenue / month.totalAvailableNights : 0)}
                sub={`Revenue per available night · ${month.totalAvailableNights} avail`}
              />
              <SummaryCard
                label="Last year final rev"
                value={formatCurrency(month.priorFinal.revenue)}
                sub={month.priorFinal.bookedNights > 0
                  ? `ADR: ${formatCurrency(month.priorFinal.revenue / month.priorFinal.bookedNights)}`
                  : 'No bookings'
                }
              />
            </div>
          </div>
        )
      })()}

      {/* per-property table */}
      {byProperty.length > 0 && (
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center gap-2 mb-4">
            <Home className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Property Pacing</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Property</th>
                  <th className="pb-2 px-4 font-medium text-muted-foreground text-right">Booked</th>
                  <th className="pb-2 px-4 font-medium text-muted-foreground text-right">Last yr (now)</th>
                  <th className="pb-2 px-4 font-medium text-muted-foreground text-right">Pace</th>
                  <th className="pb-2 px-4 font-medium text-muted-foreground text-right">ADR</th>
                  <th className="pb-2 pl-4 font-medium text-muted-foreground text-right">Last yr final</th>
                </tr>
              </thead>
              <tbody>
                {pagedProperties.map(prop => {
                  const curAdr = prop.currentNights > 0 ? prop.currentRevenue / prop.currentNights : 0
                  const priorAdr = prop.priorNightsAtThisPoint > 0 ? prop.priorRevenueAtThisPoint / prop.priorNightsAtThisPoint : 0
                  const adrChange = priorAdr > 0 ? ((curAdr - priorAdr) / priorAdr) * 100 : 0
                  return (
                  <tr
                    key={prop.propertyId}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => openModal({
                      type: 'property',
                      propertyId: prop.propertyId,
                      propertyName: prop.propertyName,
                    })}
                  >
                    <td className="py-2.5 pr-4">
                      <span className="font-medium">{prop.propertyCode || prop.propertyName}</span>
                      {prop.propertyCode && (
                        <span className="text-xs text-muted-foreground ml-1.5 hidden md:inline">
                          {prop.propertyName}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums">
                      {prop.currentNights}/{prop.availableNights}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">
                      {prop.priorNightsAtThisPoint}/{prop.availableNights}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <PaceIndicator delta={prop.paceDelta} />
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums">
                      <span>{formatCurrency(curAdr)}</span>
                      {priorAdr > 0 && (
                        <span className={cn(
                          'text-xs ml-1',
                          adrChange > 5 ? 'text-success' : adrChange < -5 ? 'text-danger' : 'text-muted-foreground'
                        )}>
                          {adrChange > 0 ? '+' : ''}{adrChange.toFixed(0)}%
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pl-4 text-right tabular-nums text-muted-foreground">
                      {prop.priorNightsFinal}/{prop.availableNights}
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={propertyPage}
            totalPages={totalPages}
            totalItems={byProperty.length}
            pageSize={PROPERTIES_PER_PAGE}
            onPageChange={setPropertyPage}
          />
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-card p-4 rounded-lg shadow-sm border border-border">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
    </div>
  )
}

// --- main component ---

export const PacingRunway = () => {
  const tagIds = useTagIds()
  const propertyIds = usePropertyIds()
  const { data, error, isLoading } = usePacing(tagIds, propertyIds)
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)

  // auto-select the month with the worst pacing delta on first load
  const effectiveSelected = useMemo(() => {
    if (!data?.months?.length) return null
    if (selectedMonth && data.months.some(m => m.month === selectedMonth)) return selectedMonth
    // default: worst-pacing month
    const worst = data.months.reduce((a, b) => a.paceDelta < b.paceDelta ? a : b)
    return worst.month
  }, [data?.months, selectedMonth])

  const selectedSummary = useMemo(
    () => data?.months?.find(m => m.month === effectiveSelected) ?? null,
    [data?.months, effectiveSelected]
  )
  const selectedDetail = effectiveSelected ? data?.details?.[effectiveSelected] ?? null : null

  // no prior-year data means comparisons are meaningless (new tenant)
  const hasPriorYearData = useMemo(() => {
    if (!data?.months?.length) return false
    return data.months.some(m => m.priorFinal.bookedNights > 0 || m.priorAtThisPoint.bookedNights > 0)
  }, [data?.months])

  if (isLoading || error || !data?.months?.length || !hasPriorYearData) {
    const noPriorYear = !isLoading && !error && !!data?.months?.length && !hasPriorYearData
    return (
      <div className="bg-card rounded-lg shadow-sm border border-border">
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="w-full flex items-center justify-between px-6 py-4 h-auto rounded-none cursor-pointer"
        >
          <div className="flex items-center gap-2">
            {expanded
              ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
              : <ChevronRight className="w-4 h-4 text-muted-foreground" />
            }
            <Activity className="w-5 h-5 text-muted-foreground" />
            <span className="font-bold text-foreground">Booking Pace</span>
            <span className="text-sm text-muted-foreground font-normal">year-over-year pacing</span>
          </div>
          {!expanded && error && (
            <div className="flex items-center gap-1.5 text-xs text-danger">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Failed to load</span>
            </div>
          )}
        </button>
        {expanded && (
          <div className="px-6 pb-6 border-t border-border">
            <StateWrapper
              loading={isLoading}
              error={error}
              empty={!isLoading && !error && (!data?.months?.length || noPriorYear)}
              loadingMessage="Loading pacing data..."
              emptyMessage={noPriorYear ? "Not enough booking history yet" : "No pacing data available"}
              emptySubMessage={noPriorYear
                ? "Pacing compares against the same period last year. Come back after your first full year of bookings to see year-over-year trends."
                : "Pacing data requires at least one year of booking history"
              }
              minHeight={100}
              className="py-8"
            >
              <div />
            </StateWrapper>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border">
      {/* collapsible header */}
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="w-full flex items-center justify-between px-6 py-4 h-auto rounded-none cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {expanded
            ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
            : <ChevronRight className="w-4 h-4 text-muted-foreground" />
          }
          <Activity className="w-5 h-5 text-muted-foreground" />
          <span className="font-bold text-foreground">Booking Pace</span>
          <span className="text-sm text-muted-foreground font-normal">year-over-year pacing</span>
        </div>
        {!expanded && data.months.length > 0 && (
          <div className="flex items-center gap-2.5">
            {data.months.map(m => (
              <div key={m.month} className="flex flex-col items-center gap-0.5"
                title={`${m.label}: ${m.paceDelta > 0 ? '+' : ''}${m.paceDelta.toFixed(1)} pts`}
              >
                <div
                  className={cn(
                    'w-2.5 h-2.5 rounded-full',
                    m.paceDelta > 2 ? 'bg-success'
                      : m.paceDelta < -5 ? 'bg-danger'
                      : m.paceDelta < -1 ? 'bg-warning'
                      : 'bg-muted-foreground/40'
                  )}
                />
                <span className="text-[9px] leading-none text-muted-foreground">
                  {m.label.slice(0, 3)}
                </span>
              </div>
            ))}
          </div>
        )}
      </button>

      {expanded && (
        <div className="px-6 pb-6 border-t border-border space-y-6">
          {/* month card runway */}
          <div className="flex gap-3 overflow-x-auto pb-2 pt-4 -mx-1 px-1">
            {data.months.map(month => (
              <MonthCard
                key={month.month}
                month={month}
                isSelected={month.month === effectiveSelected}
                onClick={() => setSelectedMonth(month.month)}
              />
            ))}
          </div>

          {/* detail panel for selected month */}
          {selectedSummary && selectedDetail && (
            <PacingDetail
              month={selectedSummary}
              byProperty={selectedDetail.byProperty}
              curve={selectedDetail.curve}
              todayDaysOut={selectedDetail.todayDaysOut}
            />
          )}
        </div>
      )}
    </div>
  )
}
