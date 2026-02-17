import { useMemo, useState, useCallback } from 'react'
import { formatCurrency, formatCompactCurrency, formatPercentage, sumBy, calculateAverage } from '@baileys/utils'
import { useTagIds, useErrorToast, useComparisonDateRange } from '@/hooks/use-dashboard-utils'
import { PropertyMetrics } from '@/types/api'
import { Calendar, DollarSign, Home, Info, Percent, TrendingUp, ScatterChart, LayoutGrid, Table } from 'lucide-react'
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

export const PropertiesDashboard = () => {
  const { filters, comparisonRange, comparisonMode, comparisonLabel } = useDashboard()
  const { showTips } = useTips()
  const { openModal } = useModal()
  const comparisonDateRange = useComparisonDateRange()
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  
  const tagIds = useTagIds()
  
  const { data, error, isLoading } = useDashboardBatch(
    'properties',
    filters.dateRange.from,
    filters.dateRange.to,
    tagIds,
    comparisonRange?.from,
    comparisonRange?.to
  )

  let properties = []
  let previousProperties = null
  
  if (Array.isArray(data)) {
    properties = data
  } else if (data) {
    properties = data.properties || []
    previousProperties = data.previousProperties || null
  }

  useErrorToast(error, 'Failed to load property metrics')

  const validProperties = Array.isArray(properties) 
    ? properties.filter((p: PropertyMetrics) => p && p.propertyName)
    : [] as PropertyMetrics[]
  
  const { totalRevenue, totalBookings, avgOccupancy, avgRevPAN } = useMemo(() => {
    const totalAvailableNights = sumBy(validProperties, (p: PropertyMetrics) => p.availableNights)
    const totalRev = sumBy(validProperties, (p: PropertyMetrics) => p.revenue)
    return {
      totalRevenue: totalRev,
      totalBookings: sumBy(validProperties, (p: PropertyMetrics) => p.bookings),
      avgOccupancy: calculateAverage(validProperties.map((p: PropertyMetrics) => p.occupancyRate)),
      avgRevPAN: totalAvailableNights > 0 ? totalRev / totalAvailableNights : 0
    }
  }, [validProperties])

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

  // memoized view toggle handlers
  const handleViewCards = useCallback(() => setViewMode('cards'), [])
  const handleViewTable = useCallback(() => setViewMode('table'), [])

  // memoized scatter plot click handler
  const handleScatterClick = useCallback((property: PropertyMetrics) => {
    openModal({
      type: 'property',
      propertyId: property.propertyId,
      propertyName: property.propertyName
    })
  }, [openModal])

  if (isLoading || validProperties.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-2xl font-bold text-gray-900">Your Properties at a Glance</h2>
          <p className="text-gray-600 text-sm mt-1">
            See how each property is performing and compare them side by side
          </p>
        </div>
        <StateWrapper
          loading={isLoading}
          empty={validProperties.length === 0}
          loadingMessage="Loading property data..."
          emptyMessage="No Properties Found"
          emptySubMessage="Properties will appear here once they're synced from your booking platform."
          emptyIcon={<Home className="w-12 h-12 text-gray-500 opacity-50 mb-2" />}
          minHeight={300}
          className="bg-white rounded-lg shadow-sm py-12"
        >
          <div />
        </StateWrapper>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Your Properties at a Glance</h2>
            <p className="text-gray-600 text-sm mt-1">
              See how each property is performing and compare them side by side
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-gray-500">Total Revenue</div>
              <div className="text-lg font-bold text-green-600">
                {formatCompactCurrency(totalRevenue)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">Properties</div>
              <div className="text-lg font-bold text-gray-900">
                {validProperties.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showTips && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
            <div className="text-sm text-blue-800">
              <strong>Reading Your Data:</strong> Click any property to see detailed insights.
              Higher occupancy means fewer empty nights. Compare revenue and RevPAN to identify your top performers.
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
          tooltip="Total revenue from all bookings in selected period"
          subValue={comparisonMode !== 'none' && previousProperties && prevTotalRevenue > 0
            ? <>vs {comparisonLabel}: {formatCurrency(prevTotalRevenue)}{comparisonDateRange && <span className="block text-xs text-gray-400 mt-0.5">{comparisonDateRange}</span>}</>
            : "All properties"
          }
          trend={comparisonMode !== 'none' && previousProperties && prevTotalRevenue > 0 ? {
            value: ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100,
            isPositive: totalRevenue > prevTotalRevenue
          } : undefined}
          color="green"
        />
        <MetricCard
          icon={TrendingUp}
          label="Avg RevPAN"
          value={avgRevPAN}
          format="currency"
          tooltip="Revenue Per Available Night — portfolio-wide revenue efficiency combining rate and occupancy"
          subValue={comparisonMode !== 'none' && previousProperties && prevAvgRevPAN > 0
            ? <>vs {comparisonLabel}: {formatCurrency(prevAvgRevPAN)}{comparisonDateRange && <span className="block text-xs text-gray-400 mt-0.5">{comparisonDateRange}</span>}</>
            : "Across all properties"
          }
          trend={comparisonMode !== 'none' && previousProperties && prevAvgRevPAN > 0 ? {
            value: ((avgRevPAN - prevAvgRevPAN) / prevAvgRevPAN) * 100,
            isPositive: avgRevPAN > prevAvgRevPAN
          } : undefined}
          color="blue"
        />
        <MetricCard
          icon={Percent}
          label="Occupancy Rate"
          value={avgOccupancy * 100}
          format="percent"
          tooltip="Percentage of available nights booked"
          subValue={comparisonMode !== 'none' && previousProperties && prevAvgOccupancy > 0
            ? <>vs {comparisonLabel}: {formatPercentage(prevAvgOccupancy * 100, 1)}{comparisonDateRange && <span className="block text-xs text-gray-400 mt-0.5">{comparisonDateRange}</span>}</>
            : "Across all properties"
          }
          trend={comparisonMode !== 'none' && previousProperties && prevAvgOccupancy > 0 ? {
            value: ((avgOccupancy - prevAvgOccupancy) / prevAvgOccupancy) * 100,
            isPositive: avgOccupancy > prevAvgOccupancy
          } : undefined}
          color={avgOccupancy >= 0.7 ? "green" : avgOccupancy >= 0.5 ? "yellow" : "red"}
        />
        <MetricCard
          icon={Calendar}
          label="Total Bookings"
          value={totalBookings}
          format="number"
          tooltip="Total number of confirmed bookings"
          subValue={comparisonMode !== 'none' && previousProperties && prevTotalBookings > 0
            ? <>vs {comparisonLabel}: {prevTotalBookings}{comparisonDateRange && <span className="block text-xs text-gray-400 mt-0.5">{comparisonDateRange}</span>}</>
            : "In selected period"
          }
          trend={comparisonMode !== 'none' && previousProperties && prevTotalBookings > 0 ? {
            value: ((totalBookings - prevTotalBookings) / prevTotalBookings) * 100,
            isPositive: totalBookings > prevTotalBookings
          } : undefined}
          color="purple"
        />
      </div>

      {/* View Toggle and Properties Display */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Property Performance</h3>
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={handleViewTable}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Table className="w-4 h-4 inline mr-1.5" />
              Table
            </button>
            <button
              onClick={handleViewCards}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <LayoutGrid className="w-4 h-4 inline mr-1.5" />
              Cards
            </button>
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
          />
        )}
      </div>

      {/* Charts Section */}
      <div>
        {/* Property Performance Scatter Plot */}
        <ChartWrapper
          title="Performance Matrix"
          subtitle="Revenue vs Occupancy Analysis"
          icon={ScatterChart}
          height={360}
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
    </div>
  )
}
