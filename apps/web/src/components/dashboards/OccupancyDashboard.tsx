import { useEffect } from 'react'
import { OccupancyHeatmap } from '@/components/OccupancyHeatmap'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { Calendar, Home, AlertCircle, Info, Percent, BarChart3, TrendingUp, TrendingDown } from 'lucide-react'
import { useDashboard } from '@/contexts/dashboard'
import { useOccupancy } from '@/hooks/use-api'
import { useToast } from '@/contexts/toast'
import { useTips } from '@/hooks/use-tips'
import { MetricCard } from '@/components/MetricCard'
import { ChartWrapper } from '@/components/ChartWrapper'
import { detectGranularity } from '@/utils/chart-helpers'
import { StateWrapper } from '@/components/StateWrapper'
import { formatPercentage, minBy, differenceInDays } from '@baileys/utils'
import { METRIC_COLORS } from '@/lib/theme'
import { useModal } from '@/contexts/modal'

export const OccupancyDashboard = () => {
  const { filters, comparisonRange, comparisonMode } = useDashboard()
  const { addToast } = useToast()
  const { openModal } = useModal()
  const { showTips } = useTips()
  
  const tagIds = filters.selectedTags.map(t => t.id)
  const { data, error, isLoading } = useOccupancy(
    filters.dateRange.from,
    filters.dateRange.to,
    tagIds,
    comparisonRange?.from,
    comparisonRange?.to
  )

  // Handle both API response formats
  const currentData = data?.current || data
  const previousData = data?.previous || null

  useEffect(() => {
    if (error) {
      addToast('error', `Failed to load occupancy data: ${error.message}`)
    }
  }, [error?.message, addToast])

  if (isLoading || !currentData) {
    return (
      <StateWrapper
        loading={isLoading}
        empty={!currentData && !isLoading}
        loadingMessage="Loading occupancy data..."
        emptyMessage="No occupancy data available"
        minHeight={400}
        className="py-12"
      >
        <div />
      </StateWrapper>
    )
  }

  // Determine time period based on date range
  const getTimePeriod = () => {
    if (!filters.dateRange.from || !filters.dateRange.to) return ''
    const daysDiff = differenceInDays(
      new Date(filters.dateRange.to),
      new Date(filters.dateRange.from)
    )
    
    if (daysDiff <= 7) return ' (Daily)'
    if (daysDiff <= 35) return ' (Weekly)'
    return ' (Monthly)'
  }

  const monthlyChartData = currentData.byMonth.map((m: any) => {
    const prevMonth = previousData?.byMonth?.find((pm: any) => pm.month.slice(5) === m.month.slice(5))
    return {
      month: m.month.slice(5),
      fullMonth: m.month,
      rate: m.rate * 100,
      previousRate: prevMonth ? prevMonth.rate * 100 : undefined,
      bookedNights: m.bookedNights,
      availableNights: m.availableNights,
      tooltip: `${m.bookedNights} / ${m.availableNights} nights`
    }
  })

  const lowestMonth = minBy(currentData.byMonth, (m: any) => m.rate) || { month: '', rate: 1 }

  const formatMonthDisplay = (monthStr: string): string => {
    if (!monthStr) return 'N/A'
    const [year, month] = monthStr.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

  const handlePeriodClick = (data: any) => {
    if (data && data.activeLabel) {
      const monthData = monthlyChartData.find((m: any) => m.month === data.activeLabel)
      if (monthData) {
        // Detect the actual granularity of the data
        const detectedGranularity = detectGranularity(currentData.byMonth || [], 'month')
        let granularity: 'daily' | 'weekly' | 'monthly' = 'monthly'
        
        switch (detectedGranularity) {
          case 'Daily':
            granularity = 'daily'
            break
          case 'Weekly':
            granularity = 'weekly'
            break
          case 'Monthly':
          default:
            granularity = 'monthly'
            break
        }
        
        const [year, month] = monthData.fullMonth.split('-')
        const day = monthData.fullMonth.split('-')[2] // Will be undefined for monthly data
        
        openModal({
          type: 'period',
          month,
          year,
          day,
          originalDate: monthData.fullMonth,
          granularity
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
      {showTips && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
            <div className="text-sm text-blue-800">
              <strong>Understanding Your Numbers:</strong> Occupancy shows what percentage of available nights were booked. 
              Higher percentages mean fewer empty nights. Look for patterns to optimize pricing and availability.
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-4 gap-4">
        <MetricCard
          icon={Percent}
          label="How Full You Were"
          value={currentData.overall * 100}
          format="percent"
          subValue={comparisonMode !== 'none' && previousData?.overall !== undefined
            ? `vs ${comparisonMode === 'previous-year' ? 'last year' : 'previous period'}: ${formatPercentage(previousData.overall * 100, 0)} | ${currentData.bookedNights.toLocaleString()} nights`
            : `${currentData.bookedNights.toLocaleString()} booked out of ${currentData.availableNights.toLocaleString()}`
          }
          trend={comparisonMode !== 'none' && previousData?.overall !== undefined ? {
            value: ((currentData.overall - previousData.overall) / previousData.overall) * 100,
            isPositive: currentData.overall > previousData.overall
          } : undefined}
          tooltip="Percentage of nights that were booked"
          color={currentData.overall > 0.7 ? "green" : currentData.overall > 0.5 ? "yellow" : "red"}
        />
        <MetricCard
          icon={Calendar}
          label="Nights With Guests"
          value={currentData.bookedNights}
          format="number"
          subValue={comparisonMode !== 'none' && previousData?.bookedNights !== undefined
            ? `vs ${comparisonMode === 'previous-year' ? 'last year' : 'previous period'}: ${previousData.bookedNights.toLocaleString()} nights`
            : "In selected period"
          }
          trend={comparisonMode !== 'none' && previousData?.bookedNights ? {
            value: ((currentData.bookedNights - previousData.bookedNights) / previousData.bookedNights) * 100,
            isPositive: currentData.bookedNights > previousData.bookedNights
          } : undefined}
          tooltip="Total nights with guests"
          color="blue"
        />
        <MetricCard
          icon={Home}
          label="Total Bookable Nights"
          value={currentData.availableNights}
          format="number"
          subValue={comparisonMode !== 'none' && previousData?.availableNights !== undefined
            ? `vs ${comparisonMode === 'previous-year' ? 'last year' : 'previous period'}: ${previousData.availableNights.toLocaleString()}`
            : "Across all properties"
          }
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
          title={`Monthly Booking Patterns${getTimePeriod()}`}
          subtitle={comparisonMode !== 'none' && previousData 
            ? `Comparing current period vs ${comparisonMode === 'previous-year' ? 'last year' : 'previous period'}`
            : undefined
          }
          icon={BarChart3}
          height={320}
        >
          <LineChart data={monthlyChartData} onClick={handlePeriodClick}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis
              tickFormatter={(value: any) => `${value}%`}
              domain={[0, 100]}
            />
            <Tooltip
              formatter={(value: number, name: string) => [
                `${value.toFixed(1)}% booked`, 
                name === 'rate' ? 'Current' : comparisonMode === 'previous-year' ? 'Last Year' : 'Previous Period'
              ]}
              labelFormatter={(label: any, payload: any) => {
                const data = payload?.[0]?.payload
                if (data?.bookedNights && data?.availableNights) {
                  return `${label}: ${data.bookedNights} nights booked out of ${data.availableNights}`
                }
                return label
              }}
              contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '6px' }}
            />
            {comparisonMode !== 'none' && previousData && <Legend />}
            <Line
              type="monotone"
              dataKey="rate"
              stroke={METRIC_COLORS.occupancy}
              strokeWidth={3}
              dot={{ fill: METRIC_COLORS.occupancy, r: 6, cursor: 'pointer' }}
              activeDot={{ r: 8 }}
              name="Current Period"
            />
            {comparisonMode !== 'none' && previousData && (
              <Line
                type="monotone"
                dataKey="previousRate"
                stroke="#94a3b8"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: '#94a3b8', r: 4 }}
                name={comparisonMode === 'previous-year' ? 'Last Year' : 'Previous Period'}
              />
            )}
          </LineChart>
        </ChartWrapper>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-bold mb-4 flex items-center">
            <Home className="w-5 h-5 mr-2" />
            How Each Property Is Doing
          </h3>
          <div className="space-y-3">
            {currentData.byProperty.length > 0 ? (
              currentData.byProperty
                .sort((a: any, b: any) => b.rate - a.rate)
                .map((property: any) => {
                  const occupancyPercent = property.rate * 100
                  const prevProperty = previousData?.byProperty?.find((p: any) => p.propertyId === property.propertyId)
                  const prevOccupancy = prevProperty ? prevProperty.rate * 100 : null
                  const occupancyColor = occupancyPercent >= 70 ? 'bg-green-500' :
                                         occupancyPercent >= 50 ? 'bg-yellow-500' :
                                         'bg-red-500'

                  return (
                    <div key={property.propertyId} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm truncate max-w-[200px]" title={property.propertyName}>
                          {property.propertyName || `Property ${property.propertyId.slice(0, 8)}`}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">
                            {formatPercentage(occupancyPercent, 0)}
                          </span>
                          {comparisonMode !== 'none' && prevOccupancy !== null && (
                            <span className={`text-xs flex items-center gap-0.5 ${occupancyPercent > prevOccupancy ? 'text-green-600' : occupancyPercent < prevOccupancy ? 'text-red-600' : 'text-gray-500'}`}>
                              {occupancyPercent > prevOccupancy ? (
                                <TrendingUp className="w-3 h-3" />
                              ) : occupancyPercent < prevOccupancy ? (
                                <TrendingDown className="w-3 h-3" />
                              ) : null}
                              {Math.abs(occupancyPercent - prevOccupancy).toFixed(0)}%
                            </span>
                          )}
                        </div>
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
          {currentData.byProperty.length > 0 && (
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
