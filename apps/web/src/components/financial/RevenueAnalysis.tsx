import React, { useMemo } from 'react'
import { MetricCard } from '@/components/MetricCard'
import { StateWrapper } from '@/components/StateWrapper'
import { SimpleTable } from '@/components/tables'
import { RevenueChart } from '@/components/charts/RevenueChart'
import { useTips } from '@/hooks/use-tips'
import { 
  DollarSign, TrendingUp, Calendar,
  Info, ArrowUp, ArrowDown, HelpCircle
} from 'lucide-react'
import { formatCurrency } from '@/utils/formatters'
import { usePropertyMetrics } from '@/hooks/use-api'
import { useDashboard } from '@/contexts/dashboard'
import { detectGranularity } from '@/utils/chart-helpers'

interface RevenueAnalysisProps {
  data: any
  loading: boolean
  onPeriodClick?: (period: string) => void
  onPropertyClick?: (propertyId: string) => void
  comparisonMode?: 'none' | 'previous-period' | 'previous-year'
}

export const RevenueAnalysis: React.FC<RevenueAnalysisProps> = ({
  data,
  loading,
  onPeriodClick,
  onPropertyClick,
  comparisonMode = 'none'
}) => {
  const { showTips } = useTips()
  const { filters } = useDashboard()
  const tagIds = filters.selectedTags.map(t => t.id)
  
  // Fetch property metrics for property-level revenue data
  const { data: propertyData } = usePropertyMetrics(
    filters.dateRange.from,
    filters.dateRange.to,
    tagIds
  )
  
  const analysis = useMemo(() => {
    if (!data) return null
    
    const { metrics, byMonth, previousPeriod, gross } = data
    
    // Determine granularity based on data format
    const granularity = detectGranularity(byMonth, 'month')
    
    // Calculate key metrics
    const totalRevenue = gross || metrics?.revenue?.gross || 0
    const avgMonthlyRevenue = byMonth?.length > 0 
      ? byMonth.reduce((sum: number, m: any) => sum + (m.amount || m.revenue || 0), 0) / byMonth.length
      : 0
    
    const previousMonthlyData = previousPeriod?.monthlyTrend || []
    const previousAvgMonthlyRevenue = previousMonthlyData.length > 0
      ? previousMonthlyData.reduce((sum: number, m: any) => sum + (m.revenue || m.amount || 0), 0) / previousMonthlyData.length
      : 0
    
    const avgMonthlyGrowth = previousAvgMonthlyRevenue > 0
      ? ((avgMonthlyRevenue - previousAvgMonthlyRevenue) / previousAvgMonthlyRevenue) * 100
      : 0
    
    // Find best/worst performing properties using propertyData
    const properties = Array.isArray(propertyData) ? propertyData : (propertyData?.metrics || propertyData?.properties || [])
    const sortedProperties = [...properties]
      .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
    
    const topProperties = sortedProperties.slice(0, 3)
    const bottomProperties = sortedProperties.slice(-3).reverse()
    
    // Calculate growth
    const revenueGrowth = previousPeriod?.revenue?.gross
      ? ((totalRevenue - previousPeriod.revenue.gross) / previousPeriod.revenue.gross) * 100
      : 0
    
    // Process monthly data with comparison data
    const monthlyData = byMonth?.map((m: any, index: number) => {
      // Try to find matching previous period data by month or by index
      // The previousPeriod.monthlyTrend now has the comparison data
      const prevData = previousPeriod?.monthlyTrend?.find((pm: any) => pm.month === m.month) ||
                      previousPeriod?.monthlyTrend?.[index]
      
      // Extract revenue values - handle different field names
      const currentRevenue = m.amount || m.revenue || m.gross || 0
      const previousRevenue = prevData ? (prevData.revenue || prevData.amount || prevData.gross || 0) : undefined
      
      return {
        ...m,
        revenue: currentRevenue,
        previousRevenue
      }
    }) || []
    
    return {
      totalRevenue,
      avgMonthlyRevenue,
      avgMonthlyGrowth,
      previousAvgMonthlyRevenue,
      revenueGrowth,
      previousRevenue: previousPeriod?.revenue?.gross || 0,
      topProperties,
      bottomProperties,
      monthlyData,
      granularity,
      hasComparison: comparisonMode !== 'none' && previousPeriod && monthlyData.some((m: any) => m.previousRevenue !== undefined)
    }
  }, [data, propertyData, comparisonMode])
  
  if (loading || !analysis) {
    return (
      <StateWrapper
        loading={loading}
        empty={!analysis && !loading}
        loadingMessage="Analyzing revenue data..."
        emptyMessage="No revenue data available"
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
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start">
            <Info className="w-5 h-5 text-green-600 mr-2 mt-0.5" />
            <div className="text-sm text-green-800">
              <strong>Revenue Analysis:</strong> Deep dive into your revenue streams, trends, and property performance
            </div>
          </div>
        </div>
      )}
      
      {/* Summary Metrics */}
      <div className="grid md:grid-cols-4 gap-4">
        <MetricCard
          icon={DollarSign}
          label="Total Revenue"
          value={analysis.totalRevenue}
          format="currency"
          color="green"
          subValue={comparisonMode !== 'none' && analysis.previousRevenue
            ? `${comparisonMode === 'previous-year' ? 'vs Last Year' : 'vs Previous Period'}: ${formatCurrency(analysis.previousRevenue)} | Monthly avg: ${formatCurrency(analysis.avgMonthlyRevenue)}`
            : `Monthly avg: ${formatCurrency(analysis.avgMonthlyRevenue)} | ${analysis.monthlyData.length} months`}
          trend={analysis.revenueGrowth !== 0 ? {
            value: analysis.revenueGrowth,
            isPositive: analysis.revenueGrowth > 0
          } : undefined}
        />
        <MetricCard
          icon={Calendar}
          label="Monthly Average"
          value={analysis.avgMonthlyRevenue}
          format="currency"
          color="blue"
          subValue={comparisonMode !== 'none' && analysis.previousAvgMonthlyRevenue > 0
            ? `${comparisonMode === 'previous-year' ? 'vs Last Year' : 'vs Previous Period'}: ${formatCurrency(analysis.previousAvgMonthlyRevenue)} | ${analysis.monthlyData.length} months`
            : `${analysis.monthlyData.length} months | Best: ${formatCurrency(Math.max(...analysis.monthlyData.map((m: any) => m.revenue || 0)))}`}
          trend={comparisonMode !== 'none' && analysis.avgMonthlyGrowth !== 0 ? {
            value: analysis.avgMonthlyGrowth,
            isPositive: analysis.avgMonthlyGrowth > 0
          } : undefined}
        />
        <MetricCard
          icon={ArrowUp}
          label="Best Month"
          value={analysis.monthlyData.length > 0 ? Math.max(...analysis.monthlyData.map((m: any) => m.revenue || 0)) : 0}
          format="currency"
          color="green"
        />
        <MetricCard
          icon={ArrowDown}
          label="Lowest Month"
          value={analysis.monthlyData.length > 0 ? Math.min(...analysis.monthlyData.map((m: any) => m.revenue || 0)) : 0}
          format="currency"
          color="yellow"
        />
      </div>
      
      {/* Revenue Trend */}
      <RevenueChart
        data={analysis.monthlyData}
        title={`${analysis.granularity} Revenue Trend`}
        subtitle={analysis.hasComparison 
          ? `Comparing current period vs ${comparisonMode === 'previous-year' ? 'last year' : 'previous period'}`
          : undefined
        }
        onPeriodClick={onPeriodClick}
        showComparison={analysis.hasComparison}
        comparisonMode={comparisonMode}
      />
      
      {/* Property Performance Tables */}
      {analysis.topProperties.length === 0 && analysis.bottomProperties.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <Info className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">No property data available for the selected period.</p>
          <p className="text-sm text-gray-500 mt-1">Select a different date range or check your property sync status.</p>
        </div>
      ) : (
      <div className="grid md:grid-cols-2 gap-6">
        {/* Top Performers */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-lg font-semibold flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
              Top Performing Properties
            </h3>
{showTips && (
              <div className="group relative">
                <HelpCircle className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" />
                <div className="absolute right-0 top-6 z-10 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                  <p className="font-semibold mb-1">Top Performers</p>
                  <p className="mb-2">Properties with the highest revenue in the selected period.</p>
                  <p className="text-gray-300">💡 Tip: Study what makes these properties successful and apply similar strategies to underperforming properties.</p>
                </div>
              </div>
            )}
          </div>
          <SimpleTable
            data={analysis.topProperties}
            columns={[
              { 
                key: 'propertyName', 
                header: 'Property',
                render: (row: any) => (
                  <button
                    onClick={() => onPropertyClick?.(row.propertyId)}
                    className="text-blue-600 hover:underline text-left"
                  >
                    {row.propertyName}
                  </button>
                )
              },
              { 
                key: 'revenue', 
                header: 'Revenue',
                render: (row: any) => formatCurrency(row.revenue || 0)
              },
              {
                key: 'bookings',
                header: 'Bookings',
                render: (row: any) => (row.bookings || 0).toString()
              }
            ]}
          />
        </div>
        
        {/* Properties Needing Attention */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-lg font-semibold flex items-center">
              <ArrowDown className="w-5 h-5 mr-2 text-yellow-600" />
              Properties Needing Attention
            </h3>
{showTips && (
              <div className="group relative">
                <HelpCircle className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" />
                <div className="absolute right-0 top-6 z-10 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                  <p className="font-semibold mb-1">Underperforming Properties</p>
                  <p className="mb-2">Properties with the lowest revenue in the selected period.</p>
                  <p className="text-gray-300">💡 Actions to consider:</p>
                  <ul className="text-gray-300 ml-2 mt-1">
                    <li>• Review pricing strategy</li>
                    <li>• Improve listing photos/description</li>
                    <li>• Check guest reviews for issues</li>
                    <li>• Consider seasonal adjustments</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
          <SimpleTable
            data={analysis.bottomProperties}
            columns={[
              { 
                key: 'propertyName', 
                header: 'Property',
                render: (row: any) => (
                  <button
                    onClick={() => onPropertyClick?.(row.propertyId)}
                    className="text-blue-600 hover:underline text-left"
                  >
                    {row.propertyName}
                  </button>
                )
              },
              { 
                key: 'revenue', 
                header: 'Revenue',
                render: (row: any) => formatCurrency(row.revenue || 0)
              },
              {
                key: 'bookings',
                header: 'Bookings',
                render: (row: any) => (row.bookings || 0).toString()
              }
            ]}
          />
        </div>
      </div>
      )}
    </div>
  )
}