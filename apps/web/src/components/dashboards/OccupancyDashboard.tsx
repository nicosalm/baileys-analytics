import { useMemo, useState, useCallback } from 'react'
import { OccupancyHeatmap } from '@/components/OccupancyHeatmap'
import { BookingGapAlert } from '@/components/BookingGapAlert'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { Calendar, Home, Info, Percent, TrendingUp, TrendingDown } from 'lucide-react'
import { useDashboard } from '@/contexts/dashboard'
import { useDashboardBatch } from '@/hooks/use-api'
import { useTagIds, useErrorToast, useComparisonDateRange } from '@/hooks/use-dashboard-utils'
import { useTips } from '@/hooks/use-tips'
import { MetricCard } from '@/components/MetricCard'
import { ChartWrapper } from '@/components/ChartWrapper'
import { detectGranularity } from '@/utils/chart-helpers'
import { StateWrapper } from '@/components/StateWrapper'
import { formatPercentage, minBy } from '@baileys/utils'
import { METRIC_COLORS } from '@/lib/theme'
import { useModal } from '@/contexts/modal'
import { OccupancyTrendData, OccupancyByProperty } from '@/types/api'

export const OccupancyDashboard = () => {
  const { filters, comparisonRange, comparisonMode } = useDashboard()
  const { openModal } = useModal()
  const { showTips } = useTips()
  const tagIds = useTagIds()
  const comparisonDateRange = useComparisonDateRange()
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
        emptySubMessage="Occupancy data will appear once bookings are synced"
        emptyIcon={<Percent className="w-12 h-12 text-gray-500 opacity-50 mb-2" />}
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

  const chartData = useMemo(() => timeSeriesData.map((dataPoint: OccupancyTrendData, index: number) => {
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
      rate: Math.min(dataPoint.rate * 100, 100),
      previousRate: prevDataPoint ? Math.min(prevDataPoint.rate * 100, 100) : undefined,
      bookedNights: dataPoint.bookedNights,
      availableNights: dataPoint.availableNights,
      tooltip: `${dataPoint.bookedNights} / ${dataPoint.availableNights} nights`
    }
  }), [timeSeriesData, previousData?.byMonth, dataGranularity])

  const lowestPeriod = minBy(timeSeriesData, (d: OccupancyTrendData) => d.rate) || { month: '', rate: 1 }

  // memoize sorted property list
  const sortedProperties = useMemo(() =>
    currentData.byProperty
      .slice()
      .sort((a: OccupancyByProperty, b: OccupancyByProperty) => b.rate - a.rate)
      .slice(0, 10),
    [currentData.byProperty]
  )

  const formatPeriodDisplay = useCallback((dateStr: string): string => {
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
  }, [dataGranularity])

  const handlePeriodClick = useCallback((data: {activeLabel?: string}) => {
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
  }, [chartData, dataGranularity, openModal])

  // memoized property click handler
  const handlePropertyClick = useCallback((property: OccupancyByProperty) => {
    openModal({
      type: 'property',
      propertyId: property.propertyId,
      propertyName: property.propertyName
    })
  }, [openModal])

  // memoized XAxis config
  const xAxisConfig = useMemo(() => {
    const shouldRotate = (dataGranularity === 'Daily' && chartData.length > 15) ||
                         (dataGranularity === 'Weekly' && chartData.length > 10)
    return {
      angle: shouldRotate ? -45 : 0,
      textAnchor: shouldRotate ? 'end' : 'middle' as const,
      height: shouldRotate ? 60 : undefined,
      interval: dataGranularity === 'Daily' && chartData.length > 30
        ? Math.ceil(chartData.length / 15)
        : dataGranularity === 'Weekly' && chartData.length > 12 ? 1 : 0
    }
  }, [dataGranularity, chartData.length])

  // memoized tooltip formatter
  const tooltipFormatter = useCallback((value: number, name: string) => {
    if (name === 'Current Period') return [`${value.toFixed(1)}%`, 'Current']
    if (name === 'Last Year' || name === 'Previous Period') return [`${value.toFixed(1)}%`, name]
    return [null, null]
  }, [])

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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <MetricCard
          icon={Percent}
          label="Occupancy Rate"
          value={currentData.overall * 100}
          format="percent"
          tooltip="Percentage of available nights booked"
          subValue={comparisonMode !== 'none' && previousData?.overall !== undefined
            ? <>vs {comparisonMode === 'previous-year' ? 'last year' : 'previous period'}: {formatPercentage(previousData.overall * 100, 0)}{comparisonDateRange && <span className="block text-xs text-gray-400 mt-0.5">{comparisonDateRange}</span>}</>
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
          label="Booked Nights"
          value={currentData.bookedNights}
          format="number"
          tooltip="Total nights booked across all properties"
          subValue={comparisonMode !== 'none' && previousData?.bookedNights !== undefined
            ? <>vs {comparisonMode === 'previous-year' ? 'last year' : 'previous period'}: {previousData.bookedNights.toLocaleString()} nights{comparisonDateRange && <span className="block text-xs text-gray-400 mt-0.5">{comparisonDateRange}</span>}</>
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
          label="Available Nights"
          value={currentData.availableNights}
          format="number"
          tooltip="Total nights available for booking"
          subValue={comparisonMode !== 'none' && previousData?.availableNights !== undefined
            ? <>vs {comparisonMode === 'previous-year' ? 'last year' : 'previous period'}: {previousData.availableNights.toLocaleString()}{comparisonDateRange && <span className="block text-xs text-gray-400 mt-0.5">{comparisonDateRange}</span>}</>
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
        height={360}
      >
        <LineChart data={chartData} onClick={handlePeriodClick} style={{ cursor: 'pointer' }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
            angle={xAxisConfig.angle}
            textAnchor={xAxisConfig.textAnchor}
            height={xAxisConfig.height}
            interval={xAxisConfig.interval}
          />
          <YAxis
            tickFormatter={(value: number) => `${Math.round(value)}%`}
            domain={[0, 100]}
            allowDataOverflow
          />
          <Tooltip
            formatter={tooltipFormatter}
            labelFormatter={(label: any) => label}
            contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '6px' }}
          />
          {comparisonMode !== 'none' && previousData && <Legend />}
          <Line
            type="monotone"
            dataKey="rate"
            stroke={METRIC_COLORS.occupancy}
            strokeWidth={3}
            dot={{ fill: METRIC_COLORS.occupancy, r: 6 }}
            style={{ cursor: 'pointer' }}
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

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Property Occupancy</h3>
            {currentData.byProperty.length > 5 && (
              <span className="text-xs text-gray-500">Top {Math.min(currentData.byProperty.length, 10)} of {currentData.byProperty.length}</span>
            )}
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto overflow-x-hidden">
            {sortedProperties.length > 0 ? (
              sortedProperties.map((property: OccupancyByProperty) => {
                const occupancyPercent = property.rate * 100
                const prevProperty = previousData?.byProperty?.find((p: OccupancyByProperty) => p.propertyId === property.propertyId)
                const prevOccupancy = prevProperty ? prevProperty.rate * 100 : null

                return (
                  <div
                    key={property.propertyId}
                    className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-gray-50 cursor-pointer px-2 -mx-2 rounded transition-colors"
                    onClick={() => handlePropertyClick(property)}
                  >
                    <div className="flex-1 min-w-0 mr-4">
                      <p className="text-sm font-medium truncate">{property.propertyName || `Property ${property.propertyId.slice(0, 8)}`}</p>
                      <p className="text-xs text-gray-500">{property.bookedNights}/{property.availableNights} nights booked</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-sm font-semibold ${
                        occupancyPercent >= 70 ? 'text-green-600' :
                        occupancyPercent >= 50 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
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
                )
              })
            ) : (
              <div className="text-center text-gray-500 py-8">
                <Home className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">No property data available</p>
                <p className="text-xs text-gray-400 mt-1">Data will appear once bookings are synced</p>
              </div>
            )}
          </div>
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
                <h3 className="text-lg font-bold">Booking Gaps</h3>
                <span className="text-xs text-gray-500">Next 60 days</span>
              </div>
              <div className="text-center py-8 text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">No gaps detected</p>
                <p className="text-xs text-gray-400 mt-1">All properties are well-booked</p>
              </div>
            </div>
          )
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="mb-4">
          <h3 className="text-lg font-bold flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-gray-600" />
            Daily Occupancy Calendar
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Click any day to see booking details
          </p>
        </div>
        <OccupancyHeatmap
          dateRange={filters.dateRange}
          tagIds={filters.selectedTags.map(t => t.id)}
        />
      </div>
    </div>
  )
}
