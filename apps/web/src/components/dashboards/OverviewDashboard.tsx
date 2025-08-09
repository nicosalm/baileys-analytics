import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { formatCurrency, formatCompactCurrency, formatPercentage } from '@baileys/utils'
import {
  AlertCircle, CheckCircle, TrendingUp,
  DollarSign, Users, Home, Calendar, Clock, ArrowUpRight, ArrowDownRight,
  BarChart3, Activity, CreditCard, AlertTriangle
} from 'lucide-react'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/contexts/toast'
import { useDashboard } from '@/contexts/dashboard'
import { METRIC_COLORS, CHART_COLORS } from '@/lib/theme'

type OverviewData = {
  metrics: {
    revenue: {
      current: number
      previous: number
      growth: number
      net: number
      avgBookingValue: number
    }
    bookings: {
      current: number
      upcoming: number
      cancellationRate: number
      avgNights: number
    }
    occupancy: {
      current: number
      trend: 'up' | 'down' | 'stable'
      avgPropertyOccupancy: number
    }
    guests: {
      total: number
      newThisMonth: number
      repeatRate: number
      vipCount: number
    }
    properties: {
      total: number
      avgOccupancy: number
    }
  }
  alerts: Array<{
    id: string
    type: 'warning' | 'info' | 'success'
    title: string
    description: string
    timestamp: string
  }>
  recentActivity: Array<{
    id: string
    type: 'booking' | 'payment' | 'guest'
    description: string
    timestamp: string
    value?: number
  }>
  charts: {
    revenueLastWeek: Array<{ day: string; revenue: number }>
    topProperties: Array<{ name: string; revenue: number; bookings: number }>
    bookingsBySource: Array<{ source: string; count: number }>
    occupancyTrend: Array<{ month: string; rate: number }>
  }
}

const MetricCard = ({
  icon: Icon,
  label,
  value,
  subValue,
  trend,
  color = 'blue',
  onClick
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  subValue?: string
  trend?: { value: number; isPositive: boolean }
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'yellow'
  onClick?: () => void
}) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
    yellow: 'bg-yellow-50 text-yellow-600'
  }

  return (
    <div 
      className={`bg-white p-6 rounded-lg shadow ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <div className={`flex items-center text-sm font-medium ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {trend.isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            {Math.abs(trend.value).toFixed(1)}%
          </div>
        )}
      </div>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm text-gray-600 mt-1">{label}</div>
      {subValue && <div className="text-xs text-gray-500 mt-1">{subValue}</div>}
    </div>
  )
}

