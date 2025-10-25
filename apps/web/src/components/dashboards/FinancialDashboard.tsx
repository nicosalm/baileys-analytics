import { useState, ReactNode, FC } from 'react'
import { useDashboardBatch } from '@/hooks/use-api'
import { useTagIds, useErrorToast } from '@/hooks/use-dashboard-utils'
import { useDashboard } from '@/contexts/dashboard'
import { useModal } from '@/contexts/modal'
import { detectGranularity, formatChartDate } from '@/utils/chart-helpers'
import { formatCompactCurrency } from '@baileys/utils'

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
    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
      active
        ? 'bg-white text-gray-900 shadow-sm'
        : 'text-gray-600 hover:text-gray-900'
    }`}
  >
    {children}
  </button>
)

export const FinancialDashboard = () => {
  const { filters, comparisonRange, comparisonMode } = useDashboard()
  const { openModal } = useModal()
  const [activeTab, setActiveTab] = useState('pl')
  
  const tagIds = useTagIds()
  
  const { data, error, isLoading } = useDashboardBatch(
    'financial',
    filters.dateRange.from,
    filters.dateRange.to,
    tagIds,
    comparisonRange?.from,
    comparisonRange?.to
  )
  
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
    previousPeriod: data.revenue.previousPeriod || data.pl.previousPeriod
  } : null

  const cashFlowData = data ? {
    metrics: data.pl.metrics,
    byMonth: data.revenue.byMonth,
    platforms: data.pl.platforms,
    previousPeriod: data.cashflow?.previousPeriod || data.pl.previousPeriod,
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
    previousPeriod: data.tax?.previousPeriod || data.pl.previousPeriod
  } : null

  useErrorToast(error, 'Failed to load financial data')

  const handlePeriodClick = (dateStr: string) => {
    let chartData: any[] = []
    
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
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Financial Center</h2>
            <p className="text-gray-600 text-sm mt-1">
              Track your vacation rental income, expenses, and profitability
            </p>
          </div>
          <div className="flex items-center gap-3">
            {financialData?.metrics && (
              <>
                <div className="text-right">
                  <div className="text-xs text-gray-500">Net Revenue</div>
                  <div className="text-lg font-bold text-green-600">
                    {formatCompactCurrency(financialData.metrics.revenue?.net || 0)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">Gross Revenue</div>
                  <div className="text-lg font-bold text-gray-900">
                    {formatCompactCurrency(financialData.metrics.revenue?.gross || 0)}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Financial Analysis</h3>
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
            <TabButton active={activeTab === 'pl'} onClick={() => setActiveTab('pl')}>
              P&L View
            </TabButton>
            <TabButton active={activeTab === 'revenue_analysis'} onClick={() => setActiveTab('revenue_analysis')}>
              Revenue
            </TabButton>
            <TabButton active={activeTab === 'cashflow'} onClick={() => setActiveTab('cashflow')}>
              Cash Flow
            </TabButton>
            <TabButton active={activeTab === 'tax_center'} onClick={() => setActiveTab('tax_center')}>
              Tax Center
            </TabButton>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'pl' && <PLView data={financialData} loading={isLoading} onPeriodClick={handlePeriodClick} comparisonMode={comparisonMode} />}
          {activeTab === 'revenue_analysis' && <RevenueAnalysis data={revenueData} loading={isLoading} onPeriodClick={handlePeriodClick} onPropertyClick={handlePropertyClick} comparisonMode={comparisonMode} />}
          {activeTab === 'cashflow' && <CashFlowView data={cashFlowData} loading={isLoading} onPeriodClick={handlePeriodClick} comparisonMode={comparisonMode} />}
          {activeTab === 'tax_center' && <TaxCenter data={taxData} loading={isLoading} onPropertyClick={handlePropertyClick} onPeriodClick={handlePeriodClick} comparisonMode={comparisonMode} />}
        </div>
      </div>
    </div>
  )
}