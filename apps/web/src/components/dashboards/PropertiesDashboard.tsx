import { useMemo, useState, useCallback } from 'react'
import { formatCurrency, formatPercentage, sumBy, calculateAverage } from '@baileys/utils'
import { useTagIds, usePropertyIds, useErrorToast, useComparisonDateRange } from '@/hooks/use-dashboard-utils'
import { PropertyMetrics } from '@/types/api'
import { Button } from '@/components/ui/button'
import { DollarSign, Info, Percent, TrendingUp, ArrowDown, ScatterChart, LayoutGrid, Table, Wallet, Share2, BarChart3, PieChart, HelpCircle } from 'lucide-react'
import { useDashboard } from '@/contexts/dashboard'
import { useDashboardBatch } from '@/hooks/use-api'
import { useModal } from '@/contexts/modal'
import { useTips } from '@/hooks/use-tips'
import { MetricCard } from '@/components/MetricCard'
import { ChartWrapper } from '@/components/ChartWrapper'
import { StateWrapper } from '@/components/StateWrapper'
import { PropertyPerformanceScatter, PerformanceQuadrantLegend } from '@/components/charts/PropertyPerformanceScatter'
import { PropertyCard } from '@/components/cards/PropertyCard'
import { PropertyTable } from '@/components/tables/PropertyTable'
import { SimpleTable } from '@/components/tables'
import { ProfitabilityChart, ProfitabilityLegend } from '@/components/charts/ProfitabilityChart'
import { PlatformMixChart, PlatformMixLegend } from '@/components/charts/PlatformMixChart'

interface PropertyProfitability {
  propertyId: string
  propertyName: string
  propertyCode?: string | null
  grossRevenue: number
  platformFees: number
  taxes: number
  operatingExpenses: number
  netRevenue: number
}

interface PropertyPlatformMix {
  propertyId: string
  propertyName: string
  propertyCode?: string | null
  platforms: Array<{ platform: string; bookings: number; revenue: number }>
}

