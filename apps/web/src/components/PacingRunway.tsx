import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceDot, Legend } from 'recharts'
import { TrendingUp, TrendingDown, Minus, Activity, Home, ChevronRight, ChevronDown, AlertCircle, Info } from 'lucide-react'
import { formatPercentage, formatCurrency, formatCompactCurrency } from '@baileys/utils'
import { cn } from '@/lib/utils'
import { MS_PER_DAY } from '@baileys/constants'
import { usePacing } from '@/hooks/use-api'
import type { PacingMonthSummary, PacingProperty, PacingCurvePoint } from '@/hooks/use-api'
import { useTagIds, usePropertyIds } from '@/hooks/use-dashboard-utils'
import { useModal } from '@/contexts/modal'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/Pagination'
import { ChartWrapper } from '@/components/ChartWrapper'
import { StateWrapper } from '@/components/StateWrapper'
import { Tooltip as UITooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { METRIC_COLORS, CHART_INFRA, resolveToken } from '@/lib/theme'
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
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-semibold', ahead ? 'text-success' : 'text-danger')}>
      {ahead ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {Math.abs(delta).toFixed(1)} pts {ahead ? 'ahead' : 'behind'}
    </span>
  )
}

function MonthCard({ month, isSelected, onClick }: { month: PacingMonthSummary; isSelected: boolean; onClick: () => void }) {
  // MonthCard tells one story: occupancy pacing vs last year. Rate metrics
  // (ADR, RevPAR, last-year-final revenue) live in the detail panel below
  // so the card stays scannable at a glance.
  const occupancyPct = month.current.occupancy * 100
  const priorPct = month.priorFinal.occupancy * 100
  const nightsGap = month.priorAtThisPoint.bookedNights - month.current.bookedNights
  const revenueGap = month.priorAtThisPoint.revenue - month.current.revenue
  const isBehind = month.paceDelta < -0.5 && (nightsGap > 0 || revenueGap > 0)

  const borderColor =
    month.paceDelta > 2
      ? 'border-success/50'
      : month.paceDelta < -5
        ? 'border-danger/50'
        : month.paceDelta < -1
          ? 'border-warning/50'
          : 'border-border'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      className={cn(
        'rounded-lg border-2 p-4 text-left transition-all duration-200',
        'cursor-pointer min-w-[160px] flex-shrink-0',
        borderColor,
        isSelected ? 'bg-primary/5 ring-2 ring-primary shadow-md' : 'bg-card hover:shadow-md hover:bg-muted/30',
      )}
    >
      <div className="text-xs font-medium text-muted-foreground mb-2">{month.label}</div>

      <div className="text-2xl font-bold mb-1">{formatPercentage(occupancyPct, 1)}</div>
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
        Last yr at this point: {formatPercentage(month.priorAtThisPoint.occupancy * 100, 1)}
      </div>

      <div className="mt-3 relative">
        <div className="w-full bg-muted rounded-full h-1.5">
          <div
            className={cn(
              'h-1.5 rounded-full transition-all',
              occupancyPct >= 70 ? 'bg-success' : occupancyPct >= 50 ? 'bg-warning' : 'bg-danger',
            )}
            style={{ width: `${Math.min(occupancyPct, 100)}%` }}
          />
        </div>
        {priorPct > 0 && (
          <div
            className="absolute top-0 w-0.5 h-1.5 bg-muted-foreground/50 rounded-full"
            style={{ left: `${Math.min(priorPct, 100)}%` }}
            title={`Last year final: ${formatPercentage(priorPct, 1)}`}
          />
        )}
      </div>
    </button>
  )
}

// --- booking curve tooltip ---

