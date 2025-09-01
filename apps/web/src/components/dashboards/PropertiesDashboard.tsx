import { useMemo } from 'react'
import { formatCurrency, formatCompactCurrency, formatPercentage, sumBy, calculateAverage, maxBy } from '@baileys/utils'
import { useTagIds, useErrorToast, getTimePeriodGranularity } from '@/hooks/use-dashboard-utils'
import { PropertyMetrics, ChartDataPoint, RadarChartData } from '@/types/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, LineChart, Line, Legend } from 'recharts'
import { Calendar, DollarSign, Home, Info, Target, Percent, TrendingUp, TrendingDown } from 'lucide-react'
import { useDashboard } from '@/contexts/dashboard'
import { useDashboardBatch } from '@/hooks/use-api'
import { useModal } from '@/contexts/modal'
import { useTips } from '@/hooks/use-tips'
import { MetricCard } from '@/components/MetricCard'
import { ChartWrapper } from '@/components/ChartWrapper'
import { StateWrapper } from '@/components/StateWrapper'
import { METRIC_COLORS, getOccupancyColor } from '@/lib/theme'

interface PropertyCardProps {
  property: PropertyMetrics
  previousProperty?: PropertyMetrics
  comparisonMode: 'none' | 'previous-period' | 'previous-year'
}

