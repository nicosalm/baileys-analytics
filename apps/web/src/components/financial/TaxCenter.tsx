import React, { useMemo } from 'react'
import { MetricCard } from '@/components/MetricCard'
import { StateWrapper } from '@/components/StateWrapper'
import { SimpleTable } from '@/components/tables'
import { TaxTrendChart } from '@/components/charts/TaxTrendChart'
import { TaxRemittanceWidget } from '@/components/tax/TaxRemittanceWidget'
import { useTips } from '@/hooks/use-tips'
import { 
  FileText, DollarSign, CheckCircle, Home,
  Info, AlertTriangle, Building
} from 'lucide-react'
import { formatCurrency, formatTaxRate } from '@/utils/formatters'
import { useDashboard } from '@/contexts/dashboard'
import { detectGranularity } from '@/utils/chart-helpers'

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
  onMonthClick,
  comparisonMode = 'none'
}) => {
  const { showTips } = useTips()
  const { filters } = useDashboard()
  
  const taxData = useMemo(() => {
    if (!data?.tax) return null
    
    const { summary, byProperty, byMonth } = data.tax
    const previousPeriod = data.previousPeriod
    
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
    
    // Calculate comparison metrics
    const previousGross = previousPeriod?.revenue?.gross || 0
    const previousTaxes = previousPeriod?.revenue?.taxes || 0
    const previousEffectiveRate = previousGross > 0 
      ? (previousTaxes / previousGross) * 100
      : 0
    
    const taxGrowth = previousTaxes > 0
      ? ((totalTax - previousTaxes) / previousTaxes) * 100
      : 0
    
    return {
      totalTax,
      ownerRemitted,
      platformRemitted,
      effectiveTaxRate,
      propertyCount: byProperty?.length || 0,
      byProperty: byProperty || [],
      byMonth: byMonth || [],
      granularity,
      comparison: {
        previousTaxes,
        previousEffectiveRate,
        taxGrowth,
        periodLabel: comparisonMode === 'previous-year' ? 'vs Last Year' : 
                     comparisonMode === 'previous-period' ? 'vs Previous Period' : ''
      }
    }
  }, [data, comparisonMode])
  
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
      {showTips && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
            <div className="text-sm text-blue-800">
              <strong>Tax Tracking:</strong> Monitors occupancy taxes collected from guests that you'll need to pay to local authorities
            </div>
          </div>
        </div>
      )}
      
      {/* Key Metrics */}
      <div className="grid md:grid-cols-4 gap-4">
        <MetricCard
          icon={FileText}
          label="Total Tax Due"
          value={taxData.totalTax}
          format="currency"
          color="green"
          subValue={comparisonMode !== 'none' && taxData.comparison.previousTaxes > 0
            ? `${taxData.comparison.periodLabel}: ${formatCurrency(taxData.comparison.previousTaxes)} | ${formatTaxRate(taxData.effectiveTaxRate / 100)} rate`
            : `${formatTaxRate(taxData.effectiveTaxRate / 100)} rate`}
          tooltip="Total tax liability including platform fees"
          trend={comparisonMode !== 'none' && taxData.comparison.taxGrowth !== 0 ? {
            value: taxData.comparison.taxGrowth,
            isPositive: taxData.comparison.taxGrowth > 0  // Keep standard: up arrow for increases
          } : undefined}
        />
        <MetricCard
          icon={DollarSign}
          label="You Remit"
          value={taxData.ownerRemitted}
          format="currency"
          color="blue"
          subValue={comparisonMode !== 'none' && taxData.comparison.previousTaxes > 0
            ? `${taxData.comparison.periodLabel}: ${formatCurrency(taxData.comparison.previousTaxes * (taxData.ownerRemitted / Math.max(taxData.totalTax, 1)))}`
            : "Your responsibility"}
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
      
      {/* Tax Trend Chart */}
      <TaxTrendChart
        data={taxData.byMonth}
        title={`${taxData.granularity} Tax Trend`}
        onMonthClick={onMonthClick}
      />
      
      {/* Tax Remittance and Property Details Side by Side */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Tax Remittance Widget */}
        <TaxRemittanceWidget
          periodStart={filters.dateRange.from}
          periodEnd={filters.dateRange.to}
        />
        
        {/* Property Tax Details Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <div>
              <h3 className="font-semibold text-gray-900 flex items-center">
                <Building className="w-4 h-4 mr-2" />
                Tax by Property
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {taxData.propertyCount} {taxData.propertyCount === 1 ? 'property' : 'properties'} with tax data
              </p>
            </div>
          </div>
          <div className="p-4">
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
        </div>
      </div>
      
      {/* Tax Rate Alert */}
      {showTips && taxData.effectiveTaxRate > 15 && (
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
    </div>
  )
}