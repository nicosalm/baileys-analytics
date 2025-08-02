import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { formatCurrency } from '@baileys/utils'
import { Calendar, TrendingUp } from 'lucide-react'
import { Spinner } from '@/components/Spinner'
import { useDrillDown } from '@/contexts/drillDown'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

type MonthDetail = {
  summary: {
    totalRevenue: number
    totalTax: number
    totalBookings: number
    avgNightlyRate: number
  }
  byProperty: Array<{
    propertyId: string
    propertyName: string
    revenue: number
    bookings: number
    tax: number
  }>
  bookings: Array<{
    id: string
    propertyName: string
    guestName: string
    arrival: string
    departure: string
    totalAmount: number
    status: string
  }>
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

export const MonthDetailView = ({ month, year }: { month: string; year: string }) => {
  const { dispatch } = useDrillDown()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<MonthDetail | null>(null)

  useEffect(() => {
    const loadMonthDetail = async () => {
      setLoading(true)

      const result = await api.request<MonthDetail>(
        `/month-detail?year=${year}&month=${month}`
      )

      if (result.success) {
        setData(result.data)
      }
      setLoading(false)
    }

    loadMonthDetail()
  }, [month, year])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!data) return null

  const monthName = new Date(`${year}-${month}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const pieData = data.byProperty.map((p, index) => ({
    name: p.propertyName,
    value: p.revenue,
    color: COLORS[index % COLORS.length]
  }))

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{monthName} Overview</h2>

      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <TrendingUp className="w-4 h-4 mr-1" />
            Total Revenue
          </div>
          <div className="text-3xl font-bold">{formatCurrency(data.summary.totalRevenue)}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-2">Total Tax</div>
          <div className="text-3xl font-bold">{formatCurrency(data.summary.totalTax)}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <Calendar className="w-4 h-4 mr-1" />
            Total Bookings
          </div>
          <div className="text-3xl font-bold">{data.summary.totalBookings}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-2">Avg Nightly Rate</div>
          <div className="text-3xl font-bold">{formatCurrency(data.summary.avgNightlyRate)}</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
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
                  cursor="pointer"
                  onClick={(data: any) => {
                    const property = data.byProperty.find((p: any) => p.propertyName === data.name)
                    if (property) {
                      dispatch({
                        type: 'DRILL_TO_PROPERTY_MONTH',
                        propertyId: property.propertyId,
                        propertyName: property.propertyName,
                        month,
                        year
                      })
                    }
                  }}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4">Property Performance</h3>
          <div className="space-y-2">
            {data.byProperty.map(property => (
              <div
                key={property.propertyId}
                className="flex justify-between items-center p-3 border rounded hover:bg-gray-50 cursor-pointer"
                onClick={() => dispatch({
                  type: 'DRILL_TO_PROPERTY_MONTH',
                  propertyId: property.propertyId,
                  propertyName: property.propertyName,
                  month,
                  year
                })}
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
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-bold mb-4">All Bookings</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Property</th>
                <th className="text-left py-2">Guest</th>
                <th className="text-left py-2">Check In</th>
                <th className="text-left py-2">Check Out</th>
                <th className="text-right py-2">Amount</th>
                <th className="text-left py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.bookings.map(booking => (
                <tr
                  key={booking.id}
                  className="border-b hover:bg-gray-50 cursor-pointer"
                  onClick={() => dispatch({ type: 'DRILL_TO_BOOKING', bookingId: booking.id })}
                >
                  <td className="py-2">{booking.propertyName}</td>
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
