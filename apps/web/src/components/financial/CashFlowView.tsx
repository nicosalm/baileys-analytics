import React, { useMemo } from 'react'
import { MetricCard } from '@/components/MetricCard'
import { StateWrapper } from '@/components/StateWrapper'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartWrapper } from '@/components/ChartWrapper'
import { useTips } from '@/hooks/use-tips'
import { 
  TrendingUp, Wallet,
  Info, ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import { formatPercentage, formatCurrency } from '@/utils/formatters'
import { chartFormatters, detectGranularity } from '@/utils/chart-helpers'
import { CHART_INFRA, resolveToken } from '@/lib/theme'
import { useDashboard } from '@/contexts/dashboard'

const CashFlowChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const data = payload[0].payload
  const netFlow = data.inflow - data.outflow

  return (
    <div className="bg-card p-3 rounded-lg shadow-lg border border-border">
      <p className="font-semibold text-sm mb-2">{label}</p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: resolveToken('--success') }} />
            <span className="text-muted-foreground">Inflow:</span>
          </div>
          <span className="font-medium">{formatCurrency(data.inflow)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: resolveToken('--danger') }} />
            <span className="text-muted-foreground">Outflow:</span>
          </div>
          <span className="font-medium">{formatCurrency(data.outflow)}</span>
        </div>
        <div className="pt-1 mt-1 border-t border-border">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Net Flow:</span>
            <span className={`font-medium ${netFlow >= 0 ? 'text-success' : 'text-danger'}`}>{formatCurrency(netFlow)}</span>
          </div>
          {data.inflow > 0 && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Retained:</span>
              <span className="font-medium">{((netFlow / data.inflow) * 100).toFixed(1)}%</span>
            </div>
          )}
        </div>
        <p className="text-muted-foreground pt-1 mt-1 border-t border-border">Click to view details</p>
      </div>
    </div>
  )
}

interface CashFlowViewProps {
  data: any
  loading: boolean
  onPeriodClick?: (period: string) => void
  comparisonMode?: 'none' | 'previous-period' | 'previous-year'
  comparisonDateRange?: string
}

