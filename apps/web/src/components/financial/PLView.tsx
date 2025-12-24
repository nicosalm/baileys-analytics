import React, { useMemo } from 'react'
import { MetricCard } from '@/components/MetricCard'
import { StateWrapper } from '@/components/StateWrapper'
import { RevenueChart } from '@/components/charts/RevenueChart'
import { PlatformDistributionChart } from '@/components/charts/PlatformDistributionChart'
import { useTips } from '@/hooks/use-tips'
import { 
  DollarSign, Wallet, Receipt, 
  Info, Target, TrendingDown 
} from 'lucide-react'
import { formatPercentage, formatCurrency } from '@/utils/formatters'
import { detectGranularity } from '@/utils/chart-helpers'

interface PLViewProps {
  data: any
  loading: boolean
  onPeriodClick?: (period: string) => void
  comparisonMode?: 'none' | 'previous-period' | 'previous-year'
}

export const PLView: React.FC<PLViewProps> = ({
  data,
  loading,
  onPeriodClick,
  comparisonMode = 'none'
}) => {
  const { showTips } = useTips()
  
  const processedData = useMemo(() => {
    if (!data || !data.metrics) return null
    
    const { metrics, platforms, previousPeriod, monthlyTrend } = data
    
    // Determine granularity based on data format
    const granularity = detectGranularity(monthlyTrend, 'month')
    
    // Access data exactly as the original did
    const grossRevenue = metrics.revenue?.gross || 0
    const netRevenue = metrics.revenue?.net || 0
    const platformFees = metrics.revenue?.platformFees || 0
    const hostFees = metrics.revenue?.hostFees || 0
    const guestFees = metrics.revenue?.guestFees || 0
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
    
    const previousProfitMargin = previousPeriod?.revenue?.gross > 0
      ? ((previousPeriod.revenue.net / previousPeriod.revenue.gross) * 100)
      : 0
    
    const profitMarginChange = previousProfitMargin > 0
      ? profitMargin - previousProfitMargin
      : 0
    
    const platformData = platforms?.map((p: any) => ({
      name: p.platform || 'Direct',
      revenue: p.grossRevenue || 0,
      percentage: grossRevenue > 0 ? (p.grossRevenue / grossRevenue) * 100 : 0
    })) || []
    
    const monthlyData = monthlyTrend?.map((m: any, index: number) => {
      // Find matching previous period data
      const prevData = previousPeriod?.monthlyTrend?.find((pm: any) => pm.month === m.month) ||
                      previousPeriod?.monthlyTrend?.[index]
      
      const monthRevenue = m.revenue || 0
      const monthFees = monthRevenue * (platformFees / Math.max(grossRevenue, 1))
      const monthTaxes = monthRevenue * (taxes / Math.max(grossRevenue, 1))
      const monthProfit = monthRevenue - monthFees - monthTaxes
      
      return {
        month: m.month,
        revenue: monthRevenue,
        platformFees: monthFees,
        taxes: monthTaxes,
        profit: monthProfit,
        costs: monthFees + monthTaxes,
        previousRevenue: prevData ? (prevData.revenue || 0) : undefined,
        previousProfit: prevData ? ((prevData.revenue || 0) * 0.7) : undefined
      }
    }) || []
    
    return {
      revenue: {
        gross: grossRevenue,
        net: netRevenue,
        platformFees,
        hostFees,
        guestFees,
        taxes
      },
      profitability: {
        marginPercent: profitMargin
      },
      comparison: {
        revenueGrowth,
        profitGrowth,
        profitMarginChange,
        previousRevenue: previousPeriod?.revenue?.gross || 0,
        previousProfit: previousPeriod?.revenue?.net || 0,
        previousProfitMargin,
        periodLabel: comparisonMode === 'previous-year' ? 'vs Last Year' : 
                     comparisonMode === 'previous-period' ? 'vs Previous Period' : '',
        hasComparison: comparisonMode !== 'none' && previousPeriod && monthlyData.some((m: any) => m.previousRevenue !== undefined)
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
        emptySubMessage="Select a date range to view your P&L"
        minHeight={300}
      >
        <div />
      </StateWrapper>
    )
  }
  
  const { revenue, profitability, comparison, platforms, monthly, granularity } = processedData
  
  return (
    <div className="space-y-6">
      {showTips && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
            <div className="text-sm text-blue-800">
              <strong>Revenue Summary:</strong> Shows revenue after platform fees and taxes. Does not include operating expenses like cleaning, management, or utilities.
            </div>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <MetricCard
          icon={DollarSign}
          label="Total Revenue"
          value={revenue.gross}
          format="currency"
          tooltip="Total revenue from all bookings in selected period"
          color="blue"
          subValue={comparisonMode !== 'none' && comparison.previousRevenue !== undefined
            ? `${comparison.periodLabel}: ${formatCurrency(comparison.previousRevenue)} | Net: ${formatCurrency(revenue.net)}`
            : `Net: ${formatCurrency(revenue.net)} | Fees: ${formatCurrency(revenue.platformFees)}`}
          trend={comparisonMode !== 'none' && comparison.previousRevenue !== undefined ? {
            value: comparison.revenueGrowth,
            isPositive: comparison.revenueGrowth > 0
          } : undefined}
        />
        <MetricCard
          icon={Wallet}
          label="Net Revenue"
          value={revenue.net}
          format="currency"
          tooltip="Revenue after platform fees and taxes (does not include operating expenses)"
          color="green"
          subValue={comparisonMode !== 'none' && comparison.previousProfit > 0
            ? `${comparison.periodLabel}: ${formatCurrency(comparison.previousProfit)}`
            : `${formatPercentage(profitability.marginPercent, 1)} retained | After ${formatCurrency(revenue.platformFees)} fees`}
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
          label="Net Margin"
          value={profitability.marginPercent}
          format="percent"
          color={profitability.marginPercent > 70 ? 'green' : profitability.marginPercent > 50 ? 'yellow' : 'red'}
          subValue={comparisonMode !== 'none' && comparison.previousProfitMargin > 0
            ? `${comparison.periodLabel}: ${comparison.previousProfitMargin.toFixed(1)}% | Target: 70%`
            : `Target: 70% | ${profitability.marginPercent > 70 ? 'Above' : 'Below'} target`}
          tooltip="Percentage of revenue kept after fees and taxes"
          trend={comparisonMode !== 'none' && comparison.profitMarginChange !== 0 ? {
            value: comparison.profitMarginChange,
            isPositive: comparison.profitMarginChange > 0
          } : undefined}
        />
      </div>
      
      {/* P&L Chart - Direct without wrapper */}
      <RevenueChart
        data={monthly}
        title={`${granularity} Profit & Loss Trend`}
        subtitle={comparison.hasComparison 
          ? `Comparing with ${comparisonMode === 'previous-year' ? 'last year' : 'previous period'}`
          : undefined
        }
        showProfit={true}
        showComparison={comparison.hasComparison}
        comparisonMode={comparisonMode}
        onPeriodClick={onPeriodClick}
        height={360}
      />
      
      {/* Platform Distribution (2/3) and Cost Breakdown (1/3) */}
      <div className="grid lg:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <PlatformDistributionChart
              data={platforms}
              title="Revenue by Platform"
            />
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h4 className="font-semibold text-gray-900 mb-3">Cost Breakdown</h4>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Platform Fees</span>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(revenue.platformFees)}</p>
                    <p className="text-xs text-gray-500">{formatPercentage((revenue.platformFees / revenue.gross) * 100, 1)} of revenue</p>
                  </div>
                </div>
                {(revenue.hostFees > 0 || revenue.guestFees > 0) && (
                  <div className="ml-4 mt-2 space-y-1.5 border-l-2 border-gray-200 pl-3">
                    {revenue.hostFees > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">Host Service Fees</span>
                        <span className="text-xs font-medium text-gray-600">{formatCurrency(revenue.hostFees)}</span>
                      </div>
                    )}
                    {revenue.guestFees > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">Guest Service Fees</span>
                        <span className="text-xs font-medium text-gray-600">{formatCurrency(revenue.guestFees)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Taxes</span>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(revenue.taxes)}</p>
                  <p className="text-xs text-gray-500">{formatPercentage((revenue.taxes / revenue.gross) * 100, 1)} of revenue</p>
                </div>
              </div>
              <div className="border-t pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-900">Total Costs</span>
                  <div className="text-right">
                    <p className="font-bold text-red-600">{formatCurrency(revenue.platformFees + revenue.taxes)}</p>
                    <p className="text-xs text-gray-500">{formatPercentage(((revenue.platformFees + revenue.taxes) / revenue.gross) * 100, 1)} of revenue</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      
      {showTips && profitability.marginPercent < 60 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <TrendingDown className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <strong>Optimization Opportunity:</strong> Your net margin is {formatPercentage(profitability.marginPercent, 1)}.
              Consider reviewing platform fees and exploring direct booking options to retain more revenue.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}