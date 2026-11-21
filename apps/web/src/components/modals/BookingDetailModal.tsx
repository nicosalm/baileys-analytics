import { useCallback } from 'react'
import { useBookingDetail } from '@/hooks/use-api'
import { formatCurrency, formatDateDisplay, differenceInDays, parseISO } from '@baileys/utils'
import { Calendar, DollarSign, User, Home, CreditCard, Info, MapPin, ExternalLink, Tags } from 'lucide-react'
import { CollapsibleTags } from '@/components/CollapsibleTags'
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
  const subtitle = isLoading
    ? 'Loading booking information...'
    : error
      ? 'Unable to load booking'
      : `Booking #${booking?.platform_reservation_number || bookingId}`
  const nights = booking ? differenceInDays(parseISO(booking.departure), parseISO(booking.arrival)) : 0

  const handleGuestClick = useCallback(() => {
    if (booking) {
      const guestId = booking.ownerrez_guest_id
        ? `or_${booking.ownerrez_guest_id}`
        : `name_${(booking.guest_name || '').toLowerCase().trim()}`
      openModal({ type: 'guest', guestId, guestName: booking.guest_name || 'Unknown' })
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
            <div className="bg-info-subtle border border-info/30 rounded-lg p-4">
              <div className="flex items-start">
                <Info className="w-5 h-5 text-info mr-2 mt-0.5" />
                <div className="text-sm text-info-fg">
                  <strong>Booking Details:</strong> Click the guest name to view their full profile.
                </div>
              </div>
            </div>
          )}

          {/* Status */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Booking Status</div>
            <StatusBadge status={booking?.status ?? 'unknown'} />
          </div>

          {/* Guest & Property Info */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-muted/40 p-4 rounded-lg cursor-pointer hover:bg-muted" onClick={handleGuestClick}>
              <div className="flex items-center text-sm text-muted-foreground mb-2">
                <User className="w-4 h-4 mr-1" />
                Guest
              </div>
              <div className="font-semibold text-primary hover:underline">{booking?.guest_name}</div>
              {booking?.guest_email && <div className="text-sm text-muted-foreground">{booking.guest_email}</div>}
              {booking?.guest_phone && <div className="text-sm text-muted-foreground">{booking.guest_phone}</div>}
            </div>

            <div className="bg-muted/40 p-4 rounded-lg">
              <div className="flex items-center text-sm text-muted-foreground mb-2">
                <Home className="w-4 h-4 mr-1" />
                Property
              </div>
              <div className="font-semibold text-foreground">{booking?.property_name}</div>
              {booking?.property_address && (
                <div className="text-sm text-muted-foreground flex items-start">
                  <MapPin className="w-3 h-3 mr-1 mt-0.5" />
                  {booking.property_address}
                </div>
              )}
            </div>
          </div>

          {(() => {
            const allTags = [...(data?.guestTags || []), ...(data?.tags || [])]
            const unique = allTags.filter((t, i, arr) => arr.findIndex((u) => u.id === t.id) === i)
            return unique.length > 0 ? (
              <div className="flex items-center gap-1.5">
                <Tags className="w-3.5 h-3.5 text-muted-foreground" />
                <CollapsibleTags tags={unique} maxVisible={6} size="sm" />
              </div>
            ) : null
          })()}

          {/* Dates & Duration */}
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center text-sm text-muted-foreground mb-3">
              <Calendar className="w-4 h-4 mr-1" />
              Stay Dates
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-muted-foreground">Check In</div>
                <div className="font-semibold">{booking?.arrival ? formatDateDisplay(booking.arrival) : '-'}</div>
                <div className="text-sm text-muted-foreground">3:00 PM</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Check Out</div>
                <div className="font-semibold">{booking?.departure ? formatDateDisplay(booking.departure) : '-'}</div>
                <div className="text-sm text-muted-foreground">11:00 AM</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Duration</div>
                <div className="font-semibold">{nights} nights</div>
                <div className="text-sm text-muted-foreground">{(booking?.adults || 0) + (booking?.children || 0) || 1} guests</div>
              </div>
            </div>
          </div>

          {/* Financial Details */}
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center text-sm text-muted-foreground mb-3">
              <DollarSign className="w-4 h-4 mr-1" />
              Payment Details
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nightly Rate</span>
                <span className="font-medium">
                  {formatCurrency(booking?.avgNightlyRate || (nights > 0 ? (booking?.total_amount ?? 0) / nights : 0))}
                </span>
              </div>
              {(booking?.host_service_fee ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Host Service Fee</span>
                  <span className="font-medium">{formatCurrency(booking!.host_service_fee ?? 0)}</span>
                </div>
              )}
              {data?.charges && data.charges.length > 0 && (
                <div className="pt-2 border-t">
                  <div className="text-xs text-muted-foreground font-medium mb-1.5">Itemized Charges</div>
                  {data.charges.map((charge, i) => (
                    <div key={charge.id || i} className="flex justify-between text-sm py-0.5">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            charge.type === 'tax'
                              ? 'bg-info'
                              : charge.type === 'fee'
                                ? 'bg-warning'
                                : charge.type === 'discount'
                                  ? 'bg-success'
                                  : 'bg-muted-foreground'
                          }`}
                        />
                        {charge.description || charge.type}
                      </span>
                      <span className={`font-medium ${charge.type === 'discount' ? 'text-success' : ''}`}>
                        {charge.type === 'discount' ? '-' : ''}
                        {formatCurrency(Math.abs(charge.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between pt-2 border-t font-semibold">
                <span>Total Amount</span>
                <span className="text-success">{formatCurrency(booking?.total_amount ?? 0)}</span>
              </div>
            </div>
          </div>

          {/* Booking Source */}
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
              <div className="flex items-center">
                <CreditCard className="w-4 h-4 mr-1" />
                Booking Information
              </div>
              {booking?.ownerrez_booking_id && (
                <a
                  href={`https://app.ownerrez.com/bookings/${booking.ownerrez_booking_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                  title="Open in OwnerRez"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  OwnerRez
                </a>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Platform: </span>
                <span className="font-medium">{booking?.platform || 'Unassigned'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Booked: </span>
                <span className="font-medium">{booking?.booked_utc ? formatDateDisplay(booking.booked_utc) : '-'}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {booking?.notes && (
            <div className="bg-muted/40 rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-2">Special Notes</div>
              <div className="text-sm">{booking.notes}</div>
            </div>
          )}
        </div>
      </StateWrapper>
    </Modal>
  )
}