export const CashFlowView: React.FC<CashFlowViewProps> = ({
  data,
  loading,
  onPeriodClick,
  comparisonMode = 'none',
  comparisonDateRange = ''
}) => {
  const { showTips } = useTips()
  const { comparisonLabel } = useDashboard()
  const cashFlowData = useMemo(() => {
    if (!data) return null
    
    const { byMonth, fees, taxes, gross, previousPeriod, operatingExpenses } = data

    // Calculate actual outflow from fees, taxes, and operating expenses
    const totalFees = fees || 0
    const totalTaxes = taxes || 0
    const totalOperatingExpenses = operatingExpenses || 0
    const totalGross = gross || 0
    const actualOutflowRate = totalGross > 0 ? (totalFees + totalTaxes + totalOperatingExpenses) / totalGross : 0.3
    
    // Calculate cash flow metrics
    const monthlyData = byMonth?.map((month: any) => {
      const monthRevenue = month.revenue || month.amount || 0
      const monthOutflow = monthRevenue * actualOutflowRate
      return {
        month: month.month,
        inflow: monthRevenue,
        outflow: monthOutflow,
        netFlow: monthRevenue - monthOutflow
      }
    }) || []
    
    const totalInflow = monthlyData.reduce((sum: number, m: any) => sum + m.inflow, 0)
    const totalOutflow = monthlyData.reduce((sum: number, m: any) => sum + m.outflow, 0)
    const netCashFlow = totalInflow - totalOutflow
    const avgMonthlyFlow = monthlyData.length > 0 
      ? monthlyData.reduce((sum: number, m: any) => sum + m.netFlow, 0) / monthlyData.length
      : 0
    
    // Calculate comparison metrics
    const previousInflow = previousPeriod?.revenue?.gross || 0
    const previousOutflow = previousInflow * actualOutflowRate
    const previousNetFlow = previousInflow - previousOutflow
    
    const inflowGrowth = previousInflow > 0 
      ? ((totalInflow - previousInflow) / previousInflow) * 100
      : 0
    const outflowGrowth = previousOutflow > 0
      ? ((totalOutflow - previousOutflow) / previousOutflow) * 100
      : 0
    const netFlowGrowth = previousNetFlow !== 0
      ? ((netCashFlow - previousNetFlow) / Math.abs(previousNetFlow)) * 100
      : 0
    
    const previousAvgMonthlyFlow = previousPeriod?.monthlyTrend?.length > 0
      ? previousPeriod.monthlyTrend.reduce((sum: number, m: any) => {
          const monthRevenue = m.revenue || m.amount || 0
          const monthOutflow = monthRevenue * actualOutflowRate
          return sum + (monthRevenue - monthOutflow)
        }, 0) / previousPeriod.monthlyTrend.length
      : 0
    
    const avgMonthlyFlowGrowth = previousAvgMonthlyFlow !== 0
      ? ((avgMonthlyFlow - previousAvgMonthlyFlow) / Math.abs(previousAvgMonthlyFlow)) * 100
      : 0
    
    return {
      totalInflow,
      totalOutflow,
      netCashFlow,
      avgMonthlyFlow,
      monthlyData,
      flowRatio: totalInflow > 0 ? (netCashFlow / totalInflow) * 100 : 0,
      totalFees: totalFees,
      totalTaxes: totalTaxes,
      totalOperatingExpenses: totalOperatingExpenses,
      comparison: {
        previousInflow,
        previousOutflow,
        previousNetFlow,
        previousAvgMonthlyFlow,
        inflowGrowth,
        outflowGrowth,
        netFlowGrowth,
        avgMonthlyFlowGrowth,
        periodLabel: comparisonLabel ? `vs ${comparisonLabel}` : ''
      }
    }
  }, [data, comparisonMode, comparisonLabel])
  
  if (loading || !cashFlowData) {
    return (
      <StateWrapper
        loading={loading}
        empty={!cashFlowData && !loading}
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
      {/* Info Banner */}
      {showTips && (
        <div className="bg-info-subtle border border-info/30 rounded-lg p-4">
          <div className="flex items-start">
            <Info className="w-5 h-5 text-info mr-2 mt-0.5" />
            <div className="text-sm text-info-fg">
              <strong>Cash Flow:</strong> Inflows (booking revenue) vs. outflows (platform fees (est.), taxes, expenses) by month.
            </div>
          </div>
        </div>
      )}
      
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <MetricCard
          icon={ArrowUpRight}
          label="Total Inflow"
          value={cashFlowData.totalInflow}
          format="currency"
          color="green"
          staggerIndex={0}
          subValue={comparisonMode !== 'none' && cashFlowData.comparison.previousInflow > 0
            ? <>{cashFlowData.comparison.periodLabel}: {formatCurrency(cashFlowData.comparison.previousInflow)}{comparisonDateRange && <span className="block text-xs text-muted-foreground mt-0.5">{comparisonDateRange}</span>}</>
            : `${cashFlowData.monthlyData.length} months | Avg: ${formatCurrency(cashFlowData.totalInflow / Math.max(cashFlowData.monthlyData.length, 1))}`}
          trend={comparisonMode !== 'none' && cashFlowData.comparison.inflowGrowth !== 0 ? {
            value: cashFlowData.comparison.inflowGrowth,
            isPositive: cashFlowData.comparison.inflowGrowth > 0
          } : undefined}
        />
        <MetricCard
          icon={ArrowDownRight}
          label="Total Outflow"
          value={cashFlowData.totalOutflow}
          format="currency"
          color="red"
          staggerIndex={1}
          subValue={comparisonMode !== 'none' && cashFlowData.comparison.previousOutflow > 0
            ? <>{cashFlowData.comparison.periodLabel}: {formatCurrency(cashFlowData.comparison.previousOutflow)}{comparisonDateRange && <span className="block text-xs text-muted-foreground mt-0.5">{comparisonDateRange}</span>}</>
            : `${formatPercentage(cashFlowData.totalOutflow / Math.max(cashFlowData.totalInflow, 1) * 100, 1)} of inflow | Fees: ${formatCurrency(cashFlowData.totalFees)} + Tax: ${formatCurrency(cashFlowData.totalTaxes)}${cashFlowData.totalOperatingExpenses > 0 ? ` + Expenses: ${formatCurrency(cashFlowData.totalOperatingExpenses)}` : ''}`}
          trend={comparisonMode !== 'none' && cashFlowData.comparison.outflowGrowth !== 0 ? {
            value: cashFlowData.comparison.outflowGrowth,
            isPositive: cashFlowData.comparison.outflowGrowth > 0  // Keep standard: up arrow for increases
          } : undefined}
        />
        <MetricCard
          icon={Wallet}
          label="Net Cash Flow"
          value={cashFlowData.netCashFlow}
          format="currency"
          color={cashFlowData.netCashFlow > 0 ? 'green' : 'red'}
          staggerIndex={2}
          subValue={comparisonMode !== 'none' && cashFlowData.comparison.previousNetFlow !== 0
            ? <>{cashFlowData.comparison.periodLabel}: {formatCurrency(cashFlowData.comparison.previousNetFlow)}{comparisonDateRange && <span className="block text-xs text-muted-foreground mt-0.5">{comparisonDateRange}</span>}</>
            : `${formatPercentage(cashFlowData.flowRatio, 1)} retained | ${cashFlowData.netCashFlow > 0 ? 'Positive' : 'Negative'} flow`}
          trend={comparisonMode !== 'none' && cashFlowData.comparison.netFlowGrowth !== 0 ? {
            value: cashFlowData.comparison.netFlowGrowth,
            isPositive: cashFlowData.comparison.netFlowGrowth > 0
          } : undefined}
        />
        <MetricCard
          icon={TrendingUp}
          label="Average Monthly Flow"
          value={cashFlowData.avgMonthlyFlow}
          format="currency"
          color="blue"
          staggerIndex={3}
          subValue={comparisonMode !== 'none' && cashFlowData.comparison.previousAvgMonthlyFlow !== 0
            ? <>{cashFlowData.comparison.periodLabel}: {formatCurrency(cashFlowData.comparison.previousAvgMonthlyFlow)}{comparisonDateRange && <span className="block text-xs text-muted-foreground mt-0.5">{comparisonDateRange}</span>}</>
            : `Per month | ${cashFlowData.avgMonthlyFlow > 0 ? 'Profitable' : 'Loss'}`}
          trend={comparisonMode !== 'none' && cashFlowData.comparison.avgMonthlyFlowGrowth !== 0 ? {
            value: cashFlowData.comparison.avgMonthlyFlowGrowth,
            isPositive: cashFlowData.comparison.avgMonthlyFlowGrowth > 0
          } : undefined}
        />
      </div>
      
      {/* Cash Flow Chart */}
      <ChartWrapper title={`${detectGranularity(cashFlowData.monthlyData || [], 'month')} Cash Flow`} height={360}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={cashFlowData.monthlyData}
            onClick={(e: any) => {
              if (e && e.activeLabel && onPeriodClick) {
                onPeriodClick(e.activeLabel)
              }
            }}
            style={{ cursor: onPeriodClick ? 'pointer' : 'default' }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_INFRA.grid} />
            <XAxis dataKey="month" stroke={CHART_INFRA.axis} tick={{ fill: CHART_INFRA.axis }} />
            <YAxis tickFormatter={chartFormatters.currency} stroke={CHART_INFRA.axis} tick={{ fill: CHART_INFRA.axis }} />
            <Tooltip content={<CashFlowChartTooltip />} />
            <Area
              type="monotone"
              dataKey="inflow"
              stackId="1"
              stroke={resolveToken('--success')}
              fill={resolveToken('--success')}
              fillOpacity={0.6}
              name="Inflow"
            />
            <Area
              type="monotone"
              dataKey="outflow"
              stackId="2"
              stroke={resolveToken('--danger')}
              fill={resolveToken('--danger')}
              fillOpacity={0.6}
              name="Outflow"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartWrapper>
      
      {/* Cash Flow Health Indicator */}
      <div className={`rounded-lg p-4 ${
        cashFlowData.flowRatio > 70 ? 'bg-success-subtle border-success/30' :
        cashFlowData.flowRatio > 50 ? 'bg-warning-subtle border-warning/30' :
        'bg-danger-subtle border-danger/30'
      } border`}>
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-foreground">Cash Flow Health</h4>
            <p className="text-sm text-muted-foreground mt-1">
              You're retaining {formatPercentage(cashFlowData.flowRatio, 1)} of your revenue after fees, taxes, and expenses
            </p>
          </div>
          <div className={`text-3xl font-bold ${
            cashFlowData.flowRatio > 70 ? 'text-success' :
            cashFlowData.flowRatio > 50 ? 'text-warning' :
            'text-danger'
          }`}>
            {formatPercentage(cashFlowData.flowRatio, 1)}
          </div>
        </div>
      </div>
    </div>
  )
}