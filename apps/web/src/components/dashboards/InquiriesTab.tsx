import { useMemo } from 'react'
import { useDashboardBatch } from '@/hooks/use-api'
import { useErrorToast } from '@/hooks/use-dashboard-utils'
import { formatDateDisplay, formatDateISO } from '@baileys/utils'
import { StateWrapper } from '@/components/StateWrapper'
import { PaginatedTable } from '@/components/tables'
import { useDashboard } from '@/contexts/dashboard'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { getPlatformColor } from '@/lib/theme'

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

const sourceLabels: Record<string, string> = {
    channel: 'Channel',
    widget: 'Direct',
    in_person: 'Direct',
}

function getInquiryPlatform(listingSite: string | null, source: string | null): string {
    if (listingSite) return listingSite
    if (source) return sourceLabels[source] || source.charAt(0).toUpperCase() + source.slice(1)
    return 'Unknown'
}

export const InquiriesTab = () => {
    const { filters } = useDashboard()
    const isRecencyPeriod = filters.dateRange.to === formatDateISO(new Date())
    const defaultSort = useMemo(() => ({
        key: isRecencyPeriod ? 'createdAt' : 'arrival',
        order: (isRecencyPeriod ? 'desc' : 'asc') as 'asc' | 'desc',
    }), [isRecencyPeriod])

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

    const filterLabel = isRecencyPeriod
        ? `Showing inquiries received ${formatDateDisplay(filters.dateRange.from)} – ${formatDateDisplay(filters.dateRange.to)}`
        : `Showing inquiries for stays ${formatDateDisplay(filters.dateRange.from)} – ${formatDateDisplay(filters.dateRange.to)}`

    return (
        <TooltipProvider>
        <p className="text-xs text-muted-foreground">{filterLabel}</p>
        <PaginatedTable
            data={data.inquiries}
            emptyMessage="No inquiries for stays in this period"
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
                    header: 'Dates',
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
                    header: 'Platform',
                    sortable: true,
                    render: (inq: InquiryItem) => {
                        const platform = getInquiryPlatform(inq.listingSite, inq.source)
                        return (
                            <span className="inline-flex items-center gap-1.5 text-sm">
                                <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: getPlatformColor(platform) }}
                                />
                                {platform}
                            </span>
                        )
                    }
                },
                {
                    key: 'comments',
                    header: 'Notes',
                    render: (inq: InquiryItem) => {
                        if (!inq.comments) return <span className="text-xs text-muted-foreground">–</span>
                        return (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="text-xs text-muted-foreground line-clamp-2 max-w-[250px] cursor-default">
                                        {inq.comments}
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-sm whitespace-pre-wrap">
                                    {inq.comments}
                                </TooltipContent>
                            </Tooltip>
                        )
                    }
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
            sortBy={defaultSort.key}
            sortOrder={defaultSort.order}
            showRowNumbers
            enableSearch
            searchKeys={['guestName', 'propertyName', 'listingSite', 'comments']}
        />
        </TooltipProvider>
    )
}
