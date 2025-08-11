import { useMemo, useCallback, useState, useEffect } from 'react'
import { useMonthDetail } from '@/hooks/use-api'
import { formatCurrency, formatPercentage, formatCompactCurrency } from '@baileys/utils'
import { Calendar, TrendingUp, Home, Download } from 'lucide-react'
import { LoadingState } from '@/components/LoadingState'
import { VirtualTable } from '@/components/VirtualTable'
import { StatusBadge } from '@/components/StatusBadge'
import { useDrillDown } from '@/contexts/drillDown'
import { useToast } from '@/contexts/toast'
import { getChartColor, getOccupancyColor } from '@/lib/theme'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

type MonthDetail = {
  summary: {
    totalRevenue: number
    totalTax: number
    totalBookings: number
    avgNightlyRate: number
    occupancyRate: number
    totalNights: number
  }
  byProperty: Array<{
    propertyId: string
    propertyName: string
    revenue: number
    bookings: number
    tax: number
    occupancyRate: number
    avgNightlyRate: number
  }>
  bookings: Array<{
    id: string
    propertyId: string
    propertyName: string
    guestName: string
    guestEmail?: string
    arrival: string
    departure: string
    nights: number
    totalAmount: number
    taxAmount: number
    status: string
    platform?: string
    bookedDate: string
  }>
}

