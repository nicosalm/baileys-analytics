import { useState, useEffect, ReactNode, FC } from 'react'
import { useFinancial } from '@/hooks/use-api'
import { useDashboard } from '@/contexts/dashboard'
import { useModal } from '@/contexts/modal'
import { useToast } from '@/contexts/toast'
import { detectGranularity, formatChartDate } from '@/utils/chart-helpers'

import { PLView } from '@/components/financial/PLView'
import { RevenueAnalysis } from '@/components/financial/RevenueAnalysis'
import { CashFlowView } from '@/components/financial/CashFlowView'
import { TaxCenter } from '@/components/financial/TaxCenter'

interface TabButtonProps {
  active: boolean
  onClick: () => void
  children: ReactNode
}

const TabButton: FC<TabButtonProps> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-6 py-3 font-medium text-sm ${
      active
        ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
    }`}
  >
    {children}
  </button>
)

const FinancialDashboard = () => {
  const { addToast } = useToast()
  const { filters, comparisonRange, comparisonMode } = useDashboard()
  const { openModal } = useModal()
  const [activeTab, setActiveTab] = useState('pl')
  
  const tagIds = filters.selectedTags.map(t => t.id)
  const { data, error, isLoading } = useFinancial(
    filters.dateRange.from,
    filters.dateRange.to,
    tagIds,
    comparisonRange?.from,
    comparisonRange?.to
  )
  
  // Process data for each tab from the unified response
  const financialData = data ? {
    metrics: data.pl.metrics,
    platforms: data.pl.platforms,
    monthlyTrend: data.pl.monthlyTrend,
    weeklyRevenue: data.pl.weeklyRevenue,
    previousPeriod: data.pl.previousPeriod,
    byMonth: data.pl.monthlyTrend
  } : null

  const revenueData = data ? {
    metrics: data.pl.metrics,
    gross: data.revenue.gross,
    net: data.revenue.net,
    taxes: data.revenue.taxes,
    fees: data.revenue.fees,
    bySource: data.revenue.bySource,
    byMonth: data.revenue.byMonth,
    byProperty: [], // Properties data not available in revenue endpoint
    lastYearData: data.revenue.lastYearData,
    previousPeriod: data.pl.previousPeriod
  } : null

  const cashFlowData = data ? {
    metrics: data.pl.metrics,
    byMonth: data.revenue.byMonth,
    platforms: data.pl.platforms,
    previousPeriod: data.pl.previousPeriod,
    fees: data.revenue.fees,
    taxes: data.revenue.taxes,
    gross: data.revenue.gross,
    net: data.revenue.net
  } : null

  const taxData = data ? {
    tax: {
      summary: data.tax.summary,
      byProperty: data.tax.byProperty,
      byMonth: data.tax.byMonth
    },
    metrics: data.pl.metrics,
    previousPeriod: data.pl.previousPeriod
  } : null

  useEffect(() => {
    if (error) {
      addToast('error', `Failed to load financial data: ${error.message}`)
    }
  }, [error?.message, addToast])

  const handlePeriodClick = (dateStr: string) => {
    // Detect the granularity based on the current data
    // This ensures we match what the chart is displaying
    let chartData: any[] = []
    
    // Get the appropriate data based on active tab
    switch (activeTab) {
      case 'pl':
        chartData = financialData?.monthlyTrend || []
        break
      case 'revenue_analysis':
        chartData = revenueData?.byMonth || []
        break
      case 'cashflow':
        chartData = cashFlowData?.byMonth || []
        break
      case 'tax_center':
        chartData = taxData?.tax?.byMonth || []
        break
    }
    
    const detectedGranularity = detectGranularity(chartData, 'month')
    
    // Handle different date formats based on detected granularity
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
      const dataPoint = chartData.find(d => formatChartDate(d.month) === dateStr)
      
      if (dataPoint && dataPoint.month) {
        // Found the original date, parse it properly
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
  }

  const handlePropertyClick = (propertyId: string) => {
    openModal({ type: 'property', propertyId, propertyName: '' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Financial Center</h2>
        <p className="text-gray-600 text-sm mt-1">
          Track your vacation rental income, expenses, and profitability
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex overflow-x-auto border-b">
          <TabButton active={activeTab === 'pl'} onClick={() => setActiveTab('pl')}>
            P&L View
          </TabButton>
          <TabButton active={activeTab === 'revenue_analysis'} onClick={() => setActiveTab('revenue_analysis')}>
            Revenue Analysis
          </TabButton>
          <TabButton active={activeTab === 'cashflow'} onClick={() => setActiveTab('cashflow')}>
            Cash Flow
          </TabButton>
          <TabButton active={activeTab === 'tax_center'} onClick={() => setActiveTab('tax_center')}>
            Tax Center
          </TabButton>
        </div>

        <div className="p-6">
          {activeTab === 'pl' && <PLView data={financialData} loading={isLoading} onMonthClick={handlePeriodClick} comparisonMode={comparisonMode} />}
          {activeTab === 'revenue_analysis' && <RevenueAnalysis data={revenueData} loading={isLoading} onMonthClick={handlePeriodClick} onPropertyClick={handlePropertyClick} comparisonMode={comparisonMode} />}
          {activeTab === 'cashflow' && <CashFlowView data={cashFlowData} loading={isLoading} onMonthClick={handlePeriodClick} comparisonMode={comparisonMode} />}
          {activeTab === 'tax_center' && <TaxCenter data={taxData} loading={isLoading} onPropertyClick={handlePropertyClick} onMonthClick={handlePeriodClick} comparisonMode={comparisonMode} />}
        </div>
      </div>
    </div>
  )
}

export default FinancialDashboard