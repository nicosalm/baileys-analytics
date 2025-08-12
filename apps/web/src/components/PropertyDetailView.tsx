import { useMemo, useCallback, useState } from 'react'
import { usePropertyDetail } from '@/hooks/use-api'
import { formatCurrency, formatPercentage, formatCompactCurrency } from '@baileys/utils'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, Calendar, DollarSign, Users, Download, Home, Bed, Bath } from 'lucide-react'
import { LoadingState } from '@/components/LoadingState'
import { SimpleTable, PaginatedTable } from '@/components/tables'
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
  const { data, isLoading: loading, error } = usePropertyDetail(
    propertyId, 
    filters.dateRange.from, 
    filters.dateRange.to
  )
  // Removed unused selectedBookings state
  const [sortBy, setSortBy] = useState<string>('arrival')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [viewMode, setViewMode] = useState<'charts' | 'table'>('charts')

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

    const exportData = sortedBookings

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
  }, [sortedBookings, data, filters.dateRange, addToast])

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
        <LoadingState />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-red-600 mb-4">Error: {error.message}</div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700"
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

  // Process data with null safety
  const processedData = {
    ...data,
    metrics: {
      totalRevenue: data.metrics?.totalRevenue || 0,
      totalBookings: data.metrics?.totalBookings || 0,
      avgNightlyRate: data.metrics?.avgNightlyRate || 0,
      occupancyRate: data.metrics?.occupancyRate || 0,
      totalNights: data.metrics?.totalNights || 0,
      avgStayLength: data.metrics?.avgStayLength || 0
    },
    monthlyData: data.monthlyData || [],
    recentBookings: data.recentBookings || [],
    guestStats: {
      totalGuests: data.guestStats?.totalGuests || 0,
      repeatGuests: data.guestStats?.repeatGuests || 0,
      avgGuestRating: data.guestStats?.avgGuestRating
    },
    revenueByPlatform: data.revenueByPlatform || []
  }

  const handleMonthClick = (monthData: any) => {
    const [year, month] = monthData.month.split('-')
    dispatch({
      type: 'DRILL_TO_PROPERTY_MONTH',
      propertyId,
      propertyName: processedData.property.name,
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
          {processedData.property.name}
        </h2>
        <p className="text-gray-600">{processedData.property.address}</p>
        <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
          <span className="flex items-center">
            <Bed className="w-4 h-4 mr-1" />
            {processedData.property.bedrooms} bed
          </span>
          <span className="flex items-center">
            <Bath className="w-4 h-4 mr-1" />
            {processedData.property.bathrooms} bath
          </span>
          <span className="flex items-center">
            <Users className="w-4 h-4 mr-1" />
            Sleeps {processedData.property.maxGuests}
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <DollarSign className="w-4 h-4 mr-1" />
            Total Revenue
          </div>
          <div className="text-3xl font-bold">{formatCompactCurrency(processedData.metrics.totalRevenue)}</div>
          <div className="text-sm text-gray-500 mt-1">
            {formatCurrency(processedData.metrics.avgNightlyRate)}/night avg
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <Calendar className="w-4 h-4 mr-1" />
            Total Bookings
          </div>
          <div className="text-3xl font-bold">{processedData.metrics.totalBookings}</div>
          <div className="text-sm text-gray-500 mt-1">
            {processedData.metrics.totalNights} nights
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <TrendingUp className="w-4 h-4 mr-1" />
            Avg Stay Length
          </div>
          <div className="text-3xl font-bold">{processedData.metrics.avgStayLength.toFixed(1)} nights</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <Users className="w-4 h-4 mr-1" />
            Occupancy Rate
          </div>
          <div className={`text-3xl font-bold ${getOccupancyColor(processedData.metrics.occupancyRate)}`}>
            {formatPercentage(processedData.metrics.occupancyRate * 100, 0)}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => setViewMode(viewMode === 'charts' ? 'table' : 'charts')}
          className="px-4 py-2 bg-gray-200 rounded-sm hover:bg-gray-300"
        >
          {viewMode === 'charts' ? 'Table View' : 'Chart View'}
        </button>
      </div>

      {viewMode === 'charts' ? (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-bold mb-4">Monthly Revenue Trend</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={processedData.monthlyData}>
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

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-bold mb-4">Monthly Occupancy</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={processedData.monthlyData}>
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

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-bold mb-4">Revenue by Platform</h3>
            {processedData.revenueByPlatform && processedData.revenueByPlatform.length > 0 ? (
              <div className="space-y-3">
                {processedData.revenueByPlatform.map((platform: any, index: number) => {
                  const percentage = processedData.metrics.totalRevenue > 0
                    ? (platform.revenue / processedData.metrics.totalRevenue) * 100
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

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-bold mb-4">Guest Statistics</h3>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Total Guests</span>
                <span className="font-medium">{processedData.guestStats.totalGuests}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Repeat Guests</span>
                <span className="font-medium">{processedData.guestStats.repeatGuests}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Repeat Rate</span>
                <span className="font-medium">
                  {processedData.guestStats.totalGuests > 0
                    ? formatPercentage((processedData.guestStats.repeatGuests / processedData.guestStats.totalGuests) * 100, 0)
                    : '0%'
                  }
                </span>
              </div>
              {processedData.guestStats.avgGuestRating && (
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Average Rating</span>
                  <span className="font-medium flex items-center">
                    <span className="text-yellow-500 mr-1">★</span>
                    {processedData.guestStats.avgGuestRating.toFixed(1)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-4 border-b">
            <h3 className="text-lg font-bold">Monthly Performance</h3>
          </div>
          <SimpleTable
            data={processedData.monthlyData}
            columns={monthlyColumns}
            onRowClick={handleMonthClick}
            getRowId={(month) => month.month}
            sortBy="month"
            sortOrder="desc"
            onSort={handleSort}
            emptyMessage="No monthly data available"
          />
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-4 border-b">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold">Recent Bookings ({processedData.recentBookings.length})</h3>
            {processedData.recentBookings.length > 0 && (
              <button
                onClick={handleExportBookings}
                className="flex items-center px-3 py-1 bg-green-600 text-white rounded-sm text-sm hover:bg-green-700"
              >
                <Download className="w-4 h-4 mr-1" />
                Export
              </button>
            )}
          </div>
        </div>

        <PaginatedTable
          data={sortedBookings}
          columns={bookingColumns}
          loading={loading}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          onRowClick={handleBookingClick}
          getRowId={(booking) => booking.id}
          pageSize={20}
          enableSearch={true}
          searchKeys={['guestName', 'guestEmail']}
          enableExport={true}
          onExport={handleExportBookings}
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