const PropertyCard = ({ property, previousProperty, comparisonMode }: PropertyCardProps) => {
  const { openModal } = useModal()

  const getGrowthIndicator = (current: number, previous?: number) => {
    if (comparisonMode === 'none' || !previous) return null
    const growth = ((current - previous) / previous) * 100
    const isPositive = growth > 0
    return (
      <span className={`text-xs flex items-center gap-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {Math.abs(growth).toFixed(0)}%
      </span>
    )
  }

  return (
    <div
      className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:shadow-md hover:border-blue-200 transition-all"
      onClick={() => openModal({
        type: 'property',
        propertyId: property.propertyId,
        propertyName: property.propertyName
      })}
    >
      <h3 className="text-lg font-bold mb-4">{property.propertyName}</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm text-gray-600">Money Earned</div>
          <div className="flex items-center gap-2">
            <div className="text-xl font-semibold">{formatCurrency(property.revenue)}</div>
            {getGrowthIndicator(property.revenue, previousProperty?.revenue)}
          </div>
          {comparisonMode !== 'none' && previousProperty && (
            <div className="text-xs text-gray-500">
              vs {formatCompactCurrency(previousProperty.revenue)}
            </div>
          )}
        </div>
        <div>
          <div className="text-sm text-gray-600">Reservations</div>
          <div className="flex items-center gap-2">
            <div className="text-xl font-semibold">{property.bookings}</div>
            {getGrowthIndicator(property.bookings, previousProperty?.bookings)}
          </div>
          {comparisonMode !== 'none' && previousProperty && (
            <div className="text-xs text-gray-500">
              vs {previousProperty.bookings}
            </div>
          )}
        </div>
        <div>
          <div className="text-sm text-gray-600">Occupancy</div>
          <div className="flex items-center gap-2">
            <div className={`text-xl font-semibold ${getOccupancyColor(property.occupancyRate * 100)}`}>
              {formatPercentage(property.occupancyRate * 100, 0)}
            </div>
            {getGrowthIndicator(property.occupancyRate, previousProperty?.occupancyRate)}
          </div>
          <div className="text-xs text-gray-500">
            {property.bookedNights} of {property.availableNights} nights
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-600">Nightly Rate</div>
          <div className="flex items-center gap-2">
            <div className="text-xl font-semibold">{formatCurrency(property.avgNightlyRate)}</div>
            {getGrowthIndicator(property.avgNightlyRate, previousProperty?.avgNightlyRate)}
          </div>
          <div className="text-xs text-gray-500">Average</div>
        </div>
      </div>
    </div>
  )
}

export const PropertiesDashboard = () => {
  const { filters, comparisonRange, comparisonMode } = useDashboard()
  const { showTips } = useTips()
  
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
    name: p.propertyName.length > 20 ? p.propertyName.substring(0, 20) + '...' : p.propertyName,
    fullName: p.propertyName, // Keep full name for tooltip
    revenue: p.revenue || 0,
    occupancy: Math.round((p.occupancyRate || 0) * 100), // Round to integer for cleaner display
    bookings: p.bookings || 0,
    date: p.date || null // Include date if available for period detection
  })), [validProperties])

  const timePeriod = getTimePeriodGranularity(filters.dateRange.from, filters.dateRange.to)

  const { maxRevenue, maxAvgRate, maxBookings } = useMemo(() => ({
    maxRevenue: maxBy(validProperties, (p: PropertyMetrics) => p.revenue)?.revenue || 1,
    maxAvgRate: maxBy(validProperties, (p: PropertyMetrics) => p.avgNightlyRate)?.avgNightlyRate || 1,
    maxBookings: maxBy(validProperties, (p: PropertyMetrics) => p.bookings)?.bookings || 1
  }), [validProperties])

  const radarData = useMemo<RadarChartData[]>(() => validProperties.map((p: PropertyMetrics) => ({
    property: p.propertyName.length > 15 ? p.propertyName.substring(0, 15) + '...' : p.propertyName,
    revenue: (p.revenue / maxRevenue) * 100,
    occupancy: p.occupancyRate * 100,
    avgRate: (p.avgNightlyRate / maxAvgRate) * 100,
    bookings: (p.bookings / maxBookings) * 100
  })), [validProperties, maxRevenue, maxAvgRate, maxBookings])

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
          emptyIcon={<Home className="w-16 h-16 text-gray-300 mb-4" />}
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

      <div className="grid md:grid-cols-4 gap-4">
        <MetricCard
          icon={Home}
          label="Properties You Manage"
          value={(properties || []).length}
          format="number"
          tooltip="Number of active properties in your portfolio"
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
          label="Combined Revenue"
          value={totalRevenue}
          format="currency"
          tooltip="Total revenue across all properties"
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
          label="Average Fullness"
          value={avgOccupancy * 100}
          format="percent"
          tooltip="Average occupancy rate across all properties"
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
          label="Total Reservations"
          value={totalBookings}
          format="number"
          tooltip="Total number of bookings across all properties"
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

      <div className="grid md:grid-cols-3 gap-6">
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

      <div className="grid md:grid-cols-2 gap-6">
        <ChartWrapper
          title={comparisonMode !== 'none' ? `Revenue Comparison${timePeriod}` : `Money vs Fullness${timePeriod}`}
          subtitle={comparisonMode !== 'none' 
            ? `Comparing current period vs ${comparisonMode === 'previous-year' ? 'last year' : 'previous period'}`
            : undefined
          }
          icon={TrendingUp}
          height={320}
        >
          {comparisonMode !== 'none' && previousProperties ? (
            <LineChart data={chartData.map((item: ChartDataPoint) => {
              const prevProp = previousProperties.find((p: PropertyMetrics) => 
                p.propertyName === item.fullName || 
                (p.propertyName.length > 20 ? p.propertyName.substring(0, 20) + '...' : p.propertyName) === item.name
              )
              return {
                ...item,
                previousRevenue: prevProp?.revenue || 0,
                previousOccupancy: Math.round((prevProp?.occupancyRate || 0) * 100)
              }
            })}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis tickFormatter={(value: number) => formatCompactCurrency(value)} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '6px' }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke={METRIC_COLORS.revenue} 
                name="Current Period"
                strokeWidth={2}
                dot={{ fill: METRIC_COLORS.revenue }}
              />
              <Line 
                type="monotone" 
                dataKey="previousRevenue" 
                stroke="#94a3b8" 
                name={comparisonMode === 'previous-year' ? 'Last Year' : 'Previous Period'}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: '#94a3b8' }}
              />
            </LineChart>
          ) : (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                yAxisId="left"
                tickFormatter={(value: number) => formatCompactCurrency(value)}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                tickFormatter={(value: number) => `${value}%`}
              />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === 'Money Earned') return formatCurrency(value)
                  if (name === 'Nights Booked %') return `${value}% of nights`
                  return value
                }}
                contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                labelFormatter={(label: any, payload: any) => {
                  if (payload && payload.length > 0) {
                    return payload[0].payload.fullName
                  }
                  return label
                }}
              />
              <Bar yAxisId="left" dataKey="revenue" fill={METRIC_COLORS.revenue} name="Money Earned" />
              <Bar yAxisId="right" dataKey="occupancy" fill={METRIC_COLORS.occupancy} name="Nights Booked %" />
            </BarChart>
          )}
        </ChartWrapper>

        <ChartWrapper
          title="Property Comparison"
          subtitle="Compare all metrics at once - bigger shapes mean better performance"
          icon={Target}
          height={320}
        >
          <RadarChart data={radarData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="property" />
            <PolarRadiusAxis angle={90} domain={[0, 100]} />
            <Radar name="Money Earned" dataKey="revenue" stroke={METRIC_COLORS.revenue} fill={METRIC_COLORS.revenue} fillOpacity={0.3} />
            <Radar name="Nights Booked" dataKey="occupancy" stroke={METRIC_COLORS.occupancy} fill={METRIC_COLORS.occupancy} fillOpacity={0.3} />
            <Radar name="Nightly Rate" dataKey="avgRate" stroke={METRIC_COLORS.bookings} fill={METRIC_COLORS.bookings} fillOpacity={0.3} />
            <Tooltip formatter={(value: number) => `${value.toFixed(0)}%`} />
          </RadarChart>
        </ChartWrapper>
      </div>
    </div>
  )
}
