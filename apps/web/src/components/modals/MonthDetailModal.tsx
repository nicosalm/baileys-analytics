import { useMonthDetail } from '@/hooks/use-api'
import { formatCurrency, formatPercentage, formatDateDisplay } from '@baileys/utils'
import { Calendar, DollarSign, Home, TrendingUp, Info } from 'lucide-react'
import { StateWrapper } from '@/components/StateWrapper'
import { Modal } from '@/components/Modal'
import { useModal } from '@/contexts/modal'
import { useDashboard } from '@/contexts/dashboard'

interface MonthDetailModalProps {
  month: string
  year: string
}

export const MonthDetailModal = ({ month, year }: MonthDetailModalProps) => {
  const { closeModal, openModal } = useModal()
  const { filters } = useDashboard()
  
  const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', { 
    month: 'long', 
    year: 'numeric' 
  })
  
  const { data, isLoading, error } = useMonthDetail(month, year, filters.selectedTags.map(t => t.id))

  const subtitle = isLoading ? "Loading month details..." :
                   error ? "Unable to load month details" :
                   `Detailed breakdown for ${monthName}`

  return (
    <Modal
      isOpen={true}
      onClose={closeModal}
      title={monthName}
      subtitle={subtitle}
      size="lg"
    >
      <StateWrapper
        loading={isLoading}
        error={error}
        empty={!data && !isLoading && !error}
        loadingMessage="Loading month details..."
        errorMessage="Failed to load month details"
        emptyMessage="No data available for this month"
        minHeight={400}
      >
        <div className="space-y-6">
        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
            <div className="text-sm text-blue-800">
              <strong>Monthly Summary:</strong> See how {monthName} performed across all your properties. 
              Click any property or guest name for more details.
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        {data?.metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border">
              <div className="flex items-center text-sm text-gray-600 mb-1">
                <DollarSign className="w-4 h-4 mr-1" />
                Revenue
              </div>
              <div className="text-2xl font-bold">{formatCurrency(data.metrics.revenue)}</div>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <div className="flex items-center text-sm text-gray-600 mb-1">
                <Calendar className="w-4 h-4 mr-1" />
                Bookings
              </div>
              <div className="text-2xl font-bold">{data.metrics.bookings}</div>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <div className="flex items-center text-sm text-gray-600 mb-1">
                <Home className="w-4 h-4 mr-1" />
                Occupancy
              </div>
              <div className="text-2xl font-bold">{formatPercentage(data.metrics.occupancyRate * 100, 0)}</div>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <div className="flex items-center text-sm text-gray-600 mb-1">
                <TrendingUp className="w-4 h-4 mr-1" />
                Avg Rate
              </div>
              <div className="text-2xl font-bold">{formatCurrency(data.metrics.avgNightlyRate)}</div>
            </div>
          </div>
        )}

        {/* Top Properties */}
        <div className="bg-white rounded-lg border">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Top Properties This Month</h3>
          </div>
          <div className="divide-y">
            {data.topProperties?.slice(0, 5).map((property: any) => (
              <div
                key={property.propertyId}
                className="p-4 hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                onClick={() => openModal({
                  type: 'property',
                  propertyId: property.propertyId,
                  propertyName: property.propertyName
                })}
              >
                <div>
                  <div className="font-medium">{property.propertyName}</div>
                  <div className="text-sm text-gray-500">
                    {property.bookings} bookings • {formatPercentage(property.occupancyRate * 100, 0)} occupancy
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-green-600">{formatCurrency(property.revenue)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bookings List */}
        <div className="bg-white rounded-lg border">
          <div className="p-4 border-b">
            <h3 className="font-semibold">All Bookings in {monthName}</h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-gray-700">Guest</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-700">Property</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-700">Dates</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-700">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.bookings?.map((booking: any) => (
                  <tr key={booking.id} className="border-t hover:bg-gray-50">
                    <td 
                      className="p-4 cursor-pointer"
                      onClick={() => openModal({
                        type: 'guest',
                        guestId: booking.guestId,
                        guestName: booking.guestName
                      })}
                    >
                      <div className="font-medium text-blue-600 hover:underline">
                        {booking.guestName}
                      </div>
                    </td>
                    <td 
                      className="p-4 cursor-pointer"
                      onClick={() => openModal({
                        type: 'property',
                        propertyId: booking.propertyId,
                        propertyName: booking.propertyName
                      })}
                    >
                      <div className="text-blue-600 hover:underline">
                        {booking.propertyName}
                      </div>
                    </td>
                    <td className="p-4 text-sm">
                      {formatDateDisplay(new Date(booking.arrival))} - {formatDateDisplay(new Date(booking.departure))}
                    </td>
                    <td className="p-4 font-medium">
                      {formatCurrency(booking.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      </StateWrapper>
    </Modal>
  )
}