import { useMemo, useCallback, memo } from 'react'
import { useDashboardBatch } from '@/hooks/use-api'
import { useTips } from '@/hooks/use-tips'
import { useTagIds, useErrorToast } from '@/hooks/use-dashboard-utils'
import { formatCurrency, formatCompactCurrency, formatPercentage, formatDateDisplay } from '@baileys/utils'
import {
  AlertCircle, CheckCircle, TrendingUp, TrendingDown,
  DollarSign, Users, Calendar, Clock,
  BarChart3, AlertTriangle, Info, Percent, Layers
} from 'lucide-react'
import { MetricCard } from '@/components/MetricCard'
import { MetricCardWithGauge } from '@/components/MetricCardWithGauge'
import { ChartWrapper } from '@/components/ChartWrapper'
import { StateWrapper } from '@/components/StateWrapper'
import { PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area, Legend } from 'recharts'
import { useDashboard } from '@/contexts/dashboard'
import { useModal } from '@/contexts/modal'
import { getPlatformColor } from '@/lib/theme'
import { useNavigate } from 'react-router-dom'

const REVENUE_THRESHOLD_RATIO = 0.2
const MAX_INDIVIDUAL_PROPERTIES = 8
const MIN_OTHER_REVENUE_PORTION = 0.2
const TOP_PROPERTIES_DEFAULT_PORTION = 0.8

const alertIcons = {
  warning: <AlertTriangle className="w-4 h-4 text-yellow-600" />,
  info: <AlertCircle className="w-4 h-4 text-blue-600" />,
  success: <CheckCircle className="w-4 h-4 text-green-600" />
}

const AlertCard = memo(({ alert }: { alert: any }) => (
  <div className="flex items-center justify-between py-2 border-b last:border-0">
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <div className="shrink-0">{(alertIcons as any)[alert.type]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{alert.title}</p>
        <p className="text-xs text-gray-500">
          {formatDateDisplay(new Date(alert.timestamp))}
        </p>
      </div>
    </div>
  </div>
))

AlertCard.displayName = 'AlertCard'

// extracted tooltip component to module scope
const RevenueChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const total = payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0)
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
        <p className="font-semibold text-sm mb-2">{label}</p>
        <div className="space-y-1 text-xs">
          {payload.slice().reverse().map((entry: any, index: number) => (
            <div key={index} className="flex justify-between gap-4">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: entry.color }} />
                <span className="text-gray-600">{entry.name}:</span>
              </div>
              <span className="font-medium">{formatCompactCurrency(entry.value)}</span>
            </div>
          ))}
          <div className="pt-1 mt-1 border-t border-gray-200">
            <div className="flex justify-between gap-4 font-semibold">
              <span>Total:</span>
              <span className="text-green-600">{formatCompactCurrency(total)}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }
  return null
}


