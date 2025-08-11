import { useEffect } from 'react'
import { PropertyMetrics } from '@/types/dashboard'
import { formatCurrency, formatCompactCurrency, formatPercentage, sumBy, calculateAverage, maxBy } from '@baileys/utils'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts'
import { Calendar, DollarSign, Home, Info, BarChart3, Target, Percent } from 'lucide-react'
import { useDashboard } from '@/contexts/dashboard'
import { usePropertyMetrics } from '@/hooks/use-api'
import { LoadingState } from '@/components/LoadingState'
import { useToast } from '@/contexts/toast'
import { useModal } from '@/contexts/modal'
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

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingState />
      </div>
    )
  }

  if (!properties || properties.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Your Properties at a Glance</h2>
          <p className="text-gray-600 text-sm mt-1">
            See how each property is performing and compare them side by side
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-12 bg-white rounded-lg shadow-sm">
          <Home className="w-16 h-16 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No Properties Found</h3>
          <p className="text-gray-500 text-center max-w-md">
            Properties will appear here once they're synced from your booking platform.
          </p>
        </div>
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
        <div className="bg-white p-6 rounded-lg shadow-sm" title="Number of properties you manage">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <Home className="w-4 h-4 mr-1" />
            Properties You Manage
          </div>
          <div className="text-3xl font-bold">{(properties || []).length}</div>
          <div className="text-xs text-gray-500 mt-1">In selected period</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm" title="Combined revenue from all properties">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <DollarSign className="w-4 h-4 mr-1" />
            Combined Revenue
          </div>
          <div className="text-3xl font-bold">
            {formatCompactCurrency(totalRevenue)}
          </div>
          <div className="text-xs text-gray-500 mt-1">All properties</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm" title="Average percentage of nights booked">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <Percent className="w-4 h-4 mr-1" />
            Average Fullness
          </div>
          <div className={`text-3xl font-bold ${getOccupancyColor(avgOccupancy * 100)}`}>
            {formatPercentage(avgOccupancy * 100, 0)}
          </div>
          <div className="text-xs text-gray-500 mt-1">Across all properties</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm" title="Total number of reservations">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <Calendar className="w-4 h-4 mr-1" />
            Total Reservations
          </div>
          <div className="text-3xl font-bold">
            {totalBookings}
          </div>
          <div className="text-xs text-gray-500 mt-1">In selected period</div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {(properties || []).map((property: any) => (
          <PropertyCard key={property.propertyId} property={property} />
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-bold mb-4 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            Money vs Fullness
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Blue bars show revenue, green bars show how full each property is
          </p>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
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
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-bold mb-4 flex items-center">
            <Target className="w-5 h-5 mr-2" />
            Property Comparison
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Compare all metrics at once - bigger shapes mean better performance
          </p>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="property" />
                <PolarRadiusAxis angle={90} domain={[0, 100]} />
                <Radar name="Money Earned" dataKey="revenue" stroke={METRIC_COLORS.revenue} fill={METRIC_COLORS.revenue} fillOpacity={0.3} />
                <Radar name="Nights Booked" dataKey="occupancy" stroke={METRIC_COLORS.occupancy} fill={METRIC_COLORS.occupancy} fillOpacity={0.3} />
                <Radar name="Nightly Rate" dataKey="avgRate" stroke={METRIC_COLORS.bookings} fill={METRIC_COLORS.bookings} fillOpacity={0.3} />
                <Tooltip formatter={(value: number) => `${value.toFixed(0)}%`} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
