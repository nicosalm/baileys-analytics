import { useState, useEffect, useMemo, useCallback } from 'react'
import { api } from '@/lib/api'
import { formatCurrency } from '@baileys/utils'
import {
  User, Calendar, DollarSign, Tag as TagIcon, Mail,
  TrendingUp, Clock, AlertCircle
} from 'lucide-react'
import { Spinner } from '@/components/Spinner'
import { VirtualTable } from '@/components/VirtualTable'
import { StatusBadge } from '@/components/StatusBadge'
import { Tag } from '@/components/Tag'
import { useDrillDown } from '@/contexts/drillDown'
import { useToast } from '@/contexts/toast'
import { METRIC_COLORS } from '@/lib/theme'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

type GuestDetail = {
  guest: {
    id: string
    name: string
    email?: string
    phone?: string
    firstVisit: string
    lastVisit: string
    totalSpent: number
    bookingCount: number
    canceledCount: number
    avgNightlyRate: number
    avgStayLength: number
    totalNights: number
    favoriteProperty?: {
      id: string
      name: string
      bookingCount: number
    }
  }
  bookings: Array<{
    id: string
    propertyId: string
    propertyName: string
    arrival: string
    departure: string
    nights: number
    totalAmount: number
    status: string
    platform?: string
  }>
  properties: Array<{
    propertyId: string
    propertyName: string
    bookingCount: number
    totalSpent: number
    avgNightlyRate: number
    lastStay: string
  }>
  spendingTrend: Array<{
    month: string
    amount: number
    bookings: number
  }>
  tags: Array<{
    id: string
    name: string
    color?: string
  }>
  paymentMethods: Array<{
    method: string
    count: number
    total: number
  }>
}

const InfoRow = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex justify-between py-2 border-b">
    <span className="text-gray-600">{label}</span>
    <span className="font-medium">{value}</span>
  </div>
)

