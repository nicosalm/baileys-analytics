import React, { useMemo } from 'react'
import { MetricCard } from '@/components/MetricCard'
import { StateWrapper } from '@/components/StateWrapper'
import { SimpleTable } from '@/components/tables'
import { TaxTrendChart } from '@/components/charts/TaxTrendChart'
import { TaxRemittanceWidget } from '@/components/tax/TaxRemittanceWidget'
import { useTips } from '@/hooks/use-tips'
import {
  FileText, DollarSign, CheckCircle, Home,
  Info, AlertTriangle, Building, Download
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatPercentage } from '@/utils/formatters'
import { useDashboard } from '@/contexts/dashboard'
import { detectGranularity } from '@/utils/chart-helpers'
import { authenticatedFetch } from '@/lib/api'
import { useToast } from '@/contexts/toast'

interface TaxCenterProps {
  data: any
  loading: boolean
  onPropertyClick?: (propertyId: string) => void
  onPeriodClick?: (period: string) => void
  comparisonMode?: 'none' | 'previous-period' | 'previous-year'
  comparisonDateRange?: string
}

export const TaxCenter: React.FC<TaxCenterProps> = ({
  data,
  loading,
  onPropertyClick,
  onPeriodClick,
  comparisonMode = 'none',
  comparisonDateRange = ''
}) => {
  const { showTips } = useTips()
  const { filters, comparisonLabel } = useDashboard()
  const { addToast } = useToast()

  const handleDownloadTaxReport = async () => {
    try {
      const response = await authenticatedFetch(`/tax/export?from=${filters.dateRange.from}&to=${filters.dateRange.to}`, {
        method: 'GET'
      })

      if (!response.ok) {
        throw new Error('Failed to download report')
      }

      const csvData = await response.text()
      const blob = new Blob([csvData], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tax-report-${filters.dateRange.from}-to-${filters.dateRange.to}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      addToast('success', 'Tax report downloaded')
    } catch (error) {
      addToast('error', 'Failed to download tax report')
    }
  }
  
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
    
    const previousOwnerRemitted = previousTaxes * (ownerRemitted / Math.max(totalTax, 1))
    const ownerRemittedGrowth = previousOwnerRemitted > 0
      ? ((ownerRemitted - previousOwnerRemitted) / previousOwnerRemitted) * 100
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
        previousOwnerRemitted,
        previousEffectiveRate,
        taxGrowth,
        ownerRemittedGrowth,
        periodLabel: comparisonLabel ? `vs ${comparisonLabel}` : ''
      }
    }
  }, [data, comparisonMode, comparisonLabel])
  
  if (loading || !taxData) {
    return (
      <StateWrapper
        loading={loading}
        empty={!taxData && !loading}
        loadingMessage="Loading tax data..."
        emptyMessage="No tax data available"
        emptySubMessage="Select a date range to view tax information"
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
              <strong>Tax Tracking:</strong> Occupancy taxes collected from guests in the selected period. Includes both what you remit and what platforms remit on your behalf.
            </div>
          </div>
        </div>
      )}

      {/* Download Report Button */}
      <div className="flex justify-end">
        <Button onClick={handleDownloadTaxReport}>
          <Download className="w-4 h-4" />
          Download Tax Report (CSV)
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <MetricCard
          icon={FileText}
          label="Total Tax Due"
          value={taxData.totalTax}
          format="currency"
          color="green"
          subValue={comparisonMode !== 'none' && taxData.comparison.previousTaxes > 0
            ? <>{taxData.comparison.periodLabel}: {formatCurrency(taxData.comparison.previousTaxes)}{comparisonDateRange && <span className="block text-xs text-muted-foreground mt-0.5">{comparisonDateRange}</span>}</>
            : `${formatPercentage(taxData.effectiveTaxRate, 2)} rate`}
          tooltip="Total occupancy tax collected in selected period"
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
          subValue={comparisonMode !== 'none' && taxData.comparison.previousOwnerRemitted > 0
            ? <>{taxData.comparison.periodLabel}: {formatCurrency(taxData.comparison.previousOwnerRemitted)}{comparisonDateRange && <span className="block text-xs text-muted-foreground mt-0.5">{comparisonDateRange}</span>}</>
            : "Your responsibility"}
          tooltip="Tax you are responsible for remitting to authorities"
          trend={comparisonMode !== 'none' && taxData.comparison.ownerRemittedGrowth !== 0 ? {
            value: taxData.comparison.ownerRemittedGrowth,
            isPositive: taxData.comparison.ownerRemittedGrowth > 0
          } : undefined}
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
        onPeriodClick={onPeriodClick}
      />
      
      {/* Tax Remittance and Property Details Side by Side */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Tax Remittance Widget */}
        <TaxRemittanceWidget
          periodStart={filters.dateRange.from}
          periodEnd={filters.dateRange.to}
        />
        
        {/* Property Tax Details Table */}
        <div className="bg-card rounded-lg shadow-sm border">
          <div className="p-4 border-b">
            <div>
              <h3 className="font-semibold text-foreground flex items-center">
                <Building className="w-4 h-4 mr-2" />
                Tax by Property
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
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
                  <Button
                    variant="link"
                    onClick={() => onPropertyClick?.(row.propertyId)}
                    className="p-0 h-auto text-left"
                  >
                    {row.propertyName}
                  </Button>
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
                render: (row: any) => formatPercentage(row.taxRate, 2)
              },
              {
                key: 'status',
                header: 'Status',
                render: (row: any) => (
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    row.status === 'configured'
                      ? 'bg-success-subtle text-success-fg'
                      : 'bg-warning-subtle text-warning-fg'
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
        <div className="bg-warning-subtle border border-warning/30 rounded-lg p-4">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-warning mr-2 mt-0.5" />
            <div className="text-sm text-warning-fg">
              <strong>High Tax Rate:</strong> Your effective tax rate is {formatPercentage(taxData.effectiveTaxRate, 2)}. 
              Consider reviewing your tax settings and jurisdictions to ensure accuracy.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}