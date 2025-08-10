import { usePropertyMonthDetail } from '@/hooks/use-api'
import { formatCurrency } from '@baileys/utils'
import { Calendar, DollarSign } from 'lucide-react'
import { Spinner } from '@/components/Spinner'
import { StatusBadge } from '@/components/StatusBadge'
import { useDrillDown } from '@/contexts/drillDown'

export const PropertyMonthDetailView = ({
  propertyId,
  month,
  year
}: {
  propertyId: string
  month: string
  year: string
}) => {
  const { dispatch } = useDrillDown()
  const { data, isLoading: loading, error } = usePropertyMonthDetail(propertyId, month, year)

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex justify-center py-12 text-red-600">
        Error loading property month details: {error.message}
      </div>
    )
  }

  if (!data) return null

  const monthName = new Date(`${year}-${month}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{data.property.name}</h2>
        <p className="text-gray-600">{monthName}</p>
      </div>

      <div className="grid md:grid-cols-5 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <DollarSign className="w-4 h-4 mr-1" />
            Revenue
          </div>
          <div className="text-2xl font-bold">{formatCurrency(data.summary.revenue)}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-2">Tax Collected</div>
          <div className="text-2xl font-bold">{formatCurrency(data.summary.tax)}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <Calendar className="w-4 h-4 mr-1" />
            Bookings
          </div>
          <div className="text-2xl font-bold">{data.summary.bookings}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-2">Total Nights</div>
          <div className="text-2xl font-bold">{data.summary.nights}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-2">Avg Nightly</div>
          <div className="text-2xl font-bold">{formatCurrency(data.summary.avgNightlyRate)}</div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-bold mb-4">Bookings Detail</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Guest</th>
                <th className="text-left py-2">Check In</th>
                <th className="text-left py-2">Check Out</th>
                <th className="text-center py-2">Nights</th>
                <th className="text-right py-2">Amount</th>
                <th className="text-right py-2">Tax</th>
                <th className="text-left py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.bookings?.map((booking: any) => (
                <tr
                  key={booking.id}
                  className="border-b hover:bg-gray-50 cursor-pointer"
                  onClick={() => dispatch({ type: 'DRILL_TO_BOOKING', bookingId: booking.id })}
                >
                  <td className="py-2">{booking.guestName}</td>
                  <td className="py-2">{new Date(booking.arrival).toLocaleDateString()}</td>
                  <td className="py-2">{new Date(booking.departure).toLocaleDateString()}</td>
                  <td className="py-2 text-center">{booking.nights}</td>
                  <td className="py-2 text-right">{formatCurrency(booking.totalAmount)}</td>
                  <td className="py-2 text-right">{formatCurrency(booking.taxAmount)}</td>
                  <td className="py-2">
                    <StatusBadge status={booking.status} />
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