export const OverviewDashboard = () => {
  const { filters, comparisonRange, comparisonMode } = useDashboard()
  const { showTips } = useTips()
  const { openModal } = useModal()
  const tagIds = useTagIds()
  const navigate = useNavigate()

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

  const { data, error, isLoading } = useDashboardBatch(
    'overview',
    filters.dateRange.from,
    filters.dateRange.to,
    tagIds,
    comparisonRange?.from,
    comparisonRange?.to
  )

  useErrorToast(error, 'Failed to load overview data')

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

  const { metrics, alerts, recentActivity, charts } = data

  // memoize revenue composition chart data
  const revenueChartData = useMemo(() => {
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
  }, [charts.topProperties, charts.revenueLastWeek, metrics?.properties?.total])

  // memoize the Area components for revenue chart
  const revenueChartAreas = useMemo(() => {
    const allSortedProps = charts.topProperties || []
    const topRevenue = allSortedProps[0]?.revenue || 0
    const revenueThreshold = topRevenue * REVENUE_THRESHOLD_RATIO

    const significantProps = allSortedProps
      .filter((p: any) => p.revenue >= revenueThreshold)
      .slice(0, MAX_INDIVIDUAL_PROPERTIES)

    const topProps = significantProps.length > 0 ? significantProps : allSortedProps.slice(0, 5)
    const totalPropertyCount = metrics?.properties?.total || charts.topProperties?.length || 0
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']
    const otherColor = '#9CA3AF'

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
            name={topProps[i].name || `Property ${i + 1}`}
          />
        )
      }
    }

    const otherCount = Math.max(0, totalPropertyCount - topProps.length)
    if (otherCount > 0 || charts.revenueLastWeek?.length > 0) {
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
  }, [charts.topProperties, charts.revenueLastWeek, metrics?.properties?.total])

  const upcomingArrivalsAlert = alerts?.find((alert: any) => {
    const hasArrival = alert.description?.toLowerCase().includes('arriving') ||
                      alert.description?.toLowerCase().includes('guests arriving') ||
                      alert.title?.toLowerCase().includes('upcoming arrivals') ||
                      (alert.title?.toLowerCase().includes('arrival') && !alert.title?.toLowerCase().includes('occupancy'))
    return hasArrival
  })

  let upcomingFromAlert = null
  if (upcomingArrivalsAlert) {
    const patterns = [
      /(\d+)\s+guest/i,
      /(\d+)\s+arrival/i,
      /(\d+)\s+booking/i,
    ]

    for (const pattern of patterns) {
      const match = upcomingArrivalsAlert.description?.match(pattern) ||
                   upcomingArrivalsAlert.title?.match(pattern)
      if (match) {
        upcomingFromAlert = match[1]
        break
      }
    }
  }

  const metricsUpcoming = parseInt(metrics.bookings.upcoming) || 0
  const actualUpcoming = (metricsUpcoming === 0 && upcomingFromAlert)
    ? parseInt(upcomingFromAlert)
    : metricsUpcoming

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Your Business at a Glance</h2>
            <p className="text-gray-600 text-sm mt-1">
              Everything you need to know about how your properties are doing
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
              Live Data
            </span>
          </div>
        </div>
      </div>

      {showTips && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
            <div className="text-sm text-blue-800">
              <strong>Quick Start:</strong> Click any metric card to dive deeper into that area.
              Green arrows mean improvement, red arrows mean decline. All numbers reflect your selected date range.
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
          tooltip="Total revenue from all bookings in selected period"
          subValue={comparisonMode !== 'none' && metrics.revenue.previous !== undefined
            ? `vs ${comparisonMode === 'previous-year' ? 'last year' : 'previous period'}: ${formatCurrency(metrics.revenue.previous)}`
            : `After fees: ${formatCompactCurrency(metrics.revenue.net)}`
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
              metrics.revenue.current * 2,
            segments: comparisonMode !== 'none' && metrics.revenue.previous ? [
              { threshold: metrics.revenue.previous * 0.8 / (Math.max(metrics.revenue.current, metrics.revenue.previous) * 1.5) * 100, color: '#EF4444', label: 'Below' },
              { threshold: metrics.revenue.previous * 1.0 / (Math.max(metrics.revenue.current, metrics.revenue.previous) * 1.5) * 100, color: '#F59E0B', label: 'Target' },
              { threshold: 100, color: '#10B981', label: 'Above' }
            ] : [
              { threshold: 30, color: '#EF4444', label: 'Low' },
              { threshold: 60, color: '#F59E0B', label: 'Medium' },
              { threshold: 100, color: '#10B981', label: 'High' }
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
          tooltip="Total number of confirmed bookings"
          subValue={comparisonMode !== 'none' && metrics.bookings.previous !== undefined
            ? `vs ${comparisonMode === 'previous-year' ? 'last year' : 'previous period'}: ${metrics.bookings.previous} | ${actualUpcoming} upcoming`
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
              metrics.bookings.current * 2,
            segments: comparisonMode !== 'none' && metrics.bookings.previous ? [
              { threshold: metrics.bookings.previous * 0.8 / (Math.max(metrics.bookings.current, metrics.bookings.previous) * 1.5) * 100, color: '#EF4444', label: 'Below' },
              { threshold: metrics.bookings.previous * 1.0 / (Math.max(metrics.bookings.current, metrics.bookings.previous) * 1.5) * 100, color: '#F59E0B', label: 'Target' },
              { threshold: 100, color: '#10B981', label: 'Above' }
            ] : [
              { threshold: 30, color: '#EF4444', label: 'Low' },
              { threshold: 60, color: '#F59E0B', label: 'Medium' },
              { threshold: 100, color: '#10B981', label: 'High' }
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
          tooltip="Percentage of available nights booked"
          subValue={comparisonMode !== 'none' && metrics.occupancy.previous !== undefined
            ? `vs ${comparisonMode === 'previous-year' ? 'last year' : 'previous period'}: ${formatPercentage(Number(metrics.occupancy.previous), 0)} | ${metrics.properties.total} properties`
            : `${metrics.properties.total} properties | ${formatPercentage(Number(metrics.occupancy.avgPropertyOccupancy || 0), 0)} average`
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
              { threshold: 50, color: '#EF4444', label: 'Low' },
              { threshold: 75, color: '#F59E0B', label: 'Good' },
              { threshold: 100, color: '#10B981', label: 'Excellent' }
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
          tooltip="Total unique guests who have stayed"
          subValue={comparisonMode !== 'none' && metrics.guests.previous !== undefined
            ? `vs ${comparisonMode === 'previous-year' ? 'last year' : 'previous period'}: ${metrics.guests.previous} | ${metrics.guests.newThisMonth} new`
            : `${metrics.guests.newThisMonth} first-timers | ${formatPercentage(Number(metrics.guests.repeatRate || 0) * 100, 0)} returning`
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
              metrics.guests.total * 2,
            segments: comparisonMode !== 'none' && metrics.guests.previous ? [
              { threshold: metrics.guests.previous * 0.8 / (Math.max(metrics.guests.total, metrics.guests.previous) * 1.5) * 100, color: '#EF4444', label: 'Below' },
              { threshold: metrics.guests.previous * 1.0 / (Math.max(metrics.guests.total, metrics.guests.previous) * 1.5) * 100, color: '#F59E0B', label: 'Target' },
              { threshold: 100, color: '#10B981', label: 'Above' }
            ] : [
              { threshold: 30, color: '#EF4444', label: 'Low' },
              { threshold: 60, color: '#F59E0B', label: 'Medium' },
              { threshold: 100, color: '#10B981', label: 'High' }
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
          tooltip="Average revenue per booking"
        />
        <MetricCard
          icon={Calendar}
          label="Average Stay Length"
          value={`${Number(metrics.bookings.avgNights || 0).toFixed(1)} nights`}
          format="custom"
          subValue="Per guest"
          size="sm"
          color="gray"
          tooltip="Average length of stay per booking"
        />
        <MetricCard
          icon={TrendingUp}
          label="Repeat Guests"
          value={Number(metrics.guests.repeatRate || 0) * 100}
          format="percent"
          subValue={metrics.guests.total > 0 ? 'Return rate' : 'No data yet'}
          size="sm"
          color="gray"
          tooltip="Percentage of returning guests"
        />
        <MetricCard
          icon={TrendingDown}
          label="Cancellation Rate"
          value={Number(metrics.bookings.cancellationRate || 0)}
          tooltip="Percentage of bookings canceled"
          format="percent"
          subValue="This period"
          size="sm"
          color={Number(metrics.bookings.cancellationRate || 0) > 10 ? "red" : "gray"}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <ChartWrapper
          title="Revenue Composition by Property"
          subtitle="Showing revenue breakdown across your top properties"
          icon={Layers}
          height={300}
        >
          <AreaChart data={revenueChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="week"
              stroke="#6B7280"
              tick={{ fontSize: 11 }}
            />
            <YAxis
              tickFormatter={(value: any) => `$${(value / 1000).toFixed(0)}k`}
              stroke="#6B7280"
              tick={{ fontSize: 11 }}
            />
            <Tooltip content={<RevenueChartTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '10px' }}
              iconType="rect"
            />
            {revenueChartAreas}
          </AreaChart>
        </ChartWrapper>

        <ChartWrapper
          title="Booking Sources"
          icon={BarChart3}
          height={280}
          noData={charts.bookingsBySource.length === 0}
        >
          <PieChart width={360} height={240}>
            <Pie
              data={charts.bookingsBySource.map((item: any) => ({
                ...item,
                count: Number(item.count)
              }))}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(entry: any) => {
                const percent = ((entry.percent || 0) * 100).toFixed(0)
                const name = entry.source.length > 18 ? entry.source.substring(0, 18) + '...' : entry.source
                return parseInt(percent) > 5 ? `${name} (${percent}%)` : ''
              }}
              outerRadius={80}
              fill="#8884d8"
              dataKey="count"
            >
              {charts.bookingsBySource.map((entry: any, index: any) => (
                <Cell key={`cell-${index}`} fill={getPlatformColor(entry.source, index)} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: any) => [value, 'Bookings']}
              contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '6px' }}
            />
          </PieChart>
        </ChartWrapper>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Things to Know</h3>
            <span className="text-xs text-gray-500">{alerts?.length || 0} items</span>
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {alerts && alerts.length > 0 ? (
              alerts.map((alert: any) => (
                <AlertCard key={alert.id} alert={alert} />
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">Everything looks good!</p>
                <p className="text-xs mt-1 text-gray-400">No issues to report</p>
              </div>
            )}
          </div>
        </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">What's New</h3>
            <span className="text-xs text-gray-500">Recent bookings</span>
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto overflow-x-hidden">
            {recentActivity && recentActivity.length > 0 ? (
              recentActivity.map((activity: any) => (
                <div
                  key={activity.id}
                  className={`flex items-center justify-between py-2 border-b last:border-0 ${
                    activity.bookingId ? 'hover:bg-gray-50 px-2 -mx-2 rounded transition-colors cursor-pointer' : ''
                  }`}
                  onClick={() => handleActivityClick(activity)}
                >
                  <div className="flex-1 min-w-0 mr-2">
                    <p className="text-sm font-medium truncate">{activity.description}</p>
                    <p className="text-xs text-gray-500">
                      {formatDateDisplay(new Date(activity.timestamp))}
                    </p>
                  </div>
                  {activity.value && (
                    <div className="text-sm font-medium text-green-600 flex-shrink-0">
                      {formatCurrency(activity.value)}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">No recent activity</p>
                <p className="text-xs mt-1 text-gray-400">Check back later for updates</p>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}