export const MonthDetailView = ({ month, year }: { month: string; year: string }) => {
  const { dispatch } = useDrillDown()
  const { addToast } = useToast()
  const { data, isLoading: loading, error } = useMonthDetail(month, year)
  const [selectedBookings, setSelectedBookings] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<string>('arrival')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [propertyFilter, setPropertyFilter] = useState<string>('all')

  // Show toast for errors
  useEffect(() => {
    if (error) {
      addToast('error', 'Failed to load month details')
    }
  }, [error, addToast])

  const filteredBookings = useMemo(() => {
    if (!data) return []
    if (propertyFilter === 'all') return data.bookings
    return data.bookings?.filter((b: any) => b.propertyId === propertyFilter) || []
  }, [data, propertyFilter])

  const sortedBookings = useMemo(() => {
    return [...filteredBookings].sort((a, b) => {
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
  }, [filteredBookings, sortBy, sortOrder])

  const handleSort = useCallback((column: string) => {
    if (column === sortBy) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }, [sortBy])

  const handleExport = useCallback(() => {
    const exportData = selectedBookings.size > 0
      ? sortedBookings.filter((b: any) => selectedBookings.has(b.id))
      : sortedBookings

    const headers = ['Property', 'Guest', 'Email', 'Check In', 'Check Out', 'Nights', 'Amount', 'Tax', 'Status', 'Platform']
    const rows = exportData.map((b: any) => [
      b.propertyName,
      b.guestName,
      b.guestEmail || '',
      new Date(b.arrival).toLocaleDateString(),
      new Date(b.departure).toLocaleDateString(),
      b.nights,
      b.totalAmount,
      b.taxAmount,
      b.status,
      b.platform || 'Direct'
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bookings-${year}-${month}.csv`
    a.click()
    URL.revokeObjectURL(url)

    addToast('success', `Exported ${exportData.length} bookings`)
  }, [selectedBookings, sortedBookings, year, month, addToast])

  const bookingColumns = useMemo(() => [
    {
      key: 'propertyName',
      header: 'Property',
      sortable: true,
      width: 200,
      render: (booking: MonthDetail['bookings'][0]) => (
        <div
          className="font-medium text-blue-600 hover:underline cursor-pointer"
          onClick={(e) => {
            e.stopPropagation()
            dispatch({
              type: 'DRILL_TO_PROPERTY',
              propertyId: booking.propertyId,
              propertyName: booking.propertyName
            })
          }}
        >
          {booking.propertyName}
        </div>
      )
    },
    {
      key: 'guestName',
      header: 'Guest',
      sortable: true,
      width: 200,
      render: (booking: MonthDetail['bookings'][0]) => (
        <div>
          <div className="font-medium">{booking.guestName}</div>
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
      render: (booking: MonthDetail['bookings'][0]) =>
        new Date(booking.arrival).toLocaleDateString()
    },
    {
      key: 'departure',
      header: 'Check Out',
      sortable: true,
      width: 120,
      render: (booking: MonthDetail['bookings'][0]) =>
        new Date(booking.departure).toLocaleDateString()
    },
    {
      key: 'nights',
      header: 'Nights',
      sortable: true,
      width: 80,
      render: (booking: MonthDetail['bookings'][0]) => (
        <span className="font-medium">{booking.nights}</span>
      )
    },
    {
      key: 'totalAmount',
      header: 'Amount',
      sortable: true,
      width: 120,
      render: (booking: MonthDetail['bookings'][0]) => (
        <span className="font-medium text-green-600">
          {formatCurrency(booking.totalAmount)}
        </span>
      )
    },
    {
      key: 'taxAmount',
      header: 'Tax',
      sortable: true,
      width: 100,
      render: (booking: MonthDetail['bookings'][0]) =>
        formatCurrency(booking.taxAmount)
    },
    {
      key: 'platform',
      header: 'Platform',
      sortable: true,
      width: 100,
      render: (booking: MonthDetail['bookings'][0]) => (
        <span className="text-sm">{booking.platform || 'Direct'}</span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      width: 100,
      render: (booking: MonthDetail['bookings'][0]) => (
        <StatusBadge status={booking.status} />
      )
    }
  ], [dispatch])

  const propertyColumns = useMemo(() => [
    {
      key: 'propertyName',
      header: 'Property',
      sortable: true,
      width: 250,
      render: (property: MonthDetail['byProperty'][0]) => (
        <div className="font-medium">{property.propertyName}</div>
      )
    },
    {
      key: 'bookings',
      header: 'Bookings',
      sortable: true,
      width: 100,
      render: (property: MonthDetail['byProperty'][0]) => (
        <span className="font-medium">{property.bookings}</span>
      )
    },
    {
      key: 'revenue',
      header: 'Revenue',
      sortable: true,
      width: 120,
      render: (property: MonthDetail['byProperty'][0]) => (
        <span className="font-medium text-green-600">
          {formatCurrency(property.revenue)}
        </span>
      )
    },
    {
      key: 'tax',
      header: 'Tax',
      sortable: true,
      width: 100,
      render: (property: MonthDetail['byProperty'][0]) =>
        formatCurrency(property.tax)
    },
    {
      key: 'avgNightlyRate',
      header: 'Avg Rate',
      sortable: true,
      width: 100,
      render: (property: MonthDetail['byProperty'][0]) =>
        formatCurrency(property.avgNightlyRate)
    },
    {
      key: 'occupancyRate',
      header: 'Occupancy',
      sortable: true,
      width: 100,
      render: (property: MonthDetail['byProperty'][0]) => (
        <span className={`font-medium ${getOccupancyColor(property.occupancyRate)}`}>
          {formatPercentage(property.occupancyRate * 100, 0)}
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

  if (!data) return null

  const monthName = new Date(`${year}-${month}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const pieData = data.byProperty?.map((p: any, index: number) => ({
    name: p.propertyName,
    value: p.revenue,
    color: getChartColor(index)
  }))

  const handlePropertyClick = (property: MonthDetail['byProperty'][0]) => {
    dispatch({
      type: 'DRILL_TO_PROPERTY_MONTH',
      propertyId: property.propertyId,
      propertyName: property.propertyName,
      month,
      year
    })
  }

  const handleBookingClick = (booking: MonthDetail['bookings'][0]) => {
    dispatch({ type: 'DRILL_TO_BOOKING', bookingId: booking.id })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{monthName} Overview</h2>

      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <TrendingUp className="w-4 h-4 mr-1" />
            Total Revenue
          </div>
          <div className="text-3xl font-bold">{formatCompactCurrency(data.summary.totalRevenue)}</div>
          <div className="text-sm text-gray-500 mt-1">
            {formatCurrency(data.summary.avgNightlyRate)}/night avg
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="text-sm text-gray-600 mb-2">Total Tax</div>
          <div className="text-3xl font-bold">{formatCurrency(data.summary.totalTax)}</div>
          <div className="text-sm text-gray-500 mt-1">
            {formatPercentage((data.summary.totalTax / data.summary.totalRevenue) * 100, 1)} of revenue
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <Calendar className="w-4 h-4 mr-1" />
            Total Bookings
          </div>
          <div className="text-3xl font-bold">{data.summary.totalBookings}</div>
          <div className="text-sm text-gray-500 mt-1">
            {data.summary.totalNights} nights
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <Home className="w-4 h-4 mr-1" />
            Occupancy Rate
          </div>
          <div className={`text-3xl font-bold ${getOccupancyColor(data.summary.occupancyRate)}`}>
            {formatPercentage(data.summary.occupancyRate * 100, 0)}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            across {data.byProperty.length} properties
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-bold mb-4">Revenue by Property</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name.length > 15 ? name.substring(0, 12) + '...' : name} ${formatPercentage((percent || 0) * 100, 0)}`
                  }
                >
                  {pieData?.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-bold mb-4">Property Performance</h3>
          {data.byProperty.length <= 10 ? (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {data.byProperty?.map((property: any) => (
                <div
                  key={property.propertyId}
                  className="flex justify-between items-center p-3 border rounded-sm hover:bg-gray-50 cursor-pointer"
                  onClick={() => handlePropertyClick(property)}
                >
                  <div>
                    <div className="font-medium">{property.propertyName}</div>
                    <div className="text-sm text-gray-600">{property.bookings} bookings</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{formatCurrency(property.revenue)}</div>
                    <div className="text-sm text-gray-600">{formatCurrency(property.tax)} tax</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <VirtualTable
              data={data.byProperty}
              columns={propertyColumns}
              height={320}
              rowHeight={48}
              onRowClick={handlePropertyClick}
              getRowId={(property) => property.propertyId}
              sortBy="revenue"
              sortOrder="desc"
              onSort={handleSort}
              emptyMessage="No properties found"
            />
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-4 border-b">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold">All Bookings ({sortedBookings.length})</h3>
            <div className="flex items-center space-x-4">
              {data.byProperty.length > 1 && (
                <select
                  value={propertyFilter}
                  onChange={(e) => setPropertyFilter(e.target.value)}
                  className="px-3 py-1 border rounded-sm text-sm"
                >
                  <option value="all">All Properties</option>
                  {data.byProperty?.map((p: any) => (
                    <option key={p.propertyId} value={p.propertyId}>
                      {p.propertyName}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={handleExport}
                className="flex items-center px-3 py-1 bg-green-600 text-white rounded-sm text-sm hover:bg-green-700"
              >
                <Download className="w-4 h-4 mr-1" />
                Export
              </button>
            </div>
          </div>
        </div>

        <VirtualTable
          data={sortedBookings}
          columns={bookingColumns}
          height={600}
          loading={loading}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          onRowClick={handleBookingClick}
          getRowId={(booking) => booking.id}
          enablePagination={sortedBookings.length > 50}
          pageSize={30}
          enableSearch={true}
          searchKeys={['guestName', 'propertyName', 'guestEmail']}
          enableExport={true}
          onExport={handleExport}
          selectable={true}
          selectedRows={selectedBookings}
          onSelectionChange={setSelectedBookings}
          emptyMessage="No bookings found"
          rowClassName={(booking) =>
            booking.status === 'cancelled' ? 'opacity-50' : ''
          }
        />
      </div>
    </div>
  )
}
