import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { MetricCard } from '@/components/MetricCard'
import { StateWrapper } from '@/components/StateWrapper'
import { RevenueChart } from '@/components/charts/RevenueChart'
import { PlatformDistributionChart } from '@/components/charts/PlatformDistributionChart'
import { useTips } from '@/hooks/use-tips'
import { useGoalProgress } from '@/hooks/use-api'
import { getMonthlyGoalValue } from '@/utils/goals'
import {
  DollarSign, Wallet, Receipt,
  Info, Landmark, TrendingDown
} from 'lucide-react'
import { formatPercentage, formatCurrency } from '@/utils/formatters'
import { detectGranularity } from '@/utils/chart-helpers'
import { useDashboard } from '@/contexts/dashboard'

interface PLViewProps {
  data: any
  loading: boolean
  onPeriodClick?: (period: string) => void
  comparisonMode?: 'none' | 'previous-period' | 'previous-year'
  comparisonDateRange?: string
}

export const PLView: React.FC<PLViewProps> = ({
  data,
  loading,
  onPeriodClick,
  comparisonMode = 'none',
  comparisonDateRange = ''
}) => {
  const { showTips } = useTips()
  const { comparisonLabel } = useDashboard()
  const { data: goalProgressData } = useGoalProgress()
  const revenueGoal = getMonthlyGoalValue(goalProgressData, 'revenue')

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
    const operatingExpenses = metrics.operatingExpenses || { total: 0, byCategory: {} }
    const operatingProfit = metrics.operatingProfit ?? (netRevenue - operatingExpenses.total)
    
    const totalCosts = platformFees + operatingExpenses.total
    const operatingMargin = grossRevenue > 0
      ? ((operatingProfit / grossRevenue) * 100)
      : 0

    const profitMargin = grossRevenue > 0
      ? ((netRevenue / grossRevenue) * 100)
      : 0

    const revenueGrowth = previousPeriod?.revenue?.gross
      ? ((grossRevenue - previousPeriod.revenue.gross) / previousPeriod.revenue.gross) * 100
      : 0

    const profitGrowth = previousPeriod?.revenue?.net
      ? ((netRevenue - previousPeriod.revenue.net) / previousPeriod.revenue.net) * 100
      : 0

    const previousOperatingExpenses = previousPeriod?.operatingExpenses || { total: 0, byCategory: {} }
    const previousTotalCosts = (previousPeriod?.revenue?.platformFees || 0) + previousOperatingExpenses.total
    const costsGrowth = previousTotalCosts > 0
      ? ((totalCosts - previousTotalCosts) / previousTotalCosts) * 100
      : 0

    const previousTaxes = previousPeriod?.revenue?.taxes || 0
    const taxesGrowth = previousTaxes > 0
      ? ((taxes - previousTaxes) / previousTaxes) * 100
      : 0

    const previousOperatingProfit = previousPeriod?.operatingProfit ?? ((previousPeriod?.revenue?.net || 0) - previousOperatingExpenses.total)
    const operatingProfitGrowth = previousOperatingProfit > 0
      ? ((operatingProfit - previousOperatingProfit) / previousOperatingProfit) * 100
      : 0

    const previousProfitMargin = previousPeriod?.revenue?.gross > 0
      ? ((previousPeriod.revenue.net / previousPeriod.revenue.gross) * 100)
      : 0

    const profitMarginChange = previousProfitMargin > 0
      ? profitMargin - previousProfitMargin
      : 0
    
    const platformData = platforms?.map((p: any) => ({
      name: p.platform || 'Unassigned',
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
        taxes,
        operatingExpenses,
        operatingProfit,
        totalCosts
      },
      profitability: {
        marginPercent: profitMargin,
        operatingMargin
      },
      comparison: {
        revenueGrowth,
        profitGrowth,
        costsGrowth,
        taxesGrowth,
        operatingProfitGrowth,
        profitMarginChange,
        previousRevenue: previousPeriod?.revenue?.gross || 0,
        previousProfit: previousPeriod?.revenue?.net || 0,
        previousTotalCosts,
        previousTaxes,
        previousOperatingProfit,
        previousProfitMargin,
        periodLabel: comparisonLabel ? `vs ${comparisonLabel}` : '',
        hasComparison: comparisonMode !== 'none' && previousPeriod && monthlyData.some((m: any) => m.previousRevenue !== undefined)
      },
      platforms: platformData,
      monthly: monthlyData,
      granularity
    }
  }, [data, comparisonMode, comparisonLabel])
  
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
              <strong>P&L Summary:</strong> Revenue → Platform Fees → Operating Expenses → Taxes → Net Revenue.{' '}
              {revenue.operatingExpenses.total > 0
                ? `Operating margin: ${formatPercentage(profitability.operatingMargin, 1)}.`
                : <>Configure <Link to="/settings?tab=platform-fees" className="underline hover:text-blue-900">Platform Fees</Link> and <Link to="/settings?tab=expenses" className="underline hover:text-blue-900">Expenses</Link> in Settings for a complete picture.</>}
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
          subValue={comparisonMode !== 'none' && comparison.previousRevenue > 0
            ? <>{comparison.periodLabel}: {formatCurrency(comparison.previousRevenue)}{comparisonDateRange && <span className="block text-xs text-gray-400 mt-0.5">{comparisonDateRange}</span>}</>
            : `${platforms.length} platform${platforms.length !== 1 ? 's' : ''}`}
          trend={comparisonMode !== 'none' && comparison.previousRevenue > 0 ? {
            value: comparison.revenueGrowth,
            isPositive: comparison.revenueGrowth > 0
          } : undefined}
        />
        <MetricCard
          icon={Receipt}
          label="Expenses & Platform Fees"
          value={revenue.totalCosts}
          format="currency"
          tooltip="Platform fees plus operating expenses"
          color="orange"
          subValue={comparisonMode !== 'none' && comparison.previousTotalCosts > 0
            ? <>{comparison.periodLabel}: {formatCurrency(comparison.previousTotalCosts)}{comparisonDateRange && <span className="block text-xs text-gray-400 mt-0.5">{comparisonDateRange}</span>}</>
            : `Fees: ${formatCurrency(revenue.platformFees)}${revenue.operatingExpenses.total > 0 ? ` | Expenses: ${formatCurrency(revenue.operatingExpenses.total)}` : ''}`}
          trend={comparisonMode !== 'none' && comparison.costsGrowth !== 0 ? {
            value: comparison.costsGrowth,
            isPositive: comparison.costsGrowth < 0
          } : undefined}
        />
        <MetricCard
          icon={Landmark}
          label="Taxes"
          value={revenue.taxes}
          format="currency"
          tooltip="Taxes collected on bookings"
          color="yellow"
          subValue={comparisonMode !== 'none' && comparison.previousTaxes > 0
            ? <>{comparison.periodLabel}: {formatCurrency(comparison.previousTaxes)}{comparisonDateRange && <span className="block text-xs text-gray-400 mt-0.5">{comparisonDateRange}</span>}</>
            : revenue.gross > 0 ? `${formatPercentage((revenue.taxes / revenue.gross) * 100, 1)} effective rate` : '0% effective rate'}
          trend={comparisonMode !== 'none' && comparison.taxesGrowth !== 0 ? {
            value: comparison.taxesGrowth,
            isPositive: comparison.taxesGrowth < 0
          } : undefined}
        />
        <MetricCard
          icon={Wallet}
          label="Net Revenue"
          value={revenue.operatingProfit}
          format="currency"
          tooltip="Revenue after fees, expenses, and taxes"
          color={profitability.operatingMargin > 70 ? 'green' : profitability.operatingMargin > 50 ? 'yellow' : 'red'}
          subValue={comparisonMode !== 'none' && comparison.previousOperatingProfit > 0
            ? <>{comparison.periodLabel}: {formatCurrency(comparison.previousOperatingProfit)}{comparisonDateRange && <span className="block text-xs text-gray-400 mt-0.5">{comparisonDateRange}</span>}</>
            : `${formatPercentage(profitability.operatingMargin, 1)} margin${revenue.operatingExpenses.total === 0 ? ' (excl. expenses)' : ''}`}
          trend={comparisonMode !== 'none' && comparison.operatingProfitGrowth !== 0 ? {
            value: comparison.operatingProfitGrowth,
            isPositive: comparison.operatingProfitGrowth > 0
          } : undefined}
        />
      </div>
      
      {/* P&L Chart - Direct without wrapper */}
      <RevenueChart
        data={monthly}
        title={`${granularity} Profit & Loss Trend`}
        subtitle={comparison.hasComparison
          ? `Comparing with ${comparisonLabel}`
          : undefined
        }
        showProfit={true}
        showComparison={comparison.hasComparison}
        comparisonLabel={comparisonLabel}
        onPeriodClick={onPeriodClick}
        height={360}
        revenueGoal={revenueGoal}
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
              {revenue.operatingExpenses.total > 0 && (
                <div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Operating Expenses</span>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(revenue.operatingExpenses.total)}</p>
                      <p className="text-xs text-gray-500">{formatPercentage((revenue.operatingExpenses.total / revenue.gross) * 100, 1)} of revenue</p>
                    </div>
                  </div>
                  {Object.keys(revenue.operatingExpenses.byCategory).length > 0 && (
                    <div className="ml-4 mt-2 space-y-1.5 border-l-2 border-gray-200 pl-3">
                      {Object.entries(revenue.operatingExpenses.byCategory).map(([category, amount]) => (
                        <div key={category} className="flex justify-between items-center">
                          <span className="text-xs text-gray-500 capitalize">{category}</span>
                          <span className="text-xs font-medium text-gray-600">{formatCurrency(amount as number)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="border-t pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-900">Total Costs</span>
                  <div className="text-right">
                    <p className="font-bold text-red-600">{formatCurrency(revenue.platformFees + revenue.taxes + revenue.operatingExpenses.total)}</p>
                    <p className="text-xs text-gray-500">{formatPercentage(((revenue.platformFees + revenue.taxes + revenue.operatingExpenses.total) / revenue.gross) * 100, 1)} of revenue</p>
                  </div>
                </div>
              </div>
              {revenue.operatingExpenses.total > 0 && (
                <div className="border-t-2 border-green-200 pt-3 mt-1 bg-green-50 -mx-4 px-4 py-3 rounded-b-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-green-900">Operating Profit</span>
                    <div className="text-right">
                      <p className="font-bold text-lg text-green-700">{formatCurrency(revenue.operatingProfit)}</p>
                      <p className="text-xs text-green-600">{formatPercentage((revenue.operatingProfit / revenue.gross) * 100, 1)} margin</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      
      {/* Charge Composition Breakdown */}
      {data?.chargeComposition && data.chargeComposition.details.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Revenue Component Breakdown</h4>
          <p className="text-sm text-gray-500 mb-4">Itemized charges from booking data (taxes, fees, discounts)</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {data.chargeComposition.taxes > 0 && (
              <div className="bg-red-50 rounded-lg p-3">
                <div className="text-xs text-red-600 font-medium">Taxes</div>
                <div className="text-lg font-bold text-red-700">{formatCurrency(data.chargeComposition.taxes)}</div>
              </div>
            )}
            {data.chargeComposition.fees > 0 && (
              <div className="bg-amber-50 rounded-lg p-3">
                <div className="text-xs text-amber-600 font-medium">Fees</div>
                <div className="text-lg font-bold text-amber-700">{formatCurrency(data.chargeComposition.fees)}</div>
              </div>
            )}
            {data.chargeComposition.discounts > 0 && (
              <div className="bg-green-50 rounded-lg p-3">
                <div className="text-xs text-green-600 font-medium">Discounts</div>
                <div className="text-lg font-bold text-green-700">-{formatCurrency(data.chargeComposition.discounts)}</div>
              </div>
            )}
            {data.chargeComposition.other > 0 && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-600 font-medium">Other</div>
                <div className="text-lg font-bold text-gray-700">{formatCurrency(data.chargeComposition.other)}</div>
              </div>
            )}
          </div>
          <div className="space-y-2">
            {data.chargeComposition.details.slice(0, 10).map((detail: any, i: number) => (
              <div key={i} className="flex justify-between items-center text-sm py-1 border-b border-gray-100 last:border-0">
                <span className="text-gray-600 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    detail.type === 'tax' ? 'bg-red-400' :
                    detail.type === 'fee' ? 'bg-amber-400' :
                    detail.type === 'discount' ? 'bg-green-400' :
                    'bg-gray-400'
                  }`} />
                  {detail.description}
                  <span className="text-xs text-gray-400">({detail.count} bookings)</span>
                </span>
                <span className="font-medium">{formatCurrency(detail.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showTips && profitability.operatingMargin < 60 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <TrendingDown className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <strong>Optimization Opportunity:</strong> Your operating margin is {formatPercentage(profitability.operatingMargin, 1)}.
              Consider reviewing platform fees and exploring direct booking options to retain more revenue.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}