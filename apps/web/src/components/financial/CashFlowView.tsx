import React, { useMemo } from 'react'
import { MetricCard } from '@/components/MetricCard'
import { StateWrapper } from '@/components/StateWrapper'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartWrapper } from '@/components/ChartWrapper'
import { 
  TrendingUp, Wallet,
  Info, ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import { formatPercentage, formatCurrency } from '@/utils/formatters'
import { chartFormatters, tooltipFormatters } from '@/utils/chart-helpers'
import { METRIC_COLORS } from '@/lib/theme'

interface CashFlowViewProps {
  data: any
  loading: boolean
  onMonthClick?: (month: string) => void
  comparisonMode?: 'none' | 'previous-period' | 'previous-year'
}

export const CashFlowView: React.FC<CashFlowViewProps> = ({
  data,
  loading,
  onMonthClick
}) => {
  const cashFlowData = useMemo(() => {
    if (!data) return null
    
    const { byMonth } = data
    
    // Calculate cash flow metrics
    const monthlyData = byMonth?.map((month: any) => ({
      month: month.month,
      inflow: month.revenue || month.amount || 0,
      outflow: month.revenue ? month.revenue * 0.3 : 0, // Approximate fees at 30%
      netFlow: month.revenue ? month.revenue * 0.7 : 0
    })) || []
    
    const totalInflow = monthlyData.reduce((sum: number, m: any) => sum + m.inflow, 0)
    const totalOutflow = monthlyData.reduce((sum: number, m: any) => sum + m.outflow, 0)
    const netCashFlow = totalInflow - totalOutflow
    const avgMonthlyFlow = monthlyData.length > 0 
      ? monthlyData.reduce((sum: number, m: any) => sum + m.netFlow, 0) / monthlyData.length
      : 0
    
    return {
      totalInflow,
      totalOutflow,
      netCashFlow,
      avgMonthlyFlow,
      monthlyData,
      flowRatio: totalInflow > 0 ? (netCashFlow / totalInflow) * 100 : 0
    }
  }, [data])
  
  if (loading || !cashFlowData) {
    return (
      <StateWrapper
        loading={loading}
        empty={!cashFlowData && !loading}
        loadingMessage="Loading cash flow data..."
        emptyMessage="No cash flow data available"
        minHeight={300}
      >
        <div />
      </StateWrapper>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div className="flex items-start">
          <Info className="w-5 h-5 text-purple-600 mr-2 mt-0.5" />
          <div className="text-sm text-purple-800">
            <strong>Cash Flow:</strong> Track money coming in (revenue) versus money going out (fees, taxes) to understand your liquidity
          </div>
        </div>
      </div>
      
      {/* Key Metrics */}
      <div className="grid md:grid-cols-4 gap-4">
        <MetricCard
          icon={ArrowUpRight}
          label="Total Inflow"
          value={cashFlowData.totalInflow}
          format="currency"
          color="green"
          subValue={`${cashFlowData.monthlyData.length} months | Avg: ${formatCurrency(cashFlowData.totalInflow / Math.max(cashFlowData.monthlyData.length, 1))}`}
        />
        <MetricCard
          icon={ArrowDownRight}
          label="Total Outflow"
          value={cashFlowData.totalOutflow}
          format="currency"
          color="red"
          subValue={`${formatPercentage(cashFlowData.totalOutflow / cashFlowData.totalInflow * 100, 1)} of inflow | Fees & taxes`}
        />
        <MetricCard
          icon={Wallet}
          label="Net Cash Flow"
          value={cashFlowData.netCashFlow}
          format="currency"
          color={cashFlowData.netCashFlow > 0 ? 'green' : 'red'}
          subValue={`${formatPercentage(cashFlowData.flowRatio, 1)} retained | ${cashFlowData.netCashFlow > 0 ? 'Positive' : 'Negative'} flow`}
        />
        <MetricCard
          icon={TrendingUp}
          label="Avg Monthly Flow"
          value={cashFlowData.avgMonthlyFlow}
          format="currency"
          color="blue"
          subValue={`Per month | ${cashFlowData.avgMonthlyFlow > 0 ? 'Profitable' : 'Loss'}`}
        />
      </div>
      
      {/* Cash Flow Chart */}
      <ChartWrapper title="Monthly Cash Flow" height={300}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={cashFlowData.monthlyData}
            onClick={(e: any) => {
              if (e && e.activeLabel && onMonthClick) {
                onMonthClick(e.activeLabel)
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={chartFormatters.currency} />
            <Tooltip formatter={tooltipFormatters.currency} />
            <Area
              type="monotone"
              dataKey="inflow"
              stackId="1"
              stroke={METRIC_COLORS.success}
              fill={METRIC_COLORS.success}
              fillOpacity={0.6}
              name="Inflow"
            />
            <Area
              type="monotone"
              dataKey="outflow"
              stackId="2"
              stroke={METRIC_COLORS.danger}
              fill={METRIC_COLORS.danger}
              fillOpacity={0.6}
              name="Outflow"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartWrapper>
      
      {/* Cash Flow Health Indicator */}
      <div className={`rounded-lg p-4 ${
        cashFlowData.flowRatio > 70 ? 'bg-green-50 border-green-200' :
        cashFlowData.flowRatio > 50 ? 'bg-yellow-50 border-yellow-200' :
        'bg-red-50 border-red-200'
      } border`}>
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-gray-900">Cash Flow Health</h4>
            <p className="text-sm text-gray-600 mt-1">
              You're retaining {formatPercentage(cashFlowData.flowRatio, 1)} of your revenue after fees and taxes
            </p>
          </div>
          <div className={`text-3xl font-bold ${
            cashFlowData.flowRatio > 70 ? 'text-green-600' :
            cashFlowData.flowRatio > 50 ? 'text-yellow-600' :
            'text-red-600'
          }`}>
            {formatPercentage(cashFlowData.flowRatio, 1)}
          </div>
        </div>
      </div>
    </div>
  )
}