export const PropertiesDashboard = () => {
  const { filters, comparisonRange, comparisonMode, comparisonLabel } = useDashboard()
  const { showTips } = useTips()
  const { openModal } = useModal()
  const comparisonDateRange = useComparisonDateRange()
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [platformView, setPlatformView] = useState<'pct' | 'rev'>('pct')

  const tagIds = useTagIds()
  const propertyIds = usePropertyIds()

  const { data, error, isLoading } = useDashboardBatch(
    'properties',
    filters.dateRange.from,
    filters.dateRange.to,
    tagIds,
    comparisonRange?.from,
    comparisonRange?.to,
    propertyIds
  )

  let properties: PropertyMetrics[] = []
  let previousProperties: PropertyMetrics[] | null = null
  let profitability: PropertyProfitability[] = []
  let platformMix: PropertyPlatformMix[] = []

  if (Array.isArray(data)) {
    properties = data
  } else if (data) {
    properties = data.properties || []
    previousProperties = data.previousProperties || null
    profitability = data.profitability || []
    platformMix = data.platformMix || []
  }

  useErrorToast(error, 'Failed to load property metrics')

  const validProperties = Array.isArray(properties)
    ? properties.filter((p: PropertyMetrics) => p && p.propertyName)
    : [] as PropertyMetrics[]

  const { totalRevenue, totalBookings, avgOccupancy, avgRevPAN, totalNetRevenue } = useMemo(() => {
    const totalAvailableNights = sumBy(validProperties, (p: PropertyMetrics) => p.availableNights)
    const totalRev = sumBy(validProperties, (p: PropertyMetrics) => p.revenue)
    const totalNet = profitability.length > 0
      ? sumBy(profitability, (p: PropertyProfitability) => p.netRevenue || 0)
      : 0
    return {
      totalRevenue: totalRev,
      totalBookings: sumBy(validProperties, (p: PropertyMetrics) => p.bookings),
      avgOccupancy: calculateAverage(validProperties.map((p: PropertyMetrics) => p.occupancyRate)),
      avgRevPAN: totalAvailableNights > 0 ? totalRev / totalAvailableNights : 0,
      totalNetRevenue: totalNet
    }
  }, [validProperties, profitability])

  const { prevTotalRevenue, prevTotalBookings, prevAvgOccupancy, prevAvgRevPAN } = useMemo(() => {
    const prev = previousProperties || []
    const prevTotalAvailableNights = sumBy(prev, (p: PropertyMetrics) => p.availableNights)
    const prevTotalRev = sumBy(prev, (p: PropertyMetrics) => p.revenue)
    return {
      prevTotalRevenue: prevTotalRev,
      prevTotalBookings: sumBy(prev, (p: PropertyMetrics) => p.bookings),
      prevAvgOccupancy: calculateAverage(prev.map((p: PropertyMetrics) => p.occupancyRate)),
      prevAvgRevPAN: prevTotalAvailableNights > 0 ? prevTotalRev / prevTotalAvailableNights : 0
    }
  }, [previousProperties])

  // collect platforms sorted by total revenue (matches chart stacking order)
  const allPlatforms = useMemo(() => {
    const totals = new Map<string, number>()
    for (const p of platformMix) {
      for (const entry of p.platforms || []) {
        totals.set(entry.platform, (totals.get(entry.platform) || 0) + entry.revenue)
      }
    }
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name)
  }, [platformMix])

  // memoized view toggle handlers
  const handleViewCards = useCallback(() => setViewMode('cards'), [])
  const handleViewTable = useCallback(() => setViewMode('table'), [])
  const handlePlatformPct = useCallback(() => setPlatformView('pct'), [])
  const handlePlatformRev = useCallback(() => setPlatformView('rev'), [])

  // memoized click handlers
  const handleScatterClick = useCallback((property: PropertyMetrics) => {
    openModal({
      type: 'property',
      propertyId: property.propertyId,
      propertyName: property.propertyName
    })
  }, [openModal])

  const handleChartPropertyClick = useCallback((propertyId: string, propertyName: string) => {
    openModal({ type: 'property', propertyId, propertyName })
  }, [openModal])

  const handlePropertyClick = useCallback((propertyId: string) => {
    const prop = validProperties.find((p: PropertyMetrics) => p.propertyId === propertyId)
    openModal({ type: 'property', propertyId, propertyName: prop?.propertyName || '' })
  }, [openModal, validProperties])

  const { topProperties, bottomProperties } = useMemo(() => {
    const sorted = [...validProperties].sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
    return {
      topProperties: sorted.slice(0, 3),
      bottomProperties: sorted.length > 3 ? sorted.slice(-3).reverse() : []
    }
  }, [validProperties])

  if (isLoading || error || validProperties.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-card rounded-xl border border-border p-4">
          <h2 className="text-lg font-semibold text-foreground">Your Properties at a Glance</h2>
          <p className="text-muted-foreground text-sm mt-1">
            See how each property is performing and compare them side by side
          </p>
        </div>
        <StateWrapper
          loading={isLoading}
          error={error}
          empty={validProperties.length === 0 && !isLoading && !error}
          loadingMessage="Loading property data..."
          emptyMessage="No Properties Found"
          emptySubMessage="Properties will appear here once they're synced from your booking platform."
          onRetry={() => window.location.reload()}
          minHeight={300}
          className="bg-card rounded-lg shadow-sm py-12"
        >
          <div />
        </StateWrapper>
      </div>
    )
  }

  // dynamic chart height based on property count
  const barChartHeight = Math.max(200, validProperties.length * 48 + 40)

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Your Properties at a Glance</h2>
            <p className="text-muted-foreground text-sm mt-1">
              See how each property is performing and compare them side by side
            </p>
          </div>
          <span className="text-sm font-medium text-muted-foreground">
            {validProperties.length} {validProperties.length === 1 ? 'property' : 'properties'}
          </span>
        </div>
      </div>

      {showTips && (
        <div className="bg-info-subtle border border-info/30 rounded-lg p-4">
          <div className="flex items-start">
            <Info className="w-5 h-5 text-info mr-2 mt-0.5" />
            <div className="text-sm text-info-fg">
              <strong>Tip:</strong> Click any property card for a full breakdown. Compare RevPAN across properties to spot top performers.
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <MetricCard
          icon={DollarSign}
          label="Total Revenue"
          value={totalRevenue}
          format="currency"
          tooltip="Gross booking revenue, all properties"
          subValue={comparisonMode !== 'none' && previousProperties && prevTotalRevenue > 0
            ? <>vs {comparisonLabel}: {formatCurrency(prevTotalRevenue)}{comparisonDateRange && <span className="block text-xs text-muted-foreground/70 mt-0.5">{comparisonDateRange}</span>}</>
            : `${totalBookings} bookings | All properties`
          }
          trend={comparisonMode !== 'none' && previousProperties && prevTotalRevenue > 0 ? {
            value: ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100,
            isPositive: totalRevenue > prevTotalRevenue
          } : undefined}
          color="green"
          staggerIndex={0}
        />
        {profitability.length > 0 ? (
          <MetricCard
            icon={Wallet}
            label="Operating Profit"
            value={totalNetRevenue}
            format="currency"
            tooltip="Revenue minus fees, taxes, and operating expenses"
            subValue={comparisonMode !== 'none' && previousProperties && prevTotalRevenue > 0
              ? <>vs {comparisonLabel}{comparisonDateRange && <span className="block text-xs text-muted-foreground/70 mt-0.5">{comparisonDateRange}</span>}</>
              : totalRevenue > 0 ? `${formatPercentage((totalNetRevenue / totalRevenue) * 100, 1)} margin` : '0% margin'
            }
            color={totalNetRevenue > 0 ? "green" : "red"}
            staggerIndex={1}
          />
        ) : (
          <MetricCard
            icon={TrendingUp}
            label="Avg RevPAN"
            value={avgRevPAN}
            format="currency"
            tooltip="Revenue Per Available Night — factors in both rate and occupancy"
            subValue={comparisonMode !== 'none' && previousProperties && prevAvgRevPAN > 0
              ? <>vs {comparisonLabel}: {formatCurrency(prevAvgRevPAN)}{comparisonDateRange && <span className="block text-xs text-muted-foreground/70 mt-0.5">{comparisonDateRange}</span>}</>
              : "Across all properties"
            }
            trend={comparisonMode !== 'none' && previousProperties && prevAvgRevPAN > 0 ? {
              value: ((avgRevPAN - prevAvgRevPAN) / prevAvgRevPAN) * 100,
              isPositive: avgRevPAN > prevAvgRevPAN
            } : undefined}
            color="blue"
            staggerIndex={1}
          />
        )}
        <MetricCard
          icon={Percent}
          label="Occupancy Rate"
          value={avgOccupancy * 100}
          format="percent"
          tooltip="Booked nights as a share of available nights"
          subValue={comparisonMode !== 'none' && previousProperties && prevAvgOccupancy > 0
            ? <>vs {comparisonLabel}: {formatPercentage(prevAvgOccupancy * 100, 1)}{comparisonDateRange && <span className="block text-xs text-muted-foreground/70 mt-0.5">{comparisonDateRange}</span>}</>
            : "Across all properties"
          }
          trend={comparisonMode !== 'none' && previousProperties && prevAvgOccupancy > 0 ? {
            value: ((avgOccupancy - prevAvgOccupancy) / prevAvgOccupancy) * 100,
            isPositive: avgOccupancy > prevAvgOccupancy
          } : undefined}
          color={avgOccupancy >= 0.7 ? "green" : avgOccupancy >= 0.5 ? "yellow" : "red"}
          staggerIndex={2}
        />
        <MetricCard
          icon={TrendingUp}
          label={profitability.length > 0 ? "Avg RevPAN" : "Total Bookings"}
          value={profitability.length > 0 ? avgRevPAN : totalBookings}
          format={profitability.length > 0 ? "currency" : "number"}
          tooltip={profitability.length > 0
            ? "Revenue Per Available Night"
            : "Confirmed reservations in this period"
          }
          subValue={comparisonMode !== 'none' && previousProperties
            ? profitability.length > 0 && prevAvgRevPAN > 0
              ? <>vs {comparisonLabel}: {formatCurrency(prevAvgRevPAN)}{comparisonDateRange && <span className="block text-xs text-muted-foreground/70 mt-0.5">{comparisonDateRange}</span>}</>
              : prevTotalBookings > 0
              ? <>vs {comparisonLabel}: {prevTotalBookings}{comparisonDateRange && <span className="block text-xs text-muted-foreground/70 mt-0.5">{comparisonDateRange}</span>}</>
              : "In selected period"
            : profitability.length > 0 ? "Across all properties" : "In selected period"
          }
          trend={comparisonMode !== 'none' && previousProperties ? (
            profitability.length > 0 && prevAvgRevPAN > 0
              ? { value: ((avgRevPAN - prevAvgRevPAN) / prevAvgRevPAN) * 100, isPositive: avgRevPAN > prevAvgRevPAN }
              : prevTotalBookings > 0
              ? { value: ((totalBookings - prevTotalBookings) / prevTotalBookings) * 100, isPositive: totalBookings > prevTotalBookings }
              : undefined
          ) : undefined}
          color={profitability.length > 0 ? "blue" : "purple"}
          staggerIndex={3}
        />
      </div>

      {/* View Toggle and Properties Display */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-foreground">Property Performance</h3>
          <div className="flex items-center gap-2 bg-muted p-1 rounded-lg">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleViewTable}
              className={viewMode === 'table' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}
            >
              <Table className="w-4 h-4" />
              Table
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleViewCards}
              className={viewMode === 'cards' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}
            >
              <LayoutGrid className="w-4 h-4" />
              Cards
            </Button>
          </div>
        </div>

        {viewMode === 'cards' ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {validProperties.map((property: PropertyMetrics) => {
              const previousProperty = previousProperties?.find((p: PropertyMetrics) => p.propertyId === property.propertyId)
              return (
                <PropertyCard
                  key={property.propertyId}
                  property={property}
                  previousProperty={previousProperty}
                  comparisonMode={comparisonMode}
                />
              )
            })}
          </div>
        ) : (
          <PropertyTable
            properties={validProperties}
            previousProperties={previousProperties}
            comparisonMode={comparisonMode}
            profitability={profitability}
          />
        )}
      </div>

      {/* Top & Bottom Performers */}
      {topProperties.length > 0 && bottomProperties.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-card rounded-lg shadow-sm border p-4">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-semibold flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-success" />
                Top Performing
              </h3>
              <div className="group relative">
                <HelpCircle className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-help" />
                <div className="absolute right-0 top-6 z-10 w-64 p-3 bg-foreground text-background border-none text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                  <p className="font-semibold mb-1">Top Performers</p>
                  <p>Properties with the highest revenue in the selected period. Study what makes these successful.</p>
                </div>
              </div>
            </div>
            <SimpleTable
              data={topProperties}
              columns={[
                {
                  key: 'propertyName',
                  header: 'Property',
                  render: (row: PropertyMetrics) => (
                    <Button variant="link" className="px-0 h-auto" onClick={() => handlePropertyClick(row.propertyId)}>
                      {row.propertyName}
                    </Button>
                  )
                },
                { key: 'revenue', header: 'Revenue', render: (row: PropertyMetrics) => formatCurrency(row.revenue || 0) },
                { key: 'bookings', header: 'Bookings', render: (row: PropertyMetrics) => String(row.bookings || 0) }
              ]}
            />
          </div>
          <div className="bg-card rounded-lg shadow-sm border p-4">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-semibold flex items-center">
                <ArrowDown className="w-5 h-5 mr-2 text-warning" />
                Needs Attention
              </h3>
              <div className="group relative">
                <HelpCircle className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-help" />
                <div className="absolute right-0 top-6 z-10 w-64 p-3 bg-foreground text-background border-none text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                  <p className="font-semibold mb-1">Underperforming</p>
                  <p className="mb-2">Properties with the lowest revenue in the selected period.</p>
                  <p className="text-background/70">Consider: pricing strategy, listing quality, guest reviews, seasonal adjustments.</p>
                </div>
              </div>
            </div>
            <SimpleTable
              data={bottomProperties}
              columns={[
                {
                  key: 'propertyName',
                  header: 'Property',
                  render: (row: PropertyMetrics) => (
                    <Button variant="link" className="px-0 h-auto" onClick={() => handlePropertyClick(row.propertyId)}>
                      {row.propertyName}
                    </Button>
                  )
                },
                { key: 'revenue', header: 'Revenue', render: (row: PropertyMetrics) => formatCurrency(row.revenue || 0) },
                { key: 'bookings', header: 'Bookings', render: (row: PropertyMetrics) => String(row.bookings || 0) }
              ]}
            />
          </div>
        </div>
      )}

      {/* Analysis Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Net Profitability */}
        <ChartWrapper
          title="Net Profitability"
          subtitle="Revenue after fees, taxes, and expenses"
          icon={Wallet}
          height={barChartHeight}
          responsive={false}
        >
          <div className="h-full flex flex-col">
            <div className="flex-1">
              <ProfitabilityChart
                data={profitability}
                onPropertyClick={handleChartPropertyClick}
              />
            </div>
            {profitability.length > 0 && <ProfitabilityLegend />}
          </div>
        </ChartWrapper>

        {/* Performance Matrix */}
        <ChartWrapper
          title="Performance Matrix"
          subtitle="Revenue vs Occupancy Analysis"
          icon={ScatterChart}
          height={380}
          responsive={false}
        >
          <div className="h-full flex flex-col">
            <div className="flex-1">
              <PropertyPerformanceScatter
                properties={validProperties}
                onPropertyClick={handleScatterClick}
              />
            </div>
            <PerformanceQuadrantLegend />
          </div>
        </ChartWrapper>
      </div>

      {/* Booking Source Mix — full width */}
      <ChartWrapper
        title="Booking Sources"
        subtitle="Platform concentration by property"
        icon={Share2}
        height={barChartHeight}
        responsive={false}
        actions={allPlatforms.length > 0 ? (
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePlatformPct}
              className={platformView === 'pct' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}
            >
              <PieChart className="w-4 h-4" />
              %
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePlatformRev}
              className={platformView === 'rev' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}
            >
              <BarChart3 className="w-4 h-4" />
              Revenue
            </Button>
          </div>
        ) : undefined}
      >
        <div className="h-full flex flex-col">
          <div className="flex-1">
            <PlatformMixChart
              data={platformMix}
              onPropertyClick={handleChartPropertyClick}
              showPercentage={platformView === 'pct'}
            />
          </div>
          {allPlatforms.length > 0 && <PlatformMixLegend platforms={allPlatforms} />}
        </div>
      </ChartWrapper>
    </div>
  )
}
