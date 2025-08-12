import { useEffect } from 'react'
import { PropertyMetrics } from '@/types/dashboard'
import { formatCurrency, formatCompactCurrency, formatPercentage, sumBy, calculateAverage, maxBy } from '@baileys/utils'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts'
import { Calendar, DollarSign, Home, Info, BarChart3, Target, Percent } from 'lucide-react'
import { useDashboard } from '@/contexts/dashboard'
import { usePropertyMetrics } from '@/hooks/use-api'
import { useToast } from '@/contexts/toast'
import { useModal } from '@/contexts/modal'
import { MetricCard } from '@/components/MetricCard'
import { ChartWrapper } from '@/components/ChartWrapper'
import { StateWrapper } from '@/components/StateWrapper'
import { METRIC_COLORS, getOccupancyColor } from '@/lib/theme'

const PropertyCard = ({ property }: { property: PropertyMetrics }) => {
  const { openModal } = useModal()

  return (
    <div
      className="bg-white p-6 rounded-lg shadow-sm cursor-pointer"
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
          <div className="text-xl font-semibold">{formatCurrency(property.revenue)}</div>
        </div>
        <div>
          <div className="text-sm text-gray-600">Reservations</div>
          <div className="text-xl font-semibold">{property.bookings}</div>
        </div>
        <div>
          <div className="text-sm text-gray-600">How Full</div>
          <div className={`text-xl font-semibold ${getOccupancyColor(property.occupancyRate * 100)}`}>
            {formatPercentage(property.occupancyRate * 100, 0)}
          </div>
          <div className="text-xs text-gray-500">
            {property.bookedNights} of {property.availableNights} nights
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-600">Nightly Rate</div>
          <div className="text-xl font-semibold">{formatCurrency(property.avgNightlyRate)}</div>
          <div className="text-xs text-gray-500">Average</div>
        </div>
      </div>
    </div>
  )
}

export const PropertiesDashboard = () => {
  const { filters } = useDashboard()
  const { addToast } = useToast()
  
  const { data: properties, error, isLoading } = usePropertyMetrics(
    filters.dateRange.from,
    filters.dateRange.to,
    filters.selectedTags.map(t => t.id)
  )

  // Handle error state
  useEffect(() => {
    if (error) {
      addToast('error', 'Failed to load property metrics')
    }
  }, [error?.message, addToast])

  if (isLoading || !properties || properties.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Your Properties at a Glance</h2>
          <p className="text-gray-600 text-sm mt-1">
            See how each property is performing and compare them side by side
          </p>
        </div>
        <StateWrapper
          loading={isLoading}
          empty={!properties || properties.length === 0}
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

  const chartData = (properties || []).map((p: any) => ({
    name: p.propertyName.length > 20 ? p.propertyName.substring(0, 20) + '...' : p.propertyName,
    fullName: p.propertyName, // Keep full name for tooltip
    revenue: p.revenue,
    occupancy: Math.round(p.occupancyRate * 100), // Round to integer for cleaner display
    bookings: p.bookings
  }))

  const maxRevenue = maxBy(properties || [], (p: any) => p.revenue)?.revenue || 1
  const maxAvgRate = maxBy(properties || [], (p: any) => p.avgNightlyRate)?.avgNightlyRate || 1
  const maxBookings = maxBy(properties || [], (p: any) => p.bookings)?.bookings || 1

  const radarData = (properties || []).map((p: any) => ({
    property: p.propertyName.length > 15 ? p.propertyName.substring(0, 15) + '...' : p.propertyName,
    revenue: (p.revenue / maxRevenue) * 100,
    occupancy: p.occupancyRate * 100,
    avgRate: (p.avgNightlyRate / maxAvgRate) * 100,
    bookings: (p.bookings / maxBookings) * 100
  }))

  const totalRevenue = sumBy(properties || [], (p: any) => p.revenue)
  const totalBookings = sumBy(properties || [], (p: any) => p.bookings)
  const avgOccupancy = calculateAverage((properties || []).map((p: any) => p.occupancyRate))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Your Properties at a Glance</h2>
        <p className="text-gray-600 text-sm mt-1">
          See how each property is performing and compare them side by side
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
          <div className="text-sm text-blue-800">
            <strong>Reading Your Data:</strong> Click any property card to see detailed insights. 
            Higher occupancy means fewer empty nights. Compare revenue and rates to identify your top performers.
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <MetricCard
          icon={Home}
          label="Properties You Manage"
          value={(properties || []).length}
          format="number"
          subValue="In selected period"
          tooltip="Number of properties you manage"
          color="blue"
        />
        <MetricCard
          icon={DollarSign}
          label="Combined Revenue"
          value={totalRevenue}
          format="currency"
          subValue="All properties"
          tooltip="Combined revenue from all properties"
          color="green"
        />
        <MetricCard
          icon={Percent}
          label="Average Fullness"
          value={avgOccupancy * 100}
          format="percent"
          subValue="Across all properties"
          tooltip="Average percentage of nights booked"
          color={avgOccupancy > 0.7 ? "green" : avgOccupancy > 0.5 ? "yellow" : "red"}
        />
        <MetricCard
          icon={Calendar}
          label="Total Reservations"
          value={totalBookings}
          format="number"
          subValue="In selected period"
          tooltip="Total number of reservations"
          color="purple"
        />
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {(properties || []).map((property: any) => (
          <PropertyCard key={property.propertyId} property={property} />
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <ChartWrapper
          title="Money vs Fullness"
          subtitle="Blue bars show revenue, green bars show how full each property is"
          icon={BarChart3}
          height={320}
        >
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
                  tickFormatter={(value: any) => formatCompactCurrency(value)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  tickFormatter={(value: any) => `${value}%`}
                />
                <Tooltip
                  formatter={(value: any, name: string) => {
                    if (name === 'Money Earned') return formatCurrency(value)
                    if (name === 'Nights Booked %') return `${value}% of nights`
                    return value
                  }}
                  contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                  labelFormatter={(label: any, payload: any) => {
                    // Show full property name in tooltip
                    if (payload && payload.length > 0) {
                      return payload[0].payload.fullName
                    }
                    return label
                  }}
                />
                <Bar yAxisId="left" dataKey="revenue" fill={METRIC_COLORS.revenue} name="Money Earned" />
                <Bar yAxisId="right" dataKey="occupancy" fill={METRIC_COLORS.occupancy} name="Nights Booked %" />
              </BarChart>
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
