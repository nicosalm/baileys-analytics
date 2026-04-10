import React, { useMemo } from 'react'
import { MetricCard } from '@/components/MetricCard'
import { StateWrapper } from '@/components/StateWrapper'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartWrapper } from '@/components/ChartWrapper'
import { useTips } from '@/hooks/use-tips'
import { CheckCircle, Clock, Calendar, TrendingUp, Info } from 'lucide-react'
import { formatCurrency } from '@/utils/formatters'
import { chartFormatters, detectGranularity } from '@/utils/chart-helpers'
import { CHART_INFRA, resolveToken } from '@/lib/theme'
import type { TooltipContentProps, MouseHandlerDataParam } from 'recharts'

const CashFlowChartTooltip = ({ active, payload, label }: Partial<TooltipContentProps<number, string>>) => {
  if (!active || !payload?.length) return null
  const entry = payload.find(p => (p.value as number) > 0) ?? payload[0]
  const isCollected = entry.dataKey === 'collected'
  return (
    <div className="bg-card p-3 rounded-lg shadow-lg border border-border">
      <p className="font-semibold text-sm mb-2">{label}</p>
      <div className="flex justify-between gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: isCollected ? resolveToken('--success') : resolveToken('--info') }} />
          <span className="text-muted-foreground">{isCollected ? 'Collected:' : 'Pending:'}</span>
        </div>
        <span className="font-medium">{formatCurrency(entry.value as number)}</span>
      </div>
      <p className="text-xs text-muted-foreground mt-2 border-t border-border pt-2">Click to view details</p>
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

export const CashFlowView: React.FC<CashFlowViewProps> = ({
  data,
  loading,
  onPeriodClick,
}) => {
  const { showTips } = useTips()

  const monthlyData = useMemo(() => {
    if (!data?.byMonth) return []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return data.byMonth.map(m => {
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
      {showTips && (
        <div className="bg-info-subtle border border-info/30 rounded-lg p-4">
          <div className="flex items-start">
            <Info className="w-5 h-5 text-info mr-2 mt-0.5" />
            <div className="text-sm text-info-fg">
              <strong>Cash Flow:</strong> Collected is revenue from past arrivals in the period. Pending is from confirmed future arrivals. Pipeline cards show all upcoming bookings regardless of active filters.
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <MetricCard
          icon={CheckCircle}
          label="Collected"
          value={data.collected}
          format="currency"
          color="green"
          staggerIndex={0}
          subValue={`${data.collectionRate.toFixed(1)}% of period revenue`}
        />
        <MetricCard
          icon={Clock}
          label="Pending"
          value={data.pending}
          format="currency"
          color="blue"
          staggerIndex={1}
          subValue="All confirmed future bookings"
        />
        <MetricCard
          icon={Calendar}
          label="Next 30 Days"
          value={data.upcoming.next30Days}
          format="currency"
          color="yellow"
          staggerIndex={2}
          subValue="Arriving within 30 days"
        />
        <MetricCard
          icon={TrendingUp}
          label="Next 90 Days"
          value={data.upcoming.next90Days}
          format="currency"
          color="purple"
          staggerIndex={3}
          subValue="Revenue pipeline"
        />
      </div>

      <ChartWrapper title={`${detectGranularity(monthlyData, 'month')} Revenue — Collected vs Pending`} height={360} noData={monthlyData.length === 0} noDataMessage="No revenue data for this period">
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
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_INFRA.grid} />
            <XAxis dataKey="month" stroke={CHART_INFRA.axis} tick={{ fill: CHART_INFRA.axis }} />
            <YAxis tickFormatter={chartFormatters.currency} stroke={CHART_INFRA.axis} tick={{ fill: CHART_INFRA.axis }} />
            <Tooltip content={<CashFlowChartTooltip />} isAnimationActive={false} />
            <Bar dataKey="collected" stackId="revenue" name="Collected" fill={resolveToken('--success')} fillOpacity={0.85} radius={[2, 2, 0, 0]} />
            <Bar dataKey="pending" stackId="revenue" name="Pending" fill={resolveToken('--info')} fillOpacity={0.85} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartWrapper>
    </div>
  )
}
