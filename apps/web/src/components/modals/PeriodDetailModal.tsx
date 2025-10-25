import { usePeriodDetail } from '@/hooks/use-api'
import { formatCurrency, formatPercentage, formatDateDisplay } from '@baileys/utils'
import { Calendar, DollarSign, Home, TrendingUp, Info } from 'lucide-react'
import { format, parseISO, addDays, startOfMonth, endOfMonth } from 'date-fns'
import { StateWrapper } from '@/components/StateWrapper'
import { Modal } from '@/components/Modal'
import { useModal } from '@/contexts/modal'
import { useDashboard } from '@/contexts/dashboard'
import { useTips } from '@/hooks/use-tips'

interface PeriodDetailModalProps {
  month: string
  year: string
  day?: string
  originalDate?: string
  granularity?: 'daily' | 'weekly' | 'monthly'
}

export const PeriodDetailModal = ({ month, year, day, originalDate: _originalDate, granularity }: PeriodDetailModalProps) => {
  const { closeModal, openModal } = useModal()
  const { showTips } = useTips()
  const { filters } = useDashboard()
  
  let displayName: string
  let dateRangeStart: string
  let dateRangeEnd: string
  
  if (granularity === 'daily' && day) {
    const dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    const date = parseISO(dateStr)
    displayName = format(date, 'EEEE, MMMM d, yyyy')
    dateRangeStart = dateStr
    dateRangeEnd = dateStr
  } else if (granularity === 'weekly' && day) {
    const dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    const date = parseISO(dateStr)
    displayName = `Week of ${format(date, 'MMM d, yyyy')}`
    dateRangeStart = dateStr
    dateRangeEnd = format(addDays(date, 6), 'yyyy-MM-dd')
  } else {
    const monthDate = new Date(parseInt(year), parseInt(month) - 1)
    displayName = format(monthDate, 'MMMM yyyy')
    dateRangeStart = format(startOfMonth(monthDate), 'yyyy-MM-dd')
    dateRangeEnd = format(endOfMonth(monthDate), 'yyyy-MM-dd')
  }
  
  const { data, isLoading, error } = usePeriodDetail(
    day ? dateRangeStart : month, 
    day ? dateRangeEnd : year, 
    filters.selectedTags.map(t => t.id),
    day !== undefined
  )

  const subtitle = isLoading ? "Loading details..." :
                   error ? "Unable to load details" :
                   `Detailed breakdown for ${displayName}`

  return (
    <Modal
      isOpen={true}
      onClose={closeModal}
      title={displayName}
      subtitle={subtitle}
      size="lg"
    >
      <StateWrapper
        loading={isLoading}
        error={error}
        empty={!data && !isLoading && !error}
        loadingMessage="Loading period details..."
        errorMessage="Failed to load period details"
        emptyMessage="No data available for this period"
        minHeight={400}
      >
        <div className="space-y-6">
        {/* Info Banner */}
        {showTips && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
              <div className="text-sm text-blue-800">
                <strong>{granularity === 'daily' ? 'Daily' : granularity === 'weekly' ? 'Weekly' : 'Monthly'} Summary:</strong> See how {displayName} performed across all your properties. 
                Click any property or guest name for more details.
              </div>
            </div>
          </div>
        )}

        {/* Key Metrics */}
        {data?.metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border">
              <div className="flex items-center text-sm text-gray-600 mb-1">
                <DollarSign className="w-4 h-4 mr-1" />
                Total Revenue
              </div>
              <div className="text-2xl font-bold">{formatCurrency(data?.metrics?.revenue || 0)}</div>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <div className="flex items-center text-sm text-gray-600 mb-1">
                <Calendar className="w-4 h-4 mr-1" />
                Total Bookings
              </div>
              <div className="text-2xl font-bold">{data?.metrics?.bookings || 0}</div>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <div className="flex items-center text-sm text-gray-600 mb-1">
                <Home className="w-4 h-4 mr-1" />
                Occupancy Rate
              </div>
              <div className="text-2xl font-bold">{formatPercentage((data?.metrics?.occupancyRate || 0) * 100, 0)}</div>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <div className="flex items-center text-sm text-gray-600 mb-1">
                <TrendingUp className="w-4 h-4 mr-1" />
                Average Rate
              </div>
              <div className="text-2xl font-bold">{formatCurrency(data?.metrics?.avgNightlyRate || 0)}</div>
            </div>
          </div>
        )}

        {/* Top Properties */}
        <div className="bg-white rounded-lg border">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Top Properties This {granularity === 'daily' ? 'Day' : granularity === 'weekly' ? 'Week' : 'Month'}</h3>
          </div>
          <div className="divide-y">
            {data?.topProperties?.slice(0, 5).map((property: any) => (
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
            <h3 className="font-semibold">Active Bookings on {displayName}</h3>
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
                {data?.bookings?.map((booking: any) => (
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