const AlertCard = ({ alert }: { alert: OverviewData['alerts'][0] }) => {
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
    <div className={`p-4 rounded-lg border ${bgColors[alert.type]}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0 mt-0.5">{icons[alert.type]}</div>
        <div className="ml-3 flex-1">
          <h4 className="text-sm font-medium">{alert.title}</h4>
          <p className="text-sm text-gray-600 mt-1">{alert.description}</p>
          <p className="text-xs text-gray-500 mt-2">
            {new Date(alert.timestamp).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  )
}

const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: any) => {
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      className="text-xs font-medium"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

export const OverviewDashboard = () => {
  const { addToast } = useToast()
  const { filters, setActiveTab } = useDashboard()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<OverviewData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const loadOverview = async () => {
      if (!mounted) return

      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams()
        if (filters.dateRange.from) params.append('from', filters.dateRange.from)
        if (filters.dateRange.to) params.append('to', filters.dateRange.to)
        if (filters.selectedTags.length > 0) {
          params.append('tags', filters.selectedTags.map(t => t.id).join(','))
        }

        const url = `/overview?${params}`
        const result = await api.request<OverviewData>(url)

        if (!mounted) return

        if (result.success) {
          setData(result.data)
        } else {
          setError(result.error || 'Failed to load overview data')
          addToast('error', `Overview error: ${result.error}`)
        }
      } catch (err) {
        if (!mounted) return

        const errorMsg = err instanceof Error ? err.message : 'An error occurred'
        setError(errorMsg)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadOverview()

    return () => {
      mounted = false
    }
  }, [filters.dateRange, filters.selectedTags])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-600 mb-2">Failed to load overview</p>
        <p className="text-sm text-gray-500">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No data available for the selected period</p>
      </div>
    )
  }

  const { metrics, alerts, recentActivity, charts } = data

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Dashboard Overview</h2>
          <p className="text-gray-600 text-sm mt-1">
            Complete snapshot of your vacation rental business
          </p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <Clock className="w-4 h-4" />
          <span>Last updated: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Primary Metrics - 4 columns */}
      <div className="grid md:grid-cols-4 gap-4">
        <MetricCard
          icon={DollarSign}
          label="Gross Revenue"
          value={formatCompactCurrency(metrics.revenue.current)}
          subValue={`Net: ${formatCompactCurrency(metrics.revenue.net)} | Avg: ${formatCurrency(metrics.revenue.avgBookingValue)}`}
          trend={{
            value: metrics.revenue.growth,
            isPositive: metrics.revenue.growth > 0
          }}
          color="green"
          onClick={() => setActiveTab('financial')}
        />
        <MetricCard
          icon={Calendar}
          label="Total Bookings"
          value={metrics.bookings.current}
          subValue={`${metrics.bookings.upcoming} upcoming | ${Number(metrics.bookings.avgNights || 0).toFixed(1)} avg nights`}
          trend={{
            value: metrics.bookings.cancellationRate * -1,
            isPositive: metrics.bookings.cancellationRate < 5
          }}
          color="blue"
          onClick={() => setActiveTab('properties')}
        />
        <MetricCard
          icon={Home}
          label="Occupancy Rate"
          value={formatPercentage(Number(metrics.occupancy.current || 0) * 100, 0)}
          subValue={`${metrics.properties.total} properties | ${formatPercentage(Number(metrics.occupancy.avgPropertyOccupancy || 0) * 100, 0)} avg`}
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
          label="Total Guests"
          value={metrics.guests.total}
          subValue={`${metrics.guests.newThisMonth} new | ${metrics.guests.vipCount} VIP | ${formatPercentage(Number(metrics.guests.repeatRate || 0) * 100, 0)} repeat`}
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
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <CreditCard className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-500">Properties</span>
          </div>
          <div className="mt-2 text-xl font-bold">{metrics.properties.total}</div>
          <div className="text-xs text-gray-600">Active listings</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <Activity className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-500">Avg Stay</span>
          </div>
          <div className="mt-2 text-xl font-bold">{Number(metrics.bookings.avgNights || 0).toFixed(1)}</div>
          <div className="text-xs text-gray-600">Nights</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <TrendingUp className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-500">Avg Value</span>
          </div>
          <div className="mt-2 text-xl font-bold">{formatCompactCurrency(metrics.revenue.avgBookingValue)}</div>
          <div className="text-xs text-gray-600">Per booking</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <Users className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-500">VIP Guests</span>
          </div>
          <div className="mt-2 text-xl font-bold">{metrics.guests.vipCount}</div>
          <div className="text-xs text-gray-600">High value</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <BarChart3 className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-500">Repeat Rate</span>
          </div>
          <div className="mt-2 text-xl font-bold">{formatPercentage(Number(metrics.guests.repeatRate || 0) * 100, 0)}</div>
          <div className="text-xs text-gray-600">Guest loyalty</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <AlertCircle className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-500">Cancel Rate</span>
          </div>
          <div className="mt-2 text-xl font-bold">{formatPercentage(Number(metrics.bookings.cancellationRate || 0), 0)}</div>
          <div className="text-xs text-gray-600">Last 30 days</div>
        </div>
      </div>

      {/* 2x2 Grid of Mini Charts with h-48 height */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
            7-Day Revenue Trend
          </h3>
          <div className="h-48">
            {charts.revenueLastWeek.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.revenueLastWeek}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={METRIC_COLORS.revenue} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={METRIC_COLORS.revenue} stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke={METRIC_COLORS.revenue}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No data available
              </div>
            )}
          </div>
        </div>

        {/* Top Properties Performance */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4 flex items-center">
            <Home className="w-5 h-5 mr-2 text-purple-600" />
            Top Properties by Revenue
          </h3>
          <div className="h-48">
            {charts.topProperties.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.topProperties.slice(0, 5).map(item => ({
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
                  <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="revenue" fill={METRIC_COLORS.revenue} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No data available
              </div>
            )}
          </div>
        </div>

        {/* Booking Sources Distribution */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
            Booking Sources
          </h3>
          <div className="h-48">
            {charts.bookingsBySource.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.bookingsBySource.map(item => ({
                      ...item,
                      count: Number(item.count)
                    }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={60}
                    fill="#8884d8"
                    dataKey="count"
                    label={renderCustomizedLabel}
                  >
                    {charts.bookingsBySource.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => [value, 'Bookings']} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No data available
              </div>
            )}
          </div>
          {charts.bookingsBySource.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2 justify-center">
              {charts.bookingsBySource.map((item, index) => (
                <div key={item.source} className="flex items-center text-xs">
                  <div
                    className="w-3 h-3 rounded mr-1"
                    style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                  />
                  <span>{item.source}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Occupancy Trend */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4 flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-orange-600" />
            6-Month Occupancy Trend
          </h3>
          <div className="h-48">
            {charts.occupancyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.occupancyTrend.map(item => ({
                  ...item,
                  rate: Number(item.rate)
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => `${value}%`} domain={[0, 100]} />
                  <Tooltip formatter={(value) => `${value}%`} />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke={METRIC_COLORS.occupancy}
                    strokeWidth={2}
                    dot={{ fill: METRIC_COLORS.occupancy, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alerts and Activity Panels */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Alerts & Notifications Panel */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Alerts & Notifications</h3>
            <span className="text-xs text-gray-500">{alerts?.length || 0} active</span>
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {alerts && alerts.length > 0 ? (
              alerts.map(alert => (
                <AlertCard key={alert.id} alert={alert} />
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p>All systems operational</p>
                <p className="text-xs mt-1">No alerts at this time</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Recent Activity</h3>
            <span className="text-xs text-gray-500">Last 7 days</span>
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {recentActivity && recentActivity.length > 0 ? (
              recentActivity.map(activity => (
                <div key={activity.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.description}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(activity.timestamp).toLocaleString()}
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

      {/* Quick Actions */}
      <div className="bg-blue-50 p-6 rounded-lg">
        <h3 className="text-lg font-bold mb-4">Quick Actions</h3>
        <div className="grid md:grid-cols-4 gap-4">
          <button 
            onClick={() => setActiveTab('financial')}
            className="p-4 bg-white rounded-lg hover:shadow-md transition-shadow text-left"
          >
            <DollarSign className="w-5 h-5 text-green-600 mb-2" />
            <div className="font-medium">View Financials</div>
            <div className="text-xs text-gray-600">Revenue & tax details</div>
          </button>
          <button 
            onClick={() => setActiveTab('properties')}
            className="p-4 bg-white rounded-lg hover:shadow-md transition-shadow text-left"
          >
            <Home className="w-5 h-5 text-purple-600 mb-2" />
            <div className="font-medium">Property Analytics</div>
            <div className="text-xs text-gray-600">Performance metrics</div>
          </button>
          <button 
            onClick={() => setActiveTab('occupancy')}
            className="p-4 bg-white rounded-lg hover:shadow-md transition-shadow text-left"
          >
            <Calendar className="w-5 h-5 text-blue-600 mb-2" />
            <div className="font-medium">Occupancy Report</div>
            <div className="text-xs text-gray-600">Availability calendar</div>
          </button>
          <button 
            onClick={() => setActiveTab('guests')}
            className="p-4 bg-white rounded-lg hover:shadow-md transition-shadow text-left"
          >
            <Users className="w-5 h-5 text-orange-600 mb-2" />
            <div className="font-medium">Guest Insights</div>
            <div className="text-xs text-gray-600">Customer analytics</div>
          </button>
        </div>
      </div>
    </div>
  )
}