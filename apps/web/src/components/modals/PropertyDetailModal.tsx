import { useState, useMemo, useCallback } from 'react'
import { usePropertyDetail } from '@/hooks/use-api'
import { formatCurrency, formatPercentage, formatCompactCurrency } from '@baileys/utils'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, Calendar, DollarSign, Users, Home, Bed, Bath, MapPin, Info, BarChart3, ExternalLink } from 'lucide-react'
import { StateWrapper } from '@/components/StateWrapper'
import { StatusBadge } from '@/components/StatusBadge'
import { MetricCard } from '@/components/MetricCard'
import { Modal } from '@/components/Modal'
import { useModal } from '@/contexts/modal'
import { useDashboard } from '@/contexts/dashboard'
import { useTips } from '@/hooks/use-tips'
import { METRIC_COLORS, CHART_COLORS } from '@/lib/theme'

interface PropertyDetailModalProps {
  propertyId: string
  propertyName: string
  from?: string
  to?: string
}

const PropertyPerformanceTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const data = payload[0].payload

  return (
    <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
      <p className="font-semibold text-sm mb-2">{label}</p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: METRIC_COLORS.revenue }} />
            <span className="text-gray-600">Revenue:</span>
          </div>
          <span className="font-medium">{formatCurrency(data.revenue)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: METRIC_COLORS.occupancy }} />
            <span className="text-gray-600">Occupancy:</span>
          </div>
          <span className="font-medium">{formatPercentage(data.occupancy, 1)}</span>
        </div>
        <div className="pt-1 mt-1 border-t border-gray-200">
          <div className="flex justify-between gap-4">
            <span className="text-gray-600">Bookings:</span>
            <span className="font-medium">{data.bookings}</span>
          </div>
          {data.bookings > 0 && data.revenue > 0 && (
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Avg per booking:</span>
              <span className="font-medium">{formatCurrency(data.revenue / data.bookings)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const PlatformRevenueTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
        <p className="font-semibold text-sm mb-2">{data.platform}</p>
        <div className="space-y-1 text-xs">
          <p className="flex justify-between gap-4">
            <span className="text-gray-600">Revenue:</span>
            <span className="font-medium text-green-600">{formatCurrency(data.revenue)}</span>
          </p>
          <p className="flex justify-between gap-4">
            <span className="text-gray-600">Share:</span>
            <span className="font-medium">{data.percentage?.toFixed(1) || '0.0'}%</span>
          </p>
        </div>
      </div>
    )
  }
  return null
}

