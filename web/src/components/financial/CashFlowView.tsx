import type React from 'react'
import { useMemo } from 'react'
import { MetricCard } from '@/components/MetricCard'
import { StateWrapper } from '@/components/StateWrapper'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartWrapper } from '@/components/ChartWrapper'
import { CheckCircle, Clock, Calendar, TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/utils/formatters'
import { chartFormatters, detectGranularity } from '@/utils/chart-helpers'
import { CHART_INFRA, METRIC_COLORS, resolveToken, BAR_SPEC } from '@/lib/theme'
import type { TooltipContentProps, MouseHandlerDataParam } from 'recharts'
import { METRIC_DEFINITIONS } from '@/lib/metric-definitions'
import { ChartLegend } from '@/components/charts/ChartLegend'

// 'YYYY-MM' becomes 'Apr'; other granularities pass through unchanged
const formatMonthTick = (value: string) =>
  /^\d{4}-\d{2}$/.test(value) ? new Date(`${value}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short' }) : value

const CashFlowChartTooltip = ({ active, payload, label }: Partial<TooltipContentProps<number, string>>) => {
  if (!active || !payload?.length) return null
  const rows = payload.filter((p) => (p.value as number) > 0)
  return (
    <div className="bg-card p-3 rounded-lg shadow-lg border border-border">
      <p className="font-semibold text-sm mb-2">{formatMonthTick(String(label))}</p>
      <div className="space-y-1 text-xs">
        {(rows.length ? rows : payload.slice(0, 1)).map((p) => (
          <div key={String(p.dataKey)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2.5 rounded-sm" style={{ backgroundColor: p.color }} aria-hidden />
              {p.name}
            </span>
            <span className="font-medium tabular-nums">{formatCurrency(p.value as number)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface MonthEntry {
  month: string
  amount?: number
  revenue?: number
}

interface CashFlowData {
  collected: number
  pending: number
  collectionRate: number
  upcoming: {
    next30Days: number
    next60Days: number
    next90Days: number
  }
  byMonth: MonthEntry[]
}

interface CashFlowViewProps {
  data: CashFlowData | null
  loading: boolean
  onPeriodClick?: (period: string) => void
  comparisonMode?: string
  comparisonDateRange?: string
}

export const CashFlowView: React.FC<CashFlowViewProps> = ({ data, loading, onPeriodClick }) => {
  const monthlyData = useMemo(() => {
    if (!data?.byMonth) return []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return data.byMonth.map((m) => {
      const [year, month] = m.month.split('-').map(Number)
      const monthStart = new Date(year, month - 1, 1)
      const amount = m.amount || 0
      return {
        month: m.month,
        collected: monthStart <= today ? amount : 0,
        pending: monthStart > today ? amount : 0,
      }
    })
  }, [data])

  if (loading || !data) {
    return (
      <StateWrapper
        loading={loading}
        empty={!data && !loading}
        loadingMessage="Loading cash flow data..."
        emptyMessage="No cash flow data available"
        emptySubMessage="Select a date range to view cash flow"
        minHeight={300}
      >
        <div />
      </StateWrapper>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <MetricCard
          icon={CheckCircle}
          label="Collected"
          value={data.collected}
          format="currency"
          staggerIndex={0}
          subValue={`${data.collectionRate.toFixed(1)}% of period revenue`}
          tooltip={METRIC_DEFINITIONS.collected}
        />
        <MetricCard
          icon={Clock}
          label="Pending"
          value={data.pending}
          format="currency"
          staggerIndex={1}
          tooltip={METRIC_DEFINITIONS.pending}
        />
        <MetricCard
          icon={Calendar}
          label="Next 30 Days"
          value={data.upcoming.next30Days}
          format="currency"
          staggerIndex={2}
          tooltip={METRIC_DEFINITIONS.pipeline30}
        />
        <MetricCard
          icon={TrendingUp}
          label="Next 90 Days"
          value={data.upcoming.next90Days}
          format="currency"
          staggerIndex={3}
          tooltip={METRIC_DEFINITIONS.pipeline90}
        />
      </div>

      <ChartWrapper
        responsive={false}
        title={`${detectGranularity(monthlyData, 'month')} revenue, collected and pending`}
        height={360}
        noData={monthlyData.length === 0}
        noDataMessage="No revenue data for this period"
      >
        <div className="h-full flex flex-col">
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlyData}
                onClick={(e: MouseHandlerDataParam) => {
                  if (e?.activeLabel && onPeriodClick) {
                    onPeriodClick(String(e.activeLabel))
                  }
                }}
                style={{ cursor: onPeriodClick ? 'pointer' : 'default' }}
              >
                <CartesianGrid vertical={false} stroke={CHART_INFRA.grid} strokeOpacity={0.6} />
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonthTick}
                  tick={{ fill: CHART_INFRA.axis, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={chartFormatters.currency}
                  tick={{ fill: CHART_INFRA.axis, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CashFlowChartTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.3 }} isAnimationActive={false} />
                <Bar
                  dataKey="collected"
                  stackId="revenue"
                  name="Collected"
                  fill={METRIC_COLORS.revenue}
                  radius={BAR_SPEC.radiusUp}
                  maxBarSize={BAR_SPEC.maxBarSize}
                />
                {/* the surface-colored stroke opens the gap between stacked segments */}
                <Bar
                  dataKey="pending"
                  stackId="revenue"
                  name="Pending"
                  fill={CHART_INFRA.comparison}
                  radius={BAR_SPEC.radiusUp}
                  maxBarSize={BAR_SPEC.maxBarSize}
                  stroke={resolveToken('--card')}
                  strokeWidth={BAR_SPEC.gap}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ChartLegend
            className="mt-3"
            items={[
              { label: 'Collected', color: METRIC_COLORS.revenue, shape: 'square' },
              { label: 'Pending', color: CHART_INFRA.comparison, shape: 'square' },
            ]}
          />
        </div>
      </ChartWrapper>
    </div>
  )
}
