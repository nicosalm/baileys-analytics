import { useState } from 'react'
import { usePropertyDetail } from '@/hooks/use-api'
import { formatCurrency, formatPercentage, formatCompactCurrency } from '@baileys/utils'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, Calendar, DollarSign, Users, Home, Bed, Bath, MapPin, Info } from 'lucide-react'
import { LoadingState } from '@/components/LoadingState'
import { StatusBadge } from '@/components/StatusBadge'
import { Modal } from '@/components/Modal'
import { useModal } from '@/contexts/modal'
import { useDashboard } from '@/contexts/dashboard'
import { METRIC_COLORS, CHART_COLORS } from '@/lib/theme'

interface PropertyDetailModalProps {
  propertyId: string
  propertyName: string
}

export const PropertyDetailModal = ({ propertyId, propertyName }: PropertyDetailModalProps) => {
  const { closeModal, openModal } = useModal()
  const { filters } = useDashboard()
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings' | 'revenue'>('overview')
  
  // Debug logging
  console.log('PropertyDetailModal - Rendering with filters:', {
    from: filters.dateRange.from,
    to: filters.dateRange.to,
    propertyId,
    timestamp: new Date().toISOString()
  })
  
  const { data, isLoading, error } = usePropertyDetail(
    propertyId,
    filters.dateRange.from,
    filters.dateRange.to,
    filters.selectedTags.map(t => t.id)
  )
  
  // Debug data received
  if (data) {
    console.log('PropertyDetailModal - Data received:', {
      totalNights: data.metrics?.totalNights,
      totalDays: data.metrics?.totalDays,
      occupancyRate: data.metrics?.occupancyRate,
      totalBookings: data.metrics?.totalBookings
    })
  }

  if (isLoading) {
    return (
      <Modal
        isOpen={true}
        onClose={closeModal}
        title={propertyName}
        subtitle="Loading property details..."
        size="xl"
      >
        <div className="flex justify-center py-12">
          <LoadingState />
        </div>
      </Modal>
    )
  }

  if (error || !data) {
    return (
      <Modal
        isOpen={true}
        onClose={closeModal}
        title={propertyName}
        subtitle="Unable to load property details"
        size="xl"
      >
        <div className="text-center py-12">
          <p className="text-gray-600">Something went wrong. Please try again.</p>
        </div>
      </Modal>
    )
  }

  const monthlyChartData = data.monthlyData?.map((m: any) => ({
    month: new Date(m.month).toLocaleDateString('en-US', { month: 'short' }),
    revenue: m.revenue,
    bookings: m.bookings,
    occupancy: m.occupancy
  })) || []

  const platformData = data.revenueByPlatform?.map((p: any, index: number) => ({
    ...p,
    color: CHART_COLORS[index % CHART_COLORS.length]
  })) || []

  return (
    <Modal
      isOpen={true}
      onClose={closeModal}
      title={propertyName}
      subtitle="How this property is doing"
      size="xl"
    >
      <div className="space-y-6">
        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
            <div className="text-sm text-blue-800">
              <strong>Property Overview:</strong> All metrics shown are for your selected date range. 
              Click on any guest name to see their booking history.
            </div>
          </div>
        </div>

        {/* Property Info Card */}
        <div className="bg-gray-50 rounded-lg p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold mb-2">{data.property.name}</h3>
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
          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center text-sm text-gray-600 mb-1">
              <DollarSign className="w-4 h-4 mr-1" />
              Total Earned
            </div>
            <div className="text-2xl font-bold">{formatCurrency(data.metrics.totalRevenue)}</div>
            <div className="text-xs text-gray-500">This period</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center text-sm text-gray-600 mb-1">
              <Calendar className="w-4 h-4 mr-1" />
              Bookings
            </div>
            <div className="text-2xl font-bold">{data.metrics.totalBookings}</div>
            <div className="text-xs text-gray-500">{(data.metrics.avgStayLength || 0).toFixed(1)} nights avg</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center text-sm text-gray-600 mb-1">
              <Home className="w-4 h-4 mr-1" />
              How Full
            </div>
            <div className="text-2xl font-bold">{formatPercentage(data.metrics.occupancyRate * 100, 0)}</div>
            <div className="text-xs text-gray-500">{data.metrics.totalNights || 0} of {data.metrics.totalDays || 0} nights</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center text-sm text-gray-600 mb-1">
              <TrendingUp className="w-4 h-4 mr-1" />
              Nightly Rate
            </div>
            <div className="text-2xl font-bold">{formatCurrency(data.metrics.avgNightlyRate)}</div>
            <div className="text-xs text-gray-500">Average</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <nav className="flex space-x-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-2 border-b-2 transition-colors ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Performance Charts
            </button>
            <button
              onClick={() => setActiveTab('bookings')}
              className={`pb-2 border-b-2 transition-colors ${
                activeTab === 'bookings'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Recent Bookings
            </button>
            <button
              onClick={() => setActiveTab('revenue')}
              className={`pb-2 border-b-2 transition-colors ${
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
                    <Tooltip 
                      formatter={(value: any, name: string) => {
                        if (name === 'Revenue') return formatCurrency(value)
                        if (name === 'Occupancy') return `${value}%`
                        return value
                      }}
                      contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                    />
                    <Line yAxisId="left" type="monotone" dataKey="revenue" stroke={METRIC_COLORS.revenue} name="Revenue" strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="occupancy" stroke={METRIC_COLORS.occupancy} name="Occupancy" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'bookings' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg border overflow-hidden">
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
                        onClick={() => openModal({ 
                          type: 'guest', 
                          guestId: booking.guestId, 
                          guestName: booking.guestName 
                        })}
                      >
                        <td className="p-4">
                          <div>
                            <div className="font-medium">{booking.guestName}</div>
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
                        <td className="p-4 text-sm font-medium">
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
                        label={(entry: any) => `${entry.platform} (${entry.bookings})`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="revenue"
                      >
                        {platformData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: any) => formatCurrency(value)}
                        contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No platform data available</p>
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
                      0
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}