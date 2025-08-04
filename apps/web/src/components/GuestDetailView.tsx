import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { formatCurrency } from '@baileys/utils'
import {
  User, Calendar, DollarSign, Tag, Mail,
  TrendingUp, Clock, AlertCircle
} from 'lucide-react'
import { Spinner } from '@/components/Spinner'
import { useDrillDown } from '@/contexts/drillDown'
import { useToast } from '@/contexts/toast'
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
    type: string
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

const BookingStatusBadge = ({ status }: { status: string }) => {
  const styles = {
    confirmed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    canceled: 'bg-red-100 text-red-800',
    pending: 'bg-yellow-100 text-yellow-800'
  }

  return (
    <span className={`px-2 py-1 text-xs rounded ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  )
}

const getTagStyle = (tag: { type: string; color?: string }) => {
  if (tag.color) {
    return {
      backgroundColor: `${tag.color}20`,
      color: tag.color,
      borderColor: tag.color
    }
  }

  const typeColors = {
    payment: 'bg-green-100 text-green-800 border-green-300',
    guest: 'bg-purple-100 text-purple-800 border-purple-300',
    booking: 'bg-blue-100 text-blue-800 border-blue-300',
    property: 'bg-orange-100 text-orange-800 border-orange-300',
    custom: 'bg-gray-100 text-gray-800 border-gray-300'
  }

  return typeColors[tag.type as keyof typeof typeColors] || typeColors.custom
}

export const GuestDetailView = ({ guestId }: { guestId: string }) => {
  const { dispatch } = useDrillDown()
  const { addToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<GuestDetail | null>(null)
  const [activeTab, setActiveTab] = useState<'bookings' | 'properties' | 'analytics'>('bookings')

  useEffect(() => {
    let cancelled = false;

    const loadGuestDetail = async () => {
      if (!guestId) return;

      setLoading(true)
      setError(null)

      console.log('Loading guest detail for:', guestId)

      try {
        const result = await api.request<GuestDetail>(`/guest/${encodeURIComponent(guestId)}/detail`)

        if (cancelled) return; // Don't update state if component unmounted

        console.log('API result:', result)

        if (result.success) {
          setData(result.data)
        } else {
          const errorMsg = result.error || 'Failed to load guest details'
          setError(errorMsg)
          // Only show toast for non-404 errors to avoid spam
          if (result.status !== 404) {
            addToast('error', `Failed to load guest: ${errorMsg}`)
          }
          console.error('Failed to load guest detail:', result.error, 'Status:', result.status)
        }
      } catch (err) {
        if (cancelled) return;

        const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred'
        setError(errorMsg)
        addToast('error', `Error loading guest: ${errorMsg}`)
        console.error('Error loading guest detail:', err)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadGuestDetail()

    // Cleanup function to prevent state updates after unmount
    return () => {
      cancelled = true;
    }
  }, [guestId]) // Remove addToast from dependencies

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

  const { guest, bookings, properties, spendingTrend, tags, paymentMethods } = data

  const handleBookingClick = (bookingId: string) => {
    dispatch({ type: 'DRILL_TO_BOOKING', bookingId })
  }

  const handlePropertyClick = (propertyId: string, propertyName: string) => {
    dispatch({
      type: 'DRILL_TO_PROPERTY',
      propertyId,
      propertyName
    })
  }

  const tagsByType = tags.reduce((acc, tag) => {
    if (!acc[tag.type]) acc[tag.type] = []
    acc[tag.type].push(tag)
    return acc
  }, {} as Record<string, typeof tags>)

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
            <Tag className="w-5 h-5 mr-2" />
            Tags
          </h3>
          {tags && Object.keys(tagsByType).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(tagsByType).map(([type, typeTags]) => (
                <div key={type}>
                  <h4 className="text-sm font-medium text-gray-600 mb-2 capitalize">{type}</h4>
                  <div className="flex flex-wrap gap-2">
                    {typeTags.map(tag => {
                      const style = getTagStyle(tag)
                      return typeof style === 'string' ? (
                        <span
                          key={tag.id}
                          className={`px-2 py-1 rounded-full text-xs border ${style}`}
                        >
                          {tag.name}
                        </span>
                      ) : (
                        <span
                          key={tag.id}
                          className="px-2 py-1 rounded-full text-xs border"
                          style={style}
                        >
                          {tag.name}
                        </span>
                      )
                    })}
                  </div>
                </div>
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
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ fill: '#3B82F6' }}
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
            <div className="overflow-x-auto">
              {bookings && bookings.length > 0 ? (
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Property</th>
                      <th className="text-left py-2">Check In</th>
                      <th className="text-left py-2">Check Out</th>
                      <th className="text-center py-2">Nights</th>
                      <th className="text-right py-2">Amount</th>
                      <th className="text-left py-2">Platform</th>
                      <th className="text-left py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((booking, index) => (
                      <tr
                        key={`${booking.id}-${index}`}
                        className="border-b hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleBookingClick(booking.id)}
                      >
                        <td className="py-2">{booking.propertyName}</td>
                        <td className="py-2">{new Date(booking.arrival).toLocaleDateString()}</td>
                        <td className="py-2">{new Date(booking.departure).toLocaleDateString()}</td>
                        <td className="py-2 text-center">{booking.nights}</td>
                        <td className="py-2 text-right">{formatCurrency(booking.totalAmount)}</td>
                        <td className="py-2">{booking.platform || 'Direct'}</td>
                        <td className="py-2">
                          <BookingStatusBadge status={booking.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-gray-500">No bookings found</p>
              )}
            </div>
          )}

          {activeTab === 'properties' && (
            <div className="space-y-3">
              {properties && properties.length > 0 ? (
                properties.map((property, index) => (
                  <div
                    key={`${property.propertyId}-${index}`}
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
                      {/* Could add seasonal analysis based on booking months */}
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
                        <Bar dataKey="bookings" fill="#10B981" name="Bookings per Month" />
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