export const GuestDetailView = ({ guestId }: { guestId: string }) => {
  const { dispatch } = useDrillDown()
  const { addToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<GuestDetail | null>(null)
  const [activeTab, setActiveTab] = useState<'bookings' | 'properties' | 'analytics'>('bookings')
  const [selectedBookings, setSelectedBookings] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<string>('arrival')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    let cancelled = false;

    const loadGuestDetail = async () => {
      if (!guestId) return;

      setLoading(true)
      setError(null)

      try {
        const result = await api.request<GuestDetail>(`/guest/${encodeURIComponent(guestId)}/detail`)

        if (cancelled) return;

        if (result.success) {
          setData(result.data)
        } else {
          const errorMsg = result.error || 'Failed to load guest details'
          setError(errorMsg)
          if (result.status !== 404) {
            addToast('error', `Failed to load guest: ${errorMsg}`)
          }
        }
      } catch (err) {
        if (cancelled) return;

        const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred'
        setError(errorMsg)
        addToast('error', `Error loading guest: ${errorMsg}`)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadGuestDetail()

    return () => {
      cancelled = true;
    }
  }, [guestId])

  const sortedBookings = useMemo(() => {
    if (!data) return []

    return [...data.bookings].sort((a, b) => {
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
  }, [data, sortBy, sortOrder])

  const handleSort = useCallback((column: string) => {
    if (column === sortBy) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }, [sortBy])

  const handleBookingClick = useCallback((booking: GuestDetail['bookings'][0]) => {
    dispatch({ type: 'DRILL_TO_BOOKING', bookingId: booking.id })
  }, [dispatch])

  const handlePropertyClick = useCallback((propertyId: string, propertyName: string) => {
    dispatch({
      type: 'DRILL_TO_PROPERTY',
      propertyId,
      propertyName
    })
  }, [dispatch])

  const handleExportBookings = useCallback(() => {
    if (!data) return

    const exportData = selectedBookings.size > 0
      ? sortedBookings.filter(b => selectedBookings.has(b.id))
      : sortedBookings

    const headers = ['Property', 'Check In', 'Check Out', 'Nights', 'Amount', 'Platform', 'Status']
    const rows = exportData.map(b => [
      b.propertyName,
      new Date(b.arrival).toLocaleDateString(),
      new Date(b.departure).toLocaleDateString(),
      b.nights,
      b.totalAmount,
      b.platform || 'Direct',
      b.status
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${data.guest.name.replace(/\s+/g, '-')}-bookings.csv`
    a.click()
    URL.revokeObjectURL(url)

    addToast('success', `Exported ${exportData.length} bookings`)
  }, [selectedBookings, sortedBookings, data, addToast])

  const bookingColumns = useMemo(() => [
    {
      key: 'propertyName',
      header: 'Property',
      sortable: true,
      width: 200,
      render: (booking: GuestDetail['bookings'][0]) => (
        <div
          className="font-medium text-blue-600 hover:underline cursor-pointer"
          onClick={(e) => {
            e.stopPropagation()
            handlePropertyClick(booking.propertyId, booking.propertyName)
          }}
        >
          {booking.propertyName}
        </div>
      )
    },
    {
      key: 'arrival',
      header: 'Check In',
      sortable: true,
      width: 120,
      render: (booking: GuestDetail['bookings'][0]) =>
        new Date(booking.arrival).toLocaleDateString()
    },
    {
      key: 'departure',
      header: 'Check Out',
      sortable: true,
      width: 120,
      render: (booking: GuestDetail['bookings'][0]) =>
        new Date(booking.departure).toLocaleDateString()
    },
    {
      key: 'nights',
      header: 'Nights',
      sortable: true,
      width: 80,
      render: (booking: GuestDetail['bookings'][0]) => (
        <span className="font-medium">{booking.nights}</span>
      )
    },
    {
      key: 'totalAmount',
      header: 'Amount',
      sortable: true,
      width: 120,
      render: (booking: GuestDetail['bookings'][0]) => (
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
      render: (booking: GuestDetail['bookings'][0]) => (
        <span className="text-sm">{booking.platform || 'Direct'}</span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      width: 100,
      render: (booking: GuestDetail['bookings'][0]) => (
        <StatusBadge status={booking.status} />
      )
    }
  ], [handlePropertyClick])

  const propertyColumns = useMemo(() => [
    {
      key: 'propertyName',
      header: 'Property',
      sortable: true,
      width: 250,
      render: (property: GuestDetail['properties'][0]) => (
        <div className="font-medium">{property.propertyName}</div>
      )
    },
    {
      key: 'bookingCount',
      header: 'Stays',
      sortable: true,
      width: 80,
      render: (property: GuestDetail['properties'][0]) => (
        <span className="font-medium">{property.bookingCount}</span>
      )
    },
    {
      key: 'totalSpent',
      header: 'Total Spent',
      sortable: true,
      width: 120,
      render: (property: GuestDetail['properties'][0]) => (
        <span className="font-medium text-green-600">
          {formatCurrency(property.totalSpent)}
        </span>
      )
    },
    {
      key: 'avgNightlyRate',
      header: 'Avg/Night',
      sortable: true,
      width: 100,
      render: (property: GuestDetail['properties'][0]) =>
        formatCurrency(property.avgNightlyRate)
    },
    {
      key: 'lastStay',
      header: 'Last Stay',
      sortable: true,
      width: 120,
      render: (property: GuestDetail['properties'][0]) =>
        new Date(property.lastStay).toLocaleDateString()
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
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Guest Details</h3>
        <p className="text-gray-600 text-center max-w-md">{error}</p>
        <p className="text-sm text-gray-500 mt-2">Guest ID: {guestId}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="w-12 h-12 text-gray-400 mb-4" />
        <p className="text-gray-600">No guest data available</p>
      </div>
    )
  }

  const { guest, properties, spendingTrend, tags, paymentMethods } = data

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center">
          <User className="w-6 h-6 mr-2" />
          {guest.name}
        </h2>
        {guest.email && (
          <div className="flex items-center text-gray-600 mt-1">
            <Mail className="w-4 h-4 mr-1" />
            {guest.email}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <DollarSign className="w-4 h-4 mr-1" />
            Total Spent
          </div>
          <div className="text-3xl font-bold">{formatCurrency(guest.totalSpent)}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <Calendar className="w-4 h-4 mr-1" />
            Total Bookings
          </div>
          <div className="text-3xl font-bold">{guest.bookingCount}</div>
          {guest.canceledCount > 0 && (
            <div className="text-sm text-red-600">{guest.canceledCount} canceled</div>
          )}
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <TrendingUp className="w-4 h-4 mr-1" />
            Avg Nightly Rate
          </div>
          <div className="text-3xl font-bold">{formatCurrency(guest.avgNightlyRate)}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <Clock className="w-4 h-4 mr-1" />
            Avg Stay Length
          </div>
          <div className="text-3xl font-bold">{guest.avgStayLength.toFixed(1)} nights</div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4">Guest Information</h3>
          <div className="space-y-1">
            <InfoRow label="First Visit" value={new Date(guest.firstVisit).toLocaleDateString()} />
            <InfoRow label="Last Visit" value={new Date(guest.lastVisit).toLocaleDateString()} />
            <InfoRow label="Total Nights" value={guest.totalNights} />
            {guest.favoriteProperty && (
              <div className="pt-3 mt-3 border-t">
                <div className="text-sm text-gray-600 mb-1">Favorite Property</div>
                <button
                  onClick={() => handlePropertyClick(
                    guest.favoriteProperty!.id,
                    guest.favoriteProperty!.name
                  )}
                  className="text-blue-600 hover:underline"
                >
                  {guest.favoriteProperty.name}
                </button>
                <div className="text-sm text-gray-500">
                  {guest.favoriteProperty.bookingCount} stays
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4">Payment Methods</h3>
          <div className="space-y-2">
            {paymentMethods && paymentMethods.length > 0 ? (
              paymentMethods.map(method => (
                <div key={method.method} className="flex justify-between">
                  <span className="text-gray-600">
                    {method.method} ({method.count}x)
                  </span>
                  <span className="font-medium">{formatCurrency(method.total)}</span>
                </div>
              ))
            ) : (
              <p className="text-gray-500">No payment data available</p>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4 flex items-center">
            <TagIcon className="w-5 h-5 mr-2" />
            Tags
          </h3>
          {tags && tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <Tag key={tag.id} tag={tag} size="sm" />
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No tags assigned</p>
          )}
        </div>
      </div>

      {spendingTrend && spendingTrend.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4">Spending Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={spendingTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke={METRIC_COLORS.revenue}
                  strokeWidth={2}
                  dot={{ fill: METRIC_COLORS.revenue }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="border-b">
          <div className="flex space-x-8 px-6">
            {(['bookings', 'properties', 'analytics'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'bookings' && (
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
              searchKeys={['propertyName']}
              enableExport={true}
              onExport={handleExportBookings}
              selectable={true}
              selectedRows={selectedBookings}
              onSelectionChange={setSelectedBookings}
              emptyMessage="No bookings found"
              rowClassName={(booking) =>
                booking.status === 'cancelled' ? 'opacity-50' : ''
              }
            />
          )}

          {activeTab === 'properties' && (
            properties && properties.length > 10 ? (
              <VirtualTable
                data={properties}
                columns={propertyColumns}
                height={400}
                onRowClick={(property) => handlePropertyClick(property.propertyId, property.propertyName)}
                getRowId={(property) => property.propertyId}
                sortBy="totalSpent"
                sortOrder="desc"
                onSort={handleSort}
                enablePagination={properties.length > 20}
                pageSize={20}
                emptyMessage="No properties found"
              />
            ) : (
              <div className="space-y-3">
                {properties && properties.length > 0 ? (
                  properties.map((property) => (
                    <div
                      key={property.propertyId}
                      className="p-4 border rounded hover:bg-gray-50 cursor-pointer"
                      onClick={() => handlePropertyClick(property.propertyId, property.propertyName)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{property.propertyName}</h4>
                          <p className="text-sm text-gray-600">
                            {property.bookingCount} stays • Last: {new Date(property.lastStay).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{formatCurrency(property.totalSpent)}</div>
                          <div className="text-sm text-gray-500">{formatCurrency(property.avgNightlyRate)}/night</div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500">No properties found</p>
                )}
              </div>
            )
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div>
                <h4 className="font-medium mb-3">Guest Behavior Analysis</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded">
                    <div className="text-sm text-gray-600">Guest Type</div>
                    <div className="font-medium">
                      {guest.bookingCount === 1 ? 'First-time Guest' :
                       guest.bookingCount < 3 ? 'Returning Guest' :
                       'Loyal Guest'}
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded">
                    <div className="text-sm text-gray-600">Value Tier</div>
                    <div className="font-medium">
                      {guest.totalSpent < 1000 ? 'Standard' :
                       guest.totalSpent < 5000 ? 'Premium' :
                       'VIP'}
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded">
                    <div className="text-sm text-gray-600">Booking Pattern</div>
                    <div className="font-medium">
                      {guest.avgStayLength < 2 ? 'Short Stays' :
                       guest.avgStayLength < 5 ? 'Medium Stays' :
                       'Extended Stays'}
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded">
                    <div className="text-sm text-gray-600">Seasonality</div>
                    <div className="font-medium">
                      {/* TODO could add seasonal analysis based on booking months */}
                      Year-round
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">Revenue Potential</h4>
                <div className="p-4 border rounded">
                  <div className="flex justify-between items-center mb-2">
                    <span>Annual Value</span>
                    <span className="font-medium">
                      {formatCurrency(guest.totalSpent / Math.max(1,
                        Math.ceil((new Date(guest.lastVisit).getTime() - new Date(guest.firstVisit).getTime()) / (365 * 24 * 60 * 60 * 1000))
                      ))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span>Lifetime Value</span>
                    <span className="font-medium">{formatCurrency(guest.totalSpent)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Projected Next Stay Value</span>
                    <span className="font-medium">{formatCurrency(guest.avgNightlyRate * guest.avgStayLength)}</span>
                  </div>
                </div>
              </div>

              {spendingTrend && spendingTrend.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Booking Frequency Analysis</h4>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={spendingTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="bookings" fill={METRIC_COLORS.bookings} name="Bookings per Month" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
