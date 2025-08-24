import React, { useState, useMemo } from 'react'
import { MetricCard } from '@/components/MetricCard'
import { StateWrapper } from '@/components/StateWrapper'
import { SimpleTable } from '@/components/tables'
import { TaxTrendChart } from '@/components/charts/TaxTrendChart'
import { TaxRemittanceWidget } from '@/components/tax/TaxRemittanceWidget'
import { 
  FileText, DollarSign, CheckCircle, Home,
  Info, AlertTriangle
} from 'lucide-react'
import { formatCurrency, formatTaxRate } from '@/utils/formatters'
import { useDashboard } from '@/contexts/dashboard'
import { detectGranularity } from '@/utils/chartUtils'

interface TaxCenterProps {
  data: any
  loading: boolean
  onPropertyClick?: (propertyId: string) => void
  onMonthClick?: (month: string) => void
  comparisonMode?: 'none' | 'previous-period' | 'previous-year'
}

export const TaxCenter: React.FC<TaxCenterProps> = ({
  data,
  loading,
  onPropertyClick,
  onMonthClick
}) => {
  const { filters } = useDashboard()
  const [viewMode, setViewMode] = useState<'summary' | 'detail'>('summary')
  
  const taxData = useMemo(() => {
    if (!data?.tax) return null
    
    const { summary, byProperty, byMonth } = data.tax
    
    // Determine granularity based on data format
    const granularity = detectGranularity(byMonth, 'month')
    
    const totalTax = summary?.totalTax || 0
    const ownerRemitted = summary?.ownerRemitted || summary?.totalTax || 0
    const platformRemitted = summary?.platformRemitted || 0
    
    // Calculate effective tax rate
    const grossRevenue = data.metrics?.revenue?.gross || 0
    const effectiveTaxRate = grossRevenue > 0
      ? (totalTax / grossRevenue) * 100
      : 0
    
    return {
      totalTax,
      ownerRemitted,
      platformRemitted,
      effectiveTaxRate,
      propertyCount: byProperty?.length || 0,
      byProperty: byProperty || [],
      byMonth: byMonth || [],
      granularity
    }
  }, [data])
  
  if (loading || !taxData) {
    return (
      <StateWrapper
        loading={loading}
        empty={!taxData && !loading}
        loadingMessage="Loading tax data..."
        emptyMessage="No tax data available"
        minHeight={300}
      >
        <div />
      </StateWrapper>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
          <div className="text-sm text-blue-800">
            <strong>Tax Tracking:</strong> Monitors occupancy taxes collected from guests that you'll need to pay to local authorities
          </div>
        </div>
      </div>
      
      {/* View Toggle */}
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">Tax Summary</h3>
        <button
          onClick={() => setViewMode(viewMode === 'summary' ? 'detail' : 'summary')}
          className="px-4 py-2 bg-gray-200 rounded-sm hover:bg-gray-300 flex items-center"
        >
          <FileText className="w-4 h-4 mr-2" />
          {viewMode === 'summary' ? 'Property Details' : 'Summary View'}
        </button>
      </div>
      
      {/* Key Metrics */}
      <div className="grid md:grid-cols-4 gap-4">
        <MetricCard
          icon={FileText}
          label="Total Tax Due"
          value={taxData.totalTax}
          format="currency"
          color="green"
          subValue={`${formatTaxRate(taxData.effectiveTaxRate / 100)} rate`}
          tooltip="Total tax liability including platform fees"
        />
        <MetricCard
          icon={DollarSign}
          label="You Remit"
          value={taxData.ownerRemitted}
          format="currency"
          color="blue"
          subValue="Your responsibility"
          tooltip="Tax amount you need to pay directly"
        />
        <MetricCard
          icon={CheckCircle}
          label="Platform Remits"
          value={taxData.platformRemitted}
          format="currency"
          color="green"
          subValue="Paid by platforms"
          tooltip="Tax paid directly by booking platforms"
        />
        <MetricCard
          icon={Home}
          label="Properties"
          value={taxData.propertyCount}
          format="number"
          color="yellow"
          subValue="Being tracked"
          tooltip="Number of properties with tax data"
        />
      </div>
      
      {/* Tax Remittance Widget */}
      <TaxRemittanceWidget
        periodStart={filters.dateRange.from}
        periodEnd={filters.dateRange.to}
      />
      
      {viewMode === 'summary' ? (
        <>
          {/* Tax Trend Chart */}
          <TaxTrendChart
            data={taxData.byMonth}
            title={`${taxData.granularity} Tax Trend`}
            onMonthClick={onMonthClick}
          />
          
          {/* Tax Rate Alert */}
          {taxData.effectiveTaxRate > 15 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <strong>High Tax Rate:</strong> Your effective tax rate is {formatTaxRate(taxData.effectiveTaxRate / 100)}. 
                  Consider reviewing your tax settings and jurisdictions to ensure accuracy.
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Property Tax Details Table */
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="text-lg font-semibold mb-3">Tax by Property</h3>
          <SimpleTable
            data={taxData.byProperty}
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
                key: 'totalTax',
                header: 'Total Tax',
                render: (row: any) => formatCurrency(row.totalTax)
              },
              {
                key: 'taxRate',
                header: 'Tax Rate',
                render: (row: any) => formatTaxRate(row.taxRate)
              },
              {
                key: 'status',
                header: 'Status',
                render: (row: any) => (
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    row.status === 'configured' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {row.status === 'configured' ? 'Configured' : 'Needs Setup'}
                  </span>
                )
              }
            ]}
          />
        </div>
      )}
    </div>
  )
}