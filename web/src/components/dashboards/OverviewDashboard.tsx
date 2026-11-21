import { useMemo, useCallback, useState } from 'react'
import { useDashboardBatch, useGoalProgress, useSeasons } from '@/hooks/use-api'
import { useTagIds, usePropertyIds, useErrorToast, useComparisonDateRange } from '@/hooks/use-dashboard-utils'
import {
  formatCurrency,
  formatCompactCurrency,
  formatPercentage,
  formatDateDisplay,
  formatDateISO,
  subDays,
  startOfYear,
  endOfYear,
  subYears,
} from '@baileys/utils'
import {
  TrendingUp,
  DollarSign,
  Users,
  Calendar,
  Clock,
  Percent,
  Settings,
  AlertCircle,
  ExternalLink,
  LogIn,
  LogOut,
  BedDouble,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { MetricCard } from '@/components/MetricCard'
import { HeadlineMetric } from '@/components/HeadlineMetric'
import { PacingSummary } from '@/components/pacing/PacingSummary'
import { ChartWrapper } from '@/components/ChartWrapper'
import { StateWrapper } from '@/components/StateWrapper'
import {
  PieChart,
  Pie,
  Cell,
  Label,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import type { TooltipContentProps } from 'recharts'
import { useDashboard } from '@/contexts/dashboard'
import { useModal } from '@/contexts/modal'
import { useTheme } from '@/contexts/theme'
import { getPlatformColor, getChartColor, CHART_INFRA, resolveToken } from '@/lib/theme'
import { getMonthlyGoalValue } from '@/utils/goals'
import { detectGranularity } from '@/utils/chart-helpers'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/Pagination'
import { useNavigate, Link } from 'react-router-dom'
import { METRIC_DEFINITIONS } from '@/lib/metric-definitions'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Badge } from '@/components/ui/badge'

interface RecentActivity {
  id: string
  type: 'booking' | 'inquiry'
  description: string
  timestamp: string
  value?: number | null
  ownerrezBookingId?: number | null
  ownerrezGuestId?: string | null
  ownerrezInquiryId?: number | null
  guestName?: string | null
  platform?: string | null
  status?: string
  metadata?: { arrival?: string; departure?: string }
}

interface BookingSourceItem {
  source: string
  count: number
  revenue?: number
}

interface BookingSourceChartItem extends BookingSourceItem {
  totalBookings: number
}

interface TopProperty {
  name: string
  code?: string
  revenue: number
  [key: string]: unknown
}

interface RevenueLastWeekItem {
  day?: string
  date?: string
  month?: string
  revenue?: number
  propertyName?: string
  property?: string
  propertyId?: string
  name?: string
}

interface RevenueChartLegendItem {
  name: string
  color: string
}

interface UpcomingBooking {
  id: string
  ownerrezBookingId: string | null
  guestName: string
  propertyName: string
  type: 'check-in' | 'check-out' | 'in-house'
  arrival: string
  departure: string
  amount: number
  isToday: boolean
  isThisWeek: boolean
}

const REVENUE_THRESHOLD_RATIO = 0.2
const MAX_INDIVIDUAL_PROPERTIES = 8
const MIN_OTHER_REVENUE_PORTION = 0.2
const TOP_PROPERTIES_DEFAULT_PORTION = 0.8

const GOAL_METRIC_CONFIG: Record<string, { label: string; icon: LucideIcon; format: string }> = {
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
    case 'currency':
      return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    case 'percent':
      return `${value.toFixed(1)}%`
    case 'nights':
      return `${value.toFixed(1)}`
    default:
      return String(Math.round(value))
  }
}

// stay dates drop the repeated year: "Sep 17 – Sep 20, 2026"
const formatStay = (arrival: string, departure: string) => {
  const from = new Date(`${arrival.slice(0, 10)}T00:00:00`)
  const to = new Date(`${departure.slice(0, 10)}T00:00:00`)
  const short = { month: 'short', day: 'numeric' } as const
  const full = { ...short, year: 'numeric' } as const
  const start = from.toLocaleDateString('en-US', from.getFullYear() === to.getFullYear() ? short : full)
  return `${start} – ${to.toLocaleDateString('en-US', full)}`
}

