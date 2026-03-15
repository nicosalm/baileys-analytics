import { useState, useMemo, useCallback, useRef, lazy, Suspense } from 'react'
import { useDashboardBatch } from '@/hooks/use-api'
import { useTagIds, usePropertyIds, useErrorToast, useComparisonDateRange } from '@/hooks/use-dashboard-utils'
import { formatCurrency, formatDateDisplay, formatPercentage, parseISO } from '@baileys/utils'
import { Button } from '@/components/ui/button'
import { Users, UserCheck, Calendar, DollarSign, Info, BarChart3, Search, X, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { PaginatedTable } from '@/components/tables'
import { MetricCard } from '@/components/MetricCard'
import { ChartWrapper } from '@/components/ChartWrapper'
import { StateWrapper } from '@/components/StateWrapper'
import { CollapsibleTags } from '@/components/CollapsibleTags'
import { useModal } from '@/contexts/modal'
import { useDashboard } from '@/contexts/dashboard'
import { useTips } from '@/hooks/use-tips'
import { useTheme } from '@/contexts/theme'
import { getPlatformColor, getTagColor, resolveToken } from '@/lib/theme'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GuestListItem, GuestSourceData, GuestTagDistribution } from '@/types/api'
import type { TooltipContentProps } from 'recharts'
import {
    PieChart, Pie, Cell, Label, Tooltip, ResponsiveContainer
} from 'recharts'

const CancelledGuestsTab = lazy(() => import('./CancelledGuestsTab').then(m => ({ default: m.CancelledGuestsTab })))
const InquiriesTab = lazy(() => import('./InquiriesTab').then(m => ({ default: m.InquiriesTab })))

type GuestSubTab = 'active' | 'cancelled' | 'inquiries'

interface TagChartItem {
    id: string
    name: string
    size: number
    value: number
    color: string
}



const GuestSourceTooltip = ({ active, payload }: Partial<TooltipContentProps<number, string>>) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload
        const total = data.totalGuests || 0
        const percent = total > 0 ? ((data.count / total) * 100).toFixed(1) : '0.0'
        return (
            <div className="bg-card p-3 rounded-lg shadow-lg border border-border">
                <p className="font-semibold text-sm mb-2">{data.source}</p>
                <div className="space-y-1 text-xs">
                    <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Guests:</span>
                        <span className="font-medium">{data.count}</span>
                    </div>
                    {data.revenue !== undefined && data.revenue > 0 && (
                        <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Revenue:</span>
                            <span className="font-medium text-success">{formatCurrency(data.revenue)}</span>
                        </div>
                    )}
                    <div className="pt-1 mt-1 border-t border-border flex justify-between gap-4">
                        <span className="text-muted-foreground">Share:</span>
                        <span className="font-medium">{percent}%</span>
                    </div>
                </div>
            </div>
        )
    }
    return null
}

