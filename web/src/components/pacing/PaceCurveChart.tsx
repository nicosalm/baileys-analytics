import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TooltipContentProps } from 'recharts'
import { MS_PER_DAY } from '@baileys/constants'
import { formatCompactCurrency, formatCurrency } from '@baileys/utils'
import type { PacingCurvePoint, PacingMonthSummary } from '@/hooks/use-api'
import { CHART_INFRA, METRIC_COLORS, resolveToken } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { SegmentedControl } from '@/components/ui/segmented-control'

type CurveMode = 'nights' | 'revenue' | 'adr'

const MODES: { key: CurveMode; label: string }[] = [
  { key: 'nights', label: 'Nights' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'adr', label: 'ADR' },
]

interface CurveRow {
  daysOut: number
  current: number | null
  prior: number | null
}

const formatValue = (value: number | null | undefined, mode: CurveMode) => {
  if (value == null) return '—'
  return mode === 'nights' ? `${value} nights` : formatCurrency(value)
}

// days relative to the first night of the month; each tick keeps its raw offset so x positions never collide
const formatDaysOut = (daysOut: number) => {
  if (daysOut === 0) return 'Month start'
  const abs = Math.abs(daysOut)
  const sign = daysOut < 0 ? '−' : '+'
  if (abs < 30) return `${sign}${abs}d`
  if (abs < 365) return `${sign}${Math.round(abs / 7)}w`
  return `${sign}${(abs / 365).toFixed(1)}y`
}

function CurveTooltip({
  active,
  payload,
  mode,
  monthStart,
}: Partial<TooltipContentProps<number, string>> & { mode: CurveMode; monthStart: Date }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload as CurveRow
  const date = new Date(monthStart.getTime() + row.daysOut * MS_PER_DAY)
  const diff = row.current != null && row.prior != null ? row.current - row.prior : null

  return (
    <div className="bg-card p-3 rounded-lg shadow-lg border border-border text-xs space-y-1 min-w-44">
      <p className="font-semibold text-sm">{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
      <div className="flex justify-between gap-4">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: METRIC_COLORS.occupancy }} />
          This year
        </span>
        <span className="font-medium tabular-nums">{formatValue(row.current, mode)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="w-3 border-t-2 border-dashed" style={{ borderColor: CHART_INFRA.comparison }} />
          Last year
        </span>
        <span className="font-medium tabular-nums">{formatValue(row.prior, mode)}</span>
      </div>
      {diff !== null && (
        <div className="flex justify-between gap-4 pt-1 border-t border-border">
          <span className="text-muted-foreground">Difference</span>
          <span className={cn('font-medium tabular-nums', diff >= 0 ? 'text-success-fg' : 'text-danger-fg')}>
            {diff > 0 ? '+' : ''}
            {mode === 'nights' ? `${Math.round(diff)} nights` : formatCurrency(diff)}
          </span>
        </div>
      )}
    </div>
  )
}

export function PaceCurveChart({
  month,
  curve,
  todayDaysOut,
}: {
  month: PacingMonthSummary
  curve: PacingCurvePoint[]
  todayDaysOut: number
}) {
  const [mode, setMode] = useState<CurveMode>('nights')

  const monthStart = useMemo(() => {
    const [y, m] = month.month.split('-').map(Number)
    return new Date(y, m - 1, 1)
  }, [month.month])

  const rows = useMemo<CurveRow[]>(
    () =>
      curve.map((pt) => {
        if (mode === 'nights') return { daysOut: pt.daysOut, current: pt.currentNights, prior: pt.priorNights }
        if (mode === 'revenue') return { daysOut: pt.daysOut, current: pt.currentRevenue, prior: pt.priorRevenue }
        return {
          daysOut: pt.daysOut,
          current: pt.currentNights > 0 ? pt.currentRevenue / pt.currentNights : null,
          prior: pt.priorNights > 0 ? pt.priorRevenue / pt.priorNights : null,
        }
      }),
    [curve, mode],
  )

  // last year's value on the same day as today, taken from the summary so it matches the table exactly
  const priorToday =
    mode === 'nights'
      ? month.priorAtThisPoint.bookedNights
      : mode === 'revenue'
        ? month.priorAtThisPoint.revenue
        : month.priorAtThisPoint.adr

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 rounded-full" style={{ backgroundColor: METRIC_COLORS.occupancy }} />
            This year
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed" style={{ borderColor: CHART_INFRA.comparison }} />
            Last year
          </span>
        </div>
        <SegmentedControl
          label="Curve measure"
          value={mode}
          onChange={setMode}
          options={MODES.map(({ key, label }) => ({ value: key, label }))}
        />
      </div>

      <div className="flex-1 min-h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 16, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART_INFRA.grid} strokeOpacity={0.6} />
            <XAxis
              type="number"
              dataKey="daysOut"
              domain={['dataMin', 'dataMax']}
              tickFormatter={formatDaysOut}
              tick={{ fill: CHART_INFRA.axis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              width={mode === 'nights' ? 36 : 52}
              tick={{ fill: CHART_INFRA.axis, fontSize: 11 }}
              tickFormatter={mode === 'nights' ? undefined : (v: number) => formatCompactCurrency(v)}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CurveTooltip mode={mode} monthStart={monthStart} />} isAnimationActive={false} />
            <ReferenceLine
              x={todayDaysOut}
              stroke={CHART_INFRA.reference}
              strokeDasharray="3 3"
              label={{ value: 'Today', position: 'insideTopRight', fill: CHART_INFRA.axis, fontSize: 11 }}
            />
            {priorToday > 0 && (
              <ReferenceDot
                x={todayDaysOut}
                y={priorToday}
                r={4}
                fill={CHART_INFRA.comparison}
                stroke={resolveToken('--card')}
                strokeWidth={2}
              />
            )}
            <Line
              type="monotone"
              dataKey="prior"
              name="Last year"
              stroke={CHART_INFRA.comparison}
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="current"
              name="This year"
              stroke={METRIC_COLORS.occupancy}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: resolveToken('--card'), strokeWidth: 2 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
