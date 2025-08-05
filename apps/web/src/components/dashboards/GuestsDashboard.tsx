import { useState, useEffect, useMemo, useCallback } from 'react'
import { api } from '@/lib/api'
import { formatCurrency, formatPercentage, ensureNumber, isValidDateRange } from '@baileys/utils'
import { Users, UserCheck, Calendar, DollarSign } from 'lucide-react'
import { Spinner } from '@/components/Spinner'
import { VirtualTable } from '@/components/VirtualTable'
import { useToast } from '@/contexts/toast'
import { useDrillDown } from '@/contexts/drillDown'
import { useDashboard } from '@/contexts/dashboard'
import {
    BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

type GuestTag = {
    id: string
    name: string
    type: string
    color?: string
    count: number
}

type GuestMetrics = {
    totalGuests: number
    repeatGuests: number
    repeatRate: number
    avgStayLength: number
    avgSpend: number
    totalRevenue: number
    topSpenders: Array<{
        id: string
        name: string
        email?: string
        totalSpent: number
        bookingCount: number
        avgNightlyRate: number
    }>
    guestsBySource: Array<{
        source: string
        count: number
        revenue: number
    }>
    tagDistribution: Array<GuestTag>
}

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
        type: string
        color?: string
    }>
}

type GuestsData = {
    metrics: GuestMetrics
    guests: GuestListItem[]
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6']

const MetricsCard = ({
    icon: Icon,
    label,
    value,
    subtext
}: {
    icon: React.ComponentType<{ className?: string }>
    label: string
    value: string | number
    subtext?: string
}) => (
    <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center text-sm text-gray-600 mb-2">
            <Icon className="w-4 h-4 mr-1" />
            {label}
        </div>
        <div className="text-3xl font-bold">{value}</div>
        {subtext && <div className="text-sm text-gray-500 mt-1">{subtext}</div>}
    </div>
)

export const GuestsDashboard = () => {
    const { addToast } = useToast()
    const { dispatch } = useDrillDown()
    const { filters } = useDashboard()
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState<GuestsData | null>(null)
    const [sortBy, setSortBy] = useState<string>('totalSpent')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
    const [selectedGuests, setSelectedGuests] = useState<Set<string>>(new Set())
    const [viewMode, setViewMode] = useState<'all' | 'vip' | 'repeat'>('all')

    const loadGuestsData = async () => {
        if (!isValidDateRange(filters.dateRange.from, filters.dateRange.to)) {
            addToast('error', 'Invalid date range selected')
            return
        }

        setLoading(true)

        const result = await api.getGuests(
            filters.dateRange.from,
            filters.dateRange.to,
            filters.selectedTags.map(t => t.id)
        )

        if (result.success) {
            setData(result.data)
        } else {
            addToast('error', 'Failed to load guests data')
        }
        setLoading(false)
    }

    useEffect(() => {
        loadGuestsData()
    }, [filters.dateRange, filters.selectedTags])

    // Filter guests based on view mode
    const filteredGuests = useMemo(() => {
        if (!data) return []

        let filtered = [...data.guests]

        switch (viewMode) {
            case 'vip':
                filtered = filtered.filter(g => g.totalSpent > 5000 || g.bookingCount > 5)
                break
            case 'repeat':
                filtered = filtered.filter(g => g.bookingCount > 1)
                break
        }

        return filtered
    }, [data, viewMode])

    // Sort guests
    const sortedGuests = useMemo(() => {
        return [...filteredGuests].sort((a, b) => {
            const aVal = a[sortBy as keyof typeof a]
            const bVal = b[sortBy as keyof typeof b]

            // Handle undefined values
            if (aVal === undefined && bVal === undefined) return 0
            if (aVal === undefined) return 1
            if (bVal === undefined) return -1

            if (sortOrder === 'asc') {
                return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
            }
            return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
        })
    }, [filteredGuests, sortBy, sortOrder])

    // Handle guest click
    const handleGuestClick = useCallback((guest: GuestListItem) => {
        dispatch({
            type: 'DRILL_TO_GUEST',
            guestId: guest.id,
            guestName: guest.name
        })
    }, [dispatch])

    // Handle sort
    const handleSort = useCallback((column: string) => {
        if (column === sortBy) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
        } else {
            setSortBy(column)
            setSortOrder('desc')
        }
    }, [sortBy])

    // Handle export
    const handleExport = useCallback(() => {
        const exportData = selectedGuests.size > 0
            ? sortedGuests.filter(g => selectedGuests.has(g.id))
            : sortedGuests

        // Convert to CSV
        const headers = ['Name', 'Email', 'Bookings', 'Total Spent', 'Avg/Night', 'First Visit', 'Last Visit']
        const rows = exportData.map(g => [
            g.name,
            g.email || '',
            g.bookingCount,
            g.totalSpent,
            g.avgNightlyRate,
            new Date(g.firstVisit).toLocaleDateString(),
            new Date(g.lastVisit).toLocaleDateString()
        ])

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `guests-export-${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)

        addToast('success', `Exported ${exportData.length} guests`)
    }, [selectedGuests, sortedGuests, addToast])

    // Define columns for VirtualTable
    const columns = useMemo(() => [
        {
            key: 'name',
            header: 'Guest',
            sortable: true,
            width: 250,
            render: (guest: GuestListItem) => (
                <div>
                    <div className="font-medium">{guest.name}</div>
                    {guest.email && <div className="text-sm text-gray-500">{guest.email}</div>}
                </div>
            )
        },
        {
            key: 'bookingCount',
            header: 'Bookings',
            sortable: true,
            width: 100,
            render: (guest: GuestListItem) => (
                <span className="font-medium">{guest.bookingCount}</span>
            )
        },
        {
            key: 'totalSpent',
            header: 'Total Spent',
            sortable: true,
            width: 150,
            render: (guest: GuestListItem) => (
                <span className="font-medium text-green-600">
                    {formatCurrency(guest.totalSpent)}
                </span>
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
            width: 200,
            render: (guest: GuestListItem) => (
                <div className="flex flex-wrap gap-1">
                    {guest.tags.slice(0, 3).map(tag => {
                        const style = tag.color ? {
                            backgroundColor: `${tag.color}20`,
                            color: tag.color,
                            borderColor: tag.color
                        } : undefined

                        return tag.color ? (
                            <span
                                key={tag.id}
                                className="px-2 py-0.5 text-xs rounded-full border"
                                style={style}
                            >
                                {tag.name}
                            </span>
                        ) : (
                            <span
                                key={tag.id}
                                className={`px-2 py-0.5 text-xs rounded-full border ${
                                    tag.type === 'payment' ? 'bg-green-100 text-green-800 border-green-300' :
                                    tag.type === 'guest' ? 'bg-purple-100 text-purple-800 border-purple-300' :
                                    'bg-gray-100 text-gray-800 border-gray-300'
                                }`}
                            >
                                {tag.name}
                            </span>
                        )
                    })}
                    {guest.tags.length > 3 && (
                        <span className="text-xs text-gray-500">+{guest.tags.length - 3}</span>
                    )}
                </div>
            )
        }
    ], [])

    if (loading && !data) {
        return (
            <div className="flex justify-center py-12">
                <Spinner size="lg" />
            </div>
        )
    }

    if (!data) return null

    const sourceChartData = data.metrics.guestsBySource.map((source, index) => ({
        ...source,
        color: COLORS[index % COLORS.length]
    }))

    const tagChartData = data.metrics.tagDistribution
        .slice(0, 10)
        .map((tag, index) => ({
            name: tag.name,
            value: tag.count,
            color: tag.color || COLORS[index % COLORS.length]
        }))

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Guest Analytics</h2>

            <div className="grid md:grid-cols-4 gap-4">
                <MetricsCard
                    icon={Users}
                    label="Total Guests"
                    value={data.metrics.totalGuests}
                />
                <MetricsCard
                    icon={UserCheck}
                    label="Repeat Guests"
                    value={data.metrics.repeatGuests}
                    subtext={`${formatPercentage(data.metrics.repeatRate * 100, 0)} repeat rate`}
                />
                <MetricsCard
                    icon={Calendar}
                    label="Avg Stay Length"
                    value={`${data.metrics.avgStayLength.toFixed(1)} nights`}
                />
                <MetricsCard
                    icon={DollarSign}
                    label="Avg Guest Spend"
                    value={formatCurrency(data.metrics.avgSpend)}
                />
            </div>

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
                                    label={(entry) =>
                                        `${entry.source} ${formatPercentage((entry.percent || 0) * 100, 0)}`
                                    }
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="count"
                                >
                                    {sourceChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => value} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-bold mb-4">Top Spenders</h3>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                        {data.metrics.topSpenders.slice(0, 10).map((guest, index) => (
                            <div
                                key={guest.id}
                                className="flex justify-between items-center p-3 border rounded hover:bg-gray-50 cursor-pointer"
                                onClick={() => dispatch({
                                    type: 'DRILL_TO_GUEST',
                                    guestId: guest.id,
                                    guestName: guest.name
                                })}
                            >
                                <div className="flex items-center">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold mr-3">
                                        {index + 1}
                                    </div>
                                    <div>
                                        <div className="font-medium">{guest.name}</div>
                                        <div className="text-sm text-gray-500">{guest.bookingCount} bookings</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-medium">{formatCurrency(guest.totalSpent)}</div>
                                    <div className="text-sm text-gray-500">{formatCurrency(guest.avgNightlyRate)}/night</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-bold mb-4">Tag Distribution</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={tagChartData} layout="horizontal">
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" />
                                <YAxis dataKey="name" type="category" width={100} />
                                <Tooltip />
                                <Bar dataKey="value" fill="#3B82F6" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-bold mb-4">Revenue by Guest Source</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={sourceChartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="source" />
                                <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                                <Tooltip formatter={(value) => formatCurrency(ensureNumber(value))} />
                                <Bar dataKey="revenue" fill="#10B981" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold">All Guests ({sortedGuests.length})</h3>
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
                                onClick={() => setViewMode('vip')}
                                className={`px-3 py-1 rounded text-sm ${
                                    viewMode === 'vip'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-200 hover:bg-gray-300'
                                }`}
                            >
                                VIP
                            </button>
                        </div>
                    </div>
                </div>

                <VirtualTable
                    data={sortedGuests}
                    columns={columns}
                    height={600}
                    loading={loading}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                    onRowClick={handleGuestClick}
                    getRowId={(guest) => guest.id}
                    enablePagination={sortedGuests.length > 100}
                    pageSize={50}
                    enableSearch={true}
                    searchKeys={['name', 'email']}
                    enableExport={true}
                    onExport={handleExport}
                    enableRefresh={true}
                    onRefresh={loadGuestsData}
                    showRowNumbers={true}
                    selectable={true}
                    selectedRows={selectedGuests}
                    onSelectionChange={setSelectedGuests}
                    emptyMessage="No guests found"
                    rowClassName={(guest) => {
                        if (guest.totalSpent > 10000) return 'bg-yellow-50'
                        if (guest.bookingCount > 10) return 'bg-purple-50'
                        return ''
                    }}
                />
            </div>
        </div>
    )
}