export const GuestsDashboard = () => {
    const { openModal } = useModal()
    const { filters, comparisonRange, comparisonMode, comparisonLabel, toggleTag } = useDashboard()
    const { showTips } = useTips()
    const { resolvedTheme } = useTheme()
    const comparisonDateRange = useComparisonDateRange()
    const [subTab, setSubTab] = useState<GuestSubTab>('active')

    const tagIds = useTagIds()
    const propertyIds = usePropertyIds()

    const { data: rawData, error, isLoading } = useDashboardBatch(
        'guests',
        filters.dateRange.from,
        filters.dateRange.to,
        tagIds,
        comparisonRange?.from,
        comparisonRange?.to,
        propertyIds
    )

    const data = rawData?.current || rawData
    const previousData = rawData?.previous || null
    

    const [sortBy, setSortBy] = useState<string>('periodSpent')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
    const [viewMode, setViewMode] = useState<'all' | 'repeat' | 'new' | 'top'>('all')
    const [staysFilter, setStaysFilter] = useState<'any' | '1' | '2-3' | '4+'>('any')

    // use ref for date to avoid callback recreation
    const dateRangeFromRef = useRef(filters.dateRange.from)
    dateRangeFromRef.current = filters.dateRange.from

    useErrorToast(error, 'Failed to load guests data')

    const topPerformers = useMemo(() => {
        if (data?.metrics?.topSpenders && data.metrics.topSpenders.length > 0) {
            return {
                spenders: data.metrics.topSpenders.slice(0, 5),
                frequent: data.metrics.topSpenders
                    .sort((a: GuestListItem, b: GuestListItem) => (b.periodBookings || b.bookingCount) - (a.periodBookings || a.bookingCount))
                    .slice(0, 5)
            }
        }

        if (!data?.guests) return { spenders: [], frequent: [] }

        const sorted = [...data.guests]
        const spenders = sorted
            .sort((a, b) => (b.periodSpent || b.totalSpent) - (a.periodSpent || a.totalSpent))
            .slice(0, 5)
        const frequent = sorted
            .sort((a, b) => (b.periodBookings || b.bookingCount) - (a.periodBookings || a.bookingCount))
            .slice(0, 5)

        return { spenders, frequent }
    }, [data])

    const filteredGuests = useMemo(() => {
        if (!data) return []

        let filtered = [...data.guests]

        switch (viewMode) {
            case 'repeat':
                filtered = filtered.filter(g => g.bookingCount > 1)
                break
            case 'new':
                filtered = filtered.filter(g => {
                    const firstVisit = parseISO(g.firstVisit)
                    const rangeStart = parseISO(filters.dateRange.from)
                    return firstVisit >= rangeStart
                })
                break
            case 'top':
                const threshold = filtered
                    .map(g => g.periodSpent || g.totalSpent)
                    .sort((a, b) => b - a)[Math.floor(filtered.length * 0.2)]
                filtered = filtered.filter(g => (g.periodSpent || g.totalSpent) >= threshold)
                break
        }

        if (staysFilter !== 'any') {
            switch (staysFilter) {
                case '1':
                    filtered = filtered.filter(g => g.bookingCount === 1)
                    break
                case '2-3':
                    filtered = filtered.filter(g => g.bookingCount >= 2 && g.bookingCount <= 3)
                    break
                case '4+':
                    filtered = filtered.filter(g => g.bookingCount >= 4)
                    break
            }
        }

        return filtered
    }, [data, viewMode, staysFilter, filters.dateRange.from])

    const sortedGuests = useMemo(() => {
        return [...filteredGuests].sort((a, b) => {
            const aVal = a[sortBy as keyof typeof a]
            const bVal = b[sortBy as keyof typeof b]

            if (aVal === undefined && bVal === undefined) return 0
            if (aVal === undefined) return 1
            if (bVal === undefined) return -1

            if (sortOrder === 'asc') {
                return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
            }
            return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
        })
    }, [filteredGuests, sortBy, sortOrder])

    const handleGuestClick = useCallback((guest: GuestListItem) => {
        const isTopSpender = topPerformers.spenders.some((g: GuestListItem) => g.id === guest.id)
        const isFrequent = topPerformers.frequent.some((g: GuestListItem) => g.id === guest.id)
        const isNew = parseISO(guest.firstVisit) >= parseISO(dateRangeFromRef.current)

        openModal({
            type: 'guest',
            guestId: guest.id,
            guestName: guest.name,
            performanceData: {
                isTopSpender,
                isFrequent,
                isNew
            }
        })
    }, [openModal, topPerformers])

    // memoized view mode handlers
    const handleViewAll = useCallback(() => setViewMode('all'), [])
    const handleViewRepeat = useCallback(() => setViewMode('repeat'), [])
    const handleViewNew = useCallback(() => setViewMode('new'), [])
    const handleViewTop = useCallback(() => setViewMode('top'), [])

    const handleStaysFilter = useCallback((value: string) => {
        setStaysFilter(value as 'any' | '1' | '2-3' | '4+')
    }, [])

    const viewModes = useMemo(() => [
        { key: 'all' as const, label: 'All', handler: handleViewAll },
        { key: 'repeat' as const, label: 'Repeat', handler: handleViewRepeat },
        { key: 'new' as const, label: 'New', handler: handleViewNew },
        { key: 'top' as const, label: 'Top Spenders', handler: handleViewTop },
    ], [handleViewAll, handleViewRepeat, handleViewNew, handleViewTop])

    const handleSort = useCallback((column: string) => {
        if (column === sortBy) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
        } else {
            setSortBy(column)
            setSortOrder('desc')
        }
    }, [sortBy])

    // memoized maxSpent for revenue column - must be defined before columns
    const maxSpent = useMemo(() =>
        data?.guests ? Math.max(...data.guests.map((g: GuestListItem) => g.periodSpent || 0)) : 0
    , [data?.guests])

    const columns = useMemo(() => [
        {
            key: 'name',
            header: 'Guest',
            sortable: true,
            width: 250,
            render: (guest: GuestListItem) => {
                return (
                    <div>
                        <div className="font-medium">{guest.name}</div>
                        {guest.email && <div className="text-xs text-muted-foreground truncate">{guest.email}</div>}
                        {guest.phone && <div className="text-xs text-muted-foreground truncate">{guest.phone}</div>}
                    </div>
                )
            }
        },
        {
            key: 'periodBookings',
            header: 'Bookings',
            sortable: true,
            width: 120,
            render: (guest: GuestListItem) => (
                <div>
                    <span className="font-medium">{guest.periodBookings || 0}</span>
                    <span className="text-xs text-muted-foreground ml-1">
                        of {guest.bookingCount} total
                    </span>
                </div>
            )
        },
        {
            key: 'periodSpent',
            header: 'Revenue',
            sortable: true,
            width: 150,
            render: (guest: GuestListItem) => {
                const spentPercentage = maxSpent > 0 ? ((guest.periodSpent || 0) / maxSpent) * 100 : 0

                return (
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-success text-sm whitespace-nowrap">
                                {formatCurrency(guest.periodSpent || 0)}
                            </span>
                        </div>
                        <div className="w-full bg-border rounded-full h-1.5 mt-1">
                            <div
                                className={`h-1.5 rounded-full ${
                                    spentPercentage > 66 ? 'bg-success' :
                                    spentPercentage > 33 ? 'bg-warning' :
                                    'bg-muted-foreground'
                                }`}
                                style={{ width: `${spentPercentage}%` }}
                            />
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                            Lifetime: {formatCurrency(guest.totalSpent)}
                        </div>
                    </div>
                )
            }
        },
        {
            key: 'avgNightlyRate',
            header: 'Average/Night',
            sortable: true,
            width: 120,
            render: (guest: GuestListItem) => formatCurrency(guest.avgNightlyRate)
        },
        {
            key: 'firstVisit',
            header: 'First Visit',
            sortable: true,
            width: 120,
            render: (guest: GuestListItem) => formatDateDisplay(guest.firstVisit)
        },
        {
            key: 'lastVisit',
            header: 'Last Visit',
            sortable: true,
            width: 120,
            render: (guest: GuestListItem) => formatDateDisplay(guest.lastVisit)
        },
        {
            key: 'tags',
            header: 'Tags',
            width: 200,
            render: (guest: GuestListItem) => (
                <CollapsibleTags
                    tags={guest.tags}
                    maxVisible={1}
                    size="sm"
                />
            )
        }
    ], [maxSpent])

    const sourceChartData = useMemo(() => {
        const sources = data?.metrics?.guestsBySource || []
        const totalGuests = sources.reduce((sum: number, s: GuestSourceData) => sum + s.count, 0)
        return sources.map((source: GuestSourceData, index: number) => ({
            ...source,
            totalGuests,
            color: getPlatformColor(source.source, index)
        }))
    }, [data?.metrics?.guestsBySource, resolvedTheme])

    const tagDistribution = useMemo(() => {
        if (data?.metrics?.tagDistribution && data.metrics.tagDistribution.length > 0) {
            return data.metrics.tagDistribution
        }

        if (!data?.guests || data.guests.length === 0) {
            return []
        }

        const tagCounts = new Map<string, { id: string; name: string; color?: string; count: number }>()

        data.guests.forEach((guest: GuestListItem) => {
            guest.tags?.forEach((tag) => {
                const existing = tagCounts.get(tag.id) || {
                    id: tag.id,
                    name: tag.name,
                    color: tag.color,
                    count: 0
                }
                existing.count++
                tagCounts.set(tag.id, existing)
            })
        })

        return Array.from(tagCounts.values())
            .sort((a, b) => b.count - a.count)
    }, [data?.metrics?.tagDistribution, data?.guests])

    const tagChartData = useMemo(() =>
        tagDistribution
            ?.slice(0, 15)
            .map((tag: GuestTagDistribution) => ({
                id: tag.id,
                name: tag.name || 'Unknown',
                size: tag.count || 0,
                value: tag.count || 0,
                color: getTagColor(tag)
            })) || [], [tagDistribution, resolvedTheme])

    const [guestSourceActiveIndex, setGuestSourceActiveIndex] = useState<number | null>(null)
    const handleSourceMouseEnter = useCallback((_: unknown, index: number) => setGuestSourceActiveIndex(index), [])
    const handleSourceMouseLeave = useCallback(() => setGuestSourceActiveIndex(null), [])

    // memoized pie chart totals
    const sourceChartTotal = useMemo(() =>
        sourceChartData.reduce((sum: number, item: GuestSourceData) => sum + (item.count || 0), 0)
    , [sourceChartData])

    // memoized tag chart derived values
    const tagChartDerived = useMemo(() => {
        const maxCount = tagChartData.length > 0 ? Math.max(...tagChartData.map((t: TagChartItem) => t.value)) : 0
        const totalTags = tagDistribution.reduce((sum: number, t: GuestTagDistribution) => sum + t.count, 0)
        return { maxCount, totalTags }
    }, [tagChartData, tagDistribution])

    const headerCard = (
        <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex flex-col gap-3">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">Guest Center</h2>
                    <p className="text-muted-foreground text-sm mt-1 hidden sm:block">
                        Understand your guests and their booking patterns
                    </p>
                </div>
                <Tabs value={subTab} onValueChange={(v) => setSubTab(v as GuestSubTab)}>
                    <TabsList className="w-full sm:w-auto">
                        <TabsTrigger value="active">Active</TabsTrigger>
                        <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
                        <TabsTrigger value="inquiries">Inquiries</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>
        </div>
    )

    if (subTab === 'cancelled') {
        return (
            <div className="space-y-6">
                {headerCard}
                {showTips && (
                    <div className="bg-info-subtle border border-info/30 rounded-lg p-4">
                        <div className="flex items-start">
                            <Info className="w-5 h-5 text-info mr-2 mt-0.5" />
                            <div className="text-sm text-info-fg">
                                <strong>Tip:</strong> Shows bookings cancelled during the selected period. Track cancellation patterns by platform and property to identify issues. Click any row to view the guest's full profile and booking history.
                            </div>
                        </div>
                    </div>
                )}
                <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
                    <CancelledGuestsTab />
                </Suspense>
            </div>
        )
    }

    if (subTab === 'inquiries') {
        return (
            <div className="space-y-6">
                {headerCard}
                {showTips && (
                    <div className="bg-info-subtle border border-info/30 rounded-lg p-4">
                        <div className="flex items-start">
                            <Info className="w-5 h-5 text-info mr-2 mt-0.5" />
                            <div className="text-sm text-info-fg">
                                <strong>Tip:</strong> Recent periods show newly received inquiries, while seasons and fixed date ranges show demand for stays in that window. Hover over truncated notes to read the full message.
                            </div>
                        </div>
                    </div>
                )}
                <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
                    <InquiriesTab />
                </Suspense>
            </div>
        )
    }

    if (isLoading || error || !data) {
        return (
            <div className="space-y-6">
                {headerCard}
                <StateWrapper
                    loading={isLoading}
                    error={error}
                    empty={!data && !isLoading && !error}
                    loadingMessage="Loading guest analytics..."
                    emptyMessage="No guest data available"
                    emptySubMessage="Guest data will appear once bookings are synced"
                    onRetry={() => window.location.reload()}
                    minHeight={400}
                    className="py-12"
                >
                    <div />
                </StateWrapper>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {headerCard}

            {showTips && (
                <div className="bg-info-subtle border border-info/30 rounded-lg p-4">
                    <div className="flex items-start">
                        <Info className="w-5 h-5 text-info mr-2 mt-0.5" />
                        <div className="text-sm text-info-fg">
                            <strong>Tip:</strong> Scoped to the selected period. Filter by repeat, new, or top spenders. Use Search Across Years to find returnees for the same dates. Click any row for their full profile.
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <MetricCard
                    icon={Users}
                    label="Total Guests"
                    value={data.metrics.totalGuests}
                    format="number"
                    tooltip="Unique guests with bookings in this period"
                    subValue={comparisonMode !== 'none' && previousData?.metrics
                        ? <>vs {comparisonLabel}: {previousData.metrics.totalGuests}{comparisonDateRange && <span className="block text-xs text-muted-foreground/70 mt-0.5">{comparisonDateRange}</span>}</>
                        : "In selected period"
                    }
                    trend={comparisonMode !== 'none' && previousData?.metrics ? {
                        value: previousData.metrics.totalGuests > 0
                            ? ((data.metrics.totalGuests - previousData.metrics.totalGuests) / previousData.metrics.totalGuests) * 100
                            : data.metrics.totalGuests > 0 ? 100 : 0,
                        isPositive: data.metrics.totalGuests > previousData.metrics.totalGuests
                    } : undefined}
                    color="blue"
                    staggerIndex={0}
                />
                <MetricCard
                    icon={UserCheck}
                    label="Repeat Rate"
                    value={data.metrics.repeatRate * 100}
                    format="percent"
                    tooltip="Guests with more than one booking"
                    subValue={comparisonMode !== 'none' && previousData?.metrics
                        ? <>vs {comparisonLabel}: {formatPercentage(previousData.metrics.repeatRate * 100, 1)} | {data.metrics.repeatGuests} returning{comparisonDateRange && <span className="block text-xs text-muted-foreground/70 mt-0.5">{comparisonDateRange}</span>}</>
                        : `${data.metrics.repeatGuests} returning guests`
                    }
                    color="green"
                    trend={comparisonMode !== 'none' && previousData?.metrics ? {
                        value: previousData.metrics.repeatRate > 0
                            ? ((data.metrics.repeatRate - previousData.metrics.repeatRate) / previousData.metrics.repeatRate) * 100
                            : data.metrics.repeatRate > 0 ? 100 : 0,
                        isPositive: data.metrics.repeatRate > previousData.metrics.repeatRate
                    } : undefined}
                    staggerIndex={1}
                />
                <MetricCard
                    icon={Calendar}
                    label="Average Stay"
                    value={`${data.metrics.avgStayLength.toFixed(1)} nights`}
                    format="custom"
                    tooltip="Average nights per booking"
                    subValue={comparisonMode !== 'none' && previousData?.metrics
                        ? <>vs {comparisonLabel}: {previousData.metrics.avgStayLength.toFixed(1)} nights{comparisonDateRange && <span className="block text-xs text-muted-foreground/70 mt-0.5">{comparisonDateRange}</span>}</>
                        : "Per booking"
                    }
                    trend={comparisonMode !== 'none' && previousData?.metrics ? {
                        value: previousData.metrics.avgStayLength > 0
                            ? ((data.metrics.avgStayLength - previousData.metrics.avgStayLength) / previousData.metrics.avgStayLength) * 100
                            : data.metrics.avgStayLength > 0 ? 100 : 0,
                        isPositive: data.metrics.avgStayLength > previousData.metrics.avgStayLength
                    } : undefined}
                    color="purple"
                    staggerIndex={2}
                />
                <MetricCard
                    icon={DollarSign}
                    label="Average Guest Value"
                    value={data.metrics.avgSpend}
                    format="currency"
                    subValue={comparisonMode !== 'none' && previousData?.metrics
                        ? <>vs {comparisonLabel}: {formatCurrency(previousData.metrics.avgSpend)}{comparisonDateRange && <span className="block text-xs text-muted-foreground/70 mt-0.5">{comparisonDateRange}</span>}</>
                        : "Per guest this period"
                    }
                    trend={comparisonMode !== 'none' && previousData?.metrics && previousData.metrics.avgSpend > 0 ? {
                        value: ((data.metrics.avgSpend - previousData.metrics.avgSpend) / previousData.metrics.avgSpend) * 100,
                        isPositive: data.metrics.avgSpend > previousData.metrics.avgSpend
                    } : undefined}
                    tooltip="Revenue per unique guest"
                    color="orange"
                    staggerIndex={3}
                />
            </div>



            <div className="grid lg:grid-cols-2 gap-6">
                <ChartWrapper
                    title="Guest Sources"
                    subtitle="Where your guests come from"
                    icon={BarChart3}
                    height={320}
                    noData={sourceChartData.length === 0}
                    responsive={false}
                >
                    <div style={{ height: 280 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={sourceChartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius="55%"
                                    outerRadius="80%"
                                    dataKey="count"
                                    stroke={resolveToken('--card')}
                                    strokeWidth={2}
                                    animationBegin={0}
                                    animationDuration={500}
                                    animationEasing="ease-out"
                                    onMouseEnter={handleSourceMouseEnter}
                                    onMouseLeave={handleSourceMouseLeave}
                                >
                                    {sourceChartData.map((entry: GuestSourceData & {color: string}, index: number) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.color}
                                            opacity={guestSourceActiveIndex === null || guestSourceActiveIndex === index ? 1 : 0.3}
                                            style={{ transition: 'opacity 0.2s ease' }}
                                        />
                                    ))}
                                    <Label
                                        content={({ viewBox }) => {
                                            const { cx, cy } = viewBox as { cx: number; cy: number }
                                            return (
                                                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                                                    <tspan x={cx} y={cy - 8} className="fill-foreground text-lg font-bold">
                                                        {sourceChartTotal}
                                                    </tspan>
                                                    <tspan x={cx} y={cy + 12} className="fill-muted-foreground text-xs">
                                                        Guests
                                                    </tspan>
                                                </text>
                                            )
                                        }}
                                    />
                                </Pie>
                                <Tooltip content={<GuestSourceTooltip />} isAnimationActive={false} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-3 justify-center text-xs px-4">
                        {sourceChartData.map((entry: GuestSourceData & {color: string}) => (
                            <div key={entry.source} className="flex items-center gap-1.5">
                                <div className="w-3 h-2.5 rounded-sm" style={{ backgroundColor: entry.color }} />
                                <span className="text-muted-foreground">{entry.source}</span>
                            </div>
                        ))}
                    </div>
                </ChartWrapper>

                <ChartWrapper
                    title="Guest Tags"
                    subtitle="Click a tag to filter the dashboard"
                    icon={BarChart3}
                    height={320}
                    noData={!tagChartData || tagChartData.length === 0}
                    noDataMessage="No tag data available"
                    responsive={false}
                >
                    <div className="space-y-1 overflow-y-auto max-h-[280px] pr-1">
                        {tagChartData.map((tag: TagChartItem) => {
                            const percentage = tagChartDerived.maxCount > 0 ? (tag.value / tagChartDerived.maxCount) * 100 : 0
                            const overallPercent = tagChartDerived.totalTags > 0 ? ((tag.value / tagChartDerived.totalTags) * 100).toFixed(0) : '0'
                            const isActive = filters.selectedTags.some(t => t.id === tag.id)

                            return (
                                <button
                                    key={tag.name}
                                    className={`flex items-center gap-3 w-full text-left rounded-lg px-2 py-1.5 transition-colors cursor-pointer ${
                                        isActive
                                            ? 'bg-primary/10 ring-1 ring-primary/20'
                                            : 'hover:bg-muted/50'
                                    }`}
                                    onClick={() => toggleTag({ id: tag.id, name: tag.name, type: 'custom', color: tag.color })}
                                    title={isActive ? `Remove "${tag.name}" filter` : `Filter by "${tag.name}"`}
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium text-foreground">{tag.name}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-foreground">{tag.value} guests</span>
                                                <span className="text-xs text-muted-foreground">({overallPercent}%)</span>
                                            </div>
                                        </div>
                                        <div className="w-full bg-muted rounded-full h-2">
                                            <div
                                                className="h-2 rounded-full transition-all"
                                                style={{
                                                    width: `${percentage}%`,
                                                    backgroundColor: getTagColor(tag)
                                                }}
                                            />
                                        </div>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </ChartWrapper>
            </div>

            <RecurringDateSearch />

            <div className="bg-card rounded-lg shadow-sm border border-border">
                <div className="p-4 border-b border-border space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="w-5 h-5 text-muted-foreground" />
                          <h3 className="text-lg font-semibold">Guest List ({sortedGuests.length})</h3>
                        </div>
                        <Select value={staysFilter} onValueChange={handleStaysFilter}>
                            <SelectTrigger className="w-[130px] h-8 text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="any">Any stays</SelectItem>
                                <SelectItem value="1">1 stay</SelectItem>
                                <SelectItem value="2-3">2-3 stays</SelectItem>
                                <SelectItem value="4+">4+ stays</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center gap-2 bg-muted p-1 rounded-lg max-w-full overflow-x-auto scrollbar-hide">
                        {viewModes.map((mode) => (
                            <Button
                                key={mode.key}
                                variant="ghost"
                                size="sm"
                                onClick={mode.handler}
                                className={`text-xs sm:text-sm ${viewMode === mode.key
                                    ? 'bg-card text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                {mode.label}
                            </Button>
                        ))}
                    </div>
                    {(viewMode !== 'all' || staysFilter !== 'any') && (
                        <div className="text-xs text-muted-foreground">
                            {viewMode === 'all' && 'Showing all guests'}
                            {viewMode === 'repeat' && 'Showing returning guests (2+ lifetime stays)'}
                            {viewMode === 'new' && 'Showing first-time guests in this period'}
                            {viewMode === 'top' && 'Showing top 20% by revenue this period'}
                            {staysFilter !== 'any' && (
                                <span>
                                    {viewMode !== 'all' ? ' ' : ''}
                                    with {staysFilter === '1' ? '1 lifetime stay' : `${staysFilter} lifetime stays`}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                <PaginatedTable
                    data={sortedGuests}
                    columns={columns}
                    loading={isLoading}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                    onRowClick={handleGuestClick}
                    getRowId={(guest) => guest.id}
                    pageSize={15}
                    enableSearch={true}
                    searchKeys={['name', 'email']}
                    showRowNumbers={true}
                    emptyMessage="No guests found for the selected criteria"
                />
            </div>
        </div>
    )
}

interface RecurringBooking {
    id: string
    guestName: string
    propertyName: string
    arrival: string
    departure: string
    amount: number
}

interface RecurringYearData {
    year: number
    guestCount: number
    bookings: RecurringBooking[]
    totalRevenue: number
}

const RecurringDateSearch = () => {
    const { openModal } = useModal()
    const [isOpen, setIsOpen] = useState(false)
    const [startMonth, setStartMonth] = useState('7')
    const [startDay, setStartDay] = useState('1')
    const [endMonth, setEndMonth] = useState('7')
    const [endDay, setEndDay] = useState('7')
    const [yearsBack, setYearsBack] = useState('4')
    const [results, setResults] = useState<RecurringYearData[] | null>(null)
    const [loading, setLoading] = useState(false)

    const handleSearch = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                startMonth, startDay, endMonth, endDay, yearsBack
            })
            const result = await api.request(`/guests/recurring-search?${params}`) as { success: boolean; data: { results: RecurringYearData[] } }
            if (result.success) {
                setResults(result.data.results)
            }
        } catch {
            // silently fail
        } finally {
            setLoading(false)
        }
    }, [startMonth, startDay, endMonth, endDay, yearsBack])

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    if (!isOpen) {
        return (
            <Button
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2"
            >
                <Search className="w-4 h-4" />
                Search Across Years
            </Button>
        )
    }

    return (
        <div className="bg-card rounded-lg shadow-sm border border-border p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Search className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold">Search Across Years</h3>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setIsOpen(false); setResults(null) }}>
                    <X className="w-4 h-4" />
                </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Find guests who stayed during the same date window across multiple years (e.g., 4th of July guests for past 4 years)</p>
            <div className="flex flex-wrap items-end gap-3 mb-4">
                <div>
                    <label className="text-xs text-muted-foreground block mb-1">From</label>
                    <div className="flex gap-1">
                        <select value={startMonth} onChange={e => setStartMonth(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
                            {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                        </select>
                        <input type="number" min="1" max="31" value={startDay} onChange={e => setStartDay(e.target.value)} className="border rounded px-2 py-1.5 text-sm w-16" />
                    </div>
                </div>
                <div>
                    <label className="text-xs text-muted-foreground block mb-1">To</label>
                    <div className="flex gap-1">
                        <select value={endMonth} onChange={e => setEndMonth(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
                            {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                        </select>
                        <input type="number" min="1" max="31" value={endDay} onChange={e => setEndDay(e.target.value)} className="border rounded px-2 py-1.5 text-sm w-16" />
                    </div>
                </div>
                <div>
                    <label className="text-xs text-muted-foreground block mb-1">Years back</label>
                    <select value={yearsBack} onChange={e => setYearsBack(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
                        {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                </div>
                <Button onClick={handleSearch} disabled={loading} size="sm">
                    {loading ? 'Searching...' : 'Search'}
                </Button>
            </div>

            {results && (
                <div className="space-y-4">
                    {results.map((yearData: RecurringYearData) => (
                        <div key={yearData.year} className="border rounded-lg p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 mb-2">
                                <h4 className="font-semibold text-foreground">{yearData.year}</h4>
                                <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                                    <span>{yearData.guestCount} guests</span>
                                    <span>{yearData.bookings.length} bookings</span>
                                    <span className="text-success font-medium">{formatCurrency(yearData.totalRevenue)}</span>
                                </div>
                            </div>
                            {yearData.bookings.length > 0 ? (
                                <div className="space-y-1.5">
                                    {yearData.bookings.map((b: RecurringBooking) => (
                                        <div key={b.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm py-1.5 border-b last:border-0 border-border gap-0.5 sm:gap-3">
                                            <div className="min-w-0">
                                                <button
                                                    onClick={() => openModal({ type: 'booking', bookingId: b.id, guestName: b.guestName })}
                                                    className="font-medium text-foreground hover:text-primary hover:underline transition-colors truncate max-w-full"
                                                >
                                                    {b.guestName}
                                                </button>
                                                <span className="text-muted-foreground/60 mx-1 sm:mx-2">at</span>
                                                <span className="text-muted-foreground truncate">{b.propertyName}</span>
                                            </div>
                                            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                                                <span className="text-muted-foreground text-xs">
                                                    {formatDateDisplay(b.arrival)} - {formatDateDisplay(b.departure)}
                                                </span>
                                                <span className="font-medium text-success">{formatCurrency(b.amount)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground/70">No bookings in this period</p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