// Series keys used both to key the chartData rows and to reference them from
// <Line dataKey=.../> and the tooltip. A typo in any one place silently drops
// a line, so keep these authoritative.
//
// We render one prior-year line (the full curve). The "1 yr ago today"
// reference is read off that line at x = todayDaysOut, which is the same
// vertical position the "Today" ReferenceLine marks for the current year.
const SERIES = {
  current: 'This year',
  prior: 'Last year',
} as const

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
  active,
  payload,
  label,
  mode,
  monthStart,
}: Partial<TooltipContentProps<number, string>> & { mode?: CurveMode; monthStart?: Date }) {
  if (!active || !payload?.length) return null

  const curveMode = mode ?? 'nights'
  const thisYear = payload.find((p) => p.name === SERIES.current)?.value as number | null | undefined
  const lastYear = payload.find((p) => p.name === SERIES.prior)?.value as number | null | undefined

  // label is the formatted daysOut from labelFormatter; find the raw value from payload
  const rawDaysOut = payload[0]?.payload?.daysOut as number | undefined

  // compute the calendar date each series corresponds to (prior line is one year back)
  let thisYearDate: string | null = null
  let lastYearDate: string | null = null
  if (monthStart && rawDaysOut != null) {
    const cur = new Date(monthStart.getTime() + rawDaysOut * MS_PER_DAY)
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
        {payload.map((entry) => {
          const isPrior = entry.name === SERIES.prior
          return (
            <div key={entry.name} className="flex justify-between gap-4">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: entry.color }} />
                <span className="text-muted-foreground">
                  {entry.name}
                  {isPrior && lastYearDate && <span className="text-muted-foreground/70"> · {lastYearDate}</span>}:
                </span>
              </div>
              <span className="font-medium">{formatCurveValue(entry.value as number | null | undefined, curveMode)}</span>
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
  const pagedProperties = byProperty.slice((propertyPage - 1) * PROPERTIES_PER_PAGE, propertyPage * PROPERTIES_PER_PAGE)

  // target month start as a local Date, used by the tooltip to resolve daysOut → calendar date
  const targetMonthStart = useMemo(() => {
    const [y, m] = month.month.split('-').map(Number)
    return new Date(y, m - 1, 1)
  }, [month.month])

  const chartData = useMemo(
    () =>
      curve.map((pt) => {
        let thisYear: number | null
        let prior: number | null
        if (curveMode === 'nights') {
          thisYear = pt.currentNights
          prior = pt.priorNights
        } else if (curveMode === 'revenue') {
          thisYear = pt.currentRevenue
          prior = pt.priorRevenue
        } else {
          thisYear = pt.currentNights > 0 ? pt.currentRevenue / pt.currentNights : null
          prior = pt.priorNights > 0 ? pt.priorRevenue / pt.priorNights : null
        }

        return {
          daysOut: pt.daysOut,
          [SERIES.current]: thisYear,
          [SERIES.prior]: prior,
        }
      }),
    [curve, curveMode],
  )

  const maxValue = useMemo(() => {
    let max = 0
    for (const pt of chartData) {
      for (const key of [SERIES.current, SERIES.prior] as const) {
        const v = (pt as Record<string, number | null>)[key]
        if (v != null && v > max) max = v
      }
    }
    return max
  }, [chartData])

  // Marks "last year at this point" visually on the prior curve. Sourced
  // from the authoritative month summary so the coordinate matches the
  // KpiGroup card exactly, without interpolating from sparse curve samples.
  const priorAtPointMarker = useMemo(() => {
    const pt = month.priorAtThisPoint
    let y: number | null
    if (curveMode === 'nights') y = pt.bookedNights || null
    else if (curveMode === 'revenue') y = pt.revenue || null
    else y = pt.adr > 0 ? pt.adr : null
    if (y == null || y <= 0) return null
    return { x: todayDaysOut, y }
  }, [month.priorAtThisPoint, curveMode, todayDaysOut])

  return (
    <div className="space-y-6">
      {/* booking curve chart */}
      {curve.length > 2 && (
        <ChartWrapper
          title={`Booking Pace: ${month.label}`}
          subtitle={
            curveMode === 'nights'
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
              {(['nights', 'revenue', 'adr'] as const).map((mode) => (
                <Button
                  key={mode}
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurveMode(mode)}
                  className={curveMode === mode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}
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
              tickFormatter={curveMode === 'nights' ? undefined : (v: number) => formatCompactCurrency(v)}
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
            {priorAtPointMarker && (
              // Anchors the "last year at this point" value visually on the
              // prior curve. No inline text: the exact value lives in the
              // KpiGroup card and on hover, so the dot stays quiet.
              <ReferenceDot
                x={priorAtPointMarker.x}
                y={priorAtPointMarker.y}
                r={5}
                fill={CHART_INFRA.comparison}
                stroke={resolveToken('--card')}
                strokeWidth={2}
              />
            )}
            <Line
              type="monotone"
              dataKey={SERIES.current}
              stroke={METRIC_COLORS.occupancy}
              strokeWidth={3}
              dot={{ fill: METRIC_COLORS.occupancy, r: 2.5, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: METRIC_COLORS.occupancy }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey={SERIES.prior}
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

      <KpiGroupRow month={month} />

      {/* per-property table — nested card, border-only to avoid double-shadowing */}
      {byProperty.length > 0 && (
        <div className="bg-card p-6 rounded-lg border border-border">
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
                {pagedProperties.map((prop) => {
                  const curAdr = prop.currentNights > 0 ? prop.currentRevenue / prop.currentNights : 0
                  const priorAdr = prop.priorNightsAtThisPoint > 0 ? prop.priorRevenueAtThisPoint / prop.priorNightsAtThisPoint : 0
                  const adrChange = priorAdr > 0 ? ((curAdr - priorAdr) / priorAdr) * 100 : 0
                  // fallback for cached responses without priorAvailableNights.
                  const priorAvail = prop.priorAvailableNights ?? prop.availableNights
                  return (
                    <tr
                      key={prop.propertyId}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() =>
                        openModal({
                          type: 'property',
                          propertyId: prop.propertyId,
                          propertyName: prop.propertyName,
                        })
                      }
                    >
                      <td className="py-2.5 pr-4">
                        <span className="font-medium">{prop.propertyCode || prop.propertyName}</span>
                        {prop.propertyCode && (
                          <span className="text-xs text-muted-foreground ml-1.5 hidden md:inline">{prop.propertyName}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums">
                        {prop.currentNights}/{prop.availableNights}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">
                        {prop.priorNightsAtThisPoint}/{priorAvail}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <PaceIndicator delta={prop.paceDelta} />
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums">
                        <span>{formatCurrency(curAdr)}</span>
                        {priorAdr > 0 && (
                          <span
                            className={cn(
                              'text-xs ml-1',
                              adrChange > 5 ? 'text-success' : adrChange < -5 ? 'text-danger' : 'text-muted-foreground',
                            )}
                          >
                            {adrChange > 0 ? '+' : ''}
                            {adrChange.toFixed(0)}%
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pl-4 text-right tabular-nums text-muted-foreground">
                        {prop.priorNightsFinal}/{priorAvail}
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

// A KPI group is a single card with one primary metric and two comparison rows.
// Three of these replace eight flat summary cards and produce a tighter visual
// scan: "how am I doing", "how was I doing a year ago", "how did I finish a year ago".
function KpiGroup({
  label,
  primary,
  primaryCaption,
  comparisons,
  delta,
  tooltip,
}: {
  label: string
  primary: string
  primaryCaption?: string
  comparisons: Array<{ label: string; value: string }>
  delta?: { value: number; format: 'pct' | 'abs'; unit?: string }
  tooltip?: string
}) {
  const renderDelta = () => {
    if (!delta) return null
    const ahead = delta.value >= 0
    if (Math.abs(delta.value) < 0.5)
      return (
        <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
          <Minus className="w-3 h-3" /> even
        </span>
      )
    const display =
      delta.format === 'pct'
        ? `${ahead ? '+' : ''}${delta.value.toFixed(1)}%`
        : `${ahead ? '+' : ''}${delta.unit ?? ''}${Math.abs(delta.value).toFixed(0)}`
    return (
      <span className={cn('inline-flex items-center gap-0.5 text-xs font-semibold', ahead ? 'text-success' : 'text-danger')}>
        {ahead ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {display}
      </span>
    )
  }

  return (
    // Nested inside the PacingRunway card (which already has shadow-sm + border).
    // Border-only treatment signals the nesting level without double-shadowing.
    <div className="bg-card p-4 rounded-lg border border-border">
      <div className="flex items-baseline justify-between mb-2">
        <div className="flex items-center gap-1">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</div>
          {tooltip && (
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  {tooltip}
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          )}
        </div>
        {renderDelta()}
      </div>
      <div className="text-2xl font-bold tabular-nums">{primary}</div>
      {primaryCaption && <div className="text-xs text-muted-foreground mt-0.5">{primaryCaption}</div>}
      <div className="mt-3 pt-3 border-t border-border space-y-1">
        {comparisons.map((c) => (
          <div key={c.label} className="flex justify-between text-xs">
            <span className="text-muted-foreground">{c.label}</span>
            <span className="tabular-nums">{c.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Percent delta between `current` and `prior`, or null when prior is 0/missing
// so the caller can hide the chip instead of showing "+∞%".
function pctDelta(current: number, prior: number): number | null {
  return prior > 0 ? ((current - prior) / prior) * 100 : null
}

// Detail panel for the selected month. Three grouped KPI cards —
// Occupancy, Revenue, Rate — each showing primary + last-year-at-this-point + last-year-final.
function KpiGroupRow({ month }: { month: PacingMonthSummary }) {
  const curAdr = month.current.adr
  const ptAdr = month.priorAtThisPoint.adr
  const finAdr = month.priorFinal.adr
  const adrDelta = pctDelta(curAdr, ptAdr)
  const revDelta = pctDelta(month.current.revenue, month.priorAtThisPoint.revenue)

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <KpiGroup
        label="Occupancy"
        primary={formatPercentage(month.current.occupancy * 100, 1)}
        primaryCaption={`${month.current.bookedNights} of ${month.totalAvailableNights} nights`}
        delta={{ value: month.paceDelta, format: 'pct' }}
        comparisons={[
          { label: 'Last yr at this point', value: formatPercentage(month.priorAtThisPoint.occupancy * 100, 1) },
          { label: 'Last yr final', value: formatPercentage(month.priorFinal.occupancy * 100, 1) },
        ]}
        tooltip="Booked nights ÷ sellable nights for this month (owner blocks excluded)."
      />
      <KpiGroup
        label="Revenue"
        primary={formatCurrency(month.current.revenue)}
        primaryCaption={`RevPAR ${formatCurrency(month.current.revpar)}`}
        delta={revDelta !== null ? { value: revDelta, format: 'pct' } : undefined}
        comparisons={[
          { label: 'Last yr at this point', value: formatCurrency(month.priorAtThisPoint.revenue) },
          { label: 'Last yr final', value: formatCurrency(month.priorFinal.revenue) },
        ]}
        tooltip="Nightly revenue booked for this month so far."
      />
      <KpiGroup
        label="Average rate"
        primary={curAdr > 0 ? formatCurrency(curAdr) : '—'}
        primaryCaption="Per booked night"
        delta={adrDelta !== null ? { value: adrDelta, format: 'pct' } : undefined}
        comparisons={[
          { label: 'Last yr at this point', value: ptAdr > 0 ? formatCurrency(ptAdr) : '—' },
          { label: 'Last yr final', value: finAdr > 0 ? formatCurrency(finAdr) : '—' },
        ]}
        tooltip="Revenue ÷ booked nights for this month."
      />
    </div>
  )
}

// Three-KPI headline at the top of the runway, aggregated across every target month.
// Same three groups as the detail panel so the visual pattern is consistent: users
// learn the layout once and apply it twice.
function PortfolioPacingHeadline({ months }: { months: PacingMonthSummary[] }) {
  const totals = months.reduce(
    (acc, m) => ({
      curNights: acc.curNights + m.current.bookedNights,
      curRevenue: acc.curRevenue + m.current.revenue,
      curAvail: acc.curAvail + m.totalAvailableNights,
      ptNights: acc.ptNights + m.priorAtThisPoint.bookedNights,
      ptRevenue: acc.ptRevenue + m.priorAtThisPoint.revenue,
      ptAvail: acc.ptAvail + m.priorAvailableNights,
      finNights: acc.finNights + m.priorFinal.bookedNights,
      finRevenue: acc.finRevenue + m.priorFinal.revenue,
      finAvail: acc.finAvail + m.priorAvailableNights,
    }),
    { curNights: 0, curRevenue: 0, curAvail: 0, ptNights: 0, ptRevenue: 0, ptAvail: 0, finNights: 0, finRevenue: 0, finAvail: 0 },
  )
  const curOcc = totals.curAvail > 0 ? (totals.curNights / totals.curAvail) * 100 : 0
  const ptOcc = totals.ptAvail > 0 ? (totals.ptNights / totals.ptAvail) * 100 : 0
  const finOcc = totals.finAvail > 0 ? (totals.finNights / totals.finAvail) * 100 : 0
  const curAdr = totals.curNights > 0 ? totals.curRevenue / totals.curNights : 0
  const ptAdr = totals.ptNights > 0 ? totals.ptRevenue / totals.ptNights : 0
  const finAdr = totals.finNights > 0 ? totals.finRevenue / totals.finNights : 0
  const curRevpar = totals.curAvail > 0 ? totals.curRevenue / totals.curAvail : 0
  const occDelta = curOcc - ptOcc
  const revDelta = pctDelta(totals.curRevenue, totals.ptRevenue)
  const adrDelta = pctDelta(curAdr, ptAdr)

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4">
      <KpiGroup
        label="Portfolio occupancy"
        primary={formatPercentage(curOcc, 1)}
        primaryCaption={`${totals.curNights} of ${totals.curAvail} nights`}
        delta={totals.ptAvail > 0 ? { value: occDelta, format: 'pct' } : undefined}
        comparisons={[
          { label: 'Last yr at this point', value: formatPercentage(ptOcc, 1) },
          { label: 'Last yr final', value: formatPercentage(finOcc, 1) },
        ]}
        tooltip="Booked nights ÷ sellable nights for this window. Owner blocks (maintenance, personal stays) are excluded from the denominator."
      />
      <KpiGroup
        label="Portfolio revenue"
        primary={formatCurrency(totals.curRevenue)}
        primaryCaption={`RevPAR ${formatCurrency(curRevpar)}`}
        delta={revDelta !== null ? { value: revDelta, format: 'pct' } : undefined}
        comparisons={[
          { label: 'Last yr at this point', value: formatCurrency(totals.ptRevenue) },
          { label: 'Last yr final', value: formatCurrency(totals.finRevenue) },
        ]}
        tooltip="Nightly revenue booked for this window so far. Grows as new reservations come in."
      />
      <KpiGroup
        label="Portfolio ADR"
        primary={curAdr > 0 ? formatCurrency(curAdr) : '—'}
        primaryCaption="Per booked night"
        delta={adrDelta !== null ? { value: adrDelta, format: 'pct' } : undefined}
        comparisons={[
          { label: 'Last yr at this point', value: ptAdr > 0 ? formatCurrency(ptAdr) : '—' },
          { label: 'Last yr final', value: finAdr > 0 ? formatCurrency(finAdr) : '—' },
        ]}
        tooltip="Revenue ÷ booked nights across this window."
      />
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
    if (selectedMonth && data.months.some((m) => m.month === selectedMonth)) return selectedMonth
    // default: worst-pacing month
    const worst = data.months.reduce((a, b) => (a.paceDelta < b.paceDelta ? a : b))
    return worst.month
  }, [data?.months, selectedMonth])

  const selectedSummary = useMemo(() => data?.months?.find((m) => m.month === effectiveSelected) ?? null, [data?.months, effectiveSelected])
  const selectedDetail = effectiveSelected ? (data?.details?.[effectiveSelected] ?? null) : null

  // no prior-year data means comparisons are meaningless (new tenant)
  const hasPriorYearData = useMemo(() => {
    if (!data?.months?.length) return false
    return data.months.some((m) => m.priorFinal.bookedNights > 0 || m.priorAtThisPoint.bookedNights > 0)
  }, [data?.months])

  if (isLoading || error || !data?.months?.length || !hasPriorYearData) {
    const noPriorYear = !isLoading && !error && !!data?.months?.length && !hasPriorYearData
    return (
      <div className="bg-card rounded-lg shadow-sm border border-border">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="w-full flex items-center justify-between px-6 py-4 h-auto rounded-none cursor-pointer"
        >
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
            <Activity className="w-5 h-5 text-muted-foreground" />
            <span className="font-bold text-foreground">Booking Pace</span>
            <span className="text-sm text-muted-foreground font-normal">forward-looking, vs last year</span>
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
              emptyMessage={noPriorYear ? 'Not enough booking history yet' : 'No pacing data available'}
              emptySubMessage={
                noPriorYear
                  ? 'Pacing compares against the same period last year. Come back after your first full year of bookings to see year-over-year trends.'
                  : 'Pacing data requires at least one year of booking history'
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
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-6 py-4 h-auto rounded-none cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          <Activity className="w-5 h-5 text-muted-foreground" />
          <span className="font-bold text-foreground">Booking Pace</span>
          <span className="text-sm text-muted-foreground font-normal">{data.window.label} · year-over-year</span>
        </div>
        {!expanded && data.months.length > 0 && (
          <div className="flex items-center gap-2.5">
            {data.months.map((m) => (
              <div
                key={m.month}
                className="flex flex-col items-center gap-0.5"
                title={`${m.label}: ${m.paceDelta > 0 ? '+' : ''}${m.paceDelta.toFixed(1)} pts`}
              >
                <div
                  className={cn(
                    'w-2.5 h-2.5 rounded-full',
                    m.paceDelta > 2
                      ? 'bg-success'
                      : m.paceDelta < -5
                        ? 'bg-danger'
                        : m.paceDelta < -1
                          ? 'bg-warning'
                          : 'bg-muted-foreground/40',
                  )}
                />
                <span className="text-[9px] leading-none text-muted-foreground">{m.label.slice(0, 3)}</span>
              </div>
            ))}
          </div>
        )}
      </button>

      {expanded && (
        <div className="px-6 pb-6 border-t border-border space-y-6">
          {/* headline bar: 3 KPIs for the 6-month runway as a whole. deliberately
              terse — the per-month breakdown below is where detail lives. */}
          <PortfolioPacingHeadline months={data.months} />

          {/* month card runway — padding here has to clear the selected-card ring+shadow
              since overflow-x-auto clips both axes; -mx offsets keep the visual flush */}
          <div className="flex gap-3 overflow-x-auto pt-2 pb-3 -mx-2 px-2">
            {data.months.map((month) => (
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
