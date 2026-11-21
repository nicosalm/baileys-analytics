import { useCallback } from 'react'
import { useDashboardBatch } from '@/hooks/use-api'
import { usePropertyIds, useErrorToast } from '@/hooks/use-dashboard-utils'
import { formatCurrency, formatDateDisplay } from '@baileys/utils'
import { StateWrapper } from '@/components/StateWrapper'
import { DataTable } from '@/components/tables/DataTable'
import { useModal } from '@/contexts/modal'
import { useDashboard } from '@/contexts/dashboard'
import { getPlatformColor } from '@/lib/theme'
import { Ban } from 'lucide-react'

interface CancelledBooking {
  id: string
  guestName: string
  guestEmail?: string
  guestPhone?: string
  ownerrezGuestId?: string
  propertyName: string
  propertyId: string
  arrival: string
  departure: string
  totalAmount: number
  platform: string
  canceledUtc: string | null
  bookedUtc: string | null
}

export const CancelledGuestsTab = () => {
  const { filters } = useDashboard()
  const propertyIds = usePropertyIds()
  const { openModal } = useModal()

  const { data, error, isLoading } = useDashboardBatch(
    'guests-cancelled',
    filters.dateRange.from,
    filters.dateRange.to,
    undefined,
    undefined,
    undefined,
    propertyIds,
  )

  useErrorToast(error, 'Failed to load cancellation data')

  const handleBookingClick = useCallback(
    (booking: CancelledBooking) => {
      openModal({
        type: 'guest',
        guestId: booking.ownerrezGuestId ? `or_${booking.ownerrezGuestId}` : `name_${booking.guestName.toLowerCase().trim()}`,
        guestName: booking.guestName,
      })
    },
    [openModal],
  )

  if (isLoading || error || !data) {
    return (
      <StateWrapper
        loading={isLoading}
        error={error}
        empty={!data && !isLoading && !error}
        loadingMessage="Loading cancellations..."
        emptyMessage="No cancellation data available"
        onRetry={() => window.location.reload()}
        minHeight={300}
        className="py-12"
      >
        <div />
      </StateWrapper>
    )
  }

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ban className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Cancellations ({data.bookings?.length || 0})</h3>
          </div>
          <span className="text-xs text-muted-foreground">All-time · sorted by cancellation date</span>
        </div>
      </div>
      <DataTable
        data={data.bookings}
        emptyMessage="No cancellations in this period"
        columns={[
          {
            key: 'guestName',
            header: 'Guest',
            sortable: true,
            width: 200,
            render: (b: CancelledBooking) => (
              <div>
                <div className="font-medium truncate">{b.guestName}</div>
                {b.guestEmail && <div className="text-xs text-muted-foreground truncate">{b.guestEmail}</div>}
              </div>
            ),
          },
          {
            key: 'propertyName',
            header: 'Property',
            sortable: true,
            width: 160,
            render: (b: CancelledBooking) => <span className="text-sm">{b.propertyName}</span>,
          },
          {
            key: 'arrival',
            header: 'Dates',
            sortable: true,
            width: 200,
            render: (b: CancelledBooking) => (
              <span className="text-sm text-muted-foreground">
                {formatDateDisplay(b.arrival)} – {formatDateDisplay(b.departure)}
              </span>
            ),
          },
          {
            key: 'platform',
            header: 'Platform',
            sortable: true,
            width: 120,
            render: (b: CancelledBooking) => (
              <span className="inline-flex items-center gap-1.5 text-sm">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getPlatformColor(b.platform) }} />
                {b.platform}
              </span>
            ),
          },
          {
            key: 'totalAmount',
            header: 'Amount',
            sortable: true,
            width: 100,
            render: (b: CancelledBooking) => (
              <span className="text-sm font-medium">{b.totalAmount > 0 ? formatCurrency(b.totalAmount) : '–'}</span>
            ),
          },
          {
            key: 'bookedUtc',
            header: 'Booked',
            sortable: true,
            width: 110,
            render: (b: CancelledBooking) => (
              <span className="text-sm text-muted-foreground">{b.bookedUtc ? formatDateDisplay(b.bookedUtc.split('T')[0]) : '–'}</span>
            ),
          },
          {
            key: 'canceledUtc',
            header: 'Cancelled',
            sortable: true,
            width: 110,
            render: (b: CancelledBooking) => (
              <span className="text-sm text-muted-foreground">{b.canceledUtc ? formatDateDisplay(b.canceledUtc.split('T')[0]) : '–'}</span>
            ),
          },
        ]}
        pageSize={10}
        sortBy="canceledUtc"
        sortOrder="desc"
        onRowClick={handleBookingClick}
        showRowNumbers
        enableSearch
        searchKeys={['guestName', 'guestEmail', 'propertyName']}
      />
    </div>
  )
}
