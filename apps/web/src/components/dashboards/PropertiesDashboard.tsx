import { useMemo, useState, useCallback } from 'react'
import { formatCurrency, formatCompactCurrency, formatPercentage, sumBy, calculateAverage } from '@baileys/utils'
import { useTagIds, useErrorToast, getTimePeriodGranularity, useComparisonDateRange } from '@/hooks/use-dashboard-utils'
import { PropertyMetrics, ChartDataPoint } from '@/types/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Calendar, DollarSign, Home, Info, Percent, TrendingUp, ScatterChart, LayoutGrid, Table } from 'lucide-react'
import { useDashboard } from '@/contexts/dashboard'
import { useDashboardBatch } from '@/hooks/use-api'
import { useModal } from '@/contexts/modal'
import { useTips } from '@/hooks/use-tips'
import { MetricCard } from '@/components/MetricCard'
import { ChartWrapper } from '@/components/ChartWrapper'
import { StateWrapper } from '@/components/StateWrapper'
import { METRIC_COLORS } from '@/lib/theme'
import { PropertyPerformanceScatter, PerformanceQuadrantLegend } from '@/components/charts/PropertyPerformanceScatter'
import { PropertyCard } from '@/components/cards/PropertyCard'
import { PropertyTable } from '@/components/tables/PropertyTable'

const PropertyComparisonTooltip = ({ active, payload, comparisonMode }: any) => {
  if (!active || !payload?.length) return null
  const data = payload[0].payload

  return (
    <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
      <p className="font-semibold text-sm mb-2">{data.fullName || data.name}</p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: METRIC_COLORS.revenue }} />
            <span className="text-gray-600">Revenue:</span>
          </div>
          <span className="font-medium">{formatCurrency(data.revenue)}</span>
        </div>
        {data.previousRevenue !== undefined && (
          <div className="flex justify-between gap-4">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-slate-400" />
              <span className="text-gray-600">{comparisonMode === 'previous-year' ? 'Last Year' : 'Previous'}:</span>
            </div>
            <span className="font-medium">{formatCurrency(data.previousRevenue)}</span>
          </div>
        )}
        {data.previousRevenue !== undefined && data.previousRevenue > 0 && (
          <div className="pt-1 mt-1 border-t border-gray-200">
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Change:</span>
              <span className={`font-medium ${data.revenue >= data.previousRevenue ? 'text-green-600' : 'text-red-600'}`}>
                {data.revenue >= data.previousRevenue ? '+' : ''}{(((data.revenue - data.previousRevenue) / data.previousRevenue) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        )}
        <p className="text-gray-400 pt-1 mt-1 border-t border-gray-200">Click to view property</p>
      </div>
    </div>
  )
}

