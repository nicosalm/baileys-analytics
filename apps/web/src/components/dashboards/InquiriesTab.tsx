import { useDashboardBatch } from '@/hooks/use-api'
import { useErrorToast } from '@/hooks/use-dashboard-utils'
import { formatDateDisplay } from '@baileys/utils'
import { StateWrapper } from '@/components/StateWrapper'
import { PaginatedTable } from '@/components/tables'
import { useDashboard } from '@/contexts/dashboard'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { getPlatformColor } from '@/lib/theme'
import { ExternalLink, MessageSquare } from 'lucide-react'
import { Link } from 'react-router-dom'

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

    const inquiries = data.inquiries ?? []

    return (
        <TooltipProvider>
        <div className="bg-card rounded-lg shadow-sm border border-border">
            <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-muted-foreground" />
                    <h3 className="text-lg font-semibold">Inquiries ({inquiries.length})</h3>
                </div>
                <span className="text-xs text-muted-foreground">
                    Received {formatDateDisplay(filters.dateRange.from)} – {formatDateDisplay(filters.dateRange.to)}
                </span>
            </div>
            {inquiries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-1.5 text-center">
                    <p className="text-sm font-medium text-muted-foreground">No inquiries in this period</p>
                    <p className="text-xs text-muted-foreground/70">
                        Inquiries sync via webhook. If history is missing, run a manual sync from{' '}
                        <Link to="/settings?tab=integrations" className="text-primary hover:text-primary/80">
                            Settings → Integrations
                        </Link>.
                    </p>
                </div>
            ) : (
        <PaginatedTable
            data={inquiries}
            emptyMessage="No inquiries received in this period"
            columns={[
                {
                    key: 'guestName',
                    header: 'Guest',
                    sortable: true,
                    width: 200,
                    render: (inq: InquiryItem) => (
                        <div>
                            <div className="font-medium truncate">{inq.guestName || 'Unknown'}</div>
                            {inq.guestEmail
                                ? <div className="text-xs text-muted-foreground truncate">{inq.guestEmail}</div>
                                : inq.guests
                                    ? <div className="text-xs text-muted-foreground">{inq.guests} guest{inq.guests !== 1 ? 's' : ''}</div>
                                    : null
                            }
                        </div>
                    )
                },
                {
                    key: 'propertyName',
                    header: 'Property',
                    sortable: true,
                    width: 160,
                    render: (inq: InquiryItem) => (
                        <span className="text-sm">{inq.propertyName || '–'}</span>
                    )
                },
                {
                    key: 'arrival',
                    header: 'Dates',
                    sortable: true,
                    width: 200,
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
                    width: 120,
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
                    width: 200,
                    render: (inq: InquiryItem) => {
                        if (!inq.comments) return <span className="text-xs text-muted-foreground">–</span>
                        return (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="text-xs text-muted-foreground line-clamp-1 max-w-[200px] cursor-default">
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
                    width: 110,
                    render: (inq: InquiryItem) => (
                        <span className="text-sm text-muted-foreground">
                            {inq.createdAt ? formatDateDisplay(inq.createdAt.split('T')[0]) : '–'}
                        </span>
                    )
                },
                {
                    key: 'ownerrezInquiryId',
                    header: '',
                    width: 40,
                    render: (inq: InquiryItem) => inq.ownerrezInquiryId ? (
                        <a
                            href={`https://app.ownerrez.com/inquiries/${inq.ownerrezInquiryId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary transition-colors"
                            title="Open in OwnerRez"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    ) : null
                },
            ]}
            pageSize={15}
            sortBy="createdAt"
            sortOrder="desc"
            showRowNumbers
            enableSearch
            searchKeys={['guestName', 'propertyName', 'listingSite', 'comments']}
        />
            )}
        </div>
        </TooltipProvider>
    )
}
