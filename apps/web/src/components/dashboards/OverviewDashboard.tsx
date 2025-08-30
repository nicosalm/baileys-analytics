import { useDashboardBatch } from '@/hooks/use-api'
import { useTips } from '@/hooks/use-tips'
import { useTagIds, useErrorToast } from '@/hooks/use-dashboard-utils'
import { formatCurrency, formatCompactCurrency, formatPercentage, formatDateDisplay } from '@baileys/utils'
import {
  AlertCircle, CheckCircle, TrendingUp,
  DollarSign, Users, Home, Calendar, Clock,
  BarChart3, Activity, AlertTriangle, Info
} from 'lucide-react'
import { MetricCard } from '@/components/MetricCard'
import { ChartWrapper } from '@/components/ChartWrapper'
import { StateWrapper } from '@/components/StateWrapper'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { useDashboard } from '@/contexts/dashboard'
import { METRIC_COLORS, getPlatformColor } from '@/lib/theme'


const AlertCard = ({ alert }: { alert: any }) => {
  const icons = {
    warning: <AlertTriangle className="w-5 h-5 text-yellow-600" />,
    info: <AlertCircle className="w-5 h-5 text-blue-600" />,
    success: <CheckCircle className="w-5 h-5 text-green-600" />
  }

  const bgColors = {
    warning: 'bg-yellow-50 border-yellow-200',
    info: 'bg-blue-50 border-blue-200',
    success: 'bg-green-50 border-green-200'
  }

  return (
    <div className={`p-4 rounded-lg border ${(bgColors as any)[alert.type]}`}>
      <div className="flex items-start">
        <div className="shrink-0 mt-0.5">{(icons as any)[alert.type]}</div>
        <div className="ml-3 flex-1">
          <h4 className="text-sm font-medium">{alert.title}</h4>
          <p className="text-sm text-gray-600 mt-1">{alert.description}</p>
          <p className="text-xs text-gray-500 mt-2">
            {formatDateDisplay(new Date(alert.timestamp))}
          </p>
        </div>
      </div>
    </div>
  )
}


