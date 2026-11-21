import { useMemo, useState, useCallback } from 'react'
import { OccupancyHeatmap } from '@/components/OccupancyHeatmap'
import { OccupancyListView } from '@/components/OccupancyListView'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from 'recharts'
import { Button } from '@/components/ui/button'
import { Calendar, Home, Percent, TrendingUp, TrendingDown, List } from 'lucide-react'
import { useDashboard } from '@/contexts/dashboard'
import { useDashboardBatch, useGoalProgress } from '@/hooks/use-api'
import { useTagIds, usePropertyIds, useErrorToast, useComparisonDateRange } from '@/hooks/use-dashboard-utils'
import { MetricCard } from '@/components/MetricCard'
import { WhatIfCalculator } from '@/components/WhatIfCalculator'
import { PacingRunway } from '@/components/pacing/PacingRunway'
import { ChartWrapper } from '@/components/ChartWrapper'
import { detectGranularity } from '@/utils/chart-helpers'
import { StateWrapper } from '@/components/StateWrapper'
import { formatPercentage, minBy } from '@baileys/utils'
import { METRIC_COLORS, CHART_INFRA } from '@/lib/theme'
import { useModal } from '@/contexts/modal'
import type { OccupancyTrendData, OccupancyByProperty } from '@/types/api'
import type { TooltipContentProps } from 'recharts'
import { METRIC_DEFINITIONS } from '@/lib/metric-definitions'

const OccupancyChartTooltip = ({ active, payload, label }: Partial<TooltipContentProps<number, string>>) => {
  if (!active || !payload?.length) return null
  const data = payload[0].payload
  const emptyNights = data.availableNights - data.bookedNights

  return (
    <div className="bg-card p-3 rounded-lg shadow-lg border border-border">
      <p className="font-semibold text-sm mb-2">{label}</p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: METRIC_COLORS.occupancy }} />
            <span className="text-muted-foreground">Occupancy:</span>
          </div>
          <span className="font-medium">{data.rate.toFixed(1)}%</span>
        </div>
        {data.previousRate !== undefined && (
          <div className="flex justify-between gap-4">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-chart-comparison" />
              <span className="text-muted-foreground">Previous:</span>
            </div>
            <span className="font-medium">{data.previousRate.toFixed(1)}%</span>
          </div>
        )}
        <div className="pt-1 mt-1 border-t border-border space-y-1">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Booked:</span>
            <span className="font-medium">{data.bookedNights.toLocaleString()} nights</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Available:</span>
            <span className="font-medium">{data.availableNights.toLocaleString()} nights</span>
          </div>
          {emptyNights > 0 && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Empty:</span>
              <span className="font-medium text-warning">{emptyNights.toLocaleString()} nights</span>
            </div>
          )}
        </div>
        <p className="text-muted-foreground/70 pt-1 mt-1 border-t border-border">Click to view details</p>
      </div>
    </div>
  )
}

