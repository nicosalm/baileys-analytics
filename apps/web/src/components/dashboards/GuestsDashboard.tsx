import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { formatCurrency, formatPercentage, ensureNumber, isValidDateRange } from '@baileys/utils'
import { Users, UserCheck, Calendar, DollarSign } from 'lucide-react'
import { Spinner } from '@/components/Spinner'
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

const GuestRow = ({
    guest,
    onGuestClick,
    onTagClick
}: {
        guest: GuestListItem
        onGuestClick: (guest: GuestListItem) => void
        onTagClick: (tag: GuestListItem['tags'][0]) => void
    }) => (
        <tr
            className="border-b hover:bg-gray-50 cursor-pointer"
            onClick={() => onGuestClick(guest)}
        >
            <td className="py-3 px-4">
                <div className="font-medium">{guest.name}</div>
                {guest.email && <div className="text-sm text-gray-500">{guest.email}</div>}
            </td>
            <td className="py-3 px-4 text-center">{guest.bookingCount}</td>
            <td className="py-3 px-4 text-right">{formatCurrency(guest.totalSpent)}</td>
            <td className="py-3 px-4 text-right">{formatCurrency(guest.avgNightlyRate)}</td>
            <td className="py-3 px-4">
                <div className="text-sm">
                    <div>{new Date(guest.firstVisit).toLocaleDateString()}</div>
                    <div className="text-gray-500">{new Date(guest.lastVisit).toLocaleDateString()}</div>
                </div>
            </td>
            <td className="py-3 px-4">
                <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                    {guest.tags.map(tag => {
                        const style = tag.color ? {
                            backgroundColor: `${tag.color}20`,
                            color: tag.color,
                            borderColor: tag.color
                        } : undefined

                        return tag.color ? (
                            <span
                                key={tag.id}
                                className="px-2 py-0.5 text-xs rounded-full border cursor-pointer hover:opacity-80"
                                style={style}
                                onClick={() => onTagClick(tag)}
                            >
                                {tag.name}
                            </span>
                        ) : (
                                <span
                                    key={tag.id}
                                    className={`px-2 py-0.5 text-xs rounded-full border cursor-pointer hover:opacity-80 ${
                                        tag.type === 'payment' ? 'bg-green-100 text-green-800 border-green-300' :
                                        tag.type === 'guest' ? 'bg-purple-100 text-purple-800 border-purple-300' :
                                        'bg-gray-100 text-gray-800 border-gray-300'
                                        }`}
                                    onClick={() => onTagClick(tag)}
                                >
                                    {tag.name}
                                </span>
                            )
                    })}
                </div>
            </td>
        </tr>
    )

export const GuestsDashboard = () => {
    const { addToast } = useToast()
    const { dispatch } = useDrillDown()
    const { filters } = useDashboard()
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState<GuestsData | null>(null)
    const [sortBy, setSortBy] = useState<'name' | 'bookings' | 'spent' | 'recent'>('spent')
    const [filterTag, setFilterTag] = useState<string | null>(null)

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

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Spinner size="lg" />
            </div>
        )
    }

    if (!data) return null

    const handleGuestClick = (guest: GuestListItem) => {
        dispatch({
            type: 'DRILL_TO_GUEST',
            guestId: guest.id,
            guestName: guest.name
        })
    }

    const handleTagFilter = (tag: GuestListItem['tags'][0]) => {
        setFilterTag(filterTag === tag.id ? null : tag.id)
    }

    const sortedGuests = [...data.guests].sort((a, b) => {
        switch (sortBy) {
            case 'name':
                return a.name.localeCompare(b.name)
            case 'bookings':
                return b.bookingCount - a.bookingCount
            case 'spent':
                return b.totalSpent - a.totalSpent
            case 'recent':
                return new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime()
            default:
                return 0
        }
    })

    const filteredGuests = filterTag
        ? sortedGuests.filter(g => g.tags.some(t => t.id === filterTag))
        : sortedGuests

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
                                <Bar
                                    dataKey="value"
                                    fill="#3B82F6"
                                    cursor="pointer"
                                    onClick={(data: any) => setFilterTag(
                                        filterTag === data.name ? null : data.name
                                    )}
                                />
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

            <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">All Guests</h3>
                    <div className="flex items-center space-x-4">
                        {filterTag && (
                            <button
                                onClick={() => setFilterTag(null)}
                                className="text-sm text-blue-600 hover:underline"
                            >
                                Clear filter
                            </button>
                        )}
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                            className="px-3 py-1 border rounded text-sm"
                        >
                            <option value="spent">Top Spenders</option>
                            <option value="bookings">Most Bookings</option>
                            <option value="recent">Most Recent</option>
                            <option value="name">Name (A-Z)</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-2 px-4">Guest</th>
                                <th className="text-center py-2 px-4">Bookings</th>
                                <th className="text-right py-2 px-4">Total Spent</th>
                                <th className="text-right py-2 px-4">Avg/Night</th>
                                <th className="text-left py-2 px-4">First/Last Visit</th>
                                <th className="text-left py-2 px-4">Tags</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredGuests.map(guest => (
                                <GuestRow
                                    key={guest.id}
                                    guest={guest}
                                    onGuestClick={handleGuestClick}
                                    onTagClick={handleTagFilter}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
