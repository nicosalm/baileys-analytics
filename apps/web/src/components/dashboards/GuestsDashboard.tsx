import { useState, useMemo, useCallback, useRef } from 'react'
import { useDashboardBatch } from '@/hooks/use-api'
import { useTagIds, useErrorToast, useComparisonDateRange } from '@/hooks/use-dashboard-utils'
import { formatCurrency, formatDateDisplay, formatPercentage } from '@baileys/utils'
import { Users, UserCheck, Calendar, DollarSign, Info, BarChart3 } from 'lucide-react'
import { PaginatedTable } from '@/components/tables'
import { MetricCard } from '@/components/MetricCard'
import { ChartWrapper } from '@/components/ChartWrapper'
import { StateWrapper } from '@/components/StateWrapper'
import { CollapsibleTags } from '@/components/CollapsibleTags'
import { useModal } from '@/contexts/modal'
import { useDashboard } from '@/contexts/dashboard'
import { useTips } from '@/hooks/use-tips'
import { getPlatformColor, getTagColor } from '@/lib/theme'
import { GuestListItem, GuestSourceData, GuestTagDistribution } from '@/types/api'
import {
    PieChart, Pie, Cell, Tooltip
} from 'recharts'


const GuestSourceTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload
        const total = data.totalGuests || 0
        const percent = total > 0 ? ((data.count / total) * 100).toFixed(1) : '0.0'
        return (
            <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                <p className="font-semibold text-sm mb-2">{data.source}</p>
                <div className="space-y-1 text-xs">
                    <p className="flex justify-between gap-4">
                        <span className="text-gray-600">Guests:</span>
                        <span className="font-medium">{data.count}</span>
                    </p>
                    <p className="flex justify-between gap-4">
                        <span className="text-gray-600">Share:</span>
                        <span className="font-medium">{percent}%</span>
                    </p>
                    {data.revenue !== undefined && data.revenue > 0 && (
                        <p className="flex justify-between gap-4">
                            <span className="text-gray-600">Revenue:</span>
                            <span className="font-medium text-green-600">{formatCurrency(data.revenue)}</span>
                        </p>
                    )}
                </div>
            </div>
        )
    }
    return null
}

