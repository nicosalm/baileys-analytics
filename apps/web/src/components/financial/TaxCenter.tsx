import React, { useMemo, useRef, useCallback, useState, useEffect } from 'react'
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
import { Pagination } from '@/components/Pagination'

interface TaxByPropertyRow {
  propertyId: string
  propertyName: string
  totalTax: number
  taxRate: number
}

interface TaxData {
  tax: {
    summary: { totalTax: number; ownerRemitted: number; platformRemitted: number; effectiveRate?: number }
    byProperty: TaxByPropertyRow[]
    byMonth: { month: string; totalTax: number; ownerRemitted?: number; platformRemitted?: number }[]
  }
  metrics?: { revenue?: { gross?: number } }
  previousPeriod?: { revenue?: { gross?: number; taxes?: number } }
}

interface TaxCenterProps {
  data: TaxData | null
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
  const trendRef = useRef<HTMLDivElement>(null)
  const [taxPropertyPage, setTaxPropertyPage] = useState(1)

  const TAX_PAGE_SIZE = 15

  const scrollToTrend = useCallback(() => {
    trendRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

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
    } catch {
      addToast('error', 'Failed to download tax report')
    }
  }
  
  // reset page when data changes
  useEffect(() => { setTaxPropertyPage(1) }, [data])

  const taxData = useMemo(() => {
    if (!data?.tax) return null
    
    const { summary, byProperty, byMonth } = data.tax
    const previousPeriod = data.previousPeriod
    
    // Determine granularity based on data format
    const granularity = detectGranularity(byMonth, 'month')
    
    const totalTax = summary?.totalTax || 0
    const ownerRemitted = summary?.ownerRemitted || summary?.totalTax || 0
    const platformRemitted = summary?.platformRemitted || 0
    
    // use backend-computed effective rate (taxable base denominator) when available
    const grossRevenue = data.metrics?.revenue?.gross || 0
    const effectiveTaxRate = summary?.effectiveRate
      ?? (grossRevenue > 0 ? (totalTax / grossRevenue) * 100 : 0)
    
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
              <strong>Tax Tracking:</strong> Occupancy taxes collected in this period, split by owner-remitted and platform-remitted. Remittance split is determined by platform name — verify with your tax advisor before filing.
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <MetricCard
          icon={FileText}
          label="Total Tax Due"
          value={taxData.totalTax}
          format="currency"
          color="green"
          staggerIndex={0}
          subValue={comparisonMode !== 'none' && taxData.comparison.previousTaxes > 0
            ? <>{taxData.comparison.periodLabel}: {formatCurrency(taxData.comparison.previousTaxes)}{comparisonDateRange && <span className="block text-xs text-muted-foreground mt-0.5">{comparisonDateRange}</span>}</>
            : `${formatPercentage(taxData.effectiveTaxRate, 2)} rate`}
          tooltip="Total occupancy and lodging tax collected — click to view trend"
          trend={comparisonMode !== 'none' && taxData.comparison.taxGrowth !== 0 ? {
            value: taxData.comparison.taxGrowth,
            isPositive: taxData.comparison.taxGrowth > 0
          } : undefined}
          onClick={scrollToTrend}
        />
        <MetricCard
          icon={DollarSign}
          label="You Remit"
          value={taxData.ownerRemitted}
          format="currency"
          color="blue"
          staggerIndex={1}
          subValue={comparisonMode !== 'none' && taxData.comparison.previousOwnerRemitted > 0
            ? <>{taxData.comparison.periodLabel}: {formatCurrency(taxData.comparison.previousOwnerRemitted)}{comparisonDateRange && <span className="block text-xs text-muted-foreground mt-0.5">{comparisonDateRange}</span>}</>
            : "Your responsibility"}
          tooltip="Tax you file and pay to local authorities"
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
          staggerIndex={2}
          subValue="Paid by platforms"
          tooltip="Tax collected and remitted by OTAs on your behalf"
        />
        <MetricCard
          icon={Home}
          label="Properties"
          value={taxData.propertyCount}
          format="number"
          color="yellow"
          staggerIndex={3}
          subValue="Being tracked"
          tooltip="Properties with tax data in this period"
        />
      </div>
      
      {/* Tax Trend Chart */}
      <div ref={trendRef}>
      <TaxTrendChart
        data={taxData.byMonth}
        title={`${taxData.granularity} Tax Trend`}
        onPeriodClick={onPeriodClick}
      />
      </div>

      {/* Tax Remittance and Property Details Side by Side */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Tax Remittance Widget */}
        <TaxRemittanceWidget
          taxData={data?.tax}
          periodStart={filters.dateRange.from}
          periodEnd={filters.dateRange.to}
        />
        
        {/* Property Tax Details Table */}
        <div className="bg-card rounded-lg shadow-sm border">
          <div className="p-4 border-b">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-foreground flex items-center">
                  <Building className="w-4 h-4 mr-2" />
                  Tax by Property
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {taxData.propertyCount} {taxData.propertyCount === 1 ? 'property' : 'properties'} with tax data
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleDownloadTaxReport} className="text-muted-foreground hover:text-foreground">
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
          </div>
          <div className="p-4">
            <SimpleTable
              data={taxData.byProperty.slice((taxPropertyPage - 1) * TAX_PAGE_SIZE, taxPropertyPage * TAX_PAGE_SIZE)}
              columns={[
              {
                key: 'propertyName',
                header: 'Property',
                render: (row: TaxByPropertyRow) => (
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
                render: (row: TaxByPropertyRow) => formatCurrency(row.totalTax)
              },
              {
                key: 'taxRate',
                header: 'Tax Rate',
                render: (row: TaxByPropertyRow) => formatPercentage(row.taxRate, 2)
              },
            ]}
          />
            <Pagination
              currentPage={taxPropertyPage}
              totalPages={Math.ceil(taxData.byProperty.length / TAX_PAGE_SIZE)}
              totalItems={taxData.byProperty.length}
              pageSize={TAX_PAGE_SIZE}
              onPageChange={setTaxPropertyPage}
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
              <strong>High Tax Rate:</strong> Effective rate is {formatPercentage(taxData.effectiveTaxRate, 2)} — verify tax charges in OwnerRez are correct.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}