import { useMemo, useState, useCallback } from 'react'
import { formatCurrency, formatCompactCurrency, formatPercentage, sumBy, calculateAverage } from '@baileys/utils'
import { useTagIds, useErrorToast, getTimePeriodGranularity } from '@/hooks/use-dashboard-utils'
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

export const PropertiesDashboard = () => {
  const { filters, comparisonRange, comparisonMode } = useDashboard()
  const { showTips } = useTips()
  const { openModal } = useModal()
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards')
  
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

  const { totalRevenue, totalBookings, avgOccupancy } = useMemo(() => ({
    totalRevenue: sumBy(validProperties, (p: PropertyMetrics) => p.revenue),
    totalBookings: sumBy(validProperties, (p: PropertyMetrics) => p.bookings),
    avgOccupancy: calculateAverage(validProperties.map((p: PropertyMetrics) => p.occupancyRate))
  }), [validProperties])
  
  const { prevTotalRevenue, prevTotalBookings, prevAvgOccupancy } = useMemo(() => ({
    prevTotalRevenue: sumBy(previousProperties || [], (p: PropertyMetrics) => p.revenue),
    prevTotalBookings: sumBy(previousProperties || [], (p: PropertyMetrics) => p.bookings),
    prevAvgOccupancy: calculateAverage((previousProperties || []).map((p: PropertyMetrics) => p.occupancyRate))
  }), [previousProperties])

  // memoized click handler for bar chart
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
          icon={Home}
          label="Property Count"
          value={(properties || []).length}
          format="number"
          tooltip="Total number of properties in portfolio"
          subValue={comparisonMode !== 'none' && previousProperties && previousProperties.length > 0
            ? `vs ${comparisonMode === 'previous-year' ? 'last year' : 'previous period'}: ${previousProperties.length} | Active properties`
            : "In selected period"
          }
          trend={comparisonMode !== 'none' && previousProperties && previousProperties.length > 0 ? {
            value: (((properties || []).length - previousProperties.length) / (previousProperties.length || 1)) * 100,
            isPositive: (properties || []).length >= previousProperties.length
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
            ? `vs ${comparisonMode === 'previous-year' ? 'last year' : 'previous period'}: ${formatCurrency(prevTotalRevenue)} | All properties`
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
            ? `vs ${comparisonMode === 'previous-year' ? 'last year' : 'previous period'}: ${formatPercentage(prevAvgOccupancy * 100, 0)} | Across all`
            : "Across all properties"
          }
          trend={comparisonMode !== 'none' && previousProperties && prevAvgOccupancy > 0 ? {
            value: ((avgOccupancy - prevAvgOccupancy) / prevAvgOccupancy) * 100,
            isPositive: avgOccupancy > prevAvgOccupancy
          } : undefined}
          color={avgOccupancy > 0.7 ? "green" : avgOccupancy > 0.5 ? "yellow" : "red"}
        />
        <MetricCard
          icon={Calendar}
          label="Total Bookings"
          value={totalBookings}
          format="number"
          tooltip="Total number of confirmed bookings"
          subValue={comparisonMode !== 'none' && previousProperties && prevTotalBookings > 0
            ? `vs ${comparisonMode === 'previous-year' ? 'last year' : 'previous period'}: ${prevTotalBookings} | All bookings`
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
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Revenue Comparison Chart */}
        <ChartWrapper
          title={comparisonMode !== 'none' ? `Revenue Comparison${timePeriod}` : `Revenue vs Occupancy${timePeriod}`}
          subtitle={comparisonMode !== 'none'
            ? `Comparing current period vs ${comparisonMode === 'previous-year' ? 'last year' : 'previous period'}`
            : validProperties.length > 10 ? `Showing all ${validProperties.length} properties` : undefined
          }
          icon={TrendingUp}
          height={Math.max(420, validProperties.length * 50)}
        >
          <ResponsiveContainer width="100%" height="100%">
            {comparisonMode !== 'none' && comparisonChartData ? (
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
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name.includes('Revenue')) return formatCurrency(value)
                    return value
                  }}
                  contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                  labelFormatter={(label: any) => chartData.find(d => d.name === label)?.fullName || label}
                />
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
            ) : (
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 20, right: 60, left: 10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  xAxisId="revenue"
                  type="number"
                  tickFormatter={(value: number) => formatCompactCurrency(value)}
                />
                <XAxis
                  xAxisId="occupancy"
                  type="number"
                  orientation="top"
                  domain={[0, 100]}
                  tickFormatter={(value: number) => `${value}%`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={180}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'Revenue') return formatCurrency(value)
                    if (name === 'Occupancy Rate') return `${value}%`
                    return value
                  }}
                  contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                  labelFormatter={(label: any) => chartData.find(d => d.name === label)?.fullName || label}
                />
                <Legend
                  wrapperStyle={{ paddingTop: '15px' }}
                  iconType="rect"
                  iconSize={12}
                />
                <Bar
                  xAxisId="revenue"
                  dataKey="revenue"
                  fill={METRIC_COLORS.revenue}
                  name="Revenue"
                  radius={[0, 4, 4, 0]}
                  cursor="pointer"
                  onClick={handleBarClick}
                />
                <Bar
                  xAxisId="occupancy"
                  dataKey="occupancy"
                  fill={METRIC_COLORS.occupancy}
                  name="Occupancy Rate"
                  radius={[0, 4, 4, 0]}
                  cursor="pointer"
                  onClick={handleBarClick}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </ChartWrapper>

        {/* Property Performance Scatter Plot */}
        <ChartWrapper
          title="Performance Matrix"
          subtitle={`Revenue vs Occupancy Analysis`}
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
