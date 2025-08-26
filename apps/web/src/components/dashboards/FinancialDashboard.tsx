import { useState, useEffect, ReactNode, FC } from 'react'
import { useFinancial } from '@/hooks/use-api'
import { useDashboard } from '@/contexts/dashboard'
import { useModal } from '@/contexts/modal'
import { useToast } from '@/contexts/toast'

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

  const handleMonthClick = (dateStr: string) => {
    // Handle different date formats
    let year: string
    let month: string
    
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Format: YYYY-MM-DD (daily or weekly data)
      [year, month] = dateStr.split('-')
    } else if (dateStr.match(/^\d{4}-\d{2}$/)) {
      // Format: YYYY-MM (monthly data)
      [year, month] = dateStr.split('-')
    } else {
      // Fallback for unexpected formats
      const date = new Date()
      year = date.getFullYear().toString()
      month = (date.getMonth() + 1).toString().padStart(2, '0')
    }
    
    // Open modal with the parsed date information
    openModal({ 
      type: 'month', 
      month, 
      year
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
          {activeTab === 'pl' && <PLView data={financialData} loading={isLoading} onMonthClick={handleMonthClick} comparisonMode={comparisonMode} />}
          {activeTab === 'revenue_analysis' && <RevenueAnalysis data={revenueData} loading={isLoading} onMonthClick={handleMonthClick} onPropertyClick={handlePropertyClick} comparisonMode={comparisonMode} />}
          {activeTab === 'cashflow' && <CashFlowView data={cashFlowData} loading={isLoading} onMonthClick={handleMonthClick} comparisonMode={comparisonMode} />}
          {activeTab === 'tax_center' && <TaxCenter data={taxData} loading={isLoading} onPropertyClick={handlePropertyClick} onMonthClick={handleMonthClick} comparisonMode={comparisonMode} />}
        </div>
      </div>
    </div>
  )
}

export default FinancialDashboard