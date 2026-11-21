import { useMemo, useState, useCallback } from 'react'
import { OccupancyHeatmap } from '@/components/OccupancyHeatmap'
import { OccupancyListView } from '@/components/OccupancyListView'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { Calendar, Home, Percent, TrendingUp, TrendingDown, List } from 'lucide-react'
import { useDashboard } from '@/contexts/dashboard'
import { useDashboardBatch, useGoalProgress } from '@/hooks/use-api'
import { useTagIds, usePropertyIds, useErrorToast, useComparisonDateRange } from '@/hooks/use-dashboard-utils'
import { MetricCard } from '@/components/MetricCard'
import { WhatIfCalculator } from '@/components/WhatIfCalculator'
import { PacingRunway } from '@/components/pacing/PacingRunway'
import { ChartWrapper } from '@/components/ChartWrapper'
import { ChartLegend } from '@/components/charts/ChartLegend'
import { detectGranularity } from '@/utils/chart-helpers'
import { StateWrapper } from '@/components/StateWrapper'
import { formatPercentage, minBy } from '@baileys/utils'
import { METRIC_COLORS, CHART_INFRA } from '@/lib/theme'
import { useModal } from '@/contexts/modal'
import type { OccupancyTrendData, OccupancyByProperty } from '@/types/api'
import type { TooltipContentProps } from 'recharts'
import { METRIC_DEFINITIONS } from '@/lib/metric-definitions'
import { SegmentedControl } from '@/components/ui/segmented-control'

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
              `${currentData.byProperty.length} ${currentData.byProperty.length === 1 ? 'property' : 'properties'}`
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
            ) : (
              `of ${currentData.availableNights.toLocaleString()} sellable`
            )
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
          label="Sellable Nights"
          value={currentData.availableNights}
          format="number"
          tooltip={METRIC_DEFINITIONS.sellableNights}
          subValue={
            comparisonMode !== 'none' && previousData?.availableNights !== undefined ? (
              <>
                vs {comparisonLabel}: {previousData.availableNights.toLocaleString()}
                {comparisonDateRange && <span className="block text-xs text-muted-foreground/70 mt-0.5">{comparisonDateRange}</span>}
              </>
            ) : currentData.blockedNights ? (
              `${currentData.blockedNights.toLocaleString()} owner-blocked excluded`
            ) : (
              'No owner blocks'
            )
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
            lowestPeriod
              ? `${formatPeriodDisplay(lowestPeriod.month)} · ${formatPercentage(lowestPeriod.rate * 100, 1)} booked${
                  occupancyGoal !== null ? `, goal ${occupancyGoal}%` : ''
                }`
              : 'No trend data in this range'
          }
          tooltip={`The ${periodWord.toLowerCase()} with the lowest occupancy in this range.${occupancyGoal !== null ? ` Your occupancy goal is ${occupancyGoal}%.` : ''}`}
          staggerIndex={3}
        />
      </div>

      <PacingRunway />

      <section className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <h3 className="text-lg font-semibold flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-muted-foreground" />
            {calendarView === 'calendar' ? 'Occupancy Calendar' : 'Booking Timeline'}
          </h3>
          <SegmentedControl
            label="Booking view"
            value={calendarView}
            onChange={setCalendarView}
            options={[
              { value: 'list', label: 'Timeline', icon: List },
              { value: 'calendar', label: 'Calendar', icon: Calendar },
            ]}
          />
        </div>
        {calendarView === 'calendar' ? (
          <div className="px-4 pb-6 sm:px-6">
            <OccupancyHeatmap dateRange={filters.dateRange} tagIds={filters.selectedTags.map((t) => t.id)} />
          </div>
        ) : (
          <OccupancyListView
            properties={(currentData.byProperty || []).map((p: OccupancyByProperty) => ({
              propertyId: p.propertyId,
              propertyName: p.propertyName,
            }))}
          />
        )}
      </section>

      <WhatIfCalculator byProperty={currentData.byProperty} dateRange={filters.dateRange} />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartWrapper
            title={getChartTitle()}
            icon={TrendingUp}
            height={360}
            responsive={false}
            noData={chartData.length === 0}
            noDataMessage="No occupancy data for this period"
          >
            <div className="h-full flex flex-col">
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    onClick={handlePeriodClick}
                    margin={{ top: 8, right: 24, bottom: 0, left: 0 }}
                    style={{ cursor: 'pointer' }}
                  >
                    <CartesianGrid vertical={false} stroke={CHART_INFRA.grid} strokeOpacity={0.6} />
                    <XAxis
                      dataKey="month"
                      angle={xAxisConfig.angle}
                      textAnchor={xAxisConfig.textAnchor}
                      height={xAxisConfig.height}
                      interval={xAxisConfig.interval}
                      tick={{ fill: CHART_INFRA.axis, fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(value: number) => `${Math.round(value)}%`}
                      domain={[0, 100]}
                      allowDataOverflow
                      tick={{ fill: CHART_INFRA.axis, fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<OccupancyChartTooltip />} isAnimationActive={false} />
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
                      strokeWidth={2}
                      dot={{ fill: METRIC_COLORS.occupancy, r: 4, strokeWidth: 0 }}
                      style={{ cursor: 'pointer' }}
                      activeDot={{ r: 6, fill: METRIC_COLORS.occupancy }}
                      name="This period"
                    />
                    {comparisonMode !== 'none' && previousData && (
                      <Line
                        type="monotone"
                        dataKey="previousRate"
                        stroke={CHART_INFRA.comparison}
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                        activeDot={{ r: 4, fill: CHART_INFRA.comparison }}
                        name={comparisonLabel || 'Previous period'}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {comparisonMode !== 'none' && previousData && (
                <ChartLegend
                  className="mt-3"
                  items={[
                    { label: 'This period', color: METRIC_COLORS.occupancy },
                    { label: comparisonLabel || 'Previous period', color: CHART_INFRA.comparison, dashed: true },
                  ]}
                />
              )}
            </div>
          </ChartWrapper>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border flex flex-col min-h-0">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Home className="w-5 h-5 text-muted-foreground" />
            Property Occupancy
          </h3>
          {sortedProperties.length > 0 ? (
            <ul className="-mx-2 flex-1 overflow-y-auto lg:max-h-[372px]">
              {sortedProperties.map((property: OccupancyByProperty) => {
                const occupancyPercent = property.rate * 100
                const prevProperty = prevByPropertyMap.get(property.propertyId)
                const prevOccupancy = comparisonMode !== 'none' && prevProperty ? prevProperty.rate * 100 : null
                const name = property.propertyName || `Property ${property.propertyId.slice(0, 8)}`

                return (
                  <li key={property.propertyId}>
                    <button
                      type="button"
                      onClick={() => handlePropertyClick(property)}
                      title={`${property.bookedNights} of ${property.availableNights} nights booked`}
                      className="grid w-full grid-cols-[minmax(0,1fr)_6rem_3.5rem] items-center gap-3 rounded-md px-2 py-2 text-left text-sm cursor-pointer transition-colors hover:bg-muted/50"
                    >
                      <span className="truncate font-medium">{name}</span>
                      <span className="relative h-1.5 rounded-full bg-muted" aria-hidden>
                        <span
                          className="absolute inset-y-0 left-0 rounded-full bg-primary"
                          style={{ width: `${Math.min(occupancyPercent, 100)}%` }}
                        />
                        {prevOccupancy !== null && prevOccupancy > 0 && (
                          <span
                            className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-foreground/50"
                            style={{ left: `${Math.min(prevOccupancy, 100)}%` }}
                          />
                        )}
                      </span>
                      <span className="text-right font-semibold tabular-nums">{formatPercentage(occupancyPercent, 1)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No properties in this range</p>
          )}
          {comparisonMode !== 'none' && previousData && sortedProperties.length > 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="inline-block h-2.5 w-0.5 rounded-full bg-foreground/50" aria-hidden />
              {comparisonLabel}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
