import { useState, useEffect } from 'react'
import { OccupancyMetrics } from '@/types/dashboard'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Calendar, TrendingUp, Home, AlertCircle } from 'lucide-react'
import { useDashboard } from '@/contexts/dashboard'
import { api } from '@/lib/api'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/contexts/toast'
import { formatPercentage, minBy, isValidDateRange } from '@baileys/utils'
import { METRIC_COLORS, getOccupancyColor } from '@/lib/theme'
import { useDrillDown } from '@/contexts/drillDown'

export const OccupancyDashboard = () => {
  const { filters } = useDashboard()
  const { addToast } = useToast()
  const { dispatch } = useDrillDown()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<OccupancyMetrics | null>(null)

  const loadOccupancy = async () => {
    if (!isValidDateRange(filters.dateRange.from, filters.dateRange.to)) {
      addToast('error', 'Invalid date range selected')
      return
    }

    setLoading(true)
    const result = await api.getOccupancy(
      filters.dateRange.from,
      filters.dateRange.to,
      filters.selectedTags.map(t => t.id)
    )

    if (result.success) {
      setData(result.data)
    } else {
      addToast('error', 'Failed to load occupancy data')
    }
    setLoading(false)
  }

  useEffect(() => {
    loadOccupancy()
  }, [filters.dateRange, filters.selectedTags])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!data) return null

  const propertyChartData = data.byProperty.map(p => ({
    name: p.propertyName || `Property ${p.propertyId}`,
    propertyId: p.propertyId,
    occupancy: p.rate * 100,
    available: (1 - p.rate) * 100
  }))

  const monthlyChartData = data.byMonth.map(m => ({
    month: m.month.slice(5),
    fullMonth: m.month,
    rate: m.rate * 100
  }))

  const lowestMonth = minBy(data.byMonth, m => m.rate) || { month: '', rate: 1 }

  const handleMonthClick = (data: any) => {
    if (data && data.activeLabel) {
      const monthData = monthlyChartData.find(m => m.month === data.activeLabel)
      if (monthData) {
        const [year, month] = monthData.fullMonth.split('-')
        dispatch({
          type: 'DRILL_TO_MONTH',
          month,
          year
        })
      }
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Occupancy Analytics</h2>

      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <TrendingUp className="w-4 h-4 mr-1" />
            Overall Occupancy
          </div>
          <div className={`text-3xl font-bold ${getOccupancyColor(data.overall)}`}>
            {formatPercentage(data.overall * 100, 0)}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <Calendar className="w-4 h-4 mr-1" />
            Booked Nights
          </div>
          <div className="text-3xl font-bold">{data.bookedNights}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <Home className="w-4 h-4 mr-1" />
            Available Nights
          </div>
          <div className="text-3xl font-bold">{data.availableNights - data.bookedNights}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <AlertCircle className="w-4 h-4 mr-1" />
            Low Season
          </div>
          <div className="text-3xl font-bold">{lowestMonth.month}</div>
          <div className="text-sm text-gray-500">{formatPercentage(lowestMonth.rate * 100, 0)} occupancy</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4">Monthly Occupancy Trend</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyChartData} onClick={handleMonthClick}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => formatPercentage(value, 0)} domain={[0, 100]} />
                <Tooltip formatter={(value) => formatPercentage(Number(value), 0)} />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke={METRIC_COLORS.occupancy}
                  strokeWidth={3}
                  dot={{ fill: METRIC_COLORS.occupancy, r: 6, cursor: 'pointer' }}
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4">Property Occupancy Comparison</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={propertyChartData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => formatPercentage(value, 0)} />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ cursor: 'pointer' }}
                  onClick={(data) => {
                    const property = propertyChartData.find(p => p.name === data.value)
                    if (property) {
                      dispatch({
                        type: 'DRILL_TO_PROPERTY',
                        propertyId: property.propertyId,
                        propertyName: property.name
                      })
                    }
                  }}
                />
                <Tooltip formatter={(value) => formatPercentage(Number(value), 0)} />
                <Bar dataKey="occupancy" stackId="a" fill={METRIC_COLORS.occupancy} name="Occupied" />
                <Bar dataKey="available" stackId="a" fill="#E5E7EB" name="Available" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-bold mb-4">Occupancy Calendar Heat Map</h3>
        <div className="text-center text-gray-500 py-12">
          Calendar view coming soon - will show daily occupancy patterns
        </div>
      </div>
    </div>
  )
}
