import { useState, useEffect, useMemo, useCallback } from 'react'
import { api } from '@/lib/api'
import { formatCurrency, formatPercentage, formatCompactCurrency } from '@baileys/utils'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, Calendar, DollarSign, Users, Download, Home, Bed, Bath } from 'lucide-react'
import { Spinner } from '@/components/Spinner'
import { VirtualTable } from '@/components/VirtualTable'
import { StatusBadge } from '@/components/StatusBadge'
import { useDrillDown } from '@/contexts/drillDown'
import { useDashboard } from '@/contexts/dashboard'
import { useToast } from '@/contexts/toast'
import { METRIC_COLORS, getChartColor, getOccupancyColor } from '@/lib/theme'

type PropertyDetail = {
  property: {
    id: string
    name: string
    address: string
    bedrooms: number
    bathrooms: number
    maxGuests: number
  }
  metrics: {
    totalRevenue: number
    totalBookings: number
    avgNightlyRate: number
    occupancyRate: number
    totalNights: number
    avgStayLength: number
  }
  monthlyData: Array<{
    month: string
    revenue: number
    bookings: number
    occupancy: number
    avgNightlyRate: number
  }>
  recentBookings: Array<{
    id: string
    guestId: string
    guestName: string
    guestEmail?: string
    arrival: string
    departure: string
    nights: number
    totalAmount: number
    status: string
    platform?: string
    bookedDate: string
  }>
  guestStats: {
    totalGuests: number
    repeatGuests: number
    avgGuestRating?: number
  }
  revenueByPlatform: Array<{
    platform: string
    revenue: number
    bookings: number
  }>
}

