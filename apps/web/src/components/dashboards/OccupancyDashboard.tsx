import { useState, useEffect } from 'react'
import { OccupancyMetrics } from '@/types/dashboard'
import { OccupancyHeatmap } from '@/components/OccupancyHeatmap'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
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

    console.log('Occupancy API Response:', result) // Debug log

    if (result.success) {
      console.log('Occupancy data:', result.data) // Debug log
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

// FIX: Convert monthly rates to percentages
  const monthlyChartData = data.byMonth.map(m => ({
    month: m.month.slice(5),
    fullMonth: m.month,
    rate: m.rate * 100,  // Convert to percentage
    bookedNights: m.bookedNights,
    availableNights: m.availableNights,
    tooltip: `${m.bookedNights} / ${m.availableNights} nights`
  }))

  // FIX: Find lowest month with correct percentage
  const lowestMonth = minBy(data.byMonth, m => m.rate) || { month: '', rate: 1 }

  // Format month display (convert YYYY-MM to readable format)
  const formatMonthDisplay = (monthStr: string): string => {
    if (!monthStr) return 'N/A'
    const [year, month] = monthStr.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

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
          <div className={`text-3xl font-bold ${getOccupancyColor(data.overall * 100)}`}>
            {formatPercentage(data.overall * 100, 0)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {data.bookedNights.toLocaleString()} / {data.availableNights.toLocaleString()} nights
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <Calendar className="w-4 h-4 mr-1" />
            Booked Nights
          </div>
          <div className="text-3xl font-bold">{data.bookedNights.toLocaleString()}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <Home className="w-4 h-4 mr-1" />
            Available Nights
          </div>
          <div className="text-3xl font-bold">{data.availableNights.toLocaleString()}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <AlertCircle className="w-4 h-4 mr-1" />
            Low Season
          </div>
          <div className="text-3xl font-bold">
            {formatMonthDisplay(lowestMonth.month)}
          </div>
          <div className="text-sm text-gray-500">
            {formatPercentage(lowestMonth.rate * 100, 0)} occupancy
          </div>
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
                <YAxis
                  tickFormatter={(value) => `${value}%`}
                  domain={[0, 100]}
                />
                <Tooltip
                  formatter={(value: number) => `${value.toFixed(1)}%`}
                  labelFormatter={(label, payload) => {
                    const data = payload?.[0]?.payload
                    if (data?.bookedNights && data?.availableNights) {
                      return `Month: ${label} (${data.bookedNights} / ${data.availableNights} nights)`
                    }
                    return `Month: ${label}`
                  }}
                />
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
          <h3 className="text-lg font-bold mb-4">Property Performance</h3>
          <div className="space-y-3">
            {data.byProperty.length > 0 ? (
              data.byProperty
                .sort((a, b) => b.rate - a.rate)
                .map(property => {
                  const occupancyPercent = property.rate * 100
                  const occupancyColor = occupancyPercent >= 70 ? 'bg-green-500' :
                                         occupancyPercent >= 50 ? 'bg-yellow-500' :
                                         'bg-red-500'

                  return (
                    <div key={property.propertyId} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm truncate max-w-[200px]" title={property.propertyName}>
                          {property.propertyName || `Property ${property.propertyId.slice(0, 8)}`}
                        </span>
                        <span className="text-sm font-semibold">
                          {formatPercentage(occupancyPercent, 0)}
                        </span>
                      </div>
                      <div className="relative">
                        <div className="w-full bg-gray-200 rounded-full h-6">
                          <div
                            className={`${occupancyColor} h-6 rounded-full flex items-center justify-end pr-2 transition-all duration-500`}
                            style={{ width: `${Math.max(occupancyPercent, 5)}%` }}
                          >
                            <span className="text-xs text-white font-medium">
                              {property.bookedNights}/{property.availableNights}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
            ) : (
              <div className="text-center text-gray-500 py-8">
                No property data available
              </div>
            )}
          </div>
          {data.byProperty.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded mr-1"></div>
                  <span className="text-gray-600">≥70% Good</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-yellow-500 rounded mr-1"></div>
                  <span className="text-gray-600">50-69% Fair</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-red-500 rounded mr-1"></div>
                  <span className="text-gray-600">&lt;50% Low</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-bold mb-4">Occupancy Calendar Heat Map</h3>
        <OccupancyHeatmap
          dateRange={filters.dateRange}
          tagIds={filters.selectedTags.map(t => t.id)}
        />
      </div>
    </div>
  )
}
