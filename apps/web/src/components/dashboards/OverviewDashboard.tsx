import { useMemo, useCallback, useState } from 'react'
import { useDashboardBatch, useGoalProgress, useSeasons } from '@/hooks/use-api'
import { useTips } from '@/hooks/use-tips'
import { useTagIds, usePropertyIds, useErrorToast, useComparisonDateRange } from '@/hooks/use-dashboard-utils'
import { formatCurrency, formatCompactCurrency, formatPercentage, formatDateDisplay, formatDateISO, subDays, startOfYear, endOfYear, subYears } from '@baileys/utils'
import {
  TrendingUp, TrendingDown,
  DollarSign, Users, Calendar, Clock,
  BarChart3, Info, Percent, Layers, Target, Settings, AlertCircle, ExternalLink,
  LogIn, LogOut
} from 'lucide-react'
import { MetricCard } from '@/components/MetricCard'
import { MetricCardWithGauge } from '@/components/MetricCardWithGauge'
import { ChartWrapper } from '@/components/ChartWrapper'
import { StateWrapper } from '@/components/StateWrapper'
import { PieChart, Pie, Cell, Label, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area, ReferenceLine, ResponsiveContainer } from 'recharts'
import { useDashboard } from '@/contexts/dashboard'
import { useModal } from '@/contexts/modal'
import { useTheme } from '@/contexts/theme'
import { getPlatformColor, getChartColor, CHART_INFRA, resolveToken } from '@/lib/theme'
import { getMonthlyGoalValue } from '@/utils/goals'
import { Button } from '@/components/ui/button'
import { useNavigate, Link } from 'react-router-dom'

const REVENUE_THRESHOLD_RATIO = 0.2
const MAX_INDIVIDUAL_PROPERTIES = 8
const MIN_OTHER_REVENUE_PORTION = 0.2
const TOP_PROPERTIES_DEFAULT_PORTION = 0.8

const GOAL_METRIC_CONFIG: Record<string, { label: string; icon: any; format: string }> = {
  revenue: { label: 'Total Revenue', icon: DollarSign, format: 'currency' },
  bookings: { label: 'Total Bookings', icon: Calendar, format: 'number' },
  occupancy: { label: 'Occupancy Rate', icon: Percent, format: 'percent' },
  guests: { label: 'Total Guests', icon: Users, format: 'number' },
  avgBookingValue: { label: 'Avg Booking Value', icon: DollarSign, format: 'currency' },
  repeatRate: { label: 'Repeat Guest Rate', icon: TrendingUp, format: 'percent' },
  avgStayLength: { label: 'Avg Stay Length', icon: Clock, format: 'nights' },
}

const formatGoalValue = (value: number, format: string) => {
  switch (format) {
    case 'currency': return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    case 'percent': return `${value.toFixed(1)}%`
    case 'nights': return `${value.toFixed(1)}`
    default: return String(Math.round(value))
  }
}

const getProgressColor = (pct: number) => {
  if (pct >= 80) return 'bg-success'
  if (pct >= 50) return 'bg-warning'
  return 'bg-danger'
}

const getProgressBgColor = (pct: number) => {
  if (pct >= 80) return 'bg-success-subtle'
  if (pct >= 50) return 'bg-warning-subtle'
  return 'bg-danger-subtle'
}

// extracted tooltip component to module scope
const BookingSourceTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    const total = payload[0].payload?.totalBookings || 0
    const percent = total > 0 ? ((data.count / total) * 100).toFixed(1) : '0.0'
    return (
      <div className="bg-card p-3 rounded-lg shadow-lg border border-border">
        <p className="font-semibold text-sm mb-2">{data.source}</p>
        <div className="space-y-1 text-xs">
          <p className="flex justify-between gap-4">
            <span className="text-muted-foreground">Bookings:</span>
            <span className="font-medium">{data.count}</span>
          </p>
          <p className="flex justify-between gap-4">
            <span className="text-muted-foreground">Share:</span>
            <span className="font-medium">{percent}%</span>
          </p>
          {data.revenue !== undefined && (
            <p className="flex justify-between gap-4">
              <span className="text-muted-foreground">Revenue:</span>
              <span className="font-medium text-success">{formatCurrency(data.revenue)}</span>
            </p>
          )}
        </div>
      </div>
    )
  }
  return null
}

const RevenueChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const total = payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0)
    return (
      <div className="bg-card p-3 rounded-lg shadow-lg border border-border">
        <p className="font-semibold text-sm mb-2">{label}</p>
        <div className="space-y-1 text-xs">
          {payload.slice().reverse().map((entry: any, index: number) => (
            <div key={index} className="flex justify-between gap-4">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: entry.color }} />
                <span className="text-muted-foreground">{entry.name}:</span>
              </div>
              <span className="font-medium">{formatCompactCurrency(entry.value)}</span>
            </div>
          ))}
          <div className="pt-1 mt-1 border-t border-border">
            <div className="flex justify-between gap-4 font-semibold">
              <span>Total:</span>
              <span className="text-success">{formatCompactCurrency(total)}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }
  return null
}


export const OverviewDashboard = () => {
  const { filters, comparisonRange, comparisonMode, comparisonLabel, updateDateRange } = useDashboard()
  const { showTips } = useTips()
  const { openModal } = useModal()
  const { resolvedTheme } = useTheme()
  const tagIds = useTagIds()
  const comparisonDateRange = useComparisonDateRange()
  const navigate = useNavigate()

  const { data: seasons = [] } = useSeasons()
  const hasActiveSeasons = seasons.some(s => s.isActive)

  const handleMetricCardClick = useCallback((tab: string) => {
    const currentParams = new URLSearchParams(window.location.search)
    const newPath = `/dashboard/${tab}${currentParams.toString() ? `?${currentParams.toString()}` : ''}`
    navigate(newPath)
  }, [navigate])

  const handleActivityClick = useCallback((activity: any) => {
    if (activity.bookingId) {
      openModal({
        type: 'booking',
        bookingId: activity.bookingId
      })
    }
  }, [openModal])

  const { data: goalProgressData } = useGoalProgress()
  const revenueGoal = getMonthlyGoalValue(goalProgressData, 'revenue')
  const propertyIds = usePropertyIds()

  const { data, error, isLoading } = useDashboardBatch(
    'overview',
    filters.dateRange.from,
    filters.dateRange.to,
    tagIds,
    comparisonRange?.from,
    comparisonRange?.to,
    propertyIds
  )

  useErrorToast(error, 'Failed to load overview data')

  const charts = data?.charts
  const metrics = data?.metrics

  const showEmptyNudge = metrics &&
    Number(metrics.revenue.current) === 0 &&
    metrics.bookings.current === 0

  const handleViewLastYear = useCallback(() => {
    const today = new Date()
    const lastYear = subYears(today, 1)
    updateDateRange({
      from: formatDateISO(startOfYear(lastYear)),
      to: formatDateISO(endOfYear(lastYear))
    })
  }, [updateDateRange])

  const handleLast12Months = useCallback(() => {
    const today = new Date()
    updateDateRange({
      from: formatDateISO(subDays(today, 365)),
      to: formatDateISO(today)
    })
  }, [updateDateRange])

  const [bookingSourceActiveIndex, setBookingSourceActiveIndex] = useState<number | null>(null)
  const handleSourceMouseEnter = useCallback((_: any, index: number) => setBookingSourceActiveIndex(index), [])
  const handleSourceMouseLeave = useCallback(() => setBookingSourceActiveIndex(null), [])

  const bookingSourceChartData = useMemo(() => {
    const sources = charts?.bookingsBySource || []
    const totalBookings = sources.reduce((sum: number, item: any) => sum + Number(item.count), 0)
    return sources
      .map((item: any) => ({
        ...item,
        count: Number(item.count),
        totalBookings
      }))
      .sort((a: any, b: any) => b.count - a.count)
  }, [charts?.bookingsBySource])

  const revenueChartData = useMemo(() => {
    if (!charts?.topProperties || !charts?.revenueLastWeek) return []

    const allSortedProps = charts.topProperties || []
    const topRevenue = allSortedProps[0]?.revenue || 0
    const revenueThreshold = topRevenue * REVENUE_THRESHOLD_RATIO

    const significantProps = allSortedProps
      .filter((p: any) => p.revenue >= revenueThreshold)
      .slice(0, MAX_INDIVIDUAL_PROPERTIES)

    const topProps = significantProps.length > 0 ? significantProps : allSortedProps.slice(0, 5)

    if (!charts.revenueLastWeek || charts.revenueLastWeek.length === 0) {
      return []
    }

    const dataByDate: { [date: string]: any } = {}

    charts.revenueLastWeek.forEach((item: any) => {
      const dateKey = item.day || item.date || item.month
      if (!dataByDate[dateKey]) {
        dataByDate[dateKey] = {
          date: dateKey,
          prop1: 0, prop2: 0, prop3: 0, prop4: 0,
          prop5: 0, prop6: 0, prop7: 0, prop8: 0,
          other: 0
        }
      }
      dataByDate[dateKey].totalRevenue = (dataByDate[dateKey].totalRevenue || 0) + (item.revenue || 0)
    })

    const totalPropertyCount = metrics?.properties?.total || 0
    const topPropsRevenue = topProps.reduce((sum: number, p: any) => sum + (p.revenue || 0), 0)
    const allPropsRevenue = allSortedProps.reduce((sum: number, p: any) => sum + (p.revenue || 0), 0)
    const hasMoreProperties = totalPropertyCount > topProps.length || allSortedProps.length > topProps.length

    const hasPropertyData = charts.revenueLastWeek.some((item: any) =>
      item.propertyName || item.property || item.propertyId || item.name)

    if (hasPropertyData) {
      charts.revenueLastWeek.forEach((item: any) => {
        const dateKey = item.day || item.date || item.month
        const propName = item.propertyName

        if (!dataByDate[dateKey]) {
          dataByDate[dateKey] = {
            date: dateKey,
            prop1: 0, prop2: 0, prop3: 0, prop4: 0,
            prop5: 0, prop6: 0, prop7: 0, prop8: 0,
            other: 0
          }
        }

        const topIndex = topProps.findIndex((p: any) => p.name === propName)
        if (topIndex >= 0 && topIndex < MAX_INDIVIDUAL_PROPERTIES) {
          dataByDate[dateKey][`prop${topIndex + 1}`] = (dataByDate[dateKey][`prop${topIndex + 1}`] || 0) + (item.revenue || 0)
        } else if (propName) {
          dataByDate[dateKey].other = (dataByDate[dateKey].other || 0) + (item.revenue || 0)
        }
      })
    } else {
      Object.keys(dataByDate).forEach(dateKey => {
        const periodRevenue = dataByDate[dateKey].totalRevenue || 0

        if (topPropsRevenue > 0) {
          const topPropsPortion = allPropsRevenue > 0 ? topPropsRevenue / allPropsRevenue : TOP_PROPERTIES_DEFAULT_PORTION
          const otherPortion = 1 - topPropsPortion

          topProps.forEach((prop: any, index: number) => {
            const propKey = `prop${index + 1}`
            const proportion = (prop.revenue || 0) / topPropsRevenue
            dataByDate[dateKey][propKey] = periodRevenue * proportion * topPropsPortion
          })

          if (hasMoreProperties) {
            const actualOtherPortion = Math.max(otherPortion, MIN_OTHER_REVENUE_PORTION)
            dataByDate[dateKey].other = periodRevenue * actualOtherPortion

            if (otherPortion < MIN_OTHER_REVENUE_PORTION) {
              const adjustmentFactor = (1 - MIN_OTHER_REVENUE_PORTION) / topPropsPortion
              topProps.forEach((_: any, index: number) => {
                const propKey = `prop${index + 1}`
                dataByDate[dateKey][propKey] = dataByDate[dateKey][propKey] * adjustmentFactor
              })
            }
          }
        } else if (periodRevenue > 0) {
          const numSlots = hasMoreProperties ? topProps.length + 1 : topProps.length
          const sharePerProp = periodRevenue / numSlots
          for (let i = 0; i < topProps.length; i++) {
            dataByDate[dateKey][`prop${i + 1}`] = sharePerProp
          }
          if (hasMoreProperties) {
            dataByDate[dateKey].other = sharePerProp
          }
        }
      })
    }

    return Object.values(dataByDate)
      .sort((a: any, b: any) => {
        const dateA = new Date(a.date.includes('Jul') ? `${a.date} 2025` : a.date)
        const dateB = new Date(b.date.includes('Jul') ? `${b.date} 2025` : b.date)
        return dateA.getTime() - dateB.getTime()
      })
      .map((item: any) => {
        const { date, totalRevenue, ...properties } = item
        return {
          week: date.replace(' 2025', '').replace('2025-', ''),
          ...properties
        }
      })
  }, [charts?.topProperties, charts?.revenueLastWeek, metrics?.properties?.total, resolvedTheme])

  const revenueChartAreas = useMemo(() => {
    if (!charts?.topProperties) return []

    const allSortedProps = charts.topProperties || []
    const topRevenue = allSortedProps[0]?.revenue || 0
    const revenueThreshold = topRevenue * REVENUE_THRESHOLD_RATIO

    const significantProps = allSortedProps
      .filter((p: any) => p.revenue >= revenueThreshold)
      .slice(0, MAX_INDIVIDUAL_PROPERTIES)

    const topProps = significantProps.length > 0 ? significantProps : allSortedProps.slice(0, 5)
    const totalPropertyCount = metrics?.properties?.total || charts.topProperties?.length || 0
    const colors = Array.from({ length: 10 }, (_, i) => getChartColor(i))
    const otherColor = CHART_INFRA.reference

    const areas = []

    for (let i = 0; i < topProps.length && i < MAX_INDIVIDUAL_PROPERTIES; i++) {
      if (topProps[i]) {
        areas.push(
          <Area
            key={`prop${i + 1}`}
            type="monotone"
            dataKey={`prop${i + 1}`}
            stackId="1"
            stroke={colors[i]}
            fill={colors[i]}
            fillOpacity={0.6}
            name={topProps[i].code || topProps[i].name || `Property ${i + 1}`}
          />
        )
      }
    }

    const otherCount = Math.max(0, totalPropertyCount - topProps.length)
    if (otherCount > 0 || charts?.revenueLastWeek?.length > 0) {
      areas.push(
        <Area
          key="other"
          type="monotone"
          dataKey="other"
          stackId="1"
          stroke={otherColor}
          fill={otherColor}
          fillOpacity={0.6}
          name={otherCount > 0 ? `Other (${otherCount} properties)` : 'Other'}
        />
      )
    }

    return areas
  }, [charts?.topProperties, charts?.revenueLastWeek, metrics?.properties?.total, resolvedTheme])

  const revenueChartLegendItems = useMemo(() => {
    if (!charts?.topProperties) return []

    const allSortedProps = charts.topProperties || []
    const topRevenue = allSortedProps[0]?.revenue || 0
    const revenueThreshold = topRevenue * REVENUE_THRESHOLD_RATIO

    const significantProps = allSortedProps
      .filter((p: any) => p.revenue >= revenueThreshold)
      .slice(0, MAX_INDIVIDUAL_PROPERTIES)

    const topProps = significantProps.length > 0 ? significantProps : allSortedProps.slice(0, 5)
    const totalPropertyCount = metrics?.properties?.total || charts.topProperties?.length || 0
    const colors = Array.from({ length: 10 }, (_, i) => getChartColor(i))

    const items = topProps.slice(0, MAX_INDIVIDUAL_PROPERTIES).map((p: any, i: number) => ({
      name: p.code || p.name || `Property ${i + 1}`,
      color: colors[i]
    }))

    const otherCount = Math.max(0, totalPropertyCount - topProps.length)
    if (otherCount > 0 || charts?.revenueLastWeek?.length > 0) {
      items.push({
        name: otherCount > 0 ? `Other (${otherCount})` : 'Other',
        color: CHART_INFRA.reference
      })
    }

    return items
  }, [charts?.topProperties, charts?.revenueLastWeek, metrics?.properties?.total, resolvedTheme])

  const enabledGoals = useMemo(() => {
    if (!goalProgressData) return []
    return goalProgressData
      .map(g => {
        const config = GOAL_METRIC_CONFIG[g.metricKey]
        if (!config) return null
        return {
          metricKey: g.metricKey,
          current: g.currentValue,
          target: g.targetValue,
          pct: g.progress,
          periodLabel: g.periodLabel,
          config,
        }
      })
      .filter(Boolean) as Array<{ metricKey: string; current: number; target: number; pct: number; periodLabel: string; config: typeof GOAL_METRIC_CONFIG[string] }>
  }, [goalProgressData])

  if (isLoading || error || !data) {
    return (
      <StateWrapper
        loading={isLoading}
        error={error}
        empty={!data && !isLoading && !error}
        loadingMessage="Loading dashboard data..."
        emptyMessage="No data available for the selected period"
        onRetry={() => window.location.reload()}
        minHeight={400}
        className="py-12"
      >
        <div />
      </StateWrapper>
    )
  }

  const { recentActivity } = data

  const actualUpcoming = parseInt(metrics.bookings.upcoming) || 0

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Your Business at a Glance</h2>
            <p className="text-muted-foreground text-sm mt-1">
              {filters.selectedTags.length > 0
                ? `Filtered: ${filters.selectedTags.map(t => t.name).filter(Boolean).join(', ') || 'Selected tags'}`
                : 'All Properties'
              } · How your properties are performing right now
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-success-subtle text-success-fg border border-success/30">
              <span className="w-2 h-2 bg-success rounded-full mr-2 animate-pulse"></span>
              Live Data
            </span>
          </div>
        </div>
      </div>

      {showTips && (
        <div className="bg-info-subtle border border-info/30 rounded-lg p-4">
          <div className="flex items-start">
            <Info className="w-5 h-5 text-info mr-2 mt-0.5" />
            <div className="text-sm text-info-fg">
              <strong>Quick Start:</strong> Click any metric card to jump to that section.
              Green arrows mean growth, red means decline vs. your comparison period. Everything reflects your selected date range.
            </div>
          </div>
        </div>
      )}

      {showEmptyNudge && (
        <div className="bg-warning-subtle border border-warning/30 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-warning mr-2 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-warning-fg">
                <strong>No data in this date range.</strong>{' '}
                Your bookings may fall outside the current period. Try a different range.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleViewLastYear}
                  className="bg-warning-subtle text-warning-fg hover:bg-warning/20 border-warning/40 text-xs"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  View Last Year
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLast12Months}
                  className="bg-warning-subtle text-warning-fg hover:bg-warning/20 border-warning/40 text-xs"
                >
                  <Clock className="w-3.5 h-3.5" />
                  Last 12 Months
                </Button>
                {!hasActiveSeasons && (
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="bg-warning-subtle text-warning-fg hover:bg-warning/20 border-warning/40 text-xs"
                  >
                    <Link to="/settings?tab=seasons">
                      <Settings className="w-3.5 h-3.5" />
                      Set Up Seasons
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 cursor-pointer gap-3 md:gap-4">
        <MetricCardWithGauge
          icon={DollarSign}
          label="Total Revenue"
          value={Number(metrics.revenue.current) || 0}
          format="currency"
          tooltip="Gross booking revenue across all properties for this period"
          staggerIndex={0}
          subValue={comparisonMode !== 'none' && metrics.revenue.previous !== undefined
            ? <>vs {comparisonLabel}: {formatCurrency(metrics.revenue.previous)}{comparisonDateRange && <span className="block text-xs text-muted-foreground/70 mt-0.5">{comparisonDateRange}</span>}</>
            : `After fees (est.): ${formatCompactCurrency(metrics.revenue.net)}`
          }
          trend={comparisonMode !== 'none' && metrics.revenue.growth !== undefined ? {
            value: metrics.revenue.growth,
            isPositive: metrics.revenue.growth > 0
          } : undefined}
          color="green"
          gauge={{
            enabled: true,
            min: 0,
            max: comparisonMode !== 'none' && metrics.revenue.previous ?
              Math.max(metrics.revenue.current, metrics.revenue.previous) * 1.5 :
              Math.max(metrics.revenue.current * 2, 1000),
            segments: comparisonMode !== 'none' && metrics.revenue.previous ? [
              { threshold: metrics.revenue.previous * 0.8 / (Math.max(metrics.revenue.current, metrics.revenue.previous) * 1.5) * 100, color: resolveToken('--danger'),  label: 'Below' },
              { threshold: metrics.revenue.previous * 1.0 / (Math.max(metrics.revenue.current, metrics.revenue.previous) * 1.5) * 100, color: resolveToken('--warning'), label: 'Target' },
              { threshold: 100, color: resolveToken('--success'), label: 'Above' }
            ] : [
              { threshold: 30,  color: resolveToken('--danger'),  label: 'Low' },
              { threshold: 60,  color: resolveToken('--warning'), label: 'Medium' },
              { threshold: 100, color: resolveToken('--success'), label: 'High' }
            ],
            target: metrics.revenue.previous
          }}
          comparisonMode={comparisonMode}
          onClick={() => handleMetricCardClick('financial')}
        />
        <MetricCardWithGauge
          icon={Calendar}
          label="Total Bookings"
          value={metrics.bookings.current}
          format="number"
          tooltip="Number of confirmed reservations in this period"
          staggerIndex={1}
          subValue={comparisonMode !== 'none' && metrics.bookings.previous !== undefined
            ? <>vs {comparisonLabel}: {metrics.bookings.previous} | {actualUpcoming} upcoming{comparisonDateRange && <span className="block text-xs text-muted-foreground/70 mt-0.5">{comparisonDateRange}</span>}</>
            : `${actualUpcoming} coming up | ${Number(metrics.bookings.avgNights || 0).toFixed(1)} nights average`
          }
          trend={comparisonMode !== 'none' && metrics.bookings.previous !== undefined ? {
            value: ((metrics.bookings.current - metrics.bookings.previous) / (metrics.bookings.previous || 1)) * 100,
            isPositive: metrics.bookings.current > metrics.bookings.previous
          } : undefined}
          color="blue"
          gauge={{
            enabled: true,
            min: 0,
            max: comparisonMode !== 'none' && metrics.bookings.previous ?
              Math.max(metrics.bookings.current, metrics.bookings.previous) * 1.5 :
              Math.max(metrics.bookings.current * 2, 10),
            segments: comparisonMode !== 'none' && metrics.bookings.previous ? [
              { threshold: metrics.bookings.previous * 0.8 / (Math.max(metrics.bookings.current, metrics.bookings.previous) * 1.5) * 100, color: resolveToken('--danger'), label: 'Below' },
              { threshold: metrics.bookings.previous * 1.0 / (Math.max(metrics.bookings.current, metrics.bookings.previous) * 1.5) * 100, color: resolveToken('--warning'), label: 'Target' },
              { threshold: 100, color: resolveToken('--success'), label: 'Above' }
            ] : [
              { threshold: 30,  color: resolveToken('--danger'),  label: 'Low' },
              { threshold: 60,  color: resolveToken('--warning'), label: 'Medium' },
              { threshold: 100, color: resolveToken('--success'), label: 'High' }
            ],
            target: metrics.bookings.previous
          }}
          comparisonMode={comparisonMode}
          onClick={() => handleMetricCardClick('properties')}
        />
        <MetricCardWithGauge
          icon={Percent}
          label="Occupancy Rate"
          value={Number(metrics.occupancy.current || 0)}
          format="percent"
          tooltip="Share of available nights that were booked across all properties"
          staggerIndex={2}
          subValue={comparisonMode !== 'none' && metrics.occupancy.previous !== undefined
            ? <>vs {comparisonLabel}: {formatPercentage(Number(metrics.occupancy.previous), 1)} | {metrics.properties.total} properties{comparisonDateRange && <span className="block text-xs text-muted-foreground/70 mt-0.5">{comparisonDateRange}</span>}</>
            : `${metrics.properties.total} properties | ${formatPercentage(Number(metrics.occupancy.avgPropertyOccupancy || 0), 1)} average`
          }
          trend={comparisonMode !== 'none' && metrics.occupancy.growth !== undefined ? {
            value: metrics.occupancy.growth,
            isPositive: metrics.occupancy.growth > 0
          } : undefined}
          color="purple"
          gauge={{
            enabled: true,
            min: 0,
            max: 100,
            segments: [
              { threshold: 50,  color: resolveToken('--danger'),  label: 'Low' },
              { threshold: 75,  color: resolveToken('--warning'), label: 'Good' },
              { threshold: 100, color: resolveToken('--success'), label: 'Excellent' }
            ],
            target: metrics.occupancy.previous
          }}
          comparisonMode={comparisonMode}
          onClick={() => handleMetricCardClick('occupancy')}
        />
        <MetricCardWithGauge
          icon={Users}
          label="Total Guests"
          value={metrics.guests.total}
          format="number"
          tooltip="Unique guests who had a booking in this period"
          staggerIndex={3}
          subValue={comparisonMode !== 'none' && metrics.guests.previous !== undefined
            ? <>vs {comparisonLabel}: {metrics.guests.previous} | {metrics.guests.newThisMonth} new{comparisonDateRange && <span className="block text-xs text-muted-foreground/70 mt-0.5">{comparisonDateRange}</span>}</>
            : `${metrics.guests.newThisMonth} first-timers | ${formatPercentage(Number(metrics.guests.repeatRate || 0) * 100, 1)} returning`
          }
          trend={comparisonMode !== 'none' && metrics.guests.growth !== undefined ? {
            value: metrics.guests.growth,
            isPositive: metrics.guests.growth > 0
          } : undefined}
          color="orange"
          gauge={{
            enabled: true,
            min: 0,
            max: comparisonMode !== 'none' && metrics.guests.previous ?
              Math.max(metrics.guests.total, metrics.guests.previous) * 1.5 :
              Math.max(metrics.guests.total * 2, 10),
            segments: comparisonMode !== 'none' && metrics.guests.previous ? [
              { threshold: metrics.guests.previous * 0.8 / (Math.max(metrics.guests.total, metrics.guests.previous) * 1.5) * 100, color: resolveToken('--danger'), label: 'Below' },
              { threshold: metrics.guests.previous * 1.0 / (Math.max(metrics.guests.total, metrics.guests.previous) * 1.5) * 100, color: resolveToken('--warning'), label: 'Target' },
              { threshold: 100, color: resolveToken('--success'), label: 'Above' }
            ] : [
              { threshold: 30,  color: resolveToken('--danger'),  label: 'Low' },
              { threshold: 60,  color: resolveToken('--warning'), label: 'Medium' },
              { threshold: 100, color: resolveToken('--success'), label: 'High' }
            ],
            target: metrics.guests.previous
          }}
          comparisonMode={comparisonMode}
          onClick={() => handleMetricCardClick('guests')}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <MetricCard
          icon={DollarSign}
          label="Average Booking Value"
          value={Number(metrics.revenue.avgBookingValue) || 0}
          format="currency"
          subValue="Per reservation"
          size="sm"
          color="gray"
          tooltip="Total revenue divided by number of bookings"
          staggerIndex={4}
        />
        <MetricCard
          icon={Calendar}
          label="Average Stay Length"
          value={`${Number(metrics.bookings.avgNights || 0).toFixed(1)} nights`}
          format="custom"
          subValue="Per booking"
          size="sm"
          color="gray"
          tooltip="How many nights the average guest stays per reservation"
          staggerIndex={5}
        />
        <MetricCard
          icon={TrendingUp}
          label="Repeat Guests"
          value={Number(metrics.guests.repeatRate || 0) * 100}
          format="percent"
          subValue={metrics.guests.total > 0 ? 'Return rate' : 'No data yet'}
          size="sm"
          color="gray"
          tooltip="Share of guests who have booked with you more than once"
          staggerIndex={6}
        />
        <MetricCard
          icon={TrendingDown}
          label="Cancellation Rate"
          value={Number(metrics.bookings.cancellationRate || 0)}
          tooltip="Share of bookings that were canceled during this period"
          format="percent"
          subValue="This period"
          size="sm"
          color={Number(metrics.bookings.cancellationRate || 0) > 10 ? "red" : "gray"}
          staggerIndex={7}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <ChartWrapper
          title="Revenue Composition by Property"
          subtitle="Showing revenue breakdown across your top properties"
          icon={Layers}
          height={340}
          responsive={false}
        >
          <div className="h-full flex flex-col">
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_INFRA.grid} />
                  <XAxis
                    dataKey="week"
                    stroke={CHART_INFRA.axis}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    tickFormatter={(value: any) => `$${(value / 1000).toFixed(0)}k`}
                    stroke={CHART_INFRA.axis}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip content={<RevenueChartTooltip />} />
                  {revenueChartAreas}
                  {revenueGoal != null && (
                    <ReferenceLine
                      y={revenueGoal}
                      stroke={CHART_INFRA.goal}
                      strokeDasharray="6 4"
                      strokeWidth={1.5}
                      label={{
                        value: `⬥ Goal: ${formatCompactCurrency(revenueGoal)}`,
                        position: 'insideTopLeft',
                        fill: CHART_INFRA.goal,
                        fontSize: 12,
                        fontWeight: 600,
                        offset: 4
                      }}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-3 justify-center text-xs mt-3 px-4">
              {revenueChartLegendItems.map((item: any) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <div className="w-3 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </ChartWrapper>

        <ChartWrapper
          title="Booking Sources"
          icon={BarChart3}
          height={280}
          noData={charts.bookingsBySource.length === 0}
          responsive={false}
        >
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={bookingSourceChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius="55%"
                  outerRadius="80%"
                  dataKey="count"
                  stroke={resolveToken('--card')}
                  strokeWidth={2}
                  animationBegin={0}
                  animationDuration={500}
                  animationEasing="ease-out"
                  onMouseEnter={handleSourceMouseEnter}
                  onMouseLeave={handleSourceMouseLeave}
                >
                  {bookingSourceChartData.map((entry: any, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={getPlatformColor(entry.source, index)}
                      opacity={bookingSourceActiveIndex === null || bookingSourceActiveIndex === index ? 1 : 0.3}
                      style={{ transition: 'opacity 0.2s ease' }}
                    />
                  ))}
                  <Label
                    content={({ viewBox }) => {
                      const { cx, cy } = viewBox as any
                      const total = bookingSourceChartData.reduce((sum: number, s: any) => sum + s.count, 0)
                      return (
                        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan x={cx} y={cy - 8} className="fill-foreground text-lg font-bold">
                            {total}
                          </tspan>
                          <tspan x={cx} y={cy + 12} className="fill-muted-foreground text-xs">
                            Bookings
                          </tspan>
                        </text>
                      )
                    }}
                  />
                </Pie>
                <Tooltip content={<BookingSourceTooltip />} isAnimationActive={false} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 justify-center text-xs px-4">
            {bookingSourceChartData.map((entry: any, index: number) => (
              <div key={entry.source} className="flex items-center gap-1.5">
                <div className="w-3 h-2.5 rounded-sm" style={{ backgroundColor: getPlatformColor(entry.source, index) }} />
                <span className="text-muted-foreground">{entry.source}</span>
              </div>
            ))}
          </div>
          {(() => {
            const unassigned = bookingSourceChartData.find((s: any) => s.source === 'Unassigned' || s.source === 'unassigned')
            if (unassigned && unassigned.count > 0) {
              return (
                <p className="text-xs text-warning text-center mt-1">
                  {unassigned.count} booking{unassigned.count !== 1 ? 's' : ''} unassigned
                </p>
              )
            }
            return null
          })()}
        </ChartWrapper>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold">Your Goals</h3>
            </div>
            {enabledGoals.length > 0 && (
              <Link to="/settings?tab=goals" className="text-xs text-info hover:text-info-fg flex items-center gap-1">
                <Settings className="w-3 h-3" />
                Edit
              </Link>
            )}
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
            {enabledGoals.length > 0 ? (
              enabledGoals.map(goal => {
                const Icon = goal.config.icon
                return (
                  <div key={goal.metricKey} className="py-2 border-b last:border-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">{goal.config.label}</span>
                        <span className="text-xs text-muted-foreground/70">({goal.periodLabel})</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatGoalValue(goal.current, goal.config.format)} / {formatGoalValue(goal.target, goal.config.format)}
                      </span>
                    </div>
                    <div className={`w-full h-2 rounded-full ${getProgressBgColor(goal.pct)}`}>
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${getProgressColor(goal.pct)}`}
                        style={{ width: `${goal.pct}%` }}
                      />
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">No goals set yet</p>
                <Link to="/settings?tab=goals" className="text-xs text-info hover:text-info-fg mt-1 inline-block">
                  Set goals in Settings to track your progress
                </Link>
              </div>
            )}
          </div>
        </div>

          <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">What's New</h3>
            <span className="text-xs text-muted-foreground">Recent bookings</span>
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto overflow-x-hidden pr-2">
            {recentActivity && recentActivity.length > 0 ? (
              recentActivity.map((activity: any) => (
                <div
                  key={activity.id}
                  className={`flex items-center justify-between py-2 border-b last:border-0 ${
                    activity.bookingId ? 'hover:bg-muted/50 px-2 -mx-2 rounded transition-colors cursor-pointer' : ''
                  }`}
                  onClick={() => handleActivityClick(activity)}
                >
                  <div className="flex-1 min-w-0 mr-2">
                    <p className="text-sm font-medium truncate">{activity.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {formatDateDisplay(activity.timestamp)}
                      </span>
                      {activity.metadata?.arrival && activity.metadata?.departure && (
                        <span className="text-xs text-muted-foreground/70">
                          · Stay: {formatDateDisplay(activity.metadata.arrival)} – {formatDateDisplay(activity.metadata.departure)}
                        </span>
                      )}
                      {activity.platform && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: getPlatformColor(activity.platform) }}
                          />
                          {activity.platform}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {activity.value && (
                      <div className="text-sm font-medium text-success">
                        {formatCurrency(activity.value)}
                      </div>
                    )}
                    {activity.ownerrezBookingId && (
                      <a
                        href={`https://app.ownerrez.com/bookings/${activity.ownerrezBookingId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground/70 hover:text-info transition-colors"
                        title="Open in OwnerRez"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">No recent activity</p>
                <p className="text-xs mt-1 text-muted-foreground/70">Check back later for updates</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming Section */}
      {data.upcoming && data.upcoming.length > 0 && (
        <UpcomingSection upcoming={data.upcoming} />
      )}

    </div>
  )
}

const UpcomingSection = ({ upcoming }: { upcoming: any[] }) => {
  const [filter, setFilter] = useState<'all' | 'today' | 'week' | 'month'>('week')

  const filtered = useMemo(() => {
    switch (filter) {
      case 'today':
        return upcoming.filter((b: any) => b.isToday)
      case 'week':
        return upcoming.filter((b: any) => b.isThisWeek)
      case 'month':
        return upcoming
      default:
        return upcoming
    }
  }, [upcoming, filter])

  return (
    <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Upcoming</h3>
          <span className="text-xs text-muted-foreground">({filtered.length})</span>
        </div>
        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
          {[
            { key: 'today' as const, label: 'Today' },
            { key: 'week' as const, label: 'This Week' },
            { key: 'month' as const, label: 'This Month' },
          ].map(btn => (
            <Button
              key={btn.key}
              variant="ghost"
              size="sm"
              onClick={() => setFilter(btn.key)}
              className={filter === btn.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
              }
            >
              {btn.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
        {filtered.length > 0 ? (
          filtered.map((booking: any) => (
            <div key={booking.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  booking.type === 'check-in' ? 'bg-success-subtle' : 'bg-orange-subtle'
                }`}>
                  {booking.type === 'check-in'
                    ? <LogIn className="w-4 h-4 text-success" />
                    : <LogOut className="w-4 h-4 text-orange-fg" />
                  }
                </div>
                <div>
                  <div className="text-sm font-medium">{booking.guestName}</div>
                  <div className="text-xs text-muted-foreground">
                    {booking.propertyName} · {booking.type === 'check-in' ? 'Check-in' : 'Check-out'}{' '}
                    {formatDateDisplay(booking.type === 'check-in' ? booking.arrival : booking.departure)}
                  </div>
                </div>
              </div>
              {booking.amount > 0 && (
                <span className="text-sm font-medium text-success">{formatCurrency(booking.amount)}</span>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No upcoming check-ins or check-outs {filter === 'today' ? 'today' : filter === 'week' ? 'this week' : 'this month'}</p>
          </div>
        )}
      </div>
    </div>
  )
}
