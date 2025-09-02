import { OccupancyHeatmap } from '@/components/OccupancyHeatmap'
import { BookingGapAlert } from '@/components/BookingGapAlert'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { Calendar, Home, Info, Percent, TrendingUp, TrendingDown } from 'lucide-react'
import { useDashboard } from '@/contexts/dashboard'
import { useDashboardBatch } from '@/hooks/use-api'
import { useTagIds, useErrorToast } from '@/hooks/use-dashboard-utils'
import { useTips } from '@/hooks/use-tips'
import { MetricCard } from '@/components/MetricCard'
import { ChartWrapper } from '@/components/ChartWrapper'
import { detectGranularity } from '@/utils/chart-helpers'
import { StateWrapper } from '@/components/StateWrapper'
import { formatPercentage, minBy } from '@baileys/utils'
import { METRIC_COLORS } from '@/lib/theme'
import { useModal } from '@/contexts/modal'
import { OccupancyTrendData, OccupancyByProperty } from '@/types/api'
import { useState } from 'react'

export const OccupancyDashboard = () => {
  const { filters, comparisonRange, comparisonMode } = useDashboard()
  const { openModal } = useModal()
  const { showTips } = useTips()
  const tagIds = useTagIds()
  const [gapAlertDismissed, setGapAlertDismissed] = useState(false)
  
  const { data, error, isLoading } = useDashboardBatch(
    'occupancy',
    filters.dateRange.from,
    filters.dateRange.to,
    tagIds,
    comparisonRange?.from,
    comparisonRange?.to
  )

  const currentData = data?.current || data
  const previousData = data?.previous || null
  const bookingGaps = currentData?.gaps || []
  
  // only show gaps that are not dismissed and have critical or warning severity
  const visibleGaps = bookingGaps.filter((gap: any) => 
    gap.severity === 'critical' || gap.severity === 'warning'
  )

  useErrorToast(error, 'Failed to load occupancy data')

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

  const timeSeriesData = currentData.byMonth || []
  const dataGranularity = detectGranularity(timeSeriesData, 'month')
  
  const getChartTitle = () => {
    switch (dataGranularity) {
      case 'Daily':
        return 'Daily Booking Patterns'
      case 'Weekly':
        return 'Weekly Booking Patterns'
      case 'Monthly':
      default:
        return 'Monthly Booking Patterns'
    }
  }

  const chartData = timeSeriesData.map((dataPoint: OccupancyTrendData, index: number) => {
    const prevDataPoint = previousData?.byMonth?.find((pd: OccupancyTrendData) => pd.month === dataPoint.month) ||
                         (previousData?.byMonth?.[index])
    
    let label: string
    if (dataGranularity === 'Daily') {
      const [year, month, day] = dataPoint.month.split('-')
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day || '1'))
      label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } else if (dataGranularity === 'Weekly') {
      const [year, month, day] = dataPoint.month.split('-')
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day || '1'))
      label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } else {
      const [year, month] = dataPoint.month.split('-')
      const date = new Date(parseInt(year), parseInt(month) - 1)
      const hasMultipleYears = timeSeriesData.some((d: OccupancyTrendData) => {
        const [y] = d.month.split('-')
        return y !== year
      })
      label = hasMultipleYears 
        ? date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
        : date.toLocaleDateString('en-US', { month: 'short' })
    }
    
    return {
      month: label,
      fullMonth: dataPoint.month,
      rate: dataPoint.rate * 100,
      previousRate: prevDataPoint ? prevDataPoint.rate * 100 : undefined,
      bookedNights: dataPoint.bookedNights,
      availableNights: dataPoint.availableNights,
      tooltip: `${dataPoint.bookedNights} / ${dataPoint.availableNights} nights`
    }
  })

  const lowestPeriod = minBy(timeSeriesData, (d: OccupancyTrendData) => d.rate) || { month: '', rate: 1 }

  const formatPeriodDisplay = (dateStr: string): string => {
    if (!dateStr) return 'N/A'
    
    if (dataGranularity === 'Daily' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateStr.split('-')
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }
    
    if (dataGranularity === 'Weekly' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateStr.split('-')
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    }
    
    const [year, month] = dateStr.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

  const handlePeriodClick = (data: {activeLabel?: string}) => {
    if (data && data.activeLabel) {
      const clickedData = chartData.find((d: {month: string; fullMonth: string}) => d.month === data.activeLabel)
      if (clickedData) {
        let granularity: 'daily' | 'weekly' | 'monthly' = 'monthly'
        
        switch (dataGranularity) {
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
        
        const [year, month, day] = clickedData.fullMonth.split('-')
        
        openModal({
          type: 'period',
          month,
          year,
          day,
          originalDate: clickedData.fullMonth,
          granularity
        })
      }
    }
  }

  return (
    <div className="space-y-6">
      
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">How Busy Are Your Properties?</h2>
            <p className="text-gray-600 text-sm mt-1">
              Track when your properties are booked and identify opportunities to fill empty nights
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-gray-500">Current Occupancy</div>
              <div className="text-lg font-bold text-blue-600">
                {formatPercentage(currentData.overall * 100, 0)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">Booked Nights</div>
              <div className="text-lg font-bold text-gray-900">
                {currentData.bookedNights.toLocaleString()}
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
          tooltip="Percentage of available nights that were booked"
          subValue={comparisonMode !== 'none' && previousData?.overall !== undefined
            ? `vs ${comparisonMode === 'previous-year' ? 'last year' : 'previous period'}: ${formatPercentage(previousData.overall * 100, 0)} | ${currentData.bookedNights.toLocaleString()} nights`
            : `${currentData.bookedNights.toLocaleString()} booked out of ${currentData.availableNights.toLocaleString()}`
          }
          trend={comparisonMode !== 'none' && previousData?.overall !== undefined ? {
            value: previousData.overall > 0 
              ? ((currentData.overall - previousData.overall) / previousData.overall) * 100
              : currentData.overall > 0 ? 100 : 0,
            isPositive: currentData.overall > previousData.overall
          } : undefined}
          color={currentData.overall > 0.7 ? "green" : currentData.overall > 0.5 ? "yellow" : "red"}
        />
        <MetricCard
          icon={Calendar}
          label="Nights With Guests"
          value={currentData.bookedNights}
          format="number"
          tooltip="Total nights with bookings across all properties"
          subValue={comparisonMode !== 'none' && previousData?.bookedNights !== undefined
            ? `vs ${comparisonMode === 'previous-year' ? 'last year' : 'previous period'}: ${previousData.bookedNights.toLocaleString()} nights`
            : "In selected period"
          }
          trend={comparisonMode !== 'none' && previousData?.bookedNights !== undefined ? {
            value: previousData.bookedNights > 0 
              ? ((currentData.bookedNights - previousData.bookedNights) / previousData.bookedNights) * 100
              : currentData.bookedNights > 0 ? 100 : 0,
            isPositive: currentData.bookedNights > previousData.bookedNights
          } : undefined}
          color="blue"
        />
        <MetricCard
          icon={Home}
          label="Total Bookable Nights"
          value={currentData.availableNights}
          format="number"
          tooltip="Maximum nights available for booking"
          subValue={comparisonMode !== 'none' && previousData?.availableNights !== undefined
            ? `vs ${comparisonMode === 'previous-year' ? 'last year' : 'previous period'}: ${previousData.availableNights.toLocaleString()}`
            : "Across all properties"
          }
          trend={comparisonMode !== 'none' && previousData?.availableNights !== undefined ? {
            value: previousData.availableNights > 0 
              ? ((currentData.availableNights - previousData.availableNights) / previousData.availableNights) * 100
              : currentData.availableNights > 0 ? 100 : 0,
            isPositive: currentData.availableNights > previousData.availableNights
          } : undefined}
          color="purple"
        />
        <MetricCard
          icon={TrendingDown}
          label={`Lowest ${dataGranularity === 'Daily' ? 'Day' : dataGranularity === 'Weekly' ? 'Week' : 'Month'}`}
          value={formatPeriodDisplay(lowestPeriod.month)}
          format="custom"
          subValue={`Only ${formatPercentage(lowestPeriod.rate * 100, 0)} booked`}
          tooltip={`${dataGranularity === 'Daily' ? 'Day' : dataGranularity === 'Weekly' ? 'Week' : 'Month'} with lowest occupancy rate in the selected period`}
          color="yellow"
        />
      </div>


      <ChartWrapper
        title={getChartTitle()}
        subtitle={comparisonMode !== 'none' && previousData 
          ? `Comparing current period vs ${comparisonMode === 'previous-year' ? 'last year' : 'previous period'}`
          : undefined
        }
        icon={TrendingUp}
        height={320}
      >
        <LineChart data={chartData} onClick={handlePeriodClick}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="month"
            angle={(dataGranularity === 'Daily' && chartData.length > 15) || (dataGranularity === 'Weekly' && chartData.length > 10) ? -45 : 0}
            textAnchor={(dataGranularity === 'Daily' && chartData.length > 15) || (dataGranularity === 'Weekly' && chartData.length > 10) ? 'end' : 'middle'}
            height={(dataGranularity === 'Daily' && chartData.length > 15) || (dataGranularity === 'Weekly' && chartData.length > 10) ? 60 : undefined}
            interval={
              dataGranularity === 'Daily' && chartData.length > 30 ? Math.ceil(chartData.length / 15) : 
              dataGranularity === 'Weekly' && chartData.length > 12 ? 1 : 
              0
            }
          />
          <YAxis
            tickFormatter={(value: number) => `${value}%`}
            domain={[0, 100]}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              `${value.toFixed(1)}%`, 
              name === 'rate' ? 'Current' : comparisonMode === 'previous-year' ? 'Last Year' : 'Previous Period'
            ]}
            labelFormatter={(label: any) => label}
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

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold mb-4 flex items-center">
            <Home className="w-5 h-5 mr-2" />
            Property Performance
            {currentData.byProperty.length > 10 && (
              <span className="ml-auto text-xs text-gray-500">Showing all {currentData.byProperty.length} properties</span>
            )}
          </h3>
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {currentData.byProperty.length > 0 ? (
              currentData.byProperty
                .sort((a: OccupancyByProperty, b: OccupancyByProperty) => b.rate - a.rate)
                .map((property: OccupancyByProperty) => {
                  const occupancyPercent = property.rate * 100
                  const prevProperty = previousData?.byProperty?.find((p: OccupancyByProperty) => p.propertyId === property.propertyId)
                  const prevOccupancy = prevProperty ? prevProperty.rate * 100 : null
                  const occupancyColor = occupancyPercent >= 70 ? 'bg-gradient-to-r from-green-500 to-green-600' :
                                         occupancyPercent >= 50 ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' :
                                         'bg-gradient-to-r from-red-500 to-red-600'

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
                        <div className="w-full bg-gray-100 rounded-full h-5 overflow-hidden">
                          <div
                            className={`${occupancyColor} h-5 rounded-full flex items-center justify-end pr-2 transition-all duration-500`}
                            style={{ width: `${Math.max(occupancyPercent, 5)}%` }}
                          >
                            {occupancyPercent >= 25 && (
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
              <div className="flex justify-center gap-4 text-xs">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-sm mr-1"></div>
                  <span className="text-gray-600">Excellent (70%+)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-yellow-500 rounded-sm mr-1"></div>
                  <span className="text-gray-600">Good (50-70%)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-red-500 rounded-sm mr-1"></div>
                  <span className="text-gray-600">Low (&lt;50%)</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Booking Gaps Alert - Always Visible */}
        {!gapAlertDismissed && (
          visibleGaps.length > 0 ? (
            <BookingGapAlert 
              gaps={visibleGaps}
              onDismiss={() => setGapAlertDismissed(true)}
              maxGapsToShow={3}
            />
          ) : (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-gray-600" />
                  <h3 className="text-lg font-bold">Booking Gaps</h3>
                </div>
                <span className="text-xs text-gray-500">Next 60 days</span>
              </div>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="bg-green-50 rounded-full p-4 mb-4">
                  <Calendar className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-gray-700 font-medium mb-2">No gaps detected!</p>
                <p className="text-sm text-gray-500">All properties are well-booked for the next 60 days</p>
              </div>
            </div>
          )
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="text-lg font-bold mb-4 flex items-center">
          <Calendar className="w-5 h-5 mr-2" />
          Daily Occupancy Calendar
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Click any day to see details
        </p>
        <OccupancyHeatmap
          dateRange={filters.dateRange}
          tagIds={filters.selectedTags.map(t => t.id)}
        />
      </div>
    </div>
  )
}