export const OccupancyDashboard = () => {
  const { filters, comparisonRange, comparisonMode, comparisonLabel } = useDashboard()
  const { openModal } = useModal()
  const tagIds = useTagIds()
  const propertyIds = usePropertyIds()
  const comparisonDateRange = useComparisonDateRange()
  const [calendarView, setCalendarView] = useState<'calendar' | 'list'>('list')
  const { data: goalProgressData } = useGoalProgress()
  const occupancyGoal = useMemo(() => {
    const goal = goalProgressData?.find((g) => g.metricKey === 'occupancy')
    return goal ? goal.targetValue : null
  }, [goalProgressData])

  const { data, error, isLoading } = useDashboardBatch(
    'occupancy',
    filters.dateRange.from,
    filters.dateRange.to,
    tagIds,
    comparisonRange?.from,
    comparisonRange?.to,
    propertyIds,
  )

  const currentData = data?.current || data
  const previousData = data?.previous || null

  useErrorToast(error, 'Failed to load occupancy data')

  const timeSeriesData = currentData?.byMonth || []
  const dataGranularity = detectGranularity(timeSeriesData, 'month')

  const prevByMonthMap = useMemo(
    () => new Map(((previousData?.byMonth as OccupancyTrendData[]) ?? []).map((pd) => [pd.month, pd])),
    [previousData?.byMonth],
  )

  const chartData = useMemo(
    () =>
      timeSeriesData.map((dataPoint: OccupancyTrendData, index: number) => {
        const prevDataPoint = prevByMonthMap.get(dataPoint.month) || previousData?.byMonth?.[index]

        let label: string
        if (dataGranularity === 'Daily') {
          const [year, month, day] = dataPoint.month.split('-')
          const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day || '1', 10))
          label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        } else if (dataGranularity === 'Weekly') {
          const [year, month, day] = dataPoint.month.split('-')
          const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day || '1', 10))
          label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        } else {
          const [year, month] = dataPoint.month.split('-')
          const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1)
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
        }
      }),
    [timeSeriesData, prevByMonthMap, dataGranularity],
  )

  const sortedProperties = useMemo(
    () =>
      (currentData?.byProperty || [])
        .slice()
        .sort((a: OccupancyByProperty, b: OccupancyByProperty) => b.rate - a.rate)
        .slice(0, 10),
    [currentData?.byProperty],
  )

  const prevByPropertyMap = useMemo(
    () => new Map(((previousData?.byProperty as OccupancyByProperty[]) ?? []).map((p) => [p.propertyId, p])),
    [previousData?.byProperty],
  )

  const formatPeriodDisplay = useCallback(
    (dateStr: string): string => {
      if (!dateStr) return 'N/A'

      if (dataGranularity === 'Daily' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = dateStr.split('-')
        const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10))
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      }

      if (dataGranularity === 'Weekly' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = dateStr.split('-')
        const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10))
        return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      }

      const [year, month] = dateStr.split('-')
      const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1)
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    },
    [dataGranularity],
  )

  const handlePeriodClick = useCallback(
    (data: { activeLabel?: string | number }) => {
      if (data?.activeLabel) {
        const clickedData = chartData.find((d: { month: string; fullMonth: string }) => d.month === data.activeLabel)
        if (clickedData) {
          let granularity: 'daily' | 'weekly' | 'monthly' = 'monthly'

          switch (dataGranularity) {
            case 'Daily':
              granularity = 'daily'
              break
            case 'Weekly':
              granularity = 'weekly'
              break
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
            granularity,
          })
        }
      }
    },
    [chartData, dataGranularity, openModal],
  )

  const handlePropertyClick = useCallback(
    (property: OccupancyByProperty) => {
      openModal({
        type: 'property',
        propertyId: property.propertyId,
        propertyName: property.propertyName,
      })
    },
    [openModal],
  )

  const xAxisConfig = useMemo(() => {
    const shouldRotate = (dataGranularity === 'Daily' && chartData.length > 15) || (dataGranularity === 'Weekly' && chartData.length > 10)
    return {
      angle: shouldRotate ? -45 : 0,
      textAnchor: shouldRotate ? ('end' as const) : ('middle' as const),
      height: shouldRotate ? 60 : undefined,
      interval:
        dataGranularity === 'Daily' && chartData.length > 30
          ? Math.ceil(chartData.length / 15)
          : dataGranularity === 'Weekly' && chartData.length > 12
            ? 1
            : 0,
    }
  }, [dataGranularity, chartData.length])

  if (isLoading || error || !currentData) {
    return (
      <StateWrapper
        loading={isLoading}
        error={error}
        empty={!currentData && !isLoading && !error}
        loadingMessage="Loading occupancy data..."
        emptyMessage="No occupancy data for this range"
        emptySubMessage="Numbers appear once bookings sync from OwnerRez."
        onRetry={() => window.location.reload()}
        minHeight={400}
        className="py-12"
      >
        <div />
      </StateWrapper>
    )
  }

  const getChartTitle = () => {
    switch (dataGranularity) {
      case 'Daily':
        return 'Daily Booking Patterns'
      case 'Weekly':
        return 'Weekly Booking Patterns'
      default:
        return 'Monthly Booking Patterns'
    }
  }

  // `lowestPeriod` is the day/week/month with the lowest occupancy *rate* —
  // the period with the most room to fill relative to its available inventory.
  // Null when there's no trend data at all; the card then hides.
  const lowestPeriod = timeSeriesData.length > 0 ? (minBy(timeSeriesData, (d: OccupancyTrendData) => d.rate) ?? null) : null
  const periodWord = dataGranularity === 'Daily' ? 'Day' : dataGranularity === 'Weekly' ? 'Week' : 'Month'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <MetricCard
          icon={Percent}
          label="Occupancy Rate"
          value={currentData.overall * 100}
          format="percent"
          tooltip={METRIC_DEFINITIONS.occupancy}
          subValue={
            comparisonMode !== 'none' && previousData?.overall !== undefined ? (
              <>
                vs {comparisonLabel}: {formatPercentage(previousData.overall * 100, 1)}
                {comparisonDateRange && <span className="block text-xs text-muted-foreground/70 mt-0.5">{comparisonDateRange}</span>}
              </>
            ) : (
              `${currentData.bookedNights.toLocaleString()} booked of ${currentData.availableNights.toLocaleString()} sellable${currentData.blockedNights ? ` | ${currentData.blockedNights.toLocaleString()} owner-blocked` : ''}`
            )
          }
          trend={
            comparisonMode !== 'none' && previousData?.overall !== undefined
              ? {
                  value:
                    previousData.overall > 0
                      ? ((currentData.overall - previousData.overall) / previousData.overall) * 100
                      : currentData.overall > 0
                        ? 100
                        : 0,
                  isPositive: currentData.overall > previousData.overall,
                }
              : undefined
          }
          staggerIndex={0}
        />
        <MetricCard
          icon={Calendar}
          label="Booked Nights"
          value={currentData.bookedNights}
          format="number"
          tooltip={METRIC_DEFINITIONS.bookedNights}
          subValue={
            comparisonMode !== 'none' && previousData?.bookedNights !== undefined ? (
              <>
                vs {comparisonLabel}: {previousData.bookedNights.toLocaleString()} nights
                {comparisonDateRange && <span className="block text-xs text-muted-foreground/70 mt-0.5">{comparisonDateRange}</span>}
              </>
            ) : undefined
          }
          trend={
            comparisonMode !== 'none' && previousData?.bookedNights !== undefined
              ? {
                  value:
                    previousData.bookedNights > 0
                      ? ((currentData.bookedNights - previousData.bookedNights) / previousData.bookedNights) * 100
                      : currentData.bookedNights > 0
                        ? 100
                        : 0,
                  isPositive: currentData.bookedNights > previousData.bookedNights,
                }
              : undefined
          }
          staggerIndex={1}
        />
        <MetricCard
          icon={Home}
          label="Available Nights"
          value={currentData.availableNights}
          format="number"
          tooltip={METRIC_DEFINITIONS.sellableNights}
          subValue={
            comparisonMode !== 'none' && previousData?.availableNights !== undefined ? (
              <>
                vs {comparisonLabel}: {previousData.availableNights.toLocaleString()}
                {comparisonDateRange && <span className="block text-xs text-muted-foreground/70 mt-0.5">{comparisonDateRange}</span>}
              </>
            ) : undefined
          }
          trend={
            comparisonMode !== 'none' && previousData?.availableNights !== undefined
              ? {
                  value:
                    previousData.availableNights > 0
                      ? ((currentData.availableNights - previousData.availableNights) / previousData.availableNights) * 100
                      : currentData.availableNights > 0
                        ? 100
                        : 0,
                  isPositive: currentData.availableNights > previousData.availableNights,
                }
              : undefined
          }
          staggerIndex={2}
        />
        <MetricCard
          icon={TrendingDown}
          label={`Softest ${periodWord}`}
          value={lowestPeriod ? `${lowestPeriod.availableNights - lowestPeriod.bookedNights} open` : '—'}
          format="custom"
          subValue={
            !lowestPeriod
              ? 'No trend data in this range'
              : occupancyGoal !== null
                ? (() => {
                    const deviation = lowestPeriod.rate * 100 - occupancyGoal
                    const isAbove = deviation >= 0
                    return (
                      <>
                        {formatPeriodDisplay(lowestPeriod.month)} ·{' '}
                        <span className={`inline-flex items-center gap-0.5 ${isAbove ? 'text-success' : 'text-danger'}`}>
                          {isAbove ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {Math.abs(deviation).toFixed(1)}% {isAbove ? 'above' : 'below'} goal
                        </span>
                      </>
                    )
                  })()
                : `${formatPeriodDisplay(lowestPeriod.month)} · ${formatPercentage(lowestPeriod.rate * 100, 1)} booked`
          }
          tooltip={`The ${periodWord.toLowerCase()} with the lowest occupancy in this range.${occupancyGoal !== null ? ` Your occupancy goal is ${occupancyGoal}%.` : ''}`}
          staggerIndex={3}
        />
      </div>

      <PacingRunway />

      <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-muted-foreground" />
              {calendarView === 'calendar' ? 'Occupancy Calendar' : 'Booking Timeline'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {calendarView === 'calendar' ? 'Tap a day to see its bookings.' : 'Stays arriving soon and the gaps between them.'}
            </p>
          </div>
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCalendarView('list')}
              className={
                calendarView === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }
            >
              <List className="w-4 h-4" />
              Timeline
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCalendarView('calendar')}
              className={
                calendarView === 'calendar' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }
            >
              <Calendar className="w-4 h-4" />
              Calendar
            </Button>
          </div>
        </div>
        {calendarView === 'calendar' ? (
          <OccupancyHeatmap dateRange={filters.dateRange} tagIds={filters.selectedTags.map((t) => t.id)} />
        ) : (
          <OccupancyListView
            properties={(currentData.byProperty || []).map((p: OccupancyByProperty) => ({
              propertyId: p.propertyId,
              propertyName: p.propertyName,
            }))}
          />
        )}
      </div>

      <WhatIfCalculator byProperty={currentData.byProperty} dateRange={filters.dateRange} />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartWrapper
            title={getChartTitle()}
            subtitle={comparisonMode !== 'none' && previousData ? `Current period vs ${comparisonLabel}` : undefined}
            icon={TrendingUp}
            height={360}
            noData={chartData.length === 0}
            noDataMessage="No occupancy data for this period"
          >
            <LineChart data={chartData} onClick={handlePeriodClick} style={{ cursor: 'pointer' }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_INFRA.grid} />
              <XAxis
                dataKey="month"
                angle={xAxisConfig.angle}
                textAnchor={xAxisConfig.textAnchor}
                height={xAxisConfig.height}
                interval={xAxisConfig.interval}
                stroke={CHART_INFRA.axis}
                tick={{ fill: CHART_INFRA.axis }}
              />
              <YAxis
                tickFormatter={(value: number) => `${Math.round(value)}%`}
                domain={[0, 100]}
                allowDataOverflow
                stroke={CHART_INFRA.axis}
                tick={{ fill: CHART_INFRA.axis }}
              />
              <Tooltip content={<OccupancyChartTooltip />} isAnimationActive={false} />
              {comparisonMode !== 'none' && previousData && <Legend />}
              {occupancyGoal !== null && (
                <ReferenceLine
                  y={occupancyGoal}
                  stroke={CHART_INFRA.goal}
                  strokeDasharray="6 4"
                  strokeWidth={1.5}
                  label={{
                    value: `⬥ Goal: ${occupancyGoal}%`,
                    position: 'insideTopLeft',
                    fill: CHART_INFRA.goal,
                    fontSize: 12,
                    fontWeight: 600,
                    offset: 4,
                  }}
                />
              )}
              <Line
                type="monotone"
                dataKey="rate"
                stroke={METRIC_COLORS.occupancy}
                strokeWidth={3}
                dot={{ fill: METRIC_COLORS.occupancy, r: 6, strokeWidth: 0 }}
                style={{ cursor: 'pointer' }}
                activeDot={{ r: 8, fill: METRIC_COLORS.occupancy }}
                name="Current Period"
              />
              {comparisonMode !== 'none' && previousData && (
                <Line
                  type="monotone"
                  dataKey="previousRate"
                  stroke={CHART_INFRA.comparison}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: CHART_INFRA.comparison, r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: CHART_INFRA.comparison }}
                  name={comparisonLabel || 'Previous Period'}
                />
              )}
            </LineChart>
          </ChartWrapper>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Home className="w-5 h-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold">Property Occupancy</h3>
            </div>
            {currentData.byProperty.length > 5 && (
              <span className="text-xs text-muted-foreground">
                Top {Math.min(currentData.byProperty.length, 10)} of {currentData.byProperty.length}
              </span>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto overflow-x-hidden pr-2 divide-y divide-border">
            {sortedProperties.length > 0 ? (
              sortedProperties.map((property: OccupancyByProperty) => {
                const occupancyPercent = property.rate * 100
                const prevProperty = prevByPropertyMap.get(property.propertyId)
                const prevOccupancy = prevProperty ? prevProperty.rate * 100 : null

                return (
                  <div
                    key={property.propertyId}
                    className="py-3 px-2 -mx-2 rounded hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => handlePropertyClick(property)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0 mr-3">
                        <p className="text-sm font-medium truncate">
                          {property.propertyName || `Property ${property.propertyId.slice(0, 8)}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {property.bookedNights}/{property.availableNights} nights
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-sm font-semibold ${
                            occupancyPercent >= 70 ? 'text-success' : occupancyPercent >= 50 ? 'text-warning' : 'text-danger'
                          }`}
                        >
                          {formatPercentage(occupancyPercent, 1)}
                        </span>
                        {comparisonMode !== 'none' && prevOccupancy !== null && (
                          <span
                            className={`text-xs flex items-center gap-0.5 ${occupancyPercent > prevOccupancy ? 'text-success' : occupancyPercent < prevOccupancy ? 'text-danger' : 'text-muted-foreground'}`}
                          >
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
                    <div className="mt-2 relative">
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            occupancyPercent >= 70 ? 'bg-success' : occupancyPercent >= 50 ? 'bg-warning' : 'bg-danger'
                          }`}
                          style={{ width: `${Math.min(occupancyPercent, 100)}%` }}
                        />
                      </div>
                      {comparisonMode !== 'none' && prevOccupancy !== null && prevOccupancy > 0 && (
                        <div
                          className="absolute top-0 w-0.5 h-1.5 bg-muted-foreground/50 rounded-full"
                          style={{ left: `${Math.min(prevOccupancy, 100)}%` }}
                          title={`Previous: ${formatPercentage(prevOccupancy, 1)}`}
                        />
                      )}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <Home className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">No property data available</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Data will appear once bookings are synced</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
