import React, { useMemo } from 'react'
import { MetricCard } from '@/components/MetricCard'
import { StateWrapper } from '@/components/StateWrapper'
import { SimpleTable } from '@/components/tables'
import { RevenueChart } from '@/components/charts/RevenueChart'
import { useTips } from '@/hooks/use-tips'
import { Button } from '@/components/ui/button'
import {
  DollarSign, TrendingUp, Calendar,
  Info, ArrowUp, ArrowDown, HelpCircle
} from 'lucide-react'
import { EmptyQuadrants } from '@/components/EmptyQuadrants'
import { formatCurrency } from '@/utils/formatters'
import { usePropertyMetrics, useGoalProgress } from '@/hooks/use-api'
import { getMonthlyGoalValue } from '@/utils/goals'
import { useDashboard } from '@/contexts/dashboard'
import { detectGranularity } from '@/utils/chart-helpers'

interface RevenueAnalysisProps {
  data: any
  loading: boolean
  onPeriodClick?: (period: string) => void
  onPropertyClick?: (propertyId: string) => void
  comparisonMode?: 'none' | 'previous-period' | 'previous-year'
  comparisonDateRange?: string
}

export const RevenueAnalysis: React.FC<RevenueAnalysisProps> = ({
  data,
  loading,
  onPeriodClick,
  onPropertyClick,
  comparisonMode = 'none',
  comparisonDateRange = ''
}) => {
  const { showTips } = useTips()
  const { filters, comparisonLabel } = useDashboard()
  const { data: goalProgressData } = useGoalProgress()
  const revenueGoal = getMonthlyGoalValue(goalProgressData, 'revenue')
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
        emptySubMessage="Select a date range to analyze revenue"
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
              <strong>Revenue Analysis:</strong> Deep dive into your revenue streams, trends, and property performance
            </div>
          </div>
        </div>
      )}
      
      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <MetricCard
          icon={DollarSign}
          label="Total Revenue"
          value={analysis.totalRevenue}
          format="currency"
          color="green"
          subValue={comparisonMode !== 'none' && analysis.previousRevenue
            ? <>{comparisonLabel ? `vs ${comparisonLabel}` : 'vs Previous Period'}: {formatCurrency(analysis.previousRevenue)}{comparisonDateRange && <span className="block text-xs text-muted-foreground mt-0.5">{comparisonDateRange}</span>}</>
            : `Monthly avg: ${formatCurrency(analysis.avgMonthlyRevenue)} | ${analysis.monthlyData.length} months`}
          trend={analysis.revenueGrowth !== 0 ? {
            value: analysis.revenueGrowth,
            isPositive: analysis.revenueGrowth > 0
          } : undefined}
          staggerIndex={0}
        />
        <MetricCard
          icon={Calendar}
          label="Monthly Average"
          value={analysis.avgMonthlyRevenue}
          format="currency"
          color="blue"
          subValue={comparisonMode !== 'none' && analysis.previousAvgMonthlyRevenue > 0
            ? <>{comparisonLabel ? `vs ${comparisonLabel}` : 'vs Previous Period'}: {formatCurrency(analysis.previousAvgMonthlyRevenue)}{comparisonDateRange && <span className="block text-xs text-muted-foreground mt-0.5">{comparisonDateRange}</span>}</>
            : `${analysis.monthlyData.length} months | Best: ${formatCurrency(Math.max(...analysis.monthlyData.map((m: any) => m.revenue || 0)))}`}
          trend={comparisonMode !== 'none' && analysis.avgMonthlyGrowth !== 0 ? {
            value: analysis.avgMonthlyGrowth,
            isPositive: analysis.avgMonthlyGrowth > 0
          } : undefined}
          staggerIndex={1}
        />
        <MetricCard
          icon={ArrowUp}
          label="Best Month"
          value={analysis.monthlyData.length > 0 ? Math.max(...analysis.monthlyData.map((m: any) => m.revenue || 0)) : 0}
          format="currency"
          color="green"
          subValue={analysis.monthlyData.length > 0 ? (() => {
            const best = analysis.monthlyData.reduce((max: any, m: any) => (m.revenue || 0) > (max.revenue || 0) ? m : max, analysis.monthlyData[0])
            if (!best?.month) return undefined
            const [year, month] = best.month.split('-')
            return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
          })() : undefined}
          staggerIndex={2}
        />
        <MetricCard
          icon={ArrowDown}
          label="Lowest Month"
          value={analysis.monthlyData.length > 0 ? Math.min(...analysis.monthlyData.map((m: any) => m.revenue || 0)) : 0}
          format="currency"
          color="yellow"
          subValue={analysis.monthlyData.length > 0 ? (() => {
            const lowest = analysis.monthlyData.reduce((min: any, m: any) => (m.revenue || 0) < (min.revenue || 0) ? m : min, analysis.monthlyData[0])
            if (!lowest?.month) return undefined
            const [year, month] = lowest.month.split('-')
            return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
          })() : undefined}
          staggerIndex={3}
        />
      </div>

      {/* Revenue Trend */}
      <RevenueChart
        data={analysis.monthlyData}
        title={`${analysis.granularity} Revenue Trend`}
        subtitle={analysis.hasComparison
          ? `Comparing current period vs ${comparisonLabel}`
          : undefined
        }
        onPeriodClick={onPeriodClick}
        showComparison={analysis.hasComparison}
        comparisonLabel={comparisonLabel}
        height={360}
        revenueGoal={revenueGoal}
      />
      
      {/* Property Performance Tables */}
      {analysis.topProperties.length === 0 && analysis.bottomProperties.length === 0 ? (
        <div className="bg-muted/40 border rounded-lg p-6 flex flex-col items-center justify-center text-muted-foreground">
          <EmptyQuadrants className="w-12 h-12 mb-2" />
          <p className="text-sm font-medium">No property data available for the selected period</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Select a different date range or check your property sync status</p>
        </div>
      ) : (
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top Performers */}
        <div className="bg-card rounded-lg shadow-sm border p-4">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-lg font-semibold flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-success" />
              Top Performing Properties
            </h3>
            <div className="group relative">
              <HelpCircle className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-help" />
              <div className="absolute right-0 top-6 z-10 w-64 p-3 bg-foreground text-background border-none text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                <p className="font-semibold mb-1">Top Performers</p>
                <p className="mb-2">Properties with the highest revenue in the selected period.</p>
                <p className="text-background/70">Tip: Study what makes these properties successful and apply similar strategies to underperforming properties.</p>
              </div>
            </div>
          </div>
          <SimpleTable
            data={analysis.topProperties}
            columns={[
              {
                key: 'propertyName',
                header: 'Property',
                render: (row: any) => (
                  <Button
                    variant="link"
                    className="px-0 h-auto"
                    onClick={() => onPropertyClick?.(row.propertyId)}
                  >
                    {row.propertyName}
                  </Button>
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
        <div className="bg-card rounded-lg shadow-sm border p-4">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-lg font-semibold flex items-center">
              <ArrowDown className="w-5 h-5 mr-2 text-warning" />
              Properties Needing Attention
            </h3>
            <div className="group relative">
              <HelpCircle className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-help" />
              <div className="absolute right-0 top-6 z-10 w-64 p-3 bg-foreground text-background border-none text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                <p className="font-semibold mb-1">Underperforming Properties</p>
                <p className="mb-2">Properties with the lowest revenue in the selected period.</p>
                <p className="text-background/70">Actions to consider:</p>
                <ul className="text-background/70 ml-2 mt-1">
                  <li>• Review pricing strategy</li>
                  <li>• Improve listing photos/description</li>
                  <li>• Check guest reviews for issues</li>
                  <li>• Consider seasonal adjustments</li>
                </ul>
              </div>
            </div>
          </div>
          <SimpleTable
            data={analysis.bottomProperties}
            columns={[
              {
                key: 'propertyName',
                header: 'Property',
                render: (row: any) => (
                  <Button
                    variant="link"
                    className="px-0 h-auto"
                    onClick={() => onPropertyClick?.(row.propertyId)}
                  >
                    {row.propertyName}
                  </Button>
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