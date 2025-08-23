import { useEffect } from 'react'
import { useOverview } from '@/hooks/use-api'
import { formatCurrency, formatCompactCurrency, formatPercentage, formatDateDisplay } from '@baileys/utils'
import {
  AlertCircle, CheckCircle, TrendingUp,
  DollarSign, Users, Home, Calendar, Clock,
  BarChart3, Activity, CreditCard, AlertTriangle, Info
} from 'lucide-react'
import { MetricCard } from '@/components/MetricCard'
import { ChartWrapper } from '@/components/ChartWrapper'
import { StateWrapper } from '@/components/StateWrapper'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { useToast } from '@/contexts/toast'
import { useDashboard } from '@/contexts/dashboard'
import { METRIC_COLORS, CHART_COLORS } from '@/lib/theme'


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
  const { addToast } = useToast()
  const { filters, setActiveTab, comparisonRange, comparisonMode } = useDashboard()
  
  const tagIds = filters.selectedTags.map(t => t.id)
  const { data, error, isLoading } = useOverview(
    filters.dateRange.from,
    filters.dateRange.to,
    tagIds,
    comparisonRange?.from,
    comparisonRange?.to
  )

  useEffect(() => {
    if (error) {
      addToast('error', `Overview error: ${error.message || 'Failed to load overview data'}`)
    }
  }, [error?.message, addToast])

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

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
          <div className="text-sm text-blue-800">
            <strong>Quick Start:</strong> Click any metric card to dive deeper into that area. 
            Green arrows mean improvement, red arrows mean decline. All numbers reflect your selected date range.
          </div>
        </div>
      </div>

      {/* Primary Metrics - 4 columns */}
      <div className="grid md:grid-cols-4 gap-4">
        <MetricCard
          icon={DollarSign}
          label="Money Earned"
          value={Number(metrics.revenue.current) || 0}
          format="currency"
          subValue={comparisonMode !== 'none' 
            ? `vs ${comparisonMode === 'previous-year' ? 'last year' : 'previous period'}: ${formatCurrency(metrics.revenue.previous)} | After fees: ${formatCompactCurrency(metrics.revenue.net)}`
            : `After fees: ${formatCompactCurrency(metrics.revenue.net)} | Per booking: ${formatCurrency(metrics.revenue.avgBookingValue)}`
          }
          trend={{
            value: metrics.revenue.growth,
            isPositive: metrics.revenue.growth > 0
          }}
          color="green"
          onClick={() => setActiveTab('financial')}
        />
        <MetricCard
          icon={Calendar}
          label="Reservations Made"
          value={metrics.bookings.current}
          subValue={comparisonMode !== 'none'
            ? `vs ${comparisonMode === 'previous-year' ? 'last year' : 'previous period'}: ${metrics.bookings.previous || 0} | ${actualUpcoming} upcoming`
            : `${actualUpcoming} coming up | ${Number(metrics.bookings.avgNights || 0).toFixed(1)} nights average`
          }
          trend={{
            value: ((metrics.bookings.current - (metrics.bookings.previous || 0)) / (metrics.bookings.previous || 1)) * 100,
            isPositive: metrics.bookings.current > (metrics.bookings.previous || 0)
          }}
          color="blue"
          onClick={() => setActiveTab('properties')}
        />
        <MetricCard
          icon={Home}
          label="How Full You Are"
          value={Number(metrics.occupancy.current || 0) * 100}
          format="percent"
          subValue={`${metrics.properties.total} properties | ${formatPercentage(Number(metrics.occupancy.avgPropertyOccupancy || 0) * 100, 0)} average`}
          trend={metrics.occupancy.trend === 'up' ? {
            value: 5,
            isPositive: true
          } : metrics.occupancy.trend === 'down' ? {
            value: 5,
            isPositive: false
          } : undefined}
          color="purple"
          onClick={() => setActiveTab('occupancy')}
        />
        <MetricCard
          icon={Users}
          label="Guest Count"
          value={metrics.guests.total}
          subValue={`${metrics.guests.newThisMonth} first-timers | ${formatPercentage(Number(metrics.guests.repeatRate || 0) * 100, 0)} returning`}
          trend={{
            value: metrics.guests.repeatRate * 100,
            isPositive: metrics.guests.repeatRate > 0.3
          }}
          color="orange"
          onClick={() => setActiveTab('guests')}
        />
      </div>

      {/* Secondary Metrics - Additional KPIs */}
      <div className="grid md:grid-cols-6 gap-3">
        <MetricCard
          icon={CreditCard}
          label="Properties"
          value={metrics.properties.total}
          format="number"
          subValue={filters.selectedTags.length > 0 ? 'Tagged properties' : 'Total active'}
          size="sm"
          color="gray"
        />
        <MetricCard
          icon={Activity}
          label="Typical Stay"
          value={`${Number(metrics.bookings.avgNights || 0).toFixed(1)} nights`}
          format="custom"
          subValue="Per reservation"
          size="sm"
          color="gray"
        />
        <MetricCard
          icon={TrendingUp}
          label="Booking Value"
          value={Number(metrics.revenue.avgBookingValue) || 0}
          format="currency"
          subValue="Average per stay"
          size="sm"
          color="gray"
        />
        <MetricCard
          icon={Users}
          label="First-Time Guests"
          value={metrics.guests.newThisMonth}
          format="number"
          subValue="New this period"
          size="sm"
          color="gray"
        />
        <MetricCard
          icon={BarChart3}
          label="Return Guests"
          value={Number(metrics.guests.repeatRate || 0) * 100}
          format="percent"
          subValue={metrics.guests.total > 0 ? 'Come back again' : 'No data yet'}
          size="sm"
          color="gray"
        />
        <MetricCard
          icon={AlertCircle}
          label="Cancellations"
          value={Number(metrics.bookings.cancellationRate || 0)}
          format="percent"
          subValue="Of bookings"
          size="sm"
          color="red"
        />
      </div>

      {/* 2x2 Grid of Mini Charts with h-48 height */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <ChartWrapper
          title="Money Made (Last 7 Days)"
          icon={TrendingUp}
          height={192}
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
          title="Your Best Performing Properties"
          icon={Home}
          height={192}
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
          title="Where Bookings Come From"
          icon={BarChart3}
          height={256}
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
              {charts.bookingsBySource.map((_: any, index: any) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
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
          title="How Full You've Been (6 Months)"
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

        {/* Recent Activity Feed */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
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