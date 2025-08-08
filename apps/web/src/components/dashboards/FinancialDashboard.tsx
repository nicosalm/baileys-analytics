import { useState, useEffect, useMemo, useCallback } from 'react'
import { api } from '@/lib/api'
import { isValidDateRange, formatCurrency, formatCompactCurrency, calculatePercentage, safeDivide, formatPercentage, sumBy } from '@baileys/utils'
import {
    DollarSign, TrendingUp, Wallet, Download, AlertCircle, Calendar
} from 'lucide-react'
import { Spinner } from '@/components/Spinner'
import { VirtualTable } from '@/components/VirtualTable'
import { useToast } from '@/contexts/toast'
import { useDashboard } from '@/contexts/dashboard'
import { CHART_COLORS, METRIC_COLORS } from '@/lib/theme'
import {
    Line, Bar, BarChart, LineChart,
    PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

type FinancialMetrics = {
    revenue: {
        gross: number
        net: number
        pending: number
        collected: number
        platformFees: number
        taxes: number
    }
    performance: {
        netRevenueRate: number // Percentage kept after fees (not "profit")
        avgBookingValue: number
        totalBookings: number
    }
    upcoming: {
        next30Days: number  // Actual confirmed bookings
        next60Days: number
        next90Days: number
    }
    kpis: {
        revpar: number
        adr: number // Average Daily Rate
        collectionRate: number
    }
}

type WeeklyRevenue = {
    week: string
    revenue: number
    bookings: number
}

type PlatformFinancials = {
    platform: string
    grossRevenue: number
    fees: number
    netRevenue: number
    feeRate: number
    bookingCount: number
}

type MonthlyTrend = {
    month: string
    revenue: number
    bookings: number
    avgBookingValue: number
}

type FinancialData = {
    metrics: FinancialMetrics
    weeklyRevenue: WeeklyRevenue[]
    platforms: PlatformFinancials[]
    monthlyTrend: MonthlyTrend[]
    previousPeriod?: {
        revenue: {
            gross: number
            net: number
        }
        performance: {
            netRevenueRate: number
        }
    }
}

const MetricCard = ({
    icon: Icon,
    label,
    value,
    previousValue,
    format = 'currency',
    loading = false,
    color = 'blue'
}: {
    icon: React.ComponentType<{ className?: string }>
    label: string
    value: number
    previousValue?: number
    format?: 'currency' | 'percent' | 'number'
    loading?: boolean
    color?: 'blue' | 'green' | 'yellow' | 'purple'
}) => {
    const formatValue = (val: number) => {
        switch (format) {
            case 'currency':
                return val >= 10000 ? formatCompactCurrency(val) : formatCurrency(val)
            case 'percent':
                return formatPercentage(val, 1)
            default:
                return val.toLocaleString()
        }
    }

    const calculateChange = (current: number, previous?: number) => {
        if (!previous || previous === 0) return undefined
        return ((current - previous) / previous) * 100
    }

    const change = calculateChange(value, previousValue)
    const colorClasses = {
        blue: 'bg-blue-50 text-blue-600',
        green: 'bg-green-50 text-green-600',
        yellow: 'bg-yellow-50 text-yellow-600',
        purple: 'bg-purple-50 text-purple-600'
    }

    if (loading) {
        return (
            <div className="bg-white p-6 rounded-lg shadow">
                <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                    <div className="h-8 bg-gray-200 rounded w-32"></div>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
                    <Icon className="w-5 h-5" />
                </div>
                {change !== undefined && (
                    <div className={`text-sm font-medium ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                    </div>
                )}
            </div>
            <div className="text-2xl font-bold">{formatValue(value)}</div>
            <div className="text-sm text-gray-600 mt-1">{label}</div>
        </div>
    )
}

export const FinancialDashboard = () => {
    const { addToast } = useToast()
    const { filters } = useDashboard()
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<FinancialData | null>(null)

    const loadFinancialData = async () => {
        if (!isValidDateRange(filters.dateRange.from, filters.dateRange.to)) {
            addToast('error', 'Invalid date range selected')
            return
        }

        setLoading(true)
        try {
            const result = await api.getFinancials(
                filters.dateRange.from,
                filters.dateRange.to,
                filters.selectedTags.map(t => t.id)
            )

            if (result.success) {
                setData(result.data)
            } else {
                addToast('error', 'Failed to load financial data')
            }
        } catch (error) {
            console.error('Error loading financial data:', error)
            addToast('error', 'An error occurred while loading financial data')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadFinancialData()
    }, [filters.dateRange, filters.selectedTags])

    const handleExportPlatforms = useCallback(() => {
        if (!data?.platforms) return

        const headers = ['Platform', 'Gross Revenue', 'Fees', 'Net Revenue', 'Fee Rate', 'Bookings', 'Avg/Booking']
        const rows = data.platforms.map(p => [
            p.platform,
            p.grossRevenue,
            p.fees,
            p.netRevenue,
            `${p.feeRate.toFixed(1)}%`,
            p.bookingCount,
            safeDivide(p.netRevenue, p.bookingCount, 0).toFixed(2)
        ])

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `platform-financials-${filters.dateRange.from}-to-${filters.dateRange.to}.csv`
        a.click()
        URL.revokeObjectURL(url)

        addToast('success', `Exported ${data.platforms.length} platforms`)
    }, [data, filters.dateRange, addToast])

    const platformColumns = useMemo(() => [
        {
            key: 'platform',
            header: 'Platform',
            width: 150,
            render: (platform: PlatformFinancials) => (
                <div className="font-medium">{platform.platform}</div>
            )
        },
        {
            key: 'grossRevenue',
            header: 'Gross Revenue',
            width: 150,
            render: (platform: PlatformFinancials) => (
                <span className="font-medium">{formatCurrency(platform.grossRevenue)}</span>
            )
        },
        {
            key: 'fees',
            header: 'Platform Fees',
            width: 120,
            render: (platform: PlatformFinancials) => (
                <span className="text-red-600">-{formatCurrency(platform.fees)}</span>
            )
        },
        {
            key: 'netRevenue',
            header: 'Net Revenue',
            width: 150,
            render: (platform: PlatformFinancials) => (
                <span className="font-bold text-green-600">
                    {formatCurrency(platform.netRevenue)}
                </span>
            )
        },
        {
            key: 'feeRate',
            header: 'Fee %',
            width: 80,
            render: (platform: PlatformFinancials) => (
                <span>{formatPercentage(platform.feeRate, 1)}</span>
            )
        },
        {
            key: 'bookingCount',
            header: 'Bookings',
            width: 80,
            render: (platform: PlatformFinancials) => (
                <span>{platform.bookingCount}</span>
            )
        }
    ], [])

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Spinner size="lg" />
            </div>
        )
    }

    if (!data) {
        return (
            <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No financial data available for the selected period</p>
            </div>
        )
    }

    const { metrics, weeklyRevenue, platforms, monthlyTrend, previousPeriod } = data

    // Calculate platform summary
    const platformSummary = platforms.length > 0 ? {
        totalGross: sumBy(platforms, p => p.grossRevenue),
        totalFees: sumBy(platforms, p => p.fees),
        totalNet: sumBy(platforms, p => p.netRevenue),
        avgFeeRate: calculatePercentage(
            sumBy(platforms, p => p.fees),
            sumBy(platforms, p => p.grossRevenue)
        )
    } : null

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Financial Overview</h2>
                <div className="text-sm text-gray-500">
                    {filters.dateRange.from} to {filters.dateRange.to}
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid md:grid-cols-4 gap-4">
                <MetricCard
                    icon={DollarSign}
                    label="Total Revenue"
                    value={metrics.revenue.gross}
                    previousValue={previousPeriod?.revenue?.gross}
                    color="green"
                    loading={loading}
                />
                <MetricCard
                    icon={TrendingUp}
                    label="Net Revenue Rate"
                    value={metrics.performance.netRevenueRate}
                    previousValue={previousPeriod?.performance?.netRevenueRate}
                    format="percent"
                    color="blue"
                    loading={loading}
                />
                <MetricCard
                    icon={Wallet}
                    label="Avg Booking Value"
                    value={metrics.performance.avgBookingValue}
                    color="purple"
                    loading={loading}
                />
                <MetricCard
                    icon={Calendar}
                    label="Total Bookings"
                    value={metrics.performance.totalBookings}
                    format="number"
                    color="yellow"
                    loading={loading}
                />
            </div>

            {/* Revenue Breakdown */}
            <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-bold mb-4">Revenue Breakdown</h3>
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between text-sm text-gray-600 mb-1">
                                <span>Gross Revenue</span>
                                <span className="font-medium text-gray-900">
                                    {formatCurrency(metrics.revenue.gross)}
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '100%' }} />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between text-sm text-gray-600 mb-1">
                                <span>Platform Fees</span>
                                <span className="font-medium text-red-600">
                                    -{formatCurrency(metrics.revenue.platformFees)}
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div className="bg-red-500 h-2 rounded-full"
                                     style={{ width: `${calculatePercentage(metrics.revenue.platformFees, metrics.revenue.gross)}%` }} />
                            </div>
                        </div>

                        {metrics.revenue.taxes > 0 && (
                            <div>
                                <div className="flex justify-between text-sm text-gray-600 mb-1">
                                    <span>Taxes</span>
                                    <span className="font-medium text-orange-600">
                                        -{formatCurrency(metrics.revenue.taxes)}
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div className="bg-orange-500 h-2 rounded-full"
                                         style={{ width: `${calculatePercentage(metrics.revenue.taxes, metrics.revenue.gross)}%` }} />
                                </div>
                            </div>
                        )}

                        <div className="pt-3 border-t">
                            <div className="flex justify-between">
                                <span className="font-medium">Net Revenue</span>
                                <span className="font-bold text-green-600 text-lg">
                                    {formatCurrency(metrics.revenue.net)}
                                </span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                                {metrics.performance.netRevenueRate.toFixed(1)}% of gross revenue retained
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-bold mb-4">Collection Status</h3>
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between mb-2">
                                <span className="text-sm text-gray-600">Collected</span>
                                <span className="font-medium text-green-600">
                                    {formatCurrency(metrics.revenue.collected)}
                                </span>
                            </div>
                            <div className="flex justify-between mb-2">
                                <span className="text-sm text-gray-600">Pending</span>
                                <span className="font-medium text-yellow-600">
                                    {formatCurrency(metrics.revenue.pending)}
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-4 mt-3">
                                <div className="bg-green-500 h-4 rounded-full"
                                     style={{ width: `${metrics.kpis.collectionRate}%` }} />
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                                {metrics.kpis.collectionRate.toFixed(1)}% collected
                            </div>
                        </div>

                        {metrics.revenue.pending > 0 && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                <div className="flex items-center">
                                    <AlertCircle className="w-4 h-4 text-yellow-600 mr-2" />
                                    <span className="text-sm text-yellow-800">
                                        {formatCurrency(metrics.revenue.pending)} in pending payments
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t">
                        <div>
                            <div className="text-2xl font-bold">{formatCurrency(metrics.kpis.adr)}</div>
                            <div className="text-xs text-gray-600">Avg Daily Rate</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{formatCurrency(metrics.kpis.revpar)}</div>
                            <div className="text-xs text-gray-600">RevPAR</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Monthly Trend */}
            {monthlyTrend && monthlyTrend.length > 0 && (
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-bold mb-4">Monthly Revenue Trend</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={monthlyTrend}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" />
                                <YAxis tickFormatter={(value) => formatCompactCurrency(value)} />
                                <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                                <Line
                                    type="monotone"
                                    dataKey="revenue"
                                    stroke={METRIC_COLORS.revenue}
                                    strokeWidth={2}
                                    dot={{ fill: METRIC_COLORS.revenue }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Platform Performance */}
            {platforms && platforms.length > 0 && (
                <div className="bg-white rounded-lg shadow">
                    <div className="p-6 border-b">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold">Platform Performance</h3>
                            <button
                                onClick={handleExportPlatforms}
                                className="flex items-center px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                            >
                                <Download className="w-4 h-4 mr-1" />
                                Export
                            </button>
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="grid md:grid-cols-2 gap-6 mb-6">
                            <div>
                                <h4 className="font-medium mb-3">Revenue by Platform</h4>
                                <div className="h-48">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={platforms.map(p => ({
                                                    name: p.platform,
                                                    value: p.netRevenue,
                                                }))}
                                                cx="50%"
                                                cy="50%"
                                                labelLine={false}
                                                label={(entry: any) => `${entry.name}: ${formatPercentage((entry.percent || 0) * 100, 0)}`}
                                                outerRadius={70}
                                                fill="#8884d8"
                                                dataKey="value"
                                            >
                                                {platforms.map((_, index) => (
                                                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div>
                                <h4 className="font-medium mb-3">Platform Comparison</h4>
                                <div className="h-48">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={platforms}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="platform" />
                                            <YAxis tickFormatter={(value) => formatCompactCurrency(value)} />
                                            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                                            <Bar dataKey="netRevenue" fill={METRIC_COLORS.revenue} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        <VirtualTable
                            data={platforms}
                            columns={platformColumns}
                            height={300}
                            getRowId={(platform) => platform.platform}
                            enablePagination={false}
                            emptyMessage="No platform data available"
                        />

                        {platformSummary && (
                            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                                <div className="grid grid-cols-4 gap-4 text-sm">
                                    <div>
                                        <span className="text-gray-600">Total Gross</span>
                                        <p className="font-bold">{formatCurrency(platformSummary.totalGross)}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Total Fees</span>
                                        <p className="font-bold text-red-600">-{formatCurrency(platformSummary.totalFees)}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Total Net</span>
                                        <p className="font-bold text-green-600">{formatCurrency(platformSummary.totalNet)}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Avg Fee Rate</span>
                                        <p className="font-bold">{formatPercentage(platformSummary.avgFeeRate, 1)}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Upcoming Bookings */}
            <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-bold mb-4">Upcoming Confirmed Revenue</h3>
                <div className="grid md:grid-cols-3 gap-4">
                    <div className="p-4 bg-green-50 rounded-lg">
                        <div className="text-sm text-green-600">Next 30 Days</div>
                        <div className="text-2xl font-bold text-green-700">
                            {formatCurrency(metrics.upcoming.next30Days)}
                        </div>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg">
                        <div className="text-sm text-blue-600">Next 60 Days</div>
                        <div className="text-2xl font-bold text-blue-700">
                            {formatCurrency(metrics.upcoming.next60Days)}
                        </div>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                        <div className="text-sm text-purple-600">Next 90 Days</div>
                        <div className="text-2xl font-bold text-purple-700">
                            {formatCurrency(metrics.upcoming.next90Days)}
                        </div>
                    </div>
                </div>
                <div className="mt-4 text-sm text-gray-600">
                    Based on confirmed bookings with future arrival dates
                </div>
            </div>

            {/* Weekly Revenue Trend */}
            {weeklyRevenue && weeklyRevenue.length > 0 && (
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-bold mb-4">Weekly Revenue Pattern</h3>
                    <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={weeklyRevenue}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="week" />
                                <YAxis tickFormatter={(value) => formatCompactCurrency(value)} />
                                <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                                <Bar dataKey="revenue" fill={METRIC_COLORS.revenue} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    )
}