export const OverviewDashboard = () => {
  const { filters, setActiveTab, comparisonRange, comparisonMode } = useDashboard()
  const { showTips } = useTips()
  const tagIds = useTagIds()
  
  // Use the batch endpoint
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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Your Business at a Glance</h2>
          <p className="text-gray-600 text-sm mt-1">
            Everything you need to know about how your properties are doing
          </p>
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
      <div className="grid md:grid-cols-4 gap-4">
        <MetricCard
          icon={DollarSign}
          label="Money Earned"
          value={Number(metrics.revenue.current) || 0}
          format="currency"
          subValue={comparisonMode !== 'none' && metrics.revenue.previous !== undefined
            ? `vs ${comparisonMode === 'previous-year' ? 'last year' : 'previous period'}: ${formatCurrency(metrics.revenue.previous)} | After fees: ${formatCompactCurrency(metrics.revenue.net)}`
            : `After fees: ${formatCompactCurrency(metrics.revenue.net)} | Per booking: ${formatCurrency(metrics.revenue.avgBookingValue)}`
          }
          trend={comparisonMode !== 'none' && metrics.revenue.growth !== undefined ? {
            value: metrics.revenue.growth,
            isPositive: metrics.revenue.growth > 0
          } : undefined}
          color="green"
          onClick={() => setActiveTab('financial')}
        />
        <MetricCard
          icon={Calendar}
          label="Reservations Made"
          value={metrics.bookings.current}
          subValue={comparisonMode !== 'none' && metrics.bookings.previous !== undefined
            ? `vs ${comparisonMode === 'previous-year' ? 'last year' : 'previous period'}: ${metrics.bookings.previous} | ${actualUpcoming} upcoming`
            : `${actualUpcoming} coming up | ${Number(metrics.bookings.avgNights || 0).toFixed(1)} nights average`
          }
          trend={comparisonMode !== 'none' && metrics.bookings.previous !== undefined ? {
            value: ((metrics.bookings.current - metrics.bookings.previous) / (metrics.bookings.previous || 1)) * 100,
            isPositive: metrics.bookings.current > metrics.bookings.previous
          } : undefined}
          color="blue"
          onClick={() => setActiveTab('properties')}
        />
        <MetricCard
          icon={Home}
          label="How Full You Are"
          value={Number(metrics.occupancy.current || 0) * 100}
          format="percent"
          subValue={comparisonMode !== 'none' && metrics.occupancy.previous !== undefined
            ? `vs ${comparisonMode === 'previous-year' ? 'last year' : 'previous period'}: ${formatPercentage(Number(metrics.occupancy.previous) * 100, 0)} | ${metrics.properties.total} properties`
            : `${metrics.properties.total} properties | ${formatPercentage(Number(metrics.occupancy.avgPropertyOccupancy || 0) * 100, 0)} average`
          }
          trend={comparisonMode !== 'none' && metrics.occupancy.growth !== undefined ? {
            value: metrics.occupancy.growth,
            isPositive: metrics.occupancy.growth > 0
          } : undefined}
          color="purple"
          onClick={() => setActiveTab('occupancy')}
        />
        <MetricCard
          icon={Users}
          label="Guest Count"
          value={metrics.guests.total}
          subValue={comparisonMode !== 'none' && metrics.guests.previous !== undefined
            ? `vs ${comparisonMode === 'previous-year' ? 'last year' : 'previous period'}: ${metrics.guests.previous} | ${metrics.guests.newThisMonth} new`
            : `${metrics.guests.newThisMonth} first-timers | ${formatPercentage(Number(metrics.guests.repeatRate || 0) * 100, 0)} returning`
          }
          trend={comparisonMode !== 'none' && metrics.guests.growth !== undefined ? {
            value: metrics.guests.growth,
            isPositive: metrics.guests.growth > 0
          } : undefined}
          color="orange"
          onClick={() => setActiveTab('guests')}
        />
      </div>

      {/* Secondary Metrics - Key Supporting KPIs */}
      <div className="grid md:grid-cols-4 gap-4">
        <MetricCard
          icon={TrendingUp}
          label="Avg Booking Value"
          value={Number(metrics.revenue.avgBookingValue) || 0}
          format="currency"
          subValue="Per reservation"
          size="sm"
          color="gray"
        />
        <MetricCard
          icon={Activity}
          label="Avg Stay Length"
          value={`${Number(metrics.bookings.avgNights || 0).toFixed(1)} nights`}
          format="custom"
          subValue="Per guest"
          size="sm"
          color="gray"
        />
        <MetricCard
          icon={Users}
          label="Repeat Guests"
          value={Number(metrics.guests.repeatRate || 0) * 100}
          format="percent"
          subValue={metrics.guests.total > 0 ? 'Return rate' : 'No data yet'}
          size="sm"
          color="gray"
        />
        <MetricCard
          icon={AlertCircle}
          label="Cancellation Rate"
          value={Number(metrics.bookings.cancellationRate || 0)}
          format="percent"
          subValue="This period"
          size="sm"
          color={Number(metrics.bookings.cancellationRate || 0) > 10 ? "red" : "gray"}
        />
      </div>

      {/* 2x2 Grid of Overview Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <ChartWrapper
          title={`Revenue Trend${
            charts.revenueLastWeek.length > 0 
              ? charts.revenueLastWeek[0].day?.includes('Week of') 
                ? ' (Weekly)' 
                : charts.revenueLastWeek[0].day?.length > 7 
                  ? ' (Monthly)' 
                  : ' (Daily)'
              : ''
          }`}
          icon={TrendingUp}
          height={240}
          noData={charts.revenueLastWeek.length === 0}
        >
          <AreaChart data={charts.revenueLastWeek}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={METRIC_COLORS.revenue} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={METRIC_COLORS.revenue} stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis tickFormatter={(value: any) => `$${(value / 1000).toFixed(0)}k`} />
            <Tooltip 
              formatter={(value: any) => [formatCurrency(Number(value)), 'Revenue']}
              contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '6px' }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke={METRIC_COLORS.revenue}
              fillOpacity={1}
              fill="url(#colorRevenue)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartWrapper>

        {/* Top Properties Performance */}
        <ChartWrapper
          title="Top Properties"
          icon={Home}
          height={240}
          noData={charts.topProperties.length === 0}
        >
          <BarChart data={charts.topProperties.slice(0, 5).map((item: any) => ({
            ...item,
            revenue: Number(item.revenue),
            bookings: Number(item.bookings)
          }))}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              height={60}
              interval={0}
              tick={{ fontSize: 10 }}
            />
            <YAxis tickFormatter={(value: any) => `$${(value / 1000).toFixed(0)}k`} />
            <Tooltip 
              formatter={(value: any) => [formatCurrency(Number(value)), 'Revenue']}
              contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '6px' }}
            />
            <Bar dataKey="revenue" fill={METRIC_COLORS.revenue} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartWrapper>

        {/* Booking Sources Distribution */}
        <ChartWrapper
          title="Booking Sources"
          icon={BarChart3}
          height={240}
          noData={charts.bookingsBySource.length === 0}
        >
          <PieChart>
            <Pie
              data={charts.bookingsBySource.map((item: any) => ({
                ...item,
                count: Number(item.count)
              }))}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(entry: any) => `${entry.source} ${formatPercentage((entry.percent || 0) * 100, 0)}`}
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

        {/* Occupancy Trend */}
        <ChartWrapper
          title={`How Full You've Been${charts.occupancyTrend.length > 0 && charts.occupancyTrend[0].month?.includes('/') ? ' (Daily)' : ' (Monthly)'}`}
          icon={Calendar}
          height={192}
          noData={charts.occupancyTrend.length === 0}
        >
          <LineChart data={charts.occupancyTrend.map((item: any) => ({
            ...item,
            rate: Number(item.rate)
          }))}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={(value: any) => `${value}%`} domain={[0, 100]} />
            <Tooltip 
              formatter={(value: any) => [`${value}% of nights booked`, 'Occupancy']}
              contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '6px' }}
            />
            <Line
              type="monotone"
              dataKey="rate"
              stroke={METRIC_COLORS.occupancy}
              strokeWidth={2}
              dot={{ fill: METRIC_COLORS.occupancy, r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ChartWrapper>
      </div>

      {/* Alerts and Activity Panels */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Alerts & Notifications Panel */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
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
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p>Everything looks good!</p>
                <p className="text-xs mt-1">No issues to report</p>
              </div>
            )}
          </div>
        </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">What's New</h3>
            <span className="text-xs text-gray-500">Recent bookings</span>
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {recentActivity && recentActivity.length > 0 ? (
              recentActivity.map((activity: any) => (
                <div key={activity.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.description}</p>
                    <p className="text-xs text-gray-500">
                      {formatDateDisplay(new Date(activity.timestamp))}
                    </p>
                  </div>
                  {activity.value && (
                    <div className="text-sm font-medium text-green-600">
                      {formatCurrency(activity.value)}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Clock className="w-8 h-8 mx-auto mb-2" />
                <p>No recent activity</p>
                <p className="text-xs mt-1">Check back later</p>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}