// extracted tooltip component to module scope
const BookingSourceTooltip = ({ active, payload }: Partial<TooltipContentProps<number, string>>) => {
  if (active && payload?.length) {
    const data = payload[0].payload
    const total = payload[0].payload?.totalBookings || 0
    const percent = total > 0 ? ((data.count / total) * 100).toFixed(1) : '0.0'
    return (
      <div className="bg-card p-3 rounded-lg shadow-lg border border-border">
        <p className="font-semibold text-sm mb-2">{data.source}</p>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Bookings:</span>
            <span className="font-medium">{data.count}</span>
          </div>
          {data.revenue !== undefined && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Revenue:</span>
              <span className="font-medium text-foreground">{formatCurrency(data.revenue)}</span>
            </div>
          )}
          <div className="pt-1 mt-1 border-t border-border flex justify-between gap-4">
            <span className="text-muted-foreground">Share:</span>
            <span className="font-medium">{percent}%</span>
          </div>
        </div>
      </div>
    )
  }
  return null
}

const RevenueChartTooltip = ({ active, payload, label }: Partial<TooltipContentProps<number, string>>) => {
  if (active && payload?.length) {
    const total = payload.reduce((sum, entry) => sum + Number(entry.value ?? 0), 0)
    return (
      <div className="bg-card p-3 rounded-lg shadow-lg border border-border">
        <p className="font-semibold text-sm mb-2">{label}</p>
        <div className="space-y-1 text-xs">
          {payload
            .slice()
            .reverse()
            .map((entry, index) => (
              <div key={index} className="flex justify-between gap-4">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: entry.color }} />
                  <span className="text-muted-foreground">{entry.name}:</span>
                </div>
                <span className="font-medium">{formatCompactCurrency(Number(entry.value ?? 0))}</span>
              </div>
            ))}
          <div className="pt-1 mt-1 border-t border-border">
            <div className="flex justify-between gap-4 font-semibold">
              <span>Total:</span>
              <span className="text-foreground">{formatCompactCurrency(total)}</span>
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
  const { openModal } = useModal()
  const { resolvedTheme } = useTheme()
  const tagIds = useTagIds()
  const comparisonDateRange = useComparisonDateRange()
  const navigate = useNavigate()

  const { data: seasons = [] } = useSeasons()
  const hasActiveSeasons = seasons.some((s) => s.isActive)

  const handleMetricCardClick = useCallback(
    (tab: string) => {
      const currentParams = new URLSearchParams(window.location.search)
      const newPath = `/dashboard/${tab}${currentParams.toString() ? `?${currentParams.toString()}` : ''}`
      navigate(newPath)
    },
    [navigate],
  )

  const handleActivityClick = useCallback(
    (activity: RecentActivity) => {
      if (activity.type === 'booking' && (activity.ownerrezGuestId || activity.guestName)) {
        openModal({
          type: 'guest',
          guestId: activity.ownerrezGuestId ? `or_${activity.ownerrezGuestId}` : `name_${activity.guestName!.toLowerCase().trim()}`,
          guestName: activity.guestName || 'Unknown',
        })
      }
    },
    [openModal],
  )

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
    propertyIds,
  )

  useErrorToast(error, 'Failed to load overview data')

  const charts = data?.charts
  const metrics = data?.metrics

  const showEmptyNudge = metrics && Number(metrics.revenue.current) === 0 && metrics.bookings.current === 0

  const handleViewLastYear = useCallback(() => {
    const today = new Date()
    const lastYear = subYears(today, 1)
    updateDateRange({
      from: formatDateISO(startOfYear(lastYear)),
      to: formatDateISO(endOfYear(lastYear)),
    })
  }, [updateDateRange])

  const handleLast12Months = useCallback(() => {
    const today = new Date()
    updateDateRange({
      from: formatDateISO(subDays(today, 365)),
      to: formatDateISO(today),
    })
  }, [updateDateRange])

  const [bookingSourceActiveIndex, setBookingSourceActiveIndex] = useState<number | null>(null)
  const handleSourceMouseEnter = useCallback((_: unknown, index: number) => setBookingSourceActiveIndex(index), [])
  const handleSourceMouseLeave = useCallback(() => setBookingSourceActiveIndex(null), [])

  const bookingSourceChartData = useMemo(() => {
    const sources: BookingSourceItem[] = charts?.bookingsBySource || []
    const totalBookings = sources.reduce((sum: number, item: BookingSourceItem) => sum + Number(item.count), 0)
    return sources
      .map(
        (item: BookingSourceItem): BookingSourceChartItem => ({
          ...item,
          count: Number(item.count),
          totalBookings,
        }),
      )
      .sort((a: BookingSourceChartItem, b: BookingSourceChartItem) => b.count - a.count)
  }, [charts?.bookingsBySource])

  const revenueChartData = useMemo(() => {
    if (!charts?.topProperties || !charts?.revenueLastWeek) return []

    const allSortedProps = charts.topProperties || []
    const topRevenue = allSortedProps[0]?.revenue || 0
    const revenueThreshold = topRevenue * REVENUE_THRESHOLD_RATIO

    const significantProps = allSortedProps.filter((p: TopProperty) => p.revenue >= revenueThreshold).slice(0, MAX_INDIVIDUAL_PROPERTIES)

    const topProps = significantProps.length > 0 ? significantProps : allSortedProps.slice(0, 5)
    const topPropsIndexMap = new Map<string, number>(topProps.map((p: TopProperty, i: number) => [p.name, i]))

    if (!charts.revenueLastWeek || charts.revenueLastWeek.length === 0) {
      return []
    }

    const dataByDate: Record<string, Record<string, number | string>> = {}

    charts.revenueLastWeek.forEach((item: RevenueLastWeekItem) => {
      const dateKey = item.date || item.day || item.month || ''
      if (!dataByDate[dateKey]) {
        dataByDate[dateKey] = {
          date: dateKey,
          displayDate: item.day || item.date || item.month || '',
          prop1: 0,
          prop2: 0,
          prop3: 0,
          prop4: 0,
          prop5: 0,
          prop6: 0,
          prop7: 0,
          prop8: 0,
          other: 0,
        }
      }
      dataByDate[dateKey].totalRevenue = (Number(dataByDate[dateKey].totalRevenue) || 0) + (item.revenue || 0)
    })

    const totalPropertyCount = metrics?.properties?.total || 0
    const topPropsRevenue = topProps.reduce((sum: number, p: TopProperty) => sum + (p.revenue || 0), 0)
    const allPropsRevenue = allSortedProps.reduce((sum: number, p: TopProperty) => sum + (p.revenue || 0), 0)
    const hasMoreProperties = totalPropertyCount > topProps.length || allSortedProps.length > topProps.length

    const hasPropertyData = charts.revenueLastWeek.some(
      (item: RevenueLastWeekItem) => item.propertyName || item.property || item.propertyId || item.name,
    )

    if (hasPropertyData) {
      charts.revenueLastWeek.forEach((item: RevenueLastWeekItem) => {
        const dateKey = item.date || item.day || item.month || ''
        const propName = item.propertyName

        if (!dataByDate[dateKey]) {
          dataByDate[dateKey] = {
            date: dateKey,
            displayDate: item.day || item.date || item.month || '',
            prop1: 0,
            prop2: 0,
            prop3: 0,
            prop4: 0,
            prop5: 0,
            prop6: 0,
            prop7: 0,
            prop8: 0,
            other: 0,
          }
        }

        const topIndex = propName != null ? (topPropsIndexMap.get(propName) ?? -1) : -1
        if (topIndex >= 0 && topIndex < MAX_INDIVIDUAL_PROPERTIES) {
          dataByDate[dateKey][`prop${topIndex + 1}`] = (Number(dataByDate[dateKey][`prop${topIndex + 1}`]) || 0) + (item.revenue || 0)
        } else if (propName) {
          dataByDate[dateKey].other = (Number(dataByDate[dateKey].other) || 0) + (item.revenue || 0)
        }
      })
    } else {
      Object.keys(dataByDate).forEach((dateKey) => {
        const periodRevenue = Number(dataByDate[dateKey].totalRevenue) || 0

        if (topPropsRevenue > 0) {
          const topPropsPortion = allPropsRevenue > 0 ? topPropsRevenue / allPropsRevenue : TOP_PROPERTIES_DEFAULT_PORTION
          const otherPortion = 1 - topPropsPortion

          topProps.forEach((prop: TopProperty, index: number) => {
            const propKey = `prop${index + 1}`
            const proportion = (prop.revenue || 0) / topPropsRevenue
            dataByDate[dateKey][propKey] = periodRevenue * proportion * topPropsPortion
          })

          if (hasMoreProperties) {
            const actualOtherPortion = Math.max(otherPortion, MIN_OTHER_REVENUE_PORTION)
            dataByDate[dateKey].other = periodRevenue * actualOtherPortion

            if (otherPortion < MIN_OTHER_REVENUE_PORTION) {
              const adjustmentFactor = (1 - MIN_OTHER_REVENUE_PORTION) / topPropsPortion
              topProps.forEach((_: unknown, index: number) => {
                const propKey = `prop${index + 1}`
                dataByDate[dateKey][propKey] = Number(dataByDate[dateKey][propKey]) * adjustmentFactor
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
      .sort((a: Record<string, number | string>, b: Record<string, number | string>) => {
        return String(a.date).localeCompare(String(b.date))
      })
      .map((item: Record<string, number | string>) => {
        const { date, displayDate, totalRevenue, ...properties } = item
        return {
          week: String(displayDate || date)
            .replace(' 2025', '')
            .replace('2025-', ''),
          fullDate: String(date),
          ...properties,
        }
      })
  }, [charts?.topProperties, charts?.revenueLastWeek, metrics?.properties?.total, resolvedTheme])

  const revenueGranularity = useMemo(() => {
    if (!charts?.revenueLastWeek?.length) return 'Monthly' as const
    return detectGranularity(charts.revenueLastWeek, 'date')
  }, [charts?.revenueLastWeek])

  const handleRevenueChartClick = useCallback(
    (data: { activeLabel?: string | number }) => {
      if (!data?.activeLabel) return
      const clicked = revenueChartData.find((d: Record<string, string | number>) => d.week === data.activeLabel)
      if (!clicked) return

      const rawDate = String(clicked.fullDate)
      let granularity: 'daily' | 'weekly' | 'monthly' = 'monthly'
      if (revenueGranularity === 'Daily') granularity = 'daily'
      else if (revenueGranularity === 'Weekly') granularity = 'weekly'

      const [year, month, day] = rawDate.split('-')
      openModal({
        type: 'period',
        month,
        year,
        day,
        originalDate: rawDate,
        granularity,
      })
    },
    [revenueChartData, revenueGranularity, openModal],
  )

  const revenueChartAreas = useMemo(() => {
    if (!charts?.topProperties) return []

    const allSortedProps = charts.topProperties || []
    const topRevenue = allSortedProps[0]?.revenue || 0
    const revenueThreshold = topRevenue * REVENUE_THRESHOLD_RATIO

    const significantProps = allSortedProps.filter((p: TopProperty) => p.revenue >= revenueThreshold).slice(0, MAX_INDIVIDUAL_PROPERTIES)

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
          />,
        )
      }
    }

    const otherCount = Math.max(0, totalPropertyCount - topProps.length)
    if (otherCount > 0) {
      areas.push(
        <Area
          key="other"
          type="monotone"
          dataKey="other"
          stackId="1"
          stroke={otherColor}
          fill={otherColor}
          fillOpacity={0.6}
          name={`Other (${otherCount} properties)`}
        />,
      )
    }

    return areas
  }, [charts?.topProperties, charts?.revenueLastWeek, metrics?.properties?.total, resolvedTheme])

  const revenueChartLegendItems = useMemo(() => {
    if (!charts?.topProperties) return []

    const allSortedProps = charts.topProperties || []
    const topRevenue = allSortedProps[0]?.revenue || 0
    const revenueThreshold = topRevenue * REVENUE_THRESHOLD_RATIO

    const significantProps = allSortedProps.filter((p: TopProperty) => p.revenue >= revenueThreshold).slice(0, MAX_INDIVIDUAL_PROPERTIES)

    const topProps = significantProps.length > 0 ? significantProps : allSortedProps.slice(0, 5)
    const totalPropertyCount = metrics?.properties?.total || charts.topProperties?.length || 0
    const colors = Array.from({ length: 10 }, (_, i) => getChartColor(i))

    const items = topProps.slice(0, MAX_INDIVIDUAL_PROPERTIES).map((p: TopProperty, i: number) => ({
      name: p.code || p.name || `Property ${i + 1}`,
      color: colors[i],
    }))

    const otherCount = Math.max(0, totalPropertyCount - topProps.length)
    if (otherCount > 0) {
      items.push({
        name: `Other (${otherCount})`,
        color: CHART_INFRA.reference,
      })
    }

    return items
  }, [charts?.topProperties, charts?.revenueLastWeek, metrics?.properties?.total, resolvedTheme])

  const enabledGoals = useMemo(() => {
    if (!goalProgressData) return []
    return goalProgressData
      .map((g) => {
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
      .filter(Boolean) as Array<{
      metricKey: string
      current: number
      target: number
      pct: number
      periodLabel: string
      config: (typeof GOAL_METRIC_CONFIG)[string]
    }>
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

  const actualUpcoming = parseInt(metrics.bookings.upcoming, 10) || 0

  return (
    <div className="space-y-6">
      {showEmptyNudge && (
        <div className="bg-warning-subtle border border-warning/30 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-warning mr-2 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-warning-fg">
                <strong>No data in this date range.</strong> Your bookings may fall outside the current period. Try a different range.
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
        <HeadlineMetric
          label="Total Revenue"
          value={Number(metrics.revenue.current) || 0}
          format="currency"
          tooltip={METRIC_DEFINITIONS.revenue}
          staggerIndex={0}
          subValue={
            comparisonMode !== 'none' && metrics.revenue.previous !== undefined ? (
              <>
                vs {comparisonLabel}: {formatCurrency(metrics.revenue.previous)}
                {comparisonDateRange && <span className="block text-xs text-muted-foreground/70 mt-0.5">{comparisonDateRange}</span>}
              </>
            ) : metrics.revenue.operatingExpenses > 0 ? (
              `Profit: ${formatCompactCurrency(metrics.revenue.operatingProfit)} · Host fees + Expenses: ${formatCompactCurrency(metrics.revenue.platformFees + metrics.revenue.operatingExpenses)}`
            ) : (
              `After host fees: ${formatCompactCurrency(metrics.revenue.net)}`
            )
          }
          trend={
            comparisonMode !== 'none' && Number(metrics.revenue.previous) > 0 && metrics.revenue.growth !== undefined
              ? {
                  value: metrics.revenue.growth,
                  isPositive: metrics.revenue.growth > 0,
                }
              : undefined
          }
          onClick={() => handleMetricCardClick('financial')}
        />
        <HeadlineMetric
          label="Total Bookings"
          value={metrics.bookings.current}
          format="number"
          tooltip={METRIC_DEFINITIONS.bookings}
          staggerIndex={1}
          subValue={
            comparisonMode !== 'none' && metrics.bookings.previous !== undefined ? (
              <>
                vs {comparisonLabel}: {metrics.bookings.previous} · {actualUpcoming} upcoming
                {comparisonDateRange && <span className="block text-xs text-muted-foreground/70 mt-0.5">{comparisonDateRange}</span>}
              </>
            ) : (
              `${actualUpcoming} coming up · ${Number(metrics.bookings.avgNights || 0).toFixed(1)} nights average`
            )
          }
          trend={
            comparisonMode !== 'none' && Number(metrics.bookings.previous) > 0
              ? {
                  value: ((metrics.bookings.current - metrics.bookings.previous) / metrics.bookings.previous) * 100,
                  isPositive: metrics.bookings.current > metrics.bookings.previous,
                }
              : undefined
          }
          onClick={() => handleMetricCardClick('properties')}
        />
        <HeadlineMetric
          label="Occupancy Rate"
          value={Number(metrics.occupancy.current || 0)}
          format="percent"
          progress={{ previous: comparisonMode !== 'none' ? Number(metrics.occupancy.previous ?? 0) : undefined }}
          tooltip={METRIC_DEFINITIONS.occupancy}
          staggerIndex={2}
          subValue={
            comparisonMode !== 'none' && metrics.occupancy.previous !== undefined ? (
              <>
                vs {comparisonLabel}: {formatPercentage(Number(metrics.occupancy.previous), 1)} · {metrics.properties.total} properties
                {metrics.occupancy.blockedNights ? ` · ${metrics.occupancy.blockedNights} owner-blocked` : ''}
                {comparisonDateRange && <span className="block text-xs text-muted-foreground/70 mt-0.5">{comparisonDateRange}</span>}
              </>
            ) : (
              `${metrics.properties.total} properties · ${formatPercentage(Number(metrics.occupancy.avgPropertyOccupancy || 0), 1)} average${metrics.occupancy.blockedNights ? ` · ${metrics.occupancy.blockedNights} owner-blocked` : ''}`
            )
          }
          trend={
            comparisonMode !== 'none' && Number(metrics.occupancy.previous) > 0 && metrics.occupancy.growth !== undefined
              ? {
                  value: metrics.occupancy.growth,
                  isPositive: metrics.occupancy.growth > 0,
                }
              : undefined
          }
          onClick={() => handleMetricCardClick('occupancy')}
        />
        <HeadlineMetric
          label="Total Guests"
          value={metrics.guests.total}
          format="number"
          tooltip={METRIC_DEFINITIONS.guests}
          staggerIndex={3}
          subValue={
            comparisonMode !== 'none' && metrics.guests.previous !== undefined ? (
              <>
                vs {comparisonLabel}: {metrics.guests.previous} · {metrics.guests.newThisMonth} new
                {comparisonDateRange && <span className="block text-xs text-muted-foreground/70 mt-0.5">{comparisonDateRange}</span>}
              </>
            ) : (
              `${metrics.guests.newThisMonth} ${metrics.guests.newThisMonth === 1 ? 'first-time guest' : 'first-time guests'} · ${formatPercentage(Number(metrics.guests.repeatRate || 0) * 100, 1)} returning`
            )
          }
          trend={
            comparisonMode !== 'none' && Number(metrics.guests.previous) > 0 && metrics.guests.growth !== undefined
              ? {
                  value: metrics.guests.growth,
                  isPositive: metrics.guests.growth > 0,
                }
              : undefined
          }
          onClick={() => handleMetricCardClick('guests')}
        />
      </div>

      <div className={`grid grid-cols-2 ${metrics.revenue.operatingExpenses > 0 ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-3 md:gap-4`}>
        {metrics.revenue.operatingExpenses > 0 && (
          <MetricCard
            label="Operating Profit"
            value={metrics.revenue.operatingProfit}
            format="currency"
            subValue={
              comparisonMode !== 'none' && metrics.revenue.previousOperatingProfit > 0
                ? `vs ${comparisonLabel}: ${formatCompactCurrency(metrics.revenue.previousOperatingProfit)}`
                : `${metrics.revenue.current > 0 ? formatPercentage((metrics.revenue.operatingProfit / metrics.revenue.current) * 100, 1) : '0%'} margin`
            }
            trend={
              comparisonMode !== 'none' && metrics.revenue.previousOperatingProfit > 0
                ? {
                    value:
                      ((metrics.revenue.operatingProfit - metrics.revenue.previousOperatingProfit) /
                        metrics.revenue.previousOperatingProfit) *
                      100,
                    isPositive: metrics.revenue.operatingProfit > metrics.revenue.previousOperatingProfit,
                  }
                : undefined
            }
            size="sm"
            tone={metrics.revenue.operatingProfit < 0 ? 'negative' : undefined}
            tooltip={METRIC_DEFINITIONS.operatingProfit}
            staggerIndex={4}
          />
        )}
        <MetricCard
          label="Average Booking Value"
          value={Number(metrics.revenue.avgBookingValue) || 0}
          format="currency"
          size="sm"
          tooltip={METRIC_DEFINITIONS.avgBookingValue}
          staggerIndex={metrics.revenue.operatingExpenses > 0 ? 5 : 4}
        />
        <MetricCard
          label="Average Stay Length"
          value={`${Number(metrics.bookings.avgNights || 0).toFixed(1)} nights`}
          format="custom"
          size="sm"
          tooltip={METRIC_DEFINITIONS.avgStay}
          staggerIndex={metrics.revenue.operatingExpenses > 0 ? 6 : 5}
        />
        <MetricCard
          label="Repeat Guests"
          value={Number(metrics.guests.repeatRate || 0) * 100}
          format="percent"
          size="sm"
          tooltip={METRIC_DEFINITIONS.repeatGuests}
          staggerIndex={metrics.revenue.operatingExpenses > 0 ? 7 : 6}
        />
        <MetricCard
          label="Cancellation Rate"
          value={Number(metrics.bookings.cancellationRate || 0)}
          tooltip={METRIC_DEFINITIONS.cancellationRate}
          format="percent"
          size="sm"
          staggerIndex={metrics.revenue.operatingExpenses > 0 ? 8 : 7}
        />
      </div>

      <PacingSummary tagIds={tagIds} propertyIds={propertyIds} onOpen={() => handleMetricCardClick('occupancy')} />

      <div className="grid lg:grid-cols-2 gap-6">
        <ChartWrapper
          title="Revenue Composition by Property"
          height={340}
          responsive={false}
          noData={revenueChartData.length === 0}
          noDataMessage="No revenue data for this period"
        >
          <div className="h-full flex flex-col">
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueChartData} onClick={handleRevenueChartClick} style={{ cursor: 'pointer' }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_INFRA.grid} />
                  <XAxis dataKey="week" stroke={CHART_INFRA.axis} tick={{ fontSize: 11 }} />
                  <YAxis
                    tickFormatter={(value: number) => `$${(value / 1000).toFixed(0)}k`}
                    stroke={CHART_INFRA.axis}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip content={<RevenueChartTooltip />} isAnimationActive={false} />
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
                        offset: 4,
                      }}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-3 justify-center text-xs mt-3 px-4">
              {revenueChartLegendItems.map((item: RevenueChartLegendItem) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <div className="w-3 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </ChartWrapper>

        <ChartWrapper title="Booking Sources" height={340} noData={charts.bookingsBySource.length === 0} responsive={false}>
          <div style={{ height: 300 }}>
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
                  {bookingSourceChartData.map((entry: BookingSourceChartItem, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={getPlatformColor(entry.source, index)}
                      opacity={bookingSourceActiveIndex === null || bookingSourceActiveIndex === index ? 1 : 0.3}
                      style={{ transition: 'opacity 0.2s ease' }}
                    />
                  ))}
                  <Label
                    content={({ viewBox }) => {
                      const { cx, cy } = viewBox as { cx: number; cy: number }
                      const total = bookingSourceChartData.reduce((sum: number, s: BookingSourceChartItem) => sum + s.count, 0)
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
            {bookingSourceChartData.map((entry: BookingSourceChartItem, index: number) => (
              <div key={entry.source} className="flex items-center gap-1.5">
                <div className="w-3 h-2.5 rounded-sm" style={{ backgroundColor: getPlatformColor(entry.source, index) }} />
                <span className="text-muted-foreground">{entry.source}</span>
              </div>
            ))}
          </div>
        </ChartWrapper>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Goals</h3>
            </div>
            {enabledGoals.length > 0 && (
              <Button asChild variant="ghost" size="sm" className="-my-1 text-muted-foreground">
                <Link to="/settings?tab=goals">Edit</Link>
              </Button>
            )}
          </div>
          {enabledGoals.length > 0 ? (
            <ul className="space-y-4 max-h-80 overflow-y-auto">
              {enabledGoals.map((goal) => (
                <li key={goal.metricKey}>
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="min-w-0 truncate text-sm">
                      <span className="font-medium text-foreground">{goal.config.label}</span>
                      <span className="text-muted-foreground"> · {goal.periodLabel}</span>
                    </span>
                    <span className="shrink-0 text-sm tabular-nums">
                      {formatGoalValue(goal.current, goal.config.format)}
                      <span className="text-muted-foreground"> of {formatGoalValue(goal.target, goal.config.format)}</span>
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-1.5 flex-1 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-500"
                        style={{ width: `${Math.min(goal.pct, 100)}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">{Math.round(goal.pct)}%</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <p>No goals</p>
              <Link to="/settings?tab=goals" className="mt-1 inline-block text-primary underline-offset-2 hover:underline">
                Set goals
              </Link>
            </div>
          )}
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Recent activity</h3>
            </div>
            <span className="text-xs text-muted-foreground">
              {formatDateDisplay(filters.dateRange.from)} – {formatDateDisplay(filters.dateRange.to)}
            </span>
          </div>
          <div className="max-h-80 overflow-y-auto overflow-x-hidden pr-2 divide-y divide-border">
            {recentActivity && recentActivity.length > 0 ? (
              recentActivity.map((activity: RecentActivity) => {
                const isCancelled = activity.status === 'canceled'
                const isInquiry = activity.type === 'inquiry'
                const isClickable = activity.type === 'booking' && (activity.ownerrezGuestId || activity.guestName)
                const ownerrezUrl = activity.ownerrezBookingId
                  ? `https://app.ownerrez.com/bookings/${activity.ownerrezBookingId}`
                  : activity.ownerrezInquiryId
                    ? `https://app.ownerrez.com/inquiries/${activity.ownerrezInquiryId}`
                    : null
                return (
                  <div
                    key={activity.id}
                    className={`flex items-center justify-between py-3 px-2 -mx-2 rounded ${
                      isClickable ? 'hover:bg-muted/50 transition-colors cursor-pointer' : ''
                    }`}
                    onClick={() => handleActivityClick(activity)}
                  >
                    <div className="flex-1 min-w-0 mr-2">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium truncate ${isCancelled ? 'text-muted-foreground' : ''}`}>
                          {activity.description}
                        </p>
                        {isInquiry && <Badge variant="neutral">Inquiry</Badge>}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-1.5 mt-0.5 text-xs text-muted-foreground">
                        <span>{formatDateDisplay(activity.timestamp)}</span>
                        {activity.metadata?.arrival && activity.metadata?.departure && (
                          <>
                            <span aria-hidden>·</span>
                            <span>Stay {formatStay(activity.metadata.arrival, activity.metadata.departure)}</span>
                          </>
                        )}
                        {activity.platform && <span aria-hidden>·</span>}
                        {activity.platform && (
                          <span className="inline-flex items-center gap-1">
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
                      {activity.value != null && activity.value > 0 && (
                        <div className={`text-sm font-medium tabular-nums ${isCancelled ? 'text-muted-foreground line-through' : ''}`}>
                          {formatCurrency(activity.value)}
                        </div>
                      )}
                      {ownerrezUrl && (
                        <a
                          href={ownerrezUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                          title="Open in OwnerRez"
                          aria-label="Open in OwnerRez"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No bookings or inquiries in this period</p>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming Section */}
      {data.upcoming && data.upcoming.length > 0 && <UpcomingSection upcoming={data.upcoming} />}
    </div>
  )
}

const UPCOMING_PAGE_SIZE = 8

// the icon shape and label tell the three states apart, so they share one neutral treatment
const UPCOMING_TYPE_STYLES: Record<UpcomingBooking['type'], { icon: LucideIcon; label: string }> = {
  'check-in': { icon: LogIn, label: 'Check-in' },
  'in-house': { icon: BedDouble, label: 'In-house through' },
  'check-out': { icon: LogOut, label: 'Check-out' },
}

const UpcomingSection = ({ upcoming }: { upcoming: UpcomingBooking[] }) => {
  const [filter, setFilter] = useState<'all' | 'today' | 'week' | 'month'>('week')
  const [page, setPage] = useState(1)
  const { openModal } = useModal()

  const filtered = useMemo(() => {
    switch (filter) {
      case 'today':
        return upcoming.filter((b: UpcomingBooking) => b.isToday)
      case 'week':
        return upcoming.filter((b: UpcomingBooking) => b.isThisWeek)
      case 'month':
        return upcoming
      default:
        return upcoming
    }
  }, [upcoming, filter])

  // reset page when filter changes
  const handleFilterChange = useCallback((key: typeof filter) => {
    setFilter(key)
    setPage(1)
  }, [])

  const paginated = filtered.slice((page - 1) * UPCOMING_PAGE_SIZE, page * UPCOMING_PAGE_SIZE)

  return (
    <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Arrivals & Departures</h3>
          <span className="text-sm text-muted-foreground tabular-nums">{filtered.length}</span>
        </div>
        <SegmentedControl
          label="Arrival window"
          value={filter}
          onChange={handleFilterChange}
          options={[
            { value: 'today', label: 'Today' },
            { value: 'week', label: 'This week' },
            { value: 'month', label: 'This month' },
          ]}
        />
      </div>
      <div className="space-y-2">
        {paginated.length > 0 ? (
          paginated.map((booking: UpcomingBooking) => {
            const style = UPCOMING_TYPE_STYLES[booking.type]
            const Icon = style.icon
            const dateLabel = booking.type === 'check-in' ? booking.arrival : booking.departure
            const ownerrezUrl = booking.ownerrezBookingId ? `https://app.ownerrez.com/bookings/${booking.ownerrezBookingId}` : null
            return (
              <div
                key={booking.id}
                className="flex items-center justify-between py-2 px-2 -mx-2 border-b last:border-0 rounded hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => openModal({ type: 'booking', bookingId: booking.id, guestName: booking.guestName })}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-muted">
                    <Icon className="w-4 h-4 text-muted-foreground" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{booking.guestName}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {booking.propertyName} · {style.label} {formatDateDisplay(dateLabel)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {booking.amount > 0 && (
                    <span className="text-sm font-medium tabular-nums text-foreground">{formatCurrency(booking.amount)}</span>
                  )}
                  {ownerrezUrl && (
                    <a
                      href={ownerrezUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                      title="Open in OwnerRez"
                      aria-label="Open in OwnerRez"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            )
          })
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-sm">
              {filter === 'today'
                ? 'No arrivals or departures today'
                : filter === 'week'
                  ? 'No guest activity this week'
                  : 'No guest activity this month'}
            </p>
          </div>
        )}
      </div>
      <Pagination
        currentPage={page}
        totalPages={Math.ceil(filtered.length / UPCOMING_PAGE_SIZE)}
        totalItems={filtered.length}
        pageSize={UPCOMING_PAGE_SIZE}
        onPageChange={setPage}
      />
    </div>
  )
}
