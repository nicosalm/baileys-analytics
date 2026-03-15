import { useDashboardBatch } from '@/hooks/use-api'
import { useErrorToast } from '@/hooks/use-dashboard-utils'
import { formatDateDisplay } from '@baileys/utils'
import { StateWrapper } from '@/components/StateWrapper'
import { PaginatedTable } from '@/components/tables'
import { useDashboard } from '@/contexts/dashboard'

interface InquiryItem {
    id: string
    ownerrezInquiryId: number
    guestName: string | null
    guestEmail: string | null
    propertyName: string | null
    propertyId: string | null
    arrival: string | null
    departure: string | null
    source: string | null
    listingSite: string | null
    comments: string | null
    guests: number | null
    createdAt: string | null
    updatedAt: string | null
}

const sourceStyles: Record<string, string> = {
    channel: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    widget: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    in_person: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
}

const sourceLabels: Record<string, string> = {
    channel: 'OTA',
    widget: 'Website',
    in_person: 'Direct',
}

function formatSource(source: string | null): string {
    if (!source) return 'Unknown'
    return sourceLabels[source] || source.charAt(0).toUpperCase() + source.slice(1)
}

export const InquiriesTab = () => {
    const { filters } = useDashboard()

    const { data, error, isLoading } = useDashboardBatch(
        'guests-inquiries',
        filters.dateRange.from,
        filters.dateRange.to,
    )

    useErrorToast(error, 'Failed to load inquiries data')

    if (isLoading || error || !data) {
        return (
            <StateWrapper
                loading={isLoading}
                error={error}
                empty={!data && !isLoading && !error}
                loadingMessage="Loading inquiries..."
                emptyMessage="No inquiries found"
                emptySubMessage="Inquiries from OwnerRez will appear here once synced"
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
            data={data.inquiries}
            emptyMessage="No inquiries in this period"
            columns={[
                {
                    key: 'guestName',
                    header: 'Guest',
                    sortable: true,
                    render: (inq: InquiryItem) => (
                        <div>
                            <div className="font-medium">{inq.guestName || 'Unknown'}</div>
                            {inq.guests && (
                                <div className="text-xs text-muted-foreground">{inq.guests} guest{inq.guests !== 1 ? 's' : ''}</div>
                            )}
                        </div>
                    )
                },
                {
                    key: 'propertyName',
                    header: 'Property',
                    sortable: true,
                    render: (inq: InquiryItem) => (
                        <span className="text-sm">{inq.propertyName || '–'}</span>
                    )
                },
                {
                    key: 'arrival',
                    header: 'Requested Dates',
                    sortable: true,
                    render: (inq: InquiryItem) => (
                        <span className="text-sm text-muted-foreground">
                            {inq.arrival && inq.departure
                                ? `${formatDateDisplay(inq.arrival)} – ${formatDateDisplay(inq.departure)}`
                                : '–'
                            }
                        </span>
                    )
                },
                {
                    key: 'source',
                    header: 'Source',
                    sortable: true,
                    render: (inq: InquiryItem) => {
                        const style = sourceStyles[inq.source || ''] || 'bg-muted text-muted-foreground'
                        return (
                            <div className="flex flex-col gap-0.5">
                                <span className={`inline-block w-fit px-2 py-0.5 text-xs rounded-full ${style}`}>
                                    {formatSource(inq.source)}
                                </span>
                                {inq.listingSite && (
                                    <span className="text-xs text-muted-foreground">{inq.listingSite}</span>
                                )}
                            </div>
                        )
                    }
                },
                {
                    key: 'comments',
                    header: 'Notes',
                    render: (inq: InquiryItem) => (
                        <span className="text-xs text-muted-foreground line-clamp-2 max-w-[200px]">
                            {inq.comments || '–'}
                        </span>
                    )
                },
                {
                    key: 'createdAt',
                    header: 'Received',
                    sortable: true,
                    render: (inq: InquiryItem) => (
                        <span className="text-sm text-muted-foreground">
                            {inq.createdAt ? formatDateDisplay(inq.createdAt.split('T')[0]) : '–'}
                        </span>
                    )
                },
            ]}
            pageSize={15}
            sortBy="createdAt"
            sortOrder="desc"
            enableSearch
            searchKeys={['guestName', 'propertyName', 'listingSite', 'comments']}
        />
    )
}
