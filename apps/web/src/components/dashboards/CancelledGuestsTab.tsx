import { useCallback } from 'react'
import { useDashboardBatch } from '@/hooks/use-api'
import { usePropertyIds, useErrorToast } from '@/hooks/use-dashboard-utils'
import { formatCurrency, formatDateDisplay } from '@baileys/utils'
import { StateWrapper } from '@/components/StateWrapper'
import { PaginatedTable } from '@/components/tables'
import { useModal } from '@/contexts/modal'
import { useDashboard } from '@/contexts/dashboard'
import { getPlatformColor } from '@/lib/theme'

interface CancelledBooking {
    id: string
    guestName: string
    guestEmail?: string
    guestPhone?: string
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
        propertyIds
    )

    useErrorToast(error, 'Failed to load cancellation data')

    const handleBookingClick = useCallback((booking: CancelledBooking) => {
        openModal({
            type: 'guest',
            guestId: `${booking.guestName.toLowerCase().trim()}_${(booking.guestEmail || '').toLowerCase().trim()}`,
            guestName: booking.guestName,
        })
    }, [openModal])

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
        <PaginatedTable
            data={data.bookings}
            emptyMessage="No cancellations in this period"
            columns={[
                {
                    key: 'guestName',
                    header: 'Guest',
                    sortable: true,
                    render: (b: CancelledBooking) => (
                        <div>
                            <div className="font-medium">{b.guestName}</div>
                            {b.guestEmail && (
                                <div className="text-xs text-muted-foreground">{b.guestEmail}</div>
                            )}
                        </div>
                    )
                },
                {
                    key: 'propertyName',
                    header: 'Property',
                    sortable: true,
                    render: (b: CancelledBooking) => (
                        <span className="text-sm">{b.propertyName}</span>
                    )
                },
                {
                    key: 'arrival',
                    header: 'Dates',
                    sortable: true,
                    render: (b: CancelledBooking) => (
                        <span className="text-sm text-muted-foreground">
                            {formatDateDisplay(b.arrival)} – {formatDateDisplay(b.departure)}
                        </span>
                    )
                },
                {
                    key: 'platform',
                    header: 'Platform',
                    sortable: true,
                    render: (b: CancelledBooking) => (
                        <span className="inline-flex items-center gap-1.5 text-sm">
                            <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: getPlatformColor(b.platform) }}
                            />
                            {b.platform}
                        </span>
                    )
                },
                {
                    key: 'totalAmount',
                    header: 'Amount',
                    sortable: true,
                    render: (b: CancelledBooking) => (
                        <span className="text-sm font-medium">
                            {b.totalAmount > 0 ? formatCurrency(b.totalAmount) : '–'}
                        </span>
                    )
                },
                {
                    key: 'canceledUtc',
                    header: 'Cancelled',
                    sortable: true,
                    render: (b: CancelledBooking) => (
                        <span className="text-sm text-muted-foreground">
                            {b.canceledUtc ? formatDateDisplay(b.canceledUtc.split('T')[0]) : '–'}
                        </span>
                    )
                },
            ]}
            pageSize={15}
            sortBy="canceledUtc"
            sortOrder="desc"
            onRowClick={handleBookingClick}
            enableSearch
            searchKeys={['guestName', 'guestEmail', 'propertyName']}
        />
    )
}