export const GuestsDashboard = () => {
    const { openModal } = useModal()
    const { filters, comparisonRange, comparisonMode, comparisonLabel } = useDashboard()
    const { showTips } = useTips()
    const comparisonDateRange = useComparisonDateRange()

    const tagIds = useTagIds()

    const { data: rawData, error, isLoading } = useDashboardBatch(
        'guests',
        filters.dateRange.from,
        filters.dateRange.to,
        tagIds,
        comparisonRange?.from,
        comparisonRange?.to
    )

    const data = rawData?.current || rawData
    const previousData = rawData?.previous || null
    

    const [sortBy, setSortBy] = useState<string>('periodSpent')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
    const [viewMode, setViewMode] = useState<'all' | 'repeat' | 'new' | 'top'>('all')

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
                filtered = filtered.filter(g => (g.periodBookings || g.bookingCount) > 1)
                break
            case 'new':
                filtered = filtered.filter(g => {
                    const firstVisit = new Date(g.firstVisit)
                    const rangeStart = new Date(filters.dateRange.from)
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

        return filtered
    }, [data, viewMode, filters.dateRange.from])

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
        const isNew = new Date(guest.firstVisit) >= new Date(dateRangeFromRef.current)

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
                const isRepeat = (guest.periodBookings || guest.bookingCount) > 1
                const isNew = new Date(guest.firstVisit) >= new Date(filters.dateRange.from)

                return (
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-medium">{guest.name}</span>
                            {isRepeat && (
                                <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded-md font-medium">Repeat</span>
                            )}
                            {isNew && (
                                <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-md font-medium">New</span>
                            )}
                        </div>
                        {guest.email && <div className="text-sm text-gray-500 truncate">{guest.email}</div>}
                        {guest.phone && <div className="text-sm text-gray-500 truncate">{guest.phone}</div>}
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
                    <span className="text-xs text-gray-500 ml-1">
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
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="flex-1">
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                    <div 
                                        className={`h-1.5 rounded-full ${
                                            spentPercentage > 66 ? 'bg-green-500' :
                                            spentPercentage > 33 ? 'bg-yellow-500' : 
                                            'bg-gray-400'
                                        }`}
                                        style={{ width: `${spentPercentage}%` }}
                                    />
                                </div>
                            </div>
                            <span className="font-medium text-green-600 text-sm">
                                {formatCurrency(guest.periodSpent || 0)}
                            </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
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
            render: (guest: GuestListItem) => formatDateDisplay(new Date(guest.firstVisit))
        },
        {
            key: 'lastVisit',
            header: 'Last Visit',
            sortable: true,
            width: 120,
            render: (guest: GuestListItem) => formatDateDisplay(new Date(guest.lastVisit))
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
    ], [maxSpent, topPerformers, dateRangeFromRef])

    const sourceChartData = useMemo(() => {
        const sources = data?.metrics?.guestsBySource || []
        const totalGuests = sources.reduce((sum: number, s: GuestSourceData) => sum + s.count, 0)
        return sources.map((source: GuestSourceData, index: number) => ({
            ...source,
            totalGuests,
            color: getPlatformColor(source.source, index)
        }))
    }, [data?.metrics?.guestsBySource])

    const tagDistribution = useMemo(() => {
        if (data?.metrics?.tagDistribution && data.metrics.tagDistribution.length > 0) {
            return data.metrics.tagDistribution
        }

        if (!data?.guests || data.guests.length === 0) {
            return []
        }

        const tagCounts = new Map<string, { name: string; color?: string; count: number }>()

        data.guests.forEach((guest: GuestListItem) => {
            guest.tags?.forEach((tag) => {
                const existing = tagCounts.get(tag.id) || {
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
                name: tag.name || 'Unknown',
                size: tag.count || 0,
                value: tag.count || 0,
                color: getTagColor(tag)
            })) || [], [tagDistribution])

    // memoized pie chart totals
    const sourceChartTotal = useMemo(() =>
        sourceChartData.reduce((sum: number, item: GuestSourceData) => sum + (item.count || 0), 0)
    , [sourceChartData])

    // memoized pie chart label function
    const pieChartLabel = useCallback((entry: any) => {
        const percent = ((entry.count / sourceChartTotal) * 100).toFixed(0)
        const name = entry.source.length > 18 ? entry.source.substring(0, 18) + '...' : entry.source
        return parseInt(percent) > 5 ? `${name} (${percent}%)` : ''
    }, [sourceChartTotal])

    // memoized tag chart derived values
    const tagChartDerived = useMemo(() => {
        const maxCount = tagChartData.length > 0 ? Math.max(...tagChartData.map((t: any) => t.value)) : 0
        const totalTags = tagDistribution.reduce((sum: number, t: any) => sum + t.count, 0)
        return { maxCount, totalTags }
    }, [tagChartData, tagDistribution])

    if (isLoading || error || !data) {
        return (
            <StateWrapper
                loading={isLoading}
                error={error}
                empty={!data && !isLoading && !error}
                loadingMessage="Loading guest analytics..."
                emptyMessage="No guest data available"
                emptySubMessage="Guest data will appear once bookings are synced"
                emptyIcon={<Users className="w-12 h-12 text-gray-500 opacity-50 mb-2" />}
                onRetry={() => window.location.reload()}
                minHeight={400}
                className="py-12"
            >
                <div />
            </StateWrapper>
        )
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Guest Analytics</h2>
                        <p className="text-gray-600 text-sm mt-1">
                            Understand your guests and their booking patterns
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <div className="text-xs text-gray-500">Total Guests</div>
                            <div className="text-lg font-bold text-blue-600">
                                {data.metrics.totalGuests.toLocaleString()}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-gray-500">Repeat Rate</div>
                            <div className="text-lg font-bold text-gray-900">
                                {formatPercentage(data.metrics.repeatRate * 100, 0)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {showTips && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start">
                        <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
                        <div className="text-sm text-blue-800">
                            <strong>Guest Analysis:</strong> Metrics show guests who had bookings in the selected period.
                            Guest totals and spending reflect their activity during this timeframe only.
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
                    tooltip="Total unique guests who have stayed"
                    subValue={comparisonMode !== 'none' && previousData?.metrics
                        ? <>vs {comparisonLabel}: {previousData.metrics.totalGuests}{comparisonDateRange && <span className="block text-xs text-gray-400 mt-0.5">{comparisonDateRange}</span>}</>
                        : "In selected period"
                    }
                    trend={comparisonMode !== 'none' && previousData?.metrics ? {
                        value: previousData.metrics.totalGuests > 0
                            ? ((data.metrics.totalGuests - previousData.metrics.totalGuests) / previousData.metrics.totalGuests) * 100
                            : data.metrics.totalGuests > 0 ? 100 : 0,
                        isPositive: data.metrics.totalGuests > previousData.metrics.totalGuests
                    } : undefined}
                    color="blue"
                />
                <MetricCard
                    icon={UserCheck}
                    label="Repeat Rate"
                    value={data.metrics.repeatRate * 100}
                    format="percent"
                    tooltip="Percentage of returning guests"
                    subValue={comparisonMode !== 'none' && previousData?.metrics
                        ? <>vs {comparisonLabel}: {formatPercentage(previousData.metrics.repeatRate * 100, 0)} | {data.metrics.repeatGuests} returning{comparisonDateRange && <span className="block text-xs text-gray-400 mt-0.5">{comparisonDateRange}</span>}</>
                        : `${data.metrics.repeatGuests} returning guests`
                    }
                    color="green"
                    trend={comparisonMode !== 'none' && previousData?.metrics ? {
                        value: previousData.metrics.repeatRate > 0
                            ? ((data.metrics.repeatRate - previousData.metrics.repeatRate) / previousData.metrics.repeatRate) * 100
                            : data.metrics.repeatRate > 0 ? 100 : 0,
                        isPositive: data.metrics.repeatRate > previousData.metrics.repeatRate
                    } : undefined}
                />
                <MetricCard
                    icon={Calendar}
                    label="Average Stay"
                    value={`${data.metrics.avgStayLength.toFixed(1)} nights`}
                    format="custom"
                    tooltip="Average length of stay per booking"
                    subValue={comparisonMode !== 'none' && previousData?.metrics
                        ? <>vs {comparisonLabel}: {previousData.metrics.avgStayLength.toFixed(1)} nights{comparisonDateRange && <span className="block text-xs text-gray-400 mt-0.5">{comparisonDateRange}</span>}</>
                        : "Per booking"
                    }
                    trend={comparisonMode !== 'none' && previousData?.metrics ? {
                        value: previousData.metrics.avgStayLength > 0
                            ? ((data.metrics.avgStayLength - previousData.metrics.avgStayLength) / previousData.metrics.avgStayLength) * 100
                            : data.metrics.avgStayLength > 0 ? 100 : 0,
                        isPositive: data.metrics.avgStayLength > previousData.metrics.avgStayLength
                    } : undefined}
                    color="purple"
                />
                <MetricCard
                    icon={DollarSign}
                    label="Average Guest Value"
                    value={data.metrics.avgSpend}
                    format="currency"
                    subValue={comparisonMode !== 'none' && previousData?.metrics
                        ? <>vs {comparisonLabel}: {formatCurrency(previousData.metrics.avgSpend)}{comparisonDateRange && <span className="block text-xs text-gray-400 mt-0.5">{comparisonDateRange}</span>}</>
                        : "Per guest this period"
                    }
                    trend={comparisonMode !== 'none' && previousData?.metrics && previousData.metrics.avgSpend > 0 ? {
                        value: ((data.metrics.avgSpend - previousData.metrics.avgSpend) / previousData.metrics.avgSpend) * 100,
                        isPositive: data.metrics.avgSpend > previousData.metrics.avgSpend
                    } : undefined}
                    tooltip="Average spending per guest in selected period"
                    color="orange"
                />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                <ChartWrapper
                    title="Guest Sources"
                    subtitle="Where your guests come from"
                    icon={BarChart3}
                    height={280}
                    noData={sourceChartData.length === 0}
                >
                    <PieChart width={360} height={240}>
                        <Pie
                            data={sourceChartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={pieChartLabel}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="count"
                        >
                            {sourceChartData.map((entry: GuestSourceData & {color: string}, index: number) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip content={<GuestSourceTooltip />} />
                    </PieChart>
                </ChartWrapper>

                <ChartWrapper
                    title="Guest Tags"
                    subtitle="Most common guest categories"
                    icon={BarChart3}
                    height={320}
                    noData={!tagChartData || tagChartData.length === 0}
                    noDataMessage="No tag data available"
                >
                    <div className="space-y-3 overflow-y-auto max-h-[280px] pr-2">
                        {tagChartData.map((tag: any) => {
                            const percentage = tagChartDerived.maxCount > 0 ? (tag.value / tagChartDerived.maxCount) * 100 : 0
                            const overallPercent = tagChartDerived.totalTags > 0 ? ((tag.value / tagChartDerived.totalTags) * 100).toFixed(0) : '0'

                            return (
                                <div key={tag.name} className="flex items-center gap-3">
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium text-gray-700">{tag.name}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-gray-900">{tag.value} guests</span>
                                                <span className="text-xs text-gray-500">({overallPercent}%)</span>
                                            </div>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div 
                                                className="h-2 rounded-full transition-all"
                                                style={{ 
                                                    width: `${percentage}%`,
                                                    backgroundColor: getTagColor(tag)
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </ChartWrapper>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-4 border-b border-gray-200">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold">Guest List ({sortedGuests.length})</h3>
                        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                            <button
                                onClick={handleViewAll}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                                    viewMode === 'all'
                                        ? 'bg-white text-gray-900 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                All
                            </button>
                            <button
                                onClick={handleViewRepeat}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                                    viewMode === 'repeat'
                                        ? 'bg-white text-gray-900 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                Repeat
                            </button>
                            <button
                                onClick={handleViewNew}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                                    viewMode === 'new'
                                        ? 'bg-white text-gray-900 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                New
                            </button>
                            <button
                                onClick={handleViewTop}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                                    viewMode === 'top'
                                        ? 'bg-white text-gray-900 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                Top 20%
                            </button>
                        </div>
                    </div>
                    {viewMode !== 'all' && (
                        <div className="mt-2 text-xs text-gray-500">
                            {viewMode === 'repeat' && 'Showing guests with multiple bookings in this period'}
                            {viewMode === 'new' && 'Showing first-time guests in this period'}
                            {viewMode === 'top' && 'Showing top 20% of guests by spending in this period'}
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
                    pageSize={20}
                    enableSearch={true}
                    searchKeys={['name', 'email']}
                    showRowNumbers={true}
                    emptyMessage="No guests found for the selected criteria"
                />
            </div>
        </div>
    )
}
