import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { formatCurrency } from '@baileys/utils'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, Calendar, DollarSign, Users } from 'lucide-react'
import { Spinner } from '@/components/Spinner'
import { useDrillDown } from '@/contexts/drillDown'
import { useDashboard } from '@/contexts/dashboard'

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
  }
  monthlyData: Array<{
    month: string
    revenue: number
    bookings: number
    occupancy: number
  }>
  recentBookings: Array<{
    id: string
    guestName: string
    arrival: string
    departure: string
    totalAmount: number
    status: string
  }>
}

export const PropertyDetailView = ({ propertyId }: { propertyId: string }) => {
  const { dispatch } = useDrillDown()
  const { filters } = useDashboard()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PropertyDetail | null>(null)

  useEffect(() => {
    const loadPropertyDetail = async () => {
      setLoading(true)

      const result = await api.request<PropertyDetail>(
        `/property/${propertyId}/detail?from=${filters.dateRange.from}&to=${filters.dateRange.to}`
      )

      if (result.success) {
        setData(result.data)
      }
      setLoading(false)
    }

    loadPropertyDetail()
  }, [propertyId, filters.dateRange])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!data) return null

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

  const handleBookingClick = (bookingId: string) => {
    dispatch({ type: 'DRILL_TO_BOOKING', bookingId })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{data.property.name}</h2>
        <p className="text-gray-600">{data.property.address}</p>
        <p className="text-sm text-gray-500">
          {data.property.bedrooms} bed • {data.property.bathrooms} bath • Sleeps {data.property.maxGuests}
        </p>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <DollarSign className="w-4 h-4 mr-1" />
            Total Revenue
          </div>
          <div className="text-3xl font-bold">{formatCurrency(data.metrics.totalRevenue)}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <Calendar className="w-4 h-4 mr-1" />
            Total Bookings
          </div>
          <div className="text-3xl font-bold">{data.metrics.totalBookings}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <TrendingUp className="w-4 h-4 mr-1" />
            Avg Nightly Rate
          </div>
          <div className="text-3xl font-bold">{formatCurrency(data.metrics.avgNightlyRate)}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <Users className="w-4 h-4 mr-1" />
            Occupancy Rate
          </div>
          <div className="text-3xl font-bold">{(data.metrics.occupancyRate * 100).toFixed(0)}%</div>
        </div>
      </div>

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
                  stroke="#3B82F6"
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
                  fill="#10B981"
                  cursor="pointer"
                  onClick={handleMonthClick}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-bold mb-4">Recent Bookings</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Guest</th>
                <th className="text-left py-2">Check In</th>
                <th className="text-left py-2">Check Out</th>
                <th className="text-right py-2">Amount</th>
                <th className="text-left py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recentBookings.map(booking => (
                <tr
                  key={booking.id}
                  className="border-b hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleBookingClick(booking.id)}
                >
                  <td className="py-2">{booking.guestName}</td>
                  <td className="py-2">{new Date(booking.arrival).toLocaleDateString()}</td>
                  <td className="py-2">{new Date(booking.departure).toLocaleDateString()}</td>
                  <td className="py-2 text-right">{formatCurrency(booking.totalAmount)}</td>
                  <td className="py-2">
                    <span className={`px-2 py-1 text-xs rounded ${
                      booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                      booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {booking.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
