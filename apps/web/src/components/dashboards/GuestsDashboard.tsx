import { useState, useMemo, useCallback } from 'react'
import { useDashboardBatch } from '@/hooks/use-api'
import { useTagIds, useErrorToast, getTimePeriodGranularity } from '@/hooks/use-dashboard-utils'
import { formatCurrency, formatDateDisplay, formatPercentage } from '@baileys/utils'
import { Users, UserCheck, Calendar, DollarSign, Info, Star } from 'lucide-react'
import { PaginatedTable } from '@/components/tables'
import { MetricCard } from '@/components/MetricCard'
import { ChartWrapper } from '@/components/ChartWrapper'
import { StateWrapper } from '@/components/StateWrapper'
import { CollapsibleTags } from '@/components/CollapsibleTags'
import { useModal } from '@/contexts/modal'
import { useDashboard } from '@/contexts/dashboard'
import { useTips } from '@/hooks/use-tips'
import { CHART_COLORS, getPlatformColor } from '@/lib/theme'
import { GuestListItem, GuestSourceData, GuestTagDistribution } from '@/types/api'
import {
    PieChart, Pie, Cell, Tooltip,
    Treemap, ResponsiveContainer
} from 'recharts'


export const GuestsDashboard = () => {
    const { openModal } = useModal()
    const { filters, comparisonRange, comparisonMode } = useDashboard()
    const { showTips } = useTips()

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

    const timePeriod = getTimePeriodGranularity(filters.dateRange.from, filters.dateRange.to)

    const [sortBy, setSortBy] = useState<string>('periodSpent')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
    const [viewMode, setViewMode] = useState<'all' | 'repeat' | 'new' | 'top'>('all')

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
        const isNew = new Date(guest.firstVisit) >= new Date(filters.dateRange.from)

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
    }, [openModal, topPerformers, filters.dateRange.from])

    const handleSort = useCallback((column: string) => {
        if (column === sortBy) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
        } else {
            setSortBy(column)
            setSortOrder('desc')
        }
    }, [sortBy])

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
                        {guest.email && <div className="text-sm text-gray-500">{guest.email}</div>}
                    </div>
                )
            }
        },
        {
            key: 'periodBookings',
            header: 'Bookings (Period)',
            sortable: true,
            width: 140,
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
            header: 'Spent (Period)',
            sortable: true,
            width: 150,
            render: (guest: GuestListItem) => (
                <div>
                    <span className="font-medium text-green-600">
                        {formatCurrency(guest.periodSpent || 0)}
                    </span>
                    <div className="text-xs text-gray-500">
                        Total: {formatCurrency(guest.totalSpent)}
                    </div>
                </div>
            )
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
            width: 350,
            render: (guest: GuestListItem) => (
                <CollapsibleTags
                    tags={guest.tags}
                    maxVisible={2}
                    size="sm"
                />
            )
        }
    ], [data, topPerformers, filters.dateRange.from])

    const sourceChartData = useMemo(() =>
        (data?.metrics?.guestsBySource || []).map((source: GuestSourceData, index: number) => ({
            ...source,
            color: getPlatformColor(source.source, index)
        })), [data?.metrics?.guestsBySource])

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
            ?.slice(0, 15) // Show more tags in treemap
            .map((tag: GuestTagDistribution, index: number) => ({
                name: tag.name || 'Unknown',
                size: tag.count || 0, // Treemap uses 'size' instead of 'value'
                value: tag.count || 0, // Keep for tooltip
                color: tag.color || CHART_COLORS[index % CHART_COLORS.length]
            })) || [], [tagDistribution])

    if (isLoading || !data) {
        return (
            <StateWrapper
                loading={isLoading}
                empty={!data && !isLoading}
                loadingMessage="Loading guest analytics..."
                emptyMessage="No guest data available"
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

            <div className="grid md:grid-cols-4 gap-4">
                <MetricCard
                    icon={Users}
                    label="Total Guests"
                    value={data.metrics.totalGuests}
                    format="number"
                    tooltip="Total unique guests who have stayed"
                    subValue={comparisonMode !== 'none' && previousData?.metrics
                        ? `vs ${comparisonMode === 'previous-year' ? 'last year' : 'previous period'}: ${previousData.metrics.totalGuests} | In period`
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
                        ? `vs ${comparisonMode === 'previous-year' ? 'last year' : 'previous period'}: ${formatPercentage(previousData.metrics.repeatRate * 100, 0)} | ${data.metrics.repeatGuests} returning`
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
                        ? `vs ${comparisonMode === 'previous-year' ? 'last year' : 'previous period'}: ${previousData.metrics.avgStayLength.toFixed(1)} nights`
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
                        ? `vs ${comparisonMode === 'previous-year' ? 'last year' : 'previous period'}: ${formatCurrency(previousData.metrics.avgSpend)}`
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

            <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold">Top Spenders This Period</h3>
                        <DollarSign className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="space-y-3">
                        {topPerformers.spenders.slice(0, 5).map((guest: GuestListItem, index: number) => (
                            <div
                                key={guest.id}
                                className="flex justify-between items-center p-3 border rounded-sm hover:bg-gray-50 cursor-pointer transition-colors"
                                onClick={() => handleGuestClick(guest)}
                            >
                                <div className="flex items-center">
                                    <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm font-bold mr-3">
                                        {index + 1}
                                    </div>
                                    <div>
                                        <div className="font-medium">{guest.name}</div>
                                        <div className="text-sm text-gray-500">
                                            {guest.periodBookings || 0} bookings this period
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-medium text-green-600">
                                        {formatCurrency(guest.periodSpent || 0)}
                                    </div>
                                    <div className="text-xs text-gray-500">this period</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold">Most Frequent This Period</h3>
                        <Star className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="space-y-3">
                        {topPerformers.frequent.slice(0, 5).map((guest: GuestListItem, index: number) => (
                            <div
                                key={guest.id}
                                className="flex justify-between items-center p-3 border rounded-sm hover:bg-gray-50 cursor-pointer transition-colors"
                                onClick={() => handleGuestClick(guest)}
                            >
                                <div className="flex items-center">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold mr-3">
                                        {index + 1}
                                    </div>
                                    <div>
                                        <div className="font-medium">{guest.name}</div>
                                        <div className="text-sm text-gray-500">
                                            {formatCurrency(guest.avgNightlyRate)}/night avg
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-medium text-blue-600">
                                        {guest.periodBookings || 0} bookings
                                    </div>
                                    <div className="text-xs text-gray-500">this period</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <ChartWrapper
                    title={`Guest Sources${timePeriod}`}
                    subtitle={comparisonMode !== 'none' ? `Current period distribution` : undefined}
                    height={320}
                    noData={sourceChartData.length === 0}
                >
                    <PieChart>
                        <Pie
                            data={sourceChartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={(props) => {
                                const entry = props as any // Recharts PieLabelProps type mismatch
                                const total = sourceChartData.reduce((sum: number, item: GuestSourceData) => sum + (item.count || 0), 0)
                                const percent = ((entry.count / total) * 100).toFixed(0)
                                return `${entry.source} ${percent}%`
                            }}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="count"
                        >
                            {sourceChartData.map((entry: GuestSourceData & {color: string}, index: number) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip formatter={(value) => `${value} guests`} />
                    </PieChart>
                </ChartWrapper>

                <ChartWrapper
                    title={`Guest Tags Distribution${timePeriod}`}
                    height={320}
                    noData={!tagChartData || tagChartData.length === 0}
                    noDataMessage="No tag data available"
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <Treemap
                            data={tagChartData}
                            dataKey="size"
                            aspectRatio={4 / 3}
                            stroke="#fff"
                            fill="#8884d8"
                            isAnimationActive={false}
                            content={({ x, y, width, height, index, name, color }: any) => (
                                <g>
                                    <rect
                                        x={x}
                                        y={y}
                                        width={width}
                                        height={height}
                                        fill={color || CHART_COLORS[index % CHART_COLORS.length]}
                                        stroke="#fff"
                                        strokeWidth={2}
                                    />
                                    {width > 50 && height > 30 && (
                                        <text
                                            x={x + width / 2}
                                            y={y + height / 2}
                                            textAnchor="middle"
                                            fill="white"
                                            fontSize={12}
                                            dominantBaseline="middle"
                                        >
                                            {name}
                                        </text>
                                    )}
                                </g>
                            )}
                        >
                            <Tooltip
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload
                                        return (
                                            <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-gray-200">
                                                <p className="font-semibold text-sm">{data.name}</p>
                                                <p className="text-xs text-gray-600">{data.value} guests</p>
                                                <p className="text-xs text-gray-500">
                                                    {((data.value / tagDistribution.reduce((sum: number, t: any) => sum + t.count, 0)) * 100).toFixed(1)}% of tagged guests
                                                </p>
                                            </div>
                                        )
                                    }
                                    return null
                                }}
                            />
                        </Treemap>
                    </ResponsiveContainer>
                </ChartWrapper>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-4 border-b">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold">Guest List ({sortedGuests.length})</h3>
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => setViewMode('all')}
                                className={`px-3 py-1 rounded-sm text-sm ${
                                    viewMode === 'all'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-200 hover:bg-gray-300'
                                }`}
                            >
                                All
                            </button>
                            <button
                                onClick={() => setViewMode('repeat')}
                                className={`px-3 py-1 rounded-sm text-sm ${
                                    viewMode === 'repeat'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-200 hover:bg-gray-300'
                                }`}
                            >
                                Repeat
                            </button>
                            <button
                                onClick={() => setViewMode('new')}
                                className={`px-3 py-1 rounded-sm text-sm ${
                                    viewMode === 'new'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-200 hover:bg-gray-300'
                                }`}
                            >
                                New
                            </button>
                            <button
                                onClick={() => setViewMode('top')}
                                className={`px-3 py-1 rounded-sm text-sm ${
                                    viewMode === 'top'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-200 hover:bg-gray-300'
                                }`}
                            >
                                Top 20%
                            </button>
                        </div>
                    </div>
                    {viewMode !== 'all' && (
                        <div className="mt-2 text-xs text-gray-600">
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
                    enableRefresh={true}
                    onRefresh={() => window.location.reload()}
                    showRowNumbers={true}
                    emptyMessage="No guests found for the selected criteria"
                />
            </div>
        </div>
    )
}
