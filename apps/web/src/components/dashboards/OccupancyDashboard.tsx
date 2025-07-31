import { useState, useEffect } from 'react'
import { OccupancyMetrics } from '@/types/dashboard'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Calendar, TrendingUp, Home, AlertCircle } from 'lucide-react'
import { useDashboard } from '@/contexts/dashboard'
import { api } from '@/lib/api'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/contexts/toast'

export const OccupancyDashboard = () => {
  const { filters } = useDashboard()
  const { addToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<OccupancyMetrics | null>(null)

  const loadOccupancy = async () => {
    setLoading(true)
    const result = await api.getOccupancy(filters.dateRange.from, filters.dateRange.to)

    if (result.success) {
      setData(result.data)
    } else {
      addToast('error', 'Failed to load occupancy data')
    }
    setLoading(false)
  }

  useEffect(() => {
    loadOccupancy()
  }, [filters.dateRange])

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
    occupancy: p.rate * 100,
    available: (1 - p.rate) * 100
  }))

  const monthlyChartData = data.byMonth.map(m => ({
    month: m.month.slice(5),
    rate: m.rate * 100
  }))

  const getOccupancyColor = (rate: number) => {
    if (rate >= 0.8) return '#10B981'
    if (rate >= 0.6) return '#F59E0B'
    return '#EF4444'
  }

  // Find lowest occupancy month
  const lowestMonth = data.byMonth.reduce((lowest, current) =>
    current.rate < lowest.rate ? current : lowest
  , data.byMonth[0] || { month: '', rate: 1 })

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Occupancy Analytics</h2>

      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <TrendingUp className="w-4 h-4 mr-1" />
            Overall Occupancy
          </div>
          <div className="text-3xl font-bold" style={{ color: getOccupancyColor(data.overall) }}>
            {(data.overall * 100).toFixed(0)}%
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
          <div className="text-sm text-gray-500">{(lowestMonth.rate * 100).toFixed(0)}% occupancy</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4">Monthly Occupancy Trend</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `${value}%`} domain={[0, 100]} />
                <Tooltip formatter={(value) => `${value}%`} />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="#3B82F6"
                  strokeWidth={3}
                  dot={{ fill: '#3B82F6', r: 6 }}
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
                <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                <YAxis dataKey="name" type="category" />
                <Tooltip formatter={(value) => `${value}%`} />
                <Bar dataKey="occupancy" stackId="a" fill="#3B82F6" name="Occupied" />
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
