import { useState, useMemo, useCallback } from 'react'
import { useDashboardBatch } from '@/hooks/use-api'
import { useTagIds, usePropertyIds, useErrorToast, useComparisonDateRange } from '@/hooks/use-dashboard-utils'
import { useDashboard } from '@/contexts/dashboard'
import { useModal } from '@/contexts/modal'
import { detectGranularity, formatChartDate } from '@/utils/chart-helpers'
import {} from '@baileys/utils'

import { StateWrapper } from '@/components/StateWrapper'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { PLView } from '@/components/financial/PLView'
import { CashFlowView } from '@/components/financial/CashFlowView'
import { TaxCenter } from '@/components/financial/TaxCenter'

export const FinancialDashboard = () => {
  const { filters, comparisonRange, comparisonMode } = useDashboard()
  const { openModal } = useModal()
  const [activeTab, setActiveTab] = useState('pl')
  
  const tagIds = useTagIds()
  const propertyIds = usePropertyIds()

  const { data, error, isLoading } = useDashboardBatch(
    'financial',
    filters.dateRange.from,
    filters.dateRange.to,
    tagIds,
    comparisonRange?.from,
    comparisonRange?.to,
    propertyIds
  )
  
  const financialData = useMemo(() => data ? {
    metrics: data.pl.metrics,
    platforms: data.pl.platforms,
    monthlyTrend: data.pl.monthlyTrend,
    weeklyRevenue: data.pl.weeklyRevenue,
    previousPeriod: data.pl.previousPeriod,
    byMonth: data.pl.monthlyTrend,
    chargeComposition: data.pl.chargeComposition
  } : null, [data])

  const cashFlowData = useMemo(() => data ? {
    metrics: data.pl.metrics,
    byMonth: data.revenue.byMonth,
    platforms: data.pl.platforms,
    previousPeriod: data.cashflow?.previousPeriod || data.pl.previousPeriod,
    fees: data.revenue.fees,
    taxes: data.revenue.taxes,
    gross: data.revenue.gross,
    net: data.revenue.net,
    operatingExpenses: data.pl.metrics.operatingExpenses?.total || 0
  } : null, [data])

  const taxData = useMemo(() => data ? {
    tax: {
      summary: data.tax.summary,
      byProperty: data.tax.byProperty,
      byMonth: data.tax.byMonth
    },
    metrics: data.pl.metrics,
    previousPeriod: data.tax?.previousPeriod || data.pl.previousPeriod
  } : null, [data])

  const comparisonDateRange = useComparisonDateRange()

  useErrorToast(error, 'Failed to load financial data')

  const handlePeriodClick = useCallback((dateStr: string) => {
    let chartData: Array<Record<string, string | number | undefined>> = []
    
    switch (activeTab) {
      case 'pl':
        chartData = financialData?.monthlyTrend || []
        break
      case 'cashflow':
        chartData = cashFlowData?.byMonth || []
        break
      case 'tax_center':
        chartData = taxData?.tax?.byMonth || []
        break
    }
    
    const detectedGranularity = detectGranularity(chartData, 'month')
    
    let year: string = new Date().getFullYear().toString()
    let month: string = (new Date().getMonth() + 1).toString().padStart(2, '0')
    let day: string | undefined
    let granularity: 'daily' | 'weekly' | 'monthly'
    
    // Convert DateGranularity type to lowercase for modal
    switch (detectedGranularity) {
      case 'Daily':
        granularity = 'daily'
        break
      case 'Weekly':
        granularity = 'weekly'
        break
      case 'Monthly':
      default:
        granularity = 'monthly'
        break
    }
    
    // Parse the date string based on expected format
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Format: YYYY-MM-DD (daily data)
      const parts = dateStr.split('-')
      year = parts[0]
      month = parts[1]
      day = parts[2]
    } else if (dateStr.includes('Week')) {
      // Format: Week of YYYY-MM-DD or similar weekly format
      const match = dateStr.match(/\d{4}-\d{2}-\d{2}/)
      if (match) {
        const parts = match[0].split('-')
        year = parts[0]
        month = parts[1]
        day = parts[2]
      } else {
        // Fallback for weekly without clear date
        const date = new Date()
        year = date.getFullYear().toString()
        month = (date.getMonth() + 1).toString().padStart(2, '0')
      }
    } else if (dateStr.match(/^\d{4}-\d{2}$/)) {
      // Format: YYYY-MM (monthly data)
      [year, month] = dateStr.split('-')
    } else {
      // Try to parse other formats (e.g., "Jun 22" or "Jan 2024")
      // First, try to find the original date from the chart data
      const dataPoint = chartData.find(d => typeof d.month === 'string' && formatChartDate(d.month) === dateStr)

      if (dataPoint && typeof dataPoint.month === 'string') {
        const originalDateStr = dataPoint.month
        if (originalDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const parts = originalDateStr.split('-')
          year = parts[0]
          month = parts[1]
          day = parts[2]
        } else if (originalDateStr.match(/^\d{4}-\d{2}$/)) {
          [year, month] = originalDateStr.split('-')
        }
      } else {
        // Fallback: Parse the formatted date
        // For dates like "Jun 22", add current year
        let parseStr = dateStr
        if (dateStr.match(/^[A-Za-z]{3} \d{1,2}$/)) {
          // Format like "Jun 22" - add current year
          const currentYear = new Date().getFullYear()
          parseStr = `${dateStr}, ${currentYear}`
        }
        
        const date = new Date(parseStr)
        if (!isNaN(date.getTime())) {
          year = date.getFullYear().toString()
          month = (date.getMonth() + 1).toString().padStart(2, '0')
          // For daily or weekly granularity, we need the day
          if (granularity === 'daily' || granularity === 'weekly') {
            day = date.getDate().toString().padStart(2, '0')
          }
        } else {
          // Final fallback
          const now = new Date()
          year = now.getFullYear().toString()
          month = (now.getMonth() + 1).toString().padStart(2, '0')
        }
      }
    }
    
    // Open modal with full date context
    openModal({
      type: 'period',
      month,
      year,
      day,
      originalDate: dateStr,
      granularity
    })
  }, [activeTab, financialData?.monthlyTrend, cashFlowData?.byMonth, taxData?.tax?.byMonth, openModal])

  const handlePropertyClick = useCallback((propertyId: string) => {
    openModal({ type: 'property', propertyId, propertyName: '' })
  }, [openModal])

  if (isLoading || error || !data) {
    return (
      <StateWrapper
        loading={isLoading}
        error={error}
        empty={!data && !isLoading && !error}
        loadingMessage="Loading financial data..."
        emptyMessage="No financial data available"
        onRetry={() => window.location.reload()}
        minHeight={400}
        className="py-12"
      >
        <div />
      </StateWrapper>
    )
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Financial Center</h2>
                <p className="text-muted-foreground text-sm mt-1 hidden sm:block">
                  Track your vacation rental income, expenses, and profitability
                </p>
              </div>
            </div>
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="pl">P&L View</TabsTrigger>
              <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
              <TabsTrigger value="tax_center">Tax Center</TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="pl" className="mt-6"><PLView data={financialData} loading={isLoading} onPeriodClick={handlePeriodClick} comparisonMode={comparisonMode} comparisonDateRange={comparisonDateRange} /></TabsContent>
        <TabsContent value="cashflow" className="mt-6"><CashFlowView data={cashFlowData} loading={isLoading} onPeriodClick={handlePeriodClick} comparisonMode={comparisonMode} comparisonDateRange={comparisonDateRange} /></TabsContent>
        <TabsContent value="tax_center" className="mt-6"><TaxCenter data={taxData} loading={isLoading} onPropertyClick={handlePropertyClick} onPeriodClick={handlePeriodClick} comparisonMode={comparisonMode} comparisonDateRange={comparisonDateRange} /></TabsContent>
      </Tabs>
    </div>
  )
}