export const PropertiesDashboard = () => {
  const { filters, comparisonRange, comparisonMode } = useDashboard()
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
  
    
  const chartData = useMemo<ChartDataPoint[]>(() => validProperties.map((p: PropertyMetrics) => ({
    name: p.propertyName.length > 25 ? p.propertyName.substring(0, 25) + '...' : p.propertyName,
    fullName: p.propertyName,
    revenue: p.revenue || 0,
    occupancy: Math.round((p.occupancyRate || 0) * 100),
    bookings: p.bookings || 0,
    date: p.date || null
  })), [validProperties])

  const timePeriod = getTimePeriodGranularity(filters.dateRange.from, filters.dateRange.to)

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

  // click handler for individual bars and chart whitespace
  const handleBarClick = useCallback((data: any) => {
    const property = validProperties.find(p => p.propertyName === data.fullName)
    if (property) {
      openModal({
        type: 'property',
        propertyId: property.propertyId,
        propertyName: property.propertyName
      })
    }
  }, [validProperties, openModal])


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

  // memoized chart data with comparison values
  const comparisonChartData = useMemo(() => {
    if (comparisonMode === 'none' || !previousProperties) return null
    return chartData.map((item: ChartDataPoint) => {
      const prevProp = previousProperties.find((p: PropertyMetrics) =>
        p.propertyName === item.fullName
      )
      return {
        ...item,
        previousRevenue: prevProp?.revenue || 0,
        previousOccupancy: Math.round((prevProp?.occupancyRate || 0) * 100)
      }
    })
  }, [chartData, previousProperties, comparisonMode])

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
              <strong>Reading Your Data:</strong> Click any property card to see detailed insights. 
              Higher occupancy means fewer empty nights. Compare revenue and rates to identify your top performers.
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <MetricCard
          icon={TrendingUp}
          label="Avg RevPAN"
          value={avgRevPAN}
          format="currency"
          tooltip="Revenue Per Available Night — portfolio-wide revenue efficiency combining rate and occupancy"
          subValue={comparisonMode !== 'none' && previousProperties && prevAvgRevPAN > 0
            ? <>vs {comparisonMode === 'previous-year' ? 'last year' : 'previous period'}: {formatCurrency(prevAvgRevPAN)}{comparisonDateRange && <span className="block text-xs text-gray-400 mt-0.5">{comparisonDateRange}</span>}</>
            : "Across all properties"
          }
          trend={comparisonMode !== 'none' && previousProperties && prevAvgRevPAN > 0 ? {
            value: ((avgRevPAN - prevAvgRevPAN) / prevAvgRevPAN) * 100,
            isPositive: avgRevPAN > prevAvgRevPAN
          } : undefined}
          color="blue"
        />
        <MetricCard
          icon={DollarSign}
          label="Total Revenue"
          value={totalRevenue}
          format="currency"
          tooltip="Total revenue from all bookings in selected period"
          subValue={comparisonMode !== 'none' && previousProperties && prevTotalRevenue > 0
            ? <>vs {comparisonMode === 'previous-year' ? 'last year' : 'previous period'}: {formatCurrency(prevTotalRevenue)}{comparisonDateRange && <span className="block text-xs text-gray-400 mt-0.5">{comparisonDateRange}</span>}</>
            : "All properties"
          }
          trend={comparisonMode !== 'none' && previousProperties && prevTotalRevenue > 0 ? {
            value: ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100,
            isPositive: totalRevenue > prevTotalRevenue
          } : undefined}
          color="green"
        />
        <MetricCard
          icon={Percent}
          label="Occupancy Rate"
          value={avgOccupancy * 100}
          format="percent"
          tooltip="Percentage of available nights booked"
          subValue={comparisonMode !== 'none' && previousProperties && prevAvgOccupancy > 0
            ? <>vs {comparisonMode === 'previous-year' ? 'last year' : 'previous period'}: {formatPercentage(prevAvgOccupancy * 100, 0)}{comparisonDateRange && <span className="block text-xs text-gray-400 mt-0.5">{comparisonDateRange}</span>}</>
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
            ? <>vs {comparisonMode === 'previous-year' ? 'last year' : 'previous period'}: {prevTotalBookings}{comparisonDateRange && <span className="block text-xs text-gray-400 mt-0.5">{comparisonDateRange}</span>}</>
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
      <div className={`grid gap-6 ${comparisonMode !== 'none' ? 'lg:grid-cols-2' : 'max-w-4xl'}`}>
        {/* Revenue Comparison Chart — only shown in comparison mode */}
        {comparisonMode !== 'none' && comparisonChartData && (
          <ChartWrapper
            title={`Revenue Comparison${timePeriod}`}
            subtitle={`Comparing current period vs ${comparisonMode === 'previous-year' ? 'last year' : 'previous period'}`}
            icon={TrendingUp}
            height={Math.max(420, validProperties.length * 50)}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={comparisonChartData}
                layout="vertical"
                margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(value: number) => formatCompactCurrency(value)} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={180}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip content={<PropertyComparisonTooltip comparisonMode={comparisonMode} />} />
                <Legend
                  wrapperStyle={{ paddingTop: '15px' }}
                  iconType="rect"
                  iconSize={12}
                  formatter={(value: string) => {
                    if (value === 'Current Revenue') return 'Current'
                    if (value === 'Last Year Revenue') return 'Last Year'
                    if (value === 'Previous Period Revenue') return 'Previous'
                    return value
                  }}
                />
                <Bar
                  dataKey="revenue"
                  fill={METRIC_COLORS.revenue}
                  name="Current Revenue"
                  radius={[0, 4, 4, 0]}
                  cursor="pointer"
                  onClick={handleBarClick}
                />
                <Bar
                  dataKey="previousRevenue"
                  fill="#94a3b8"
                  name={comparisonMode === 'previous-year' ? 'Last Year Revenue' : 'Previous Period Revenue'}
                  radius={[0, 4, 4, 0]}
                  cursor="pointer"
                  onClick={handleBarClick}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartWrapper>
        )}

        {/* Property Performance Scatter Plot */}
        <ChartWrapper
          title="Performance Matrix"
          subtitle="Revenue vs Occupancy Analysis"
          icon={ScatterChart}
          height={360}
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
