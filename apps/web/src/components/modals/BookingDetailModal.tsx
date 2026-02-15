import { useCallback } from 'react'
import { useBookingDetail } from '@/hooks/use-api'
import { formatCurrency, formatDateDisplay, differenceInDays } from '@baileys/utils'
import { Calendar, DollarSign, User, Home, CreditCard, Info, MapPin, ExternalLink } from 'lucide-react'
import { StateWrapper } from '@/components/StateWrapper'
import { StatusBadge } from '@/components/StatusBadge'
import { Modal } from '@/components/Modal'
import { useModal } from '@/contexts/modal'
import { useTips } from '@/hooks/use-tips'

interface BookingDetailModalProps {
  bookingId: string
  guestName?: string
}

export const BookingDetailModal = ({ bookingId, guestName }: BookingDetailModalProps) => {
  const { closeModal, openModal } = useModal()
  const { showTips } = useTips()
  const { data, isLoading, error } = useBookingDetail(bookingId)

  const booking = data?.booking
  const subtitle = isLoading ? "Loading booking information..." :
                   error ? "Unable to load booking" :
                   `Booking #${booking?.confirmationCode || bookingId}`
  const nights = booking ? differenceInDays(new Date(booking.departure), new Date(booking.arrival)) : 0

  // memoized click handlers
  const handleGuestClick = useCallback(() => {
    if (booking) {
      openModal({ type: 'guest', guestId: booking.guestId, guestName: booking.guestName })
    }
  }, [booking, openModal])

  const handlePropertyClick = useCallback(() => {
    if (booking) {
      openModal({ type: 'property', propertyId: booking.propertyId, propertyName: booking.propertyName })
    }
  }, [booking, openModal])

  return (
    <Modal
      isOpen={true}
      onClose={closeModal}
      title={guestName ? `${guestName}'s Booking` : 'Booking Details'}
      subtitle={subtitle}
      size="md"
    >
      <StateWrapper
        loading={isLoading}
        error={error}
        empty={!data && !isLoading && !error}
        loadingMessage="Loading booking information..."
        errorMessage="Failed to load booking details"
        emptyMessage="No booking data available"
        minHeight={300}
      >
        <div className="space-y-6">
        {/* Info Banner */}
        {showTips && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
              <div className="text-sm text-blue-800">
                <strong>Booking Details:</strong> Complete information about this reservation. 
                Click guest or property names to view their details.
              </div>
            </div>
          </div>
        )}

        {/* Status */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">Booking Status</div>
          <StatusBadge status={booking.status} />
        </div>

        {/* Guest & Property Info */}
        <div className="grid md:grid-cols-2 gap-4">
          <div
            className="bg-gray-50 p-4 rounded-lg cursor-pointer hover:bg-gray-100"
            onClick={handleGuestClick}
          >
            <div className="flex items-center text-sm text-gray-600 mb-2">
              <User className="w-4 h-4 mr-1" />
              Guest
            </div>
            <div className="font-semibold text-blue-600 hover:underline">{booking.guestName}</div>
            {booking.guestEmail && (
              <div className="text-sm text-gray-500">{booking.guestEmail}</div>
            )}
            {booking.guestPhone && (
              <div className="text-sm text-gray-500">{booking.guestPhone}</div>
            )}
          </div>

          <div
            className="bg-gray-50 p-4 rounded-lg cursor-pointer hover:bg-gray-100"
            onClick={handlePropertyClick}
          >
            <div className="flex items-center text-sm text-gray-600 mb-2">
              <Home className="w-4 h-4 mr-1" />
              Property
            </div>
            <div className="font-semibold text-blue-600 hover:underline">{booking.propertyName}</div>
            {booking.propertyAddress && (
              <div className="text-sm text-gray-500 flex items-start">
                <MapPin className="w-3 h-3 mr-1 mt-0.5" />
                {booking.propertyAddress}
              </div>
            )}
          </div>
        </div>

        {/* Dates & Duration */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center text-sm text-gray-600 mb-3">
            <Calendar className="w-4 h-4 mr-1" />
            Stay Dates
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-gray-500">Check In</div>
              <div className="font-semibold">{formatDateDisplay(new Date(booking.arrival))}</div>
              <div className="text-sm text-gray-600">{booking.checkInTime || '3:00 PM'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Check Out</div>
              <div className="font-semibold">{formatDateDisplay(new Date(booking.departure))}</div>
              <div className="text-sm text-gray-600">{booking.checkOutTime || '11:00 AM'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Duration</div>
              <div className="font-semibold">{nights} nights</div>
              <div className="text-sm text-gray-600">{booking.guestCount || 1} guests</div>
            </div>
          </div>
        </div>

        {/* Financial Details */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center text-sm text-gray-600 mb-3">
            <DollarSign className="w-4 h-4 mr-1" />
            Payment Details
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Nightly Rate</span>
              <span className="font-medium">{formatCurrency(booking.nightlyRate || booking.totalAmount / nights)}</span>
            </div>
            {booking.cleaningFee && booking.cleaningFee > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Cleaning Fee</span>
                <span className="font-medium">{formatCurrency(booking.cleaningFee)}</span>
              </div>
            )}
            {booking.taxes && booking.taxes > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Taxes</span>
                <span className="font-medium">{formatCurrency(booking.taxes)}</span>
              </div>
            )}
            {(booking.hostServiceFee || booking.host_service_fee) > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Host Service Fee</span>
                <span className="font-medium">{formatCurrency(booking.hostServiceFee || booking.host_service_fee)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t font-semibold">
              <span>Total Amount</span>
              <span className="text-green-600">{formatCurrency(booking.totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* Booking Source */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <div className="flex items-center">
              <CreditCard className="w-4 h-4 mr-1" />
              Booking Information
            </div>
            {booking.ownerrez_booking_id && (
              <a
                href={`https://app.ownerrez.com/bookings/${booking.ownerrez_booking_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors"
                title="Open in OwnerRez"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                OwnerRez
              </a>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Platform: </span>
              <span className="font-medium">{booking.platform || 'Direct'}</span>
            </div>
            <div>
              <span className="text-gray-600">Booked: </span>
              <span className="font-medium">{formatDateDisplay(new Date(booking.bookedDate))}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {booking.notes && (
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-2">Special Notes</div>
            <div className="text-sm">{booking.notes}</div>
          </div>
        )}
        </div>
      </StateWrapper>
    </Modal>
  )
}