export const PropertyDetailView = ({ propertyId }: { propertyId: string }) => {
  const { dispatch } = useDrillDown()
  const { filters } = useDashboard()
  const { addToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PropertyDetail | null>(null)
  const [selectedBookings, setSelectedBookings] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<string>('arrival')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [viewMode, setViewMode] = useState<'charts' | 'table'>('charts')

  useEffect(() => {
    const loadPropertyDetail = async () => {
      try {
        setLoading(true)
        setError(null)

        const result = await api.request<PropertyDetail>(
          `/property/${propertyId}/detail?from=${filters.dateRange.from}&to=${filters.dateRange.to}`
        )

        if (result.success && result.data) {
          const processedData = {
            ...result.data,
            metrics: {
              totalRevenue: result.data.metrics?.totalRevenue || 0,
              totalBookings: result.data.metrics?.totalBookings || 0,
              avgNightlyRate: result.data.metrics?.avgNightlyRate || 0,
              occupancyRate: result.data.metrics?.occupancyRate || 0,
              totalNights: result.data.metrics?.totalNights || 0,
              avgStayLength: result.data.metrics?.avgStayLength || 0
            },
            monthlyData: result.data.monthlyData || [],
            recentBookings: result.data.recentBookings || [],
            guestStats: {
              totalGuests: result.data.guestStats?.totalGuests || 0,
              repeatGuests: result.data.guestStats?.repeatGuests || 0,
              avgGuestRating: result.data.guestStats?.avgGuestRating
            },
            revenueByPlatform: result.data.revenueByPlatform || []
          }
          setData(processedData)
        } else {
          const errorMsg = 'Failed to load property details'
          setError(errorMsg)
          addToast('error', errorMsg)
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred'
        setError(errorMsg)
        addToast('error', errorMsg)
      } finally {
        setLoading(false)
      }
    }

    if (propertyId) {
      loadPropertyDetail()
    }
  }, [propertyId, filters.dateRange, addToast])

  const sortedBookings = useMemo(() => {
    if (!data?.recentBookings) return []

    return [...data.recentBookings].sort((a, b) => {
      const aVal = a[sortBy as keyof typeof a]
      const bVal = b[sortBy as keyof typeof b]

      if (aVal === undefined && bVal === undefined) return 0
      if (aVal === undefined) return 1
      if (bVal === undefined) return -1

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
      }
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
    })
  }, [data?.recentBookings, sortBy, sortOrder])

  const handleSort = useCallback((column: string) => {
    if (column === sortBy) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }, [sortBy])

  const handleExportBookings = useCallback(() => {
    if (!data) return

    const exportData = selectedBookings.size > 0
      ? sortedBookings.filter(b => selectedBookings.has(b.id))
      : sortedBookings

    const headers = ['Guest', 'Email', 'Check In', 'Check Out', 'Nights', 'Amount', 'Platform', 'Status', 'Booked Date']
    const rows = exportData.map(b => [
      b.guestName,
      b.guestEmail || '',
      new Date(b.arrival).toLocaleDateString(),
      new Date(b.departure).toLocaleDateString(),
      b.nights,
      b.totalAmount,
      b.platform || 'Direct',
      b.status,
      new Date(b.bookedDate).toLocaleDateString()
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${data.property.name.replace(/\s+/g, '-')}-bookings-${filters.dateRange.from}-to-${filters.dateRange.to}.csv`
    a.click()
    URL.revokeObjectURL(url)

    addToast('success', `Exported ${exportData.length} bookings`)
  }, [selectedBookings, sortedBookings, data, filters.dateRange, addToast])

  const bookingColumns = useMemo(() => [
    {
      key: 'guestName',
      header: 'Guest',
      sortable: true,
      width: 200,
      render: (booking: PropertyDetail['recentBookings'][0]) => (
        <div>
          <div
            className="font-medium text-blue-600 hover:underline cursor-pointer"
            onClick={(e) => {
              e.stopPropagation()
              dispatch({
                type: 'DRILL_TO_GUEST',
                guestId: booking.guestId,
                guestName: booking.guestName
              })
            }}
          >
            {booking.guestName}
          </div>
          {booking.guestEmail && (
            <div className="text-xs text-gray-500">{booking.guestEmail}</div>
          )}
        </div>
      )
    },
    {
      key: 'arrival',
      header: 'Check In',
      sortable: true,
      width: 120,
      render: (booking: PropertyDetail['recentBookings'][0]) =>
        new Date(booking.arrival).toLocaleDateString()
    },
    {
      key: 'departure',
      header: 'Check Out',
      sortable: true,
      width: 120,
      render: (booking: PropertyDetail['recentBookings'][0]) =>
        new Date(booking.departure).toLocaleDateString()
    },
    {
      key: 'nights',
      header: 'Nights',
      sortable: true,
      width: 80,
      render: (booking: PropertyDetail['recentBookings'][0]) => (
        <span className="font-medium">{booking.nights}</span>
      )
    },
    {
      key: 'totalAmount',
      header: 'Amount',
      sortable: true,
      width: 120,
      render: (booking: PropertyDetail['recentBookings'][0]) => (
        <span className="font-medium text-green-600">
          {formatCurrency(booking.totalAmount)}
        </span>
      )
    },
    {
      key: 'platform',
      header: 'Platform',
      sortable: true,
      width: 100,
      render: (booking: PropertyDetail['recentBookings'][0]) => (
        <span className="text-sm">{booking.platform || 'Direct'}</span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      width: 100,
      render: (booking: PropertyDetail['recentBookings'][0]) => (
        <StatusBadge status={booking.status} />
      )
    },
    {
      key: 'bookedDate',
      header: 'Booked',
      sortable: true,
      width: 120,
      render: (booking: PropertyDetail['recentBookings'][0]) =>
        new Date(booking.bookedDate).toLocaleDateString()
    }
  ], [dispatch])

  const monthlyColumns = useMemo(() => [
    {
      key: 'month',
      header: 'Month',
      sortable: true,
      width: 150,
      render: (month: PropertyDetail['monthlyData'][0]) => {
        const [year, monthNum] = month.month.split('-')
        const monthName = new Date(`${year}-${monthNum}-01`).toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric'
        })
        return <div className="font-medium">{monthName}</div>
      }
    },
    {
      key: 'bookings',
      header: 'Bookings',
      sortable: true,
      width: 100,
      render: (month: PropertyDetail['monthlyData'][0]) => (
        <span className="font-medium">{month.bookings}</span>
      )
    },
    {
      key: 'revenue',
      header: 'Revenue',
      sortable: true,
      width: 120,
      render: (month: PropertyDetail['monthlyData'][0]) => (
        <span className="font-medium text-green-600">
          {formatCurrency(month.revenue)}
        </span>
      )
    },
    {
      key: 'avgNightlyRate',
      header: 'Avg Rate',
      sortable: true,
      width: 100,
      render: (month: PropertyDetail['monthlyData'][0]) =>
        formatCurrency(month.avgNightlyRate)
    },
    {
      key: 'occupancy',
      header: 'Occupancy',
      sortable: true,
      width: 100,
      render: (month: PropertyDetail['monthlyData'][0]) => (
        <span className={`font-medium ${
          month.occupancy > 80 ? 'text-green-600' :
          month.occupancy > 60 ? 'text-yellow-600' :
          'text-red-600'
        }`}>
          {formatPercentage(month.occupancy, 0)}
        </span>
      )
    }
  ], [])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-red-600 mb-4">Error: {error}</div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex justify-center py-12 text-gray-500">
        No property data available
      </div>
    )
  }

  const handleMonthClick = (monthData: any) => {
    const [year, month] = monthData.month.split('-')
    dispatch({
      type: 'DRILL_TO_PROPERTY_MONTH',
      propertyId,
      propertyName: data.property.name,
      month,
      year
    })
  }

  const handleBookingClick = (booking: PropertyDetail['recentBookings'][0]) => {
    dispatch({ type: 'DRILL_TO_BOOKING', bookingId: booking.id })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center">
          <Home className="w-6 h-6 mr-2" />
          {data.property.name}
        </h2>
        <p className="text-gray-600">{data.property.address}</p>
        <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
          <span className="flex items-center">
            <Bed className="w-4 h-4 mr-1" />
            {data.property.bedrooms} bed
          </span>
          <span className="flex items-center">
            <Bath className="w-4 h-4 mr-1" />
            {data.property.bathrooms} bath
          </span>
          <span className="flex items-center">
            <Users className="w-4 h-4 mr-1" />
            Sleeps {data.property.maxGuests}
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <DollarSign className="w-4 h-4 mr-1" />
            Total Revenue
          </div>
          <div className="text-3xl font-bold">{formatCompactCurrency(data.metrics.totalRevenue)}</div>
          <div className="text-sm text-gray-500 mt-1">
            {formatCurrency(data.metrics.avgNightlyRate)}/night avg
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <Calendar className="w-4 h-4 mr-1" />
            Total Bookings
          </div>
          <div className="text-3xl font-bold">{data.metrics.totalBookings}</div>
          <div className="text-sm text-gray-500 mt-1">
            {data.metrics.totalNights} nights
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <TrendingUp className="w-4 h-4 mr-1" />
            Avg Stay Length
          </div>
          <div className="text-3xl font-bold">{data.metrics.avgStayLength.toFixed(1)} nights</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <Users className="w-4 h-4 mr-1" />
            Occupancy Rate
          </div>
          <div className={`text-3xl font-bold ${getOccupancyColor(data.metrics.occupancyRate)}`}>
            {formatPercentage(data.metrics.occupancyRate * 100, 0)}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => setViewMode(viewMode === 'charts' ? 'table' : 'charts')}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          {viewMode === 'charts' ? 'Table View' : 'Chart View'}
        </button>
      </div>

      {viewMode === 'charts' ? (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-bold mb-4">Monthly Revenue Trend</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(value) => value.slice(5)}
                  />
                  <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke={METRIC_COLORS.revenue}
                    strokeWidth={2}
                    dot={{ cursor: 'pointer' }}
                    activeDot={{ onClick: handleMonthClick }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-bold mb-4">Monthly Occupancy</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(value) => value.slice(5)}
                  />
                  <YAxis tickFormatter={(value) => `${value}%`} />
                  <Tooltip formatter={(value) => `${value}%`} />
                  <Bar
                    dataKey="occupancy"
                    fill={METRIC_COLORS.occupancy}
                    cursor="pointer"
                    onClick={handleMonthClick}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-bold mb-4">Revenue by Platform</h3>
            {data.revenueByPlatform && data.revenueByPlatform.length > 0 ? (
              <div className="space-y-3">
                {data.revenueByPlatform.map((platform, index) => {
                  const percentage = data.metrics.totalRevenue > 0
                    ? (platform.revenue / data.metrics.totalRevenue) * 100
                    : 0
                  return (
                    <div key={platform.platform}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium">{platform.platform}</span>
                        <span className="text-sm text-gray-600">
                          {formatCurrency(platform.revenue)} ({platform.bookings} bookings)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: getChartColor(index)
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-gray-500">No platform data available</p>
            )}
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-bold mb-4">Guest Statistics</h3>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Total Guests</span>
                <span className="font-medium">{data.guestStats.totalGuests}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Repeat Guests</span>
                <span className="font-medium">{data.guestStats.repeatGuests}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Repeat Rate</span>
                <span className="font-medium">
                  {data.guestStats.totalGuests > 0
                    ? formatPercentage((data.guestStats.repeatGuests / data.guestStats.totalGuests) * 100, 0)
                    : '0%'
                  }
                </span>
              </div>
              {data.guestStats.avgGuestRating && (
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Average Rating</span>
                  <span className="font-medium flex items-center">
                    <span className="text-yellow-500 mr-1">★</span>
                    {data.guestStats.avgGuestRating.toFixed(1)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h3 className="text-lg font-bold">Monthly Performance</h3>
          </div>
          <VirtualTable
            data={data.monthlyData}
            columns={monthlyColumns}
            height={400}
            onRowClick={handleMonthClick}
            getRowId={(month) => month.month}
            sortBy="month"
            sortOrder="desc"
            onSort={handleSort}
            enablePagination={data.monthlyData.length > 12}
            pageSize={12}
            emptyMessage="No monthly data available"
          />
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold">Recent Bookings ({data.recentBookings.length})</h3>
            {data.recentBookings.length > 0 && (
              <button
                onClick={handleExportBookings}
                className="flex items-center px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
              >
                <Download className="w-4 h-4 mr-1" />
                Export
              </button>
            )}
          </div>
        </div>

        <VirtualTable
          data={sortedBookings}
          columns={bookingColumns}
          height={400}
          loading={loading}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          onRowClick={handleBookingClick}
          getRowId={(booking) => booking.id}
          enablePagination={sortedBookings.length > 20}
          pageSize={20}
          enableSearch={true}
          searchKeys={['guestName', 'guestEmail']}
          enableExport={true}
          onExport={handleExportBookings}
          selectable={true}
          selectedRows={selectedBookings}
          onSelectionChange={setSelectedBookings}
          emptyMessage="No bookings found"
          showRowNumbers={false}
          rowClassName={(booking) =>
            booking.status === 'cancelled' ? 'opacity-50' : ''
          }
        />
      </div>
    </div>
  )
}