export const PropertyDetailModal = ({ propertyId, propertyName, from, to }: PropertyDetailModalProps) => {
  const { closeModal, openModal } = useModal()
  const { showTips } = useTips()
  const { filters } = useDashboard()
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings' | 'revenue'>('overview')

  const effectiveFrom = from || filters.dateRange.from
  const effectiveTo = to || filters.dateRange.to

  const { data, isLoading, error } = usePropertyDetail(
    propertyId,
    effectiveFrom,
    effectiveTo,
    filters.selectedTags.map(t => t.id)
  )

  const subtitle = isLoading ? "Loading property details..." :
                   error ? "Unable to load property details" :
                   `Performance metrics for ${propertyName}`

  const monthlyChartData = useMemo(() =>
    data?.monthlyData?.map((m: any) => ({
      month: new Date(m.month).toLocaleDateString('en-US', { month: 'short' }),
      revenue: m.revenue,
      bookings: m.bookings,
      occupancy: Math.round(m.occupancy * 10) / 10
    })) || []
  , [data?.monthlyData])

  const platformData = useMemo(() =>
    data?.revenueByPlatform?.map((p: any, index: number) => ({
      ...p,
      color: CHART_COLORS[index % CHART_COLORS.length]
    })) || []
  , [data?.revenueByPlatform])

  // memoized platform total for pie chart label
  const platformTotal = useMemo(() =>
    platformData.reduce((sum: number, p: any) => sum + p.revenue, 0)
  , [platformData])

  // memoized pie chart label function
  const pieChartLabel = useCallback((entry: any) => {
    const percent = platformTotal > 0 ? ((entry.revenue / platformTotal) * 100).toFixed(0) : '0'
    const name = entry.platform.length > 18 ? entry.platform.substring(0, 18) + '...' : entry.platform
    return `${name} (${percent}%)`
  }, [platformTotal])

  // memoized tab handlers
  const handleTabOverview = useCallback(() => setActiveTab('overview'), [])
  const handleTabBookings = useCallback(() => setActiveTab('bookings'), [])
  const handleTabRevenue = useCallback(() => setActiveTab('revenue'), [])

  // memoized guest click handler
  const handleGuestClick = useCallback((guestId: string, guestName: string) => {
    openModal({ type: 'guest', guestId, guestName })
  }, [openModal])

  return (
    <Modal
      isOpen={true}
      onClose={closeModal}
      title={propertyName}
      subtitle={subtitle}
      size="xl"
    >
      <StateWrapper
        loading={isLoading}
        error={error}
        empty={!data && !isLoading && !error}
        loadingMessage="Loading property details..."
        errorMessage="Failed to load property details"
        emptyMessage="No property data available"
        minHeight={400}
      >
        {data && (
        <div className="space-y-6">
        {/* Info Banner */}
        {showTips && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
              <div className="text-sm text-blue-800">
                <strong>Property Overview:</strong> All metrics shown are for your selected date range. 
                Click on any guest name to see their booking history.
              </div>
            </div>
          </div>
        )}

        {/* Property Info Card */}
        <div className="bg-gray-50 rounded-lg p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-bold">{data.property.name}</h3>
                {data.property.ownerrezId && (
                  <a
                    href={`https://app.ownerrez.com/properties/${data.property.ownerrezId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-blue-600 transition-colors"
                    title="Open in OwnerRez"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
              <div className="flex items-center text-sm text-gray-600 mb-2">
                <MapPin className="w-4 h-4 mr-1" />
                {data.property.address}
              </div>
              <div className="flex items-center space-x-4 text-sm">
                <span className="flex items-center">
                  <Bed className="w-4 h-4 mr-1" />
                  {data.property.bedrooms} Bedrooms
                </span>
                <span className="flex items-center">
                  <Bath className="w-4 h-4 mr-1" />
                  {data.property.bathrooms} Bathrooms
                </span>
                <span className="flex items-center">
                  <Users className="w-4 h-4 mr-1" />
                  Sleeps {data.property.maxGuests}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid md:grid-cols-4 gap-4">
          <MetricCard
            icon={DollarSign}
            label="Total Revenue"
            value={data.metrics.totalRevenue}
            format="currency"
            subValue="This period"
            size="sm"
            color="green"
            className="border border-gray-200"
          />
          <MetricCard
            icon={Calendar}
            label="Total Bookings"
            value={data.metrics.totalBookings}
            format="number"
            subValue={`${(data.metrics.avgStayLength || 0).toFixed(1)} nights avg`}
            size="sm"
            color="blue"
            className="border border-gray-200"
          />
          <MetricCard
            icon={Home}
            label="Occupancy Rate"
            value={data.metrics.occupancyRate * 100}
            format="percent"
            subValue={`${data.metrics.totalNights || 0} of ${data.metrics.totalDays || 0} nights`}
            size="sm"
            color="purple"
            className="border border-gray-200"
          />
          <MetricCard
            icon={TrendingUp}
            label="Average Nightly Rate"
            value={data.metrics.avgNightlyRate}
            format="currency"
            subValue="Average"
            size="sm"
            color="orange"
            className="border border-gray-200"
          />
        </div>

        {/* Cost Metrics */}
        {(data.metrics.platformFees > 0 || data.metrics.taxes > 0 || data.metrics.operatingExpenses > 0) && (
          <div className="bg-white rounded-lg border p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Cost Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {data.metrics.platformFees > 0 && (
                <div>
                  <div className="text-xs text-gray-500">Platform Fees</div>
                  <div className="text-lg font-semibold text-red-600">-{formatCurrency(data.metrics.platformFees)}</div>
                </div>
              )}
              {data.metrics.taxes > 0 && (
                <div>
                  <div className="text-xs text-gray-500">Taxes</div>
                  <div className="text-lg font-semibold text-red-600">-{formatCurrency(data.metrics.taxes)}</div>
                </div>
              )}
              {data.metrics.operatingExpenses > 0 && (
                <div>
                  <div className="text-xs text-gray-500">Operating Expenses</div>
                  <div className="text-lg font-semibold text-red-600">-{formatCurrency(data.metrics.operatingExpenses)}</div>
                </div>
              )}
              <div>
                <div className="text-xs text-gray-500">Net Revenue</div>
                <div className={`text-lg font-semibold ${data.metrics.netRevenue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(data.metrics.netRevenue)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b">
          <nav className="flex space-x-6">
            <button
              onClick={handleTabOverview}
              className={`pb-2 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Performance Charts
            </button>
            <button
              onClick={handleTabBookings}
              className={`pb-2 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'bookings'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Recent Bookings
            </button>
            <button
              onClick={handleTabRevenue}
              className={`pb-2 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'revenue'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Revenue Sources
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Monthly Performance Chart */}
            <div className="bg-white p-6 rounded-lg border">
              <h3 className="text-lg font-bold mb-4">Monthly Performance</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="left" tickFormatter={(value) => formatCompactCurrency(value)} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `${value}%`} />
                    <Tooltip content={<PropertyPerformanceTooltip />} />
                    <Line yAxisId="left" type="monotone" dataKey="revenue" stroke={METRIC_COLORS.revenue} name="Revenue" strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="occupancy" stroke={METRIC_COLORS.occupancy} name="Occupancy" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'bookings' && (
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Recent Bookings</h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left p-4 text-sm font-medium text-gray-700">Guest</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-700">Check In</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-700">Check Out</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-700">Amount</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentBookings?.map((booking: any) => (
                    <tr
                      key={booking.id}
                      className="border-t hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleGuestClick(booking.guestId, booking.guestName)}
                    >
                      <td className="p-4">
                        <div>
                          <div className="font-medium text-blue-600 hover:underline">{booking.guestName}</div>
                          {booking.guestEmail && (
                            <div className="text-sm text-gray-500">{booking.guestEmail}</div>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-sm">
                        {new Date(booking.arrival).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-sm">
                        {new Date(booking.departure).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-sm font-medium text-green-600">
                        {formatCurrency(booking.totalAmount)}
                      </td>
                      <td className="p-4">
                        <StatusBadge status={booking.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'revenue' && (
          <div className="space-y-6">
            {/* Revenue by Platform */}
            <div className="bg-white p-6 rounded-lg border">
              <h3 className="text-lg font-bold mb-4">Where Bookings Come From</h3>
              {platformData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={platformData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={pieChartLabel}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="revenue"
                      >
                        {platformData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<PlatformRevenueTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-8">
                  <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">No platform data available</p>
                </div>
              )}
            </div>

            {/* Guest Stats */}
            <div className="bg-white p-6 rounded-lg border">
              <h3 className="text-lg font-bold mb-4">Guest Insights</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Total Guests</div>
                  <div className="text-2xl font-bold">{data.guestStats?.totalGuests || 0}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Returning Guests</div>
                  <div className="text-2xl font-bold">{data.guestStats?.repeatGuests || 0}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Return Rate</div>
                  <div className="text-2xl font-bold">
                    {formatPercentage(
                      data.guestStats?.totalGuests 
                        ? (data.guestStats.repeatGuests / data.guestStats.totalGuests) * 100 
                        : 0, 
                      1
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
        )}
      </StateWrapper>
    </Modal>
  )
}