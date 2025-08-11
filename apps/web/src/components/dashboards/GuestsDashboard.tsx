import { useState, useMemo, useCallback, useEffect } from 'react'
import { useGuests } from '@/hooks/use-api'
import { formatCurrency, formatPercentage } from '@baileys/utils'
import { Users, UserCheck, Calendar, DollarSign, Info, Star, Award } from 'lucide-react'
import { Spinner } from '@/components/Spinner'
import { VirtualTable } from '@/components/VirtualTable'
import { CollapsibleTags } from '@/components/CollapsibleTags'
import { useToast } from '@/contexts/toast'
import { useModal } from '@/contexts/modal'
import { useDashboard } from '@/contexts/dashboard'
import { CHART_COLORS, METRIC_COLORS } from '@/lib/theme'
import {
    BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

type GuestListItem = {
    id: string
    name: string
    email?: string
    firstVisit: string
    lastVisit: string
    bookingCount: number
    totalSpent: number
    avgNightlyRate: number
    properties: string[]
    tags: Array<{
        id: string
        name: string
        color?: string
    }>
    // New fields for period-specific data
    periodBookings?: number
    periodSpent?: number
}

const MetricsCard = ({
    icon: Icon,
    label,
    value,
    subtext,
    tooltip
}: {
    icon: React.ComponentType<{ className?: string }>
    label: string
    value: string | number
    subtext?: string
    tooltip?: string
}) => (
    <div className="bg-white p-6 rounded-lg shadow" title={tooltip}>
        <div className="flex items-center text-sm text-gray-600 mb-2">
            <Icon className="w-4 h-4 mr-1" />
            {label}
        </div>
        <div className="text-3xl font-bold">{value}</div>
        {subtext && <div className="text-sm text-gray-500 mt-1">{subtext}</div>}
    </div>
)

// New badge for top performers in the selected period
const PerformanceBadge = ({ type }: {
    type: 'spender' | 'frequent' | 'new'
}) => {
    const badges = {
        spender: { color: 'bg-green-100 text-green-800', icon: DollarSign, label: 'Top Spender' },
        frequent: { color: 'bg-blue-100 text-blue-800', icon: Star, label: 'Frequent' },
        new: { color: 'bg-purple-100 text-purple-800', icon: Award, label: 'New Guest' }
    }
    
    const badge = badges[type]
    const Icon = badge.icon
    
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.color}`}>
            <Icon className="w-3 h-3 mr-1" />
            {badge.label}
        </span>
    )
}

export const GuestsDashboard = () => {
    const { addToast } = useToast()
    const { openModal } = useModal()
    const { filters } = useDashboard()
    
    const { data, error, isLoading } = useGuests(
        filters.dateRange.from,
        filters.dateRange.to,
        filters.selectedTags.map(t => t.id)
    )
    const [sortBy, setSortBy] = useState<string>('periodSpent')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
    const [selectedGuests, setSelectedGuests] = useState<Set<string>>(new Set())
    const [viewMode, setViewMode] = useState<'all' | 'repeat' | 'new' | 'top'>('all')

    // Handle error state
    useEffect(() => {
        if (error) {
            addToast('error', 'Failed to load guests data')
        }
    }, [error?.message, addToast])

    // Calculate top performers for the selected period
    const topPerformers = useMemo(() => {
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
                // Guests whose first visit is within the selected date range
                filtered = filtered.filter(g => {
                    const firstVisit = new Date(g.firstVisit)
                    const rangeStart = new Date(filters.dateRange.from)
                    return firstVisit >= rangeStart
                })
                break
            case 'top':
                // Top 20% by spending in this period
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
        openModal({
            type: 'guest',
            guestId: guest.id,
            guestName: guest.name
        })
    }, [openModal])

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
                const isTopSpender = topPerformers.spenders.some(g => g.id === guest.id)
                const isFrequent = topPerformers.frequent.some(g => g.id === guest.id)
                const isNew = new Date(guest.firstVisit) >= new Date(filters.dateRange.from)
                
                return (
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-medium">{guest.name}</span>
                            {isTopSpender && <PerformanceBadge type="spender" />}
                            {!isTopSpender && isFrequent && <PerformanceBadge type="frequent" />}
                            {!isTopSpender && !isFrequent && isNew && <PerformanceBadge type="new" />}
                        </div>
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
            header: 'Avg/Night',
            sortable: true,
            width: 120,
            render: (guest: GuestListItem) => formatCurrency(guest.avgNightlyRate)
        },
        {
            key: 'firstVisit',
            header: 'First Visit',
            sortable: true,
            width: 120,
            render: (guest: GuestListItem) => new Date(guest.firstVisit).toLocaleDateString()
        },
        {
            key: 'lastVisit',
            header: 'Last Visit',
            sortable: true,
            width: 120,
            render: (guest: GuestListItem) => new Date(guest.lastVisit).toLocaleDateString()
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

    if (isLoading && !data) {
        return (
            <div className="flex justify-center py-12">
                <Spinner size="lg" />
            </div>
        )
    }

    if (!data) return null

    const sourceChartData = data.metrics.guestsBySource.map((source: any, index: any) => ({
        ...source,
        color: CHART_COLORS[index % CHART_COLORS.length]
    }))

    // Calculate tag distribution
    const calculateTagDistribution = () => {
        if (data.metrics.tagDistribution && data.metrics.tagDistribution.length > 0) {
            return data.metrics.tagDistribution
        }

        const tagCounts = new Map<string, { name: string; color?: string; count: number }>()

        data.guests.forEach((guest: any) => {
            guest.tags?.forEach((tag: any) => {
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
    }

    const tagDistribution = calculateTagDistribution()
    const tagChartData = tagDistribution
        ?.slice(0, 10)
        .map((tag: any, index: any) => ({
            name: tag.name || 'Unknown',
            value: tag.count || 0,
            color: tag.color || CHART_COLORS[index % CHART_COLORS.length]
        })) || []

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold">Guest Analytics</h2>
                <p className="text-gray-600 text-sm mt-1">
                    Understand your guests and their booking patterns
                </p>
            </div>

            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                    <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
                    <div className="text-sm text-blue-800">
                        <strong>Period Analysis:</strong> All metrics reflect the selected date range. 
                        "Top Performers" are based on activity within this period, not lifetime values.
                    </div>
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid md:grid-cols-4 gap-4">
                <MetricsCard
                    icon={Users}
                    label="Active Guests"
                    value={data.metrics.totalGuests}
                    subtext="In selected period"
                    tooltip="Guests with bookings in the selected date range"
                />
                <MetricsCard
                    icon={UserCheck}
                    label="Repeat Rate"
                    value={`${formatPercentage(data.metrics.repeatRate * 100, 0)}`}
                    subtext={`${data.metrics.repeatGuests} returning guests`}
                    tooltip="Percentage of guests with multiple bookings"
                />
                <MetricsCard
                    icon={Calendar}
                    label="Avg Stay"
                    value={`${data.metrics.avgStayLength.toFixed(1)} nights`}
                    subtext="Per booking"
                    tooltip="Average length of stay per reservation"
                />
                <MetricsCard
                    icon={DollarSign}
                    label="Avg Guest Value"
                    value={formatCurrency(data.metrics.avgSpend)}
                    subtext="Per guest this period"
                    tooltip="Average spending per guest in selected period"
                />
            </div>

            {/* Top Performers Section */}
            <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold">Top Spenders This Period</h3>
                        <DollarSign className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="space-y-3">
                        {topPerformers.spenders.slice(0, 5).map((guest: any, index: any) => (
                            <div
                                key={guest.id}
                                className="flex justify-between items-center p-3 border rounded hover:bg-gray-50 cursor-pointer transition-colors"
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

                <div className="bg-white p-6 rounded-lg shadow">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold">Most Frequent This Period</h3>
                        <Star className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="space-y-3">
                        {topPerformers.frequent.slice(0, 5).map((guest: any, index: any) => (
                            <div
                                key={guest.id}
                                className="flex justify-between items-center p-3 border rounded hover:bg-gray-50 cursor-pointer transition-colors"
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

            {/* Charts Section */}
            <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-bold mb-4">Guest Sources</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={sourceChartData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={(entry: any) =>
                                        `${entry.source} ${formatPercentage((entry.percent || 0) * 100, 0)}`
                                    }
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="count"
                                >
                                    {sourceChartData.map((entry: any, index: any) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => `${value} guests`} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-bold mb-4">Guest Tags Distribution</h3>
                    {tagChartData && tagChartData.length > 0 ? (
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={tagChartData.slice(0, 8)}
                                    margin={{ top: 20, right: 20, left: 20, bottom: 60 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis
                                        dataKey="name"
                                        angle={-45}
                                        textAnchor="end"
                                        height={100}
                                        interval={0}
                                        tick={{ fontSize: 10 }}
                                    />
                                    <YAxis tick={{ fontSize: 12 }} />
                                    <Tooltip
                                        formatter={(value: any) => [`${value} guests`, 'Count']}
                                    />
                                    <Bar dataKey="value" fill={METRIC_COLORS.revenue}>
                                        {tagChartData.map((entry: any, index: any) => (
                                            <Cell key={`cell-${index}`} fill={entry.color || METRIC_COLORS.revenue} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-80 text-gray-500">
                            <div className="text-4xl mb-2">🏷️</div>
                            <p className="text-sm">No tag data available</p>
                            <p className="text-xs mt-2">Tag guests to see distribution</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Guest Table */}
            <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold">Guest List ({sortedGuests.length})</h3>
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => setViewMode('all')}
                                className={`px-3 py-1 rounded text-sm ${
                                    viewMode === 'all'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-200 hover:bg-gray-300'
                                }`}
                            >
                                All
                            </button>
                            <button
                                onClick={() => setViewMode('repeat')}
                                className={`px-3 py-1 rounded text-sm ${
                                    viewMode === 'repeat'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-200 hover:bg-gray-300'
                                }`}
                            >
                                Repeat
                            </button>
                            <button
                                onClick={() => setViewMode('new')}
                                className={`px-3 py-1 rounded text-sm ${
                                    viewMode === 'new'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-200 hover:bg-gray-300'
                                }`}
                            >
                                New
                            </button>
                            <button
                                onClick={() => setViewMode('top')}
                                className={`px-3 py-1 rounded text-sm ${
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

                <VirtualTable
                    data={sortedGuests}
                    columns={columns}
                    height={600}
                    loading={isLoading}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                    onRowClick={handleGuestClick}
                    getRowId={(guest) => guest.id}
                    enablePagination={sortedGuests.length > 100}
                    pageSize={50}
                    enableSearch={true}
                    searchKeys={['name', 'email']}
                    enableRefresh={true}
                    onRefresh={() => window.location.reload()}
                    showRowNumbers={true}
                    selectable={true}
                    selectedRows={selectedGuests}
                    onSelectionChange={setSelectedGuests}
                    emptyMessage="No guests found for the selected criteria"
                    rowClassName={() => ''}
                />
            </div>
        </div>
    )
}