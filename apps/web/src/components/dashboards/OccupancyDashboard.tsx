import { useEffect } from 'react'
import { OccupancyHeatmap } from '@/components/OccupancyHeatmap'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { Calendar, Home, AlertCircle, Info, Percent, BarChart3 } from 'lucide-react'
import { useDashboard } from '@/contexts/dashboard'
import { useOccupancy } from '@/hooks/use-api'
import { useToast } from '@/contexts/toast'
import { MetricCard } from '@/components/MetricCard'
import { ChartWrapper } from '@/components/ChartWrapper'
import { StateWrapper } from '@/components/StateWrapper'
import { formatPercentage, minBy } from '@baileys/utils'
import { METRIC_COLORS } from '@/lib/theme'
import { useModal } from '@/contexts/modal'

export const OccupancyDashboard = () => {
  const { filters } = useDashboard()
  const { addToast } = useToast()
  const { openModal } = useModal()
  
  const tagIds = filters.selectedTags.map(t => t.id)
  const { data, error, isLoading } = useOccupancy(
    filters.dateRange.from,
    filters.dateRange.to,
    tagIds
  )

  useEffect(() => {
    if (error) {
      addToast('error', `Failed to load occupancy data: ${error.message}`)
    }
  }, [error?.message, addToast])

  if (isLoading || !data) {
    return (
      <StateWrapper
        loading={isLoading}
        empty={!data && !isLoading}
        loadingMessage="Loading occupancy data..."
        emptyMessage="No occupancy data available"
        minHeight={400}
        className="py-12"
      >
        <div />
      </StateWrapper>
    )
  }

  const monthlyChartData = data.byMonth.map((m: any) => ({
    month: m.month.slice(5),
    fullMonth: m.month,
    rate: m.rate * 100,
    bookedNights: m.bookedNights,
    availableNights: m.availableNights,
    tooltip: `${m.bookedNights} / ${m.availableNights} nights`
  }))

  const lowestMonth = minBy(data.byMonth, (m: any) => m.rate) || { month: '', rate: 1 }

  const formatMonthDisplay = (monthStr: string): string => {
    if (!monthStr) return 'N/A'
    const [year, month] = monthStr.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

  const handleMonthClick = (data: any) => {
    if (data && data.activeLabel) {
      const monthData = monthlyChartData.find((m: any) => m.month === data.activeLabel)
      if (monthData) {
        const [year, month] = monthData.fullMonth.split('-')
        openModal({
          type: 'month',
          month,
          year
        })
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">How Busy Are Your Properties?</h2>
        <p className="text-gray-600 text-sm mt-1">
          Track when your properties are booked and identify opportunities to fill empty nights
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
          <div className="text-sm text-blue-800">
            <strong>Understanding Your Numbers:</strong> Occupancy shows what percentage of available nights were booked. 
            Higher percentages mean fewer empty nights. Look for patterns to optimize pricing and availability.
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <MetricCard
          icon={Percent}
          label="How Full You Were"
          value={data.overall * 100}
          format="percent"
          subValue={`${data.bookedNights.toLocaleString()} booked out of ${data.availableNights.toLocaleString()}`}
          tooltip="Percentage of nights that were booked"
          color={data.overall > 0.7 ? "green" : data.overall > 0.5 ? "yellow" : "red"}
        />
        <MetricCard
          icon={Calendar}
          label="Nights With Guests"
          value={data.bookedNights}
          format="number"
          subValue="In selected period"
          tooltip="Total nights with guests"
          color="blue"
        />
        <MetricCard
          icon={Home}
          label="Total Bookable Nights"
          value={data.availableNights}
          format="number"
          subValue="Across all properties"
          tooltip="Total nights properties could be booked"
          color="purple"
        />
        <MetricCard
          icon={AlertCircle}
          label="Most Empty Nights"
          value={formatMonthDisplay(lowestMonth.month)}
          format="custom"
          subValue={`Only ${formatPercentage(lowestMonth.rate * 100, 0)} booked`}
          tooltip="Month with most empty nights"
          color="orange"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <ChartWrapper
          title="Monthly Booking Patterns"
          icon={BarChart3}
          height={320}
        >
          <LineChart data={monthlyChartData} onClick={handleMonthClick}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis
              tickFormatter={(value: any) => `${value}%`}
              domain={[0, 100]}
            />
            <Tooltip
              formatter={(value: number) => [`${value.toFixed(1)}% booked`, 'Occupancy']}
              labelFormatter={(label: any, payload: any) => {
                const data = payload?.[0]?.payload
                if (data?.bookedNights && data?.availableNights) {
                  return `${label}: ${data.bookedNights} nights booked out of ${data.availableNights}`
                }
                return label
              }}
              contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '6px' }}
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
        </ChartWrapper>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-bold mb-4 flex items-center">
            <Home className="w-5 h-5 mr-2" />
            How Each Property Is Doing
          </h3>
          <div className="space-y-3">
            {data.byProperty.length > 0 ? (
              data.byProperty
                .sort((a: any, b: any) => b.rate - a.rate)
                .map((property: any) => {
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
                            {occupancyPercent >= 20 && (
                              <span className="text-xs text-white font-medium">
                                {property.bookedNights}/{property.availableNights}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
            ) : (
              <div className="text-center text-gray-500 py-8">
                <Home className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No property data available</p>
                <p className="text-xs text-gray-400 mt-2">Data will appear once bookings are synced</p>
              </div>
            )}
          </div>
          {data.byProperty.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-sm mr-1"></div>
                  <span className="text-gray-600">Great (70%+)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-yellow-500 rounded-sm mr-1"></div>
                  <span className="text-gray-600">OK (50-69%)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-red-500 rounded-sm mr-1"></div>
                  <span className="text-gray-600">Needs Work (&lt;50%)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="text-lg font-bold mb-4 flex items-center">
          <Calendar className="w-5 h-5 mr-2" />
          Daily Booking Calendar
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Darker colors show busier days. Click any date to see details.
        </p>
        <OccupancyHeatmap
          dateRange={filters.dateRange}
          tagIds={filters.selectedTags.map(t => t.id)}
        />
      </div>
    </div>
  )
}
