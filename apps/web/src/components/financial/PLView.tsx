import React, { useMemo } from 'react'
import { MetricCard } from '@/components/MetricCard'
import { StateWrapper } from '@/components/StateWrapper'
import { RevenueChart } from '@/components/charts/RevenueChart'
import { PlatformDistributionChart } from '@/components/charts/PlatformDistributionChart'
import { 
  DollarSign, Wallet, Receipt, 
  Info, Target, TrendingDown 
} from 'lucide-react'
import { formatPercentage, formatCurrency } from '@/utils/formatters'
import { detectGranularity } from '@/utils/chartUtils'

interface PLViewProps {
  data: any
  loading: boolean
  onMonthClick?: (month: string) => void
  comparisonMode?: 'none' | 'previous-period' | 'previous-year'
}

export const PLView: React.FC<PLViewProps> = ({
  data,
  loading,
  onMonthClick,
  comparisonMode = 'none'
}) => {
  
  const processedData = useMemo(() => {
    if (!data || !data.metrics) return null
    
    const { metrics, platforms, previousPeriod, monthlyTrend } = data
    
    // Determine granularity based on data format
    const granularity = detectGranularity(monthlyTrend, 'month')
    
    // Access data exactly as the original did
    const grossRevenue = metrics.revenue?.gross || 0
    const netRevenue = metrics.revenue?.net || 0
    const platformFees = metrics.revenue?.platformFees || 0
    const taxes = metrics.revenue?.taxes || 0
    
    const profitMargin = grossRevenue > 0 
      ? ((netRevenue / grossRevenue) * 100)
      : 0
    
    const revenueGrowth = previousPeriod?.revenue?.gross 
      ? ((grossRevenue - previousPeriod.revenue.gross) / previousPeriod.revenue.gross) * 100
      : 0
    
    const profitGrowth = previousPeriod?.revenue?.net
      ? ((netRevenue - previousPeriod.revenue.net) / previousPeriod.revenue.net) * 100
      : 0
    
    const platformData = platforms?.map((p: any) => ({
      name: p.platform || 'Direct',
      revenue: p.grossRevenue || 0,
      percentage: grossRevenue > 0 ? (p.grossRevenue / grossRevenue) * 100 : 0
    })) || []
    
    const monthlyData = monthlyTrend?.map((m: any) => ({
      month: m.month,
      revenue: m.revenue || 0,
      profit: m.revenue * 0.7 || 0, // Approximate profit at 70% of revenue
      taxes: 0
    })) || []
    
    return {
      revenue: {
        gross: grossRevenue,
        net: netRevenue,
        platformFees,
        taxes
      },
      profitability: {
        marginPercent: profitMargin
      },
      comparison: {
        revenueGrowth,
        profitGrowth,
        previousRevenue: previousPeriod?.revenue?.gross || 0,
        previousProfit: previousPeriod?.revenue?.net || 0,
        periodLabel: comparisonMode === 'previous-year' ? 'vs Last Year' : 
                     comparisonMode === 'previous-period' ? 'vs Previous Period' : ''
      },
      platforms: platformData,
      monthly: monthlyData,
      granularity
    }
  }, [data, comparisonMode])
  
  if (loading || !processedData) {
    return (
      <StateWrapper
        loading={loading}
        error={null}
        empty={!data && !loading}
        loadingMessage="Loading profit & loss data..."
        emptyMessage="No financial data available"
        minHeight={300}
      >
        <div />
      </StateWrapper>
    )
  }
  
  const { revenue, profitability, comparison, platforms, monthly, granularity } = processedData
  
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
          <div className="text-sm text-blue-800">
            <strong>Profit & Loss:</strong> Shows your actual earnings after all platform fees and costs are deducted
          </div>
        </div>
      </div>
      
      <div className="grid md:grid-cols-4 gap-4">
        <MetricCard
          icon={DollarSign}
          label="Gross Revenue"
          value={revenue.gross}
          format="currency"
          color="blue"
          subValue={comparisonMode !== 'none' && comparison.previousRevenue > 0
            ? `${comparison.periodLabel}: ${formatCurrency(comparison.previousRevenue)} | Net: ${formatCurrency(revenue.net)}`
            : `Net: ${formatCurrency(revenue.net)} | Fees: ${formatCurrency(revenue.platformFees)}`}
          trend={comparisonMode !== 'none' && comparison.revenueGrowth !== 0 ? {
            value: comparison.revenueGrowth,
            isPositive: comparison.revenueGrowth > 0
          } : undefined}
        />
        <MetricCard
          icon={Wallet}
          label="Net Profit"
          value={revenue.net}
          format="currency"
          color="green"
          subValue={comparisonMode !== 'none' && comparison.previousProfit > 0
            ? `${comparison.periodLabel}: ${formatCurrency(comparison.previousProfit)} | ${formatPercentage(profitability.marginPercent, 1)} margin`
            : `${formatPercentage(profitability.marginPercent, 1)} margin | After ${formatCurrency(revenue.platformFees)} fees`}
          trend={comparisonMode !== 'none' && comparison.profitGrowth !== 0 ? {
            value: comparison.profitGrowth,
            isPositive: comparison.profitGrowth > 0
          } : undefined}
        />
        <MetricCard
          icon={Receipt}
          label="Platform Fees"
          value={revenue.platformFees}
          format="currency"
          color="yellow"
          subValue={`${formatPercentage((revenue.platformFees / revenue.gross) * 100, 1)} of revenue | ${platforms.length} platforms`}
          tooltip="Fees charged by booking platforms"
        />
        <MetricCard
          icon={Target}
          label="Profit Margin"
          value={profitability.marginPercent}
          format="percent"
          color={profitability.marginPercent > 70 ? 'green' : profitability.marginPercent > 50 ? 'yellow' : 'red'}
          subValue={`Target: 70% | ${profitability.marginPercent > 70 ? 'Above' : 'Below'} target`}
          tooltip="Percentage of revenue kept after all costs"
        />
      </div>
      
      <div className="grid md:grid-cols-2 gap-6">
        <RevenueChart
          data={monthly}
          title={`${granularity} P&L Trend`}
          showProfit={true}
          onMonthClick={onMonthClick}
        />
        <PlatformDistributionChart
          data={platforms}
          title="Revenue by Platform"
        />
      </div>
      
      {profitability.marginPercent < 60 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <TrendingDown className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <strong>Optimization Opportunity:</strong> Your profit margin is {formatPercentage(profitability.marginPercent, 1)}. 
              Consider reviewing platform fees and exploring direct booking options to improve profitability.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}