import { useState, useEffect } from 'react'
import { PropertyMetrics } from '@/types/dashboard'
import { formatCurrency, formatCompactCurrency, formatPercentage, sumBy, calculateAverage, maxBy, isValidDateRange } from '@baileys/utils'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts'
import { TrendingUp, Calendar, DollarSign, Home } from 'lucide-react'
import { useDashboard } from '@/contexts/dashboard'
import { api } from '@/lib/api'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/contexts/toast'
import { useDrillDown } from '@/contexts/drillDown'
import { METRIC_COLORS, getOccupancyColor } from '@/lib/theme'

const PropertyCard = ({ property }: { property: PropertyMetrics }) => {
  const { dispatch } = useDrillDown()

  return (
    <div
      className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer"
      onClick={() => dispatch({
        type: 'DRILL_TO_PROPERTY',
        propertyId: property.propertyId,
        propertyName: property.propertyName
      })}
    >
      <h3 className="text-lg font-bold mb-4">{property.propertyName}</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm text-gray-600">Revenue</div>
          <div className="text-xl font-semibold">{formatCurrency(property.revenue)}</div>
        </div>
        <div>
          <div className="text-sm text-gray-600">Bookings</div>
          <div className="text-xl font-semibold">{property.bookings}</div>
        </div>
        <div>
          <div className="text-sm text-gray-600">Occupancy</div>
          <div className={`text-xl font-semibold ${getOccupancyColor(property.occupancyRate * 100)}`}>
            {formatPercentage(property.occupancyRate * 100, 0)}
          </div>
          <div className="text-xs text-gray-500">
            {property.bookedNights} / {property.availableNights} nights
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-600">Avg Nightly</div>
          <div className="text-xl font-semibold">{formatCurrency(property.avgNightlyRate)}</div>
        </div>
      </div>
    </div>
  )
}

export const PropertiesDashboard = () => {
  const { filters } = useDashboard()
  const { addToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [properties, setProperties] = useState<PropertyMetrics[]>([])

  const loadMetrics = async () => {
    if (!isValidDateRange(filters.dateRange.from, filters.dateRange.to)) {
      addToast('error', 'Invalid date range selected')
      return
    }

    setLoading(true)
    const result = await api.getPropertyMetrics(
      filters.dateRange.from,
      filters.dateRange.to,
      filters.selectedTags.map(t => t.id)
    )

    if (result.success) {
      console.log('Property metrics loaded:', result.data) // Debug log
      setProperties(result.data)
    } else {
      addToast('error', 'Failed to load property metrics')
    }
    setLoading(false)
  }

  useEffect(() => {
    loadMetrics()
  }, [filters.dateRange, filters.selectedTags])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  const chartData = properties.map(p => ({
    name: p.propertyName,
    revenue: p.revenue,
    occupancy: p.occupancyRate * 100, // Convert to percentage for display
    bookings: p.bookings
  }))

  const maxRevenue = maxBy(properties, p => p.revenue)?.revenue || 1
  const maxAvgRate = maxBy(properties, p => p.avgNightlyRate)?.avgNightlyRate || 1
  const maxBookings = maxBy(properties, p => p.bookings)?.bookings || 1

  const radarData = properties.map(p => ({
    property: p.propertyName,
    revenue: (p.revenue / maxRevenue) * 100,
    occupancy: p.occupancyRate * 100, // Already 0-100 scale
    avgRate: (p.avgNightlyRate / maxAvgRate) * 100,
    bookings: (p.bookings / maxBookings) * 100
  }))

  const totalRevenue = sumBy(properties, p => p.revenue)
  const totalBookings = sumBy(properties, p => p.bookings)
  const avgOccupancy = calculateAverage(properties.map(p => p.occupancyRate))

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Property Performance</h2>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <Home className="w-4 h-4 mr-1" />
            Total Properties
          </div>
          <div className="text-3xl font-bold">{properties.length}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <DollarSign className="w-4 h-4 mr-1" />
            Total Revenue
          </div>
          <div className="text-3xl font-bold">
            {formatCompactCurrency(totalRevenue)}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <Calendar className="w-4 h-4 mr-1" />
            Avg Occupancy
          </div>
          <div className={`text-3xl font-bold ${getOccupancyColor(avgOccupancy * 100)}`}>
            {formatPercentage(avgOccupancy * 100, 0)}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <TrendingUp className="w-4 h-4 mr-1" />
            Total Bookings
          </div>
          <div className="text-3xl font-bold">
            {totalBookings}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {properties.map(property => (
          <PropertyCard key={property.propertyId} property={property} />
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4">Revenue & Occupancy Comparison</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis yAxisId="left" tickFormatter={(value) => formatCompactCurrency(value)} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `${value}%`} />
                <Tooltip
                  formatter={(value: any, name: string) => {
                    if (name === 'Revenue') return formatCurrency(value)
                    if (name === 'Occupancy %') return `${Number(value).toFixed(1)}%`
                    return value
                  }}
                />
                <Bar yAxisId="left" dataKey="revenue" fill={METRIC_COLORS.revenue} name="Revenue" />
                <Bar yAxisId="right" dataKey="occupancy" fill={METRIC_COLORS.occupancy} name="Occupancy %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4">Performance Radar</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="property" />
                <PolarRadiusAxis angle={90} domain={[0, 100]} />
                <Radar name="Revenue" dataKey="revenue" stroke={METRIC_COLORS.revenue} fill={METRIC_COLORS.revenue} fillOpacity={0.3} />
                <Radar name="Occupancy" dataKey="occupancy" stroke={METRIC_COLORS.occupancy} fill={METRIC_COLORS.occupancy} fillOpacity={0.3} />
                <Radar name="Avg Rate" dataKey="avgRate" stroke={METRIC_COLORS.bookings} fill={METRIC_COLORS.bookings} fillOpacity={0.3} />
                <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
