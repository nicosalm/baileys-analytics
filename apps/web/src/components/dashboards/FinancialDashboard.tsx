import { useState, useEffect, useMemo, useCallback } from 'react'
import { api } from '@/lib/api'
import { isValidDateRange, formatCurrency, formatCompactCurrency, calculatePercentage, ensureNumber, safeDivide, formatPercentage, sumBy } from '@baileys/utils'
import {
    DollarSign, TrendingUp, PiggyBank,
    Receipt, CreditCard, Calculator, AlertCircle,
    ArrowUpRight, ArrowDownRight, Wallet, Target,
    ChevronRight, Download, FileText
} from 'lucide-react'
import { Spinner } from '@/components/Spinner'
import { VirtualTable } from '@/components/VirtualTable'
import { useToast } from '@/contexts/toast'
import { useDashboard } from '@/contexts/dashboard'
import { CHART_COLORS, METRIC_COLORS } from '@/lib/theme'
import {
    Line, Bar, BarChart,
    PieChart, Pie, Cell, ComposedChart,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Legend
} from 'recharts'

type FinancialMetrics = {
    revenue: {
        gross: number
        net: number
        pending: number
        collected: number
    }
    expenses: {
        total: number
        categories: Array<{
            category: string
            amount: number
            percentage: number
        }>
    }
    profitability: {
        netIncome: number
        profitMargin: number
        ebitda: number
        roi: number
    }
    cashFlow: {
        inflow: number
        outflow: number
        net: number
        forecast30Days: number
    }
    kpis: {
        revpar: number
        goppar: number
        averageCollectionPeriod: number
        expenseRatio: number
    }
}

type CashFlowData = {
    date: string
    inflow: number
    outflow: number
    netFlow: number
    balance: number
}

type BudgetComparison = {
    category: string
    budgeted: number
    actual: number
    variance: number
    variancePercent: number
}

type PlatformFinancials = {
    platform: string
    grossRevenue: number
    fees: number
    netRevenue: number
    feeRate: number
    bookingCount: number
}

type MonthlyProfitability = {
    month: string
    revenue: number
    expenses: number
    profit: number
}

type FinancialData = {
    metrics: FinancialMetrics
    cashFlow: CashFlowData[]
    budget: BudgetComparison[]
    platforms: PlatformFinancials[]
    monthlyProfitability: MonthlyProfitability[]
}

const MetricCard = ({
    icon: Icon,
    label,
    value,
    change,
    format = 'currency',
    target,
    loading = false
}: {
    icon: React.ComponentType<{ className?: string }>
    label: string
    value: number
    change?: number
    format?: 'currency' | 'percent' | 'number' | 'days'
    target?: number
    loading?: boolean
}) => {
    const formatValue = (val: number) => {
        switch (format) {
            case 'currency':
                return val >= 10000 ? formatCompactCurrency(val) : formatCurrency(val)
            case 'percent':
                return formatPercentage(val, 1)
            case 'days':
                return `${val.toFixed(0)} days`
            default:
                return val.toLocaleString()
        }
    }

    const isPositive = change !== undefined ? change >= 0 : true
    const TrendIcon = isPositive ? ArrowUpRight : ArrowDownRight

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
        <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center text-sm text-gray-600">
                    <Icon className="w-4 h-4 mr-1" />
                    {label}
                </div>
                {change !== undefined && (
                    <div className={`flex items-center text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        <TrendIcon className="w-4 h-4" />
                        {Math.abs(change).toFixed(1)}%
                    </div>
                )}
            </div>
            <div className="text-2xl font-bold">{formatValue(value)}</div>
            {target !== undefined && (
                <div className="mt-2">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Target</span>
                        <span>{formatValue(target)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                            className={`h-2 rounded-full ${value >= target ? 'bg-green-500' : 'bg-yellow-500'}`}
                            style={{ width: `${Math.min(calculatePercentage(value, target), 100)}%` }}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}

export const FinancialDashboard = () => {
    const { addToast } = useToast()
    const { filters } = useDashboard()
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<FinancialData | null>(null)
    const [activeTab, setActiveTab] = useState<'overview' | 'cashflow' | 'expenses' | 'platform'>('overview')
    const [viewMode, setViewMode] = useState<'charts' | 'tables'>('charts')
    const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set())
    const [sortBy, setSortBy] = useState<string>('netRevenue')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

    const loadFinancialData = async () => {
        if (!isValidDateRange(filters.dateRange.from, filters.dateRange.to)) {
            addToast('error', 'Invalid date range selected');
            return;
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

    const sortedPlatforms = useMemo(() => {
        if (!data) return []

        return [...data.platforms].sort((a, b) => {
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
    }, [data, sortBy, sortOrder])

    const handleSort = useCallback((column: string) => {
        if (column === sortBy) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
        } else {
            setSortBy(column)
            setSortOrder('desc')
        }
    }, [sortBy])

    const handleExportPlatforms = useCallback(() => {
        if (!data) return

        const exportData = selectedPlatforms.size > 0
            ? sortedPlatforms.filter(p => selectedPlatforms.has(p.platform))
            : sortedPlatforms

        const headers = ['Platform', 'Gross Revenue', 'Fees', 'Net Revenue', 'Fee Rate', 'Bookings', 'Avg/Booking']
        const rows = exportData.map(p => [
            p.platform,
            p.grossRevenue,
            p.fees,
            p.netRevenue,
            formatPercentage(p.feeRate, 1),
            p.bookingCount,
            safeDivide(p.netRevenue, p.bookingCount, 0)
        ])

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `platform-financials-${filters.dateRange.from}-to-${filters.dateRange.to}.csv`
        a.click()
        URL.revokeObjectURL(url)

        addToast('success', `Exported ${exportData.length} platforms`)
    }, [selectedPlatforms, sortedPlatforms, filters.dateRange, addToast])

    const platformColumns = useMemo(() => [
        {
            key: 'platform',
            header: 'Platform',
            sortable: true,
            width: 150,
            render: (platform: PlatformFinancials) => (
                <div className="font-medium">{platform.platform}</div>
            )
        },
        {
            key: 'grossRevenue',
            header: 'Gross Revenue',
            sortable: true,
            width: 150,
            render: (platform: PlatformFinancials) => (
                <span className="font-medium">{formatCurrency(platform.grossRevenue)}</span>
            )
        },
        {
            key: 'fees',
            header: 'Fees',
            sortable: true,
            width: 120,
            render: (platform: PlatformFinancials) => (
                <span className="text-red-600">-{formatCurrency(platform.fees)}</span>
            )
        },
        {
            key: 'netRevenue',
            header: 'Net Revenue',
            sortable: true,
            width: 150,
            render: (platform: PlatformFinancials) => (
                <span className="font-medium text-green-600">
                    {formatCurrency(platform.netRevenue)}
                </span>
            )
        },
        {
            key: 'feeRate',
            header: 'Fee Rate',
            sortable: true,
            width: 100,
            render: (platform: PlatformFinancials) => (
                <span className={`font-medium ${
                    platform.feeRate > 5 ? 'text-red-600' :
                    platform.feeRate > 3 ? 'text-yellow-600' :
                    'text-green-600'
                }`}>
                    {formatPercentage(platform.feeRate, 1)}
                </span>
            )
        },
        {
            key: 'bookingCount',
            header: 'Bookings',
            sortable: true,
            width: 100,
            render: (platform: PlatformFinancials) => (
                <span className="font-medium">{platform.bookingCount}</span>
            )
        },
        {
            key: 'avgPerBooking',
            header: 'Avg/Booking',
            sortable: false,
            width: 120,
            render: (platform: PlatformFinancials) => (
                <span>{formatCurrency(safeDivide(platform.netRevenue, platform.bookingCount, 0))}</span>
            )
        }
    ], [])

    const budgetColumns = useMemo(() => [
        {
            key: 'category',
            header: 'Category',
            sortable: true,
            width: 200,
            render: (item: BudgetComparison) => (
                <div className="font-medium">{item.category}</div>
            )
        },
        {
            key: 'budgeted',
            header: 'Budgeted',
            sortable: true,
            width: 120,
            render: (item: BudgetComparison) => formatCurrency(item.budgeted)
        },
        {
            key: 'actual',
            header: 'Actual',
            sortable: true,
            width: 120,
            render: (item: BudgetComparison) => formatCurrency(item.actual)
        },
        {
            key: 'variance',
            header: 'Variance',
            sortable: true,
            width: 120,
            render: (item: BudgetComparison) => (
                <span className={item.variance >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {item.variance >= 0 ? '+' : ''}{formatCurrency(item.variance)}
                </span>
            )
        },
        {
            key: 'variancePercent',
            header: '%',
            sortable: true,
            width: 80,
            render: (item: BudgetComparison) => (
                <span className={item.variancePercent >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {item.variancePercent >= 0 ? '+' : ''}{formatPercentage(item.variancePercent, 1)}
                </span>
            )
        }
    ], [])

    const cashFlowColumns = useMemo(() => [
        {
            key: 'date',
            header: 'Date',
            sortable: true,
            width: 120,
            render: (item: CashFlowData) => new Date(item.date).toLocaleDateString()
        },
        {
            key: 'inflow',
            header: 'Inflow',
            sortable: true,
            width: 120,
            render: (item: CashFlowData) => (
                <span className="text-green-600">{formatCurrency(item.inflow)}</span>
            )
        },
        {
            key: 'outflow',
            header: 'Outflow',
            sortable: true,
            width: 120,
            render: (item: CashFlowData) => (
                <span className="text-red-600">{formatCurrency(item.outflow)}</span>
            )
        },
        {
            key: 'netFlow',
            header: 'Net Flow',
            sortable: true,
            width: 120,
            render: (item: CashFlowData) => (
                <span className={item.netFlow >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {formatCurrency(item.netFlow)}
                </span>
            )
        },
        {
            key: 'balance',
            header: 'Balance',
            sortable: true,
            width: 120,
            render: (item: CashFlowData) => (
                <span className="font-medium">{formatCurrency(item.balance)}</span>
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

    const { metrics, cashFlow, budget, platforms, monthlyProfitability } = data

    const expenseDonutData = metrics.expenses.categories.map((cat, index) => ({
        name: cat.category,
        value: cat.amount,
        color: CHART_COLORS[index % CHART_COLORS.length]
    }))

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Financial Dashboard</h2>
                {activeTab === 'overview' && (
                    <button
                        onClick={() => setViewMode(viewMode === 'charts' ? 'tables' : 'charts')}
                        className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 flex items-center"
                    >
                        <FileText className="w-4 h-4 mr-2" />
                        {viewMode === 'charts' ? 'Table View' : 'Chart View'}
                    </button>
                )}
            </div>

            <div className="grid md:grid-cols-4 gap-4">
                <MetricCard
                    icon={DollarSign}
                    label="Net Income"
                    value={metrics.profitability.netIncome}
                    change={12.5}
                    loading={loading}
                />
                <MetricCard
                    icon={TrendingUp}
                    label="Profit Margin"
                    value={metrics.profitability.profitMargin}
                    format="percent"
                    change={2.3}
                    loading={loading}
                />
                <MetricCard
                    icon={Wallet}
                    label="Cash Flow"
                    value={metrics.cashFlow.net}
                    change={8.7}
                    loading={loading}
                />
                <MetricCard
                    icon={Target}
                    label="ROI"
                    value={metrics.profitability.roi}
                    format="percent"
                    change={3.2}
                    loading={loading}
                />
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-bold mb-4">Revenue Breakdown</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-gray-600">Gross Revenue</span>
                            <span className="font-medium">{formatCurrency(metrics.revenue.gross)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">Platform Fees</span>
                            <span className="font-medium text-red-600">
                                -{formatCurrency(metrics.revenue.gross - metrics.revenue.net)}
                            </span>
                        </div>
                        <div className="flex justify-between pt-3 border-t">
                            <span className="font-medium">Net Revenue</span>
                            <span className="font-bold text-green-600">{formatCurrency(metrics.revenue.net)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Pending Collection</span>
                            <span className="text-yellow-600">{formatCurrency(metrics.revenue.pending)}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-bold mb-4">Operating Expenses</h3>
                    {metrics.expenses.categories.length > 0 ? (
                        <>
                            <div className="h-48">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={expenseDonutData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={2}
                                            dataKey="value"
                                        >
                                            {expenseDonutData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                                {metrics.expenses.categories.slice(0, 4).map((cat, index) => (
                                    <div key={cat.category} className="flex items-center">
                                        <div
                                            className="w-3 h-3 rounded-full mr-2"
                                            style={{ backgroundColor: CHART_COLORS[index] }}
                                        />
                                        <span className="text-gray-600">{cat.category}: {cat.percentage}%</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <p className="text-gray-500 text-center py-8">No expense data available</p>
                    )}
                </div>

                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-bold mb-4">Key Performance Indicators</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-gray-600">RevPAR</span>
                            <span className="font-medium">{formatCurrency(metrics.kpis.revpar)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">GOPPAR</span>
                            <span className="font-medium">{formatCurrency(metrics.kpis.goppar)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">Collection Period</span>
                            <span className="font-medium">{metrics.kpis.averageCollectionPeriod.toFixed(1)} days</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">Expense Ratio</span>
                            <span className="font-medium">{formatPercentage(metrics.kpis.expenseRatio, 0)}</span>
                        </div>
                        <div className="flex justify-between pt-3 border-t">
                            <span className="font-medium">EBITDA</span>
                            <span className="font-bold text-green-600">{formatCurrency(metrics.profitability.ebitda)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow">
                <div className="border-b">
                    <div className="flex space-x-8 px-6">
                        {(['overview', 'cashflow', 'expenses', 'platform'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${
                                    activeTab === tab
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                {tab === 'cashflow' ? 'Cash Flow' : tab}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-6">
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            {viewMode === 'charts' ? (
                                <>
                                    <div>
                                        <h4 className="font-medium mb-4">Monthly Profitability Trend</h4>
                                        {monthlyProfitability && monthlyProfitability.length > 0 ? (
                                            <div className="h-64">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <ComposedChart data={monthlyProfitability}>
                                                        <CartesianGrid strokeDasharray="3 3" />
                                                        <XAxis dataKey="month" />
                                                        <YAxis tickFormatter={(value) => formatCompactCurrency(value)} />
                                                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                                                        <Legend />
                                                        <Bar dataKey="revenue" fill={METRIC_COLORS.revenue} name="Revenue" />
                                                        <Bar dataKey="expenses" fill={METRIC_COLORS.expenses} name="Expenses" />
                                                        <Line
                                                            type="monotone"
                                                            dataKey="profit"
                                                            stroke={METRIC_COLORS.profit}
                                                            strokeWidth={2}
                                                            name="Net Profit"
                                                        />
                                                    </ComposedChart>
                                                </ResponsiveContainer>
                                            </div>
                                        ) : (
                                            <p className="text-gray-500 text-center py-8">No profitability data available</p>
                                        )}
                                    </div>

                                    <div>
                                        <h4 className="font-medium mb-4">Budget vs Actual</h4>
                                        {budget && budget.length > 0 ? (
                                            <div className="h-64">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={budget}>
                                                        <CartesianGrid strokeDasharray="3 3" />
                                                        <XAxis dataKey="category" angle={-45} textAnchor="end" height={80} />
                                                        <YAxis tickFormatter={(value) => formatCompactCurrency(value)} />
                                                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                                                        <Legend />
                                                        <Bar dataKey="budgeted" fill="#E5E7EB" name="Budgeted" />
                                                        <Bar dataKey="actual" fill={METRIC_COLORS.revenue} name="Actual" />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        ) : (
                                            <p className="text-gray-500 text-center py-8">No budget data available</p>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div>
                                    <h4 className="font-medium mb-4">Budget vs Actual</h4>
                                    {budget && budget.length > 0 ? (
                                        <VirtualTable
                                            data={budget}
                                            columns={budgetColumns}
                                            height={400}
                                            getRowId={(item) => item.category}
                                            enablePagination={budget.length > 20}
                                            pageSize={20}
                                            emptyMessage="No budget data available"
                                        />
                                    ) : (
                                        <p className="text-gray-500 text-center py-8">No budget data available</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'cashflow' && (
                        <div className="space-y-6">
                            <div className="grid md:grid-cols-4 gap-4">
                                <div className="p-4 bg-green-50 rounded-lg">
                                    <div className="text-sm text-green-600">Cash Inflow</div>
                                    <div className="text-2xl font-bold text-green-700">
                                        {metrics.cashFlow.inflow >= 10000
                                            ? formatCompactCurrency(metrics.cashFlow.inflow)
                                            : formatCurrency(metrics.cashFlow.inflow)}
                                    </div>
                                </div>
                                <div className="p-4 bg-red-50 rounded-lg">
                                    <div className="text-sm text-red-600">Cash Outflow</div>
                                    <div className="text-2xl font-bold text-red-700">
                                        {formatCurrency(metrics.cashFlow.outflow)}
                                    </div>
                                </div>
                                <div className="p-4 bg-blue-50 rounded-lg">
                                    <div className="text-sm text-blue-600">Net Cash Flow</div>
                                    <div className="text-2xl font-bold text-blue-700">
                                        {formatCurrency(metrics.cashFlow.net)}
                                    </div>
                                </div>
                                <div className="p-4 bg-purple-50 rounded-lg">
                                    <div className="text-sm text-purple-600">30-Day Forecast</div>
                                    <div className="text-2xl font-bold text-purple-700">
                                        {formatCurrency(metrics.cashFlow.forecast30Days)}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h4 className="font-medium mb-4">Cash Flow Details</h4>
                                {cashFlow && cashFlow.length > 0 ? (
                                    <VirtualTable
                                        data={cashFlow}
                                        columns={cashFlowColumns}
                                        height={400}
                                        getRowId={(item) => item.date}
                                        enablePagination={cashFlow.length > 30}
                                        pageSize={30}
                                        sortBy="date"
                                        sortOrder="desc"
                                        onSort={handleSort}
                                        emptyMessage="No cash flow data available"
                                        enableSearch={true}
                                        searchKeys={['date']}
                                    />
                                ) : (
                                    <p className="text-gray-500 text-center py-8">No cash flow data available</p>
                                )}
                            </div>

                            <div>
                                <h4 className="font-medium mb-4">Pending Receivables</h4>
                                {metrics.revenue.pending > 0 ? (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                        <div className="flex items-center">
                                            <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
                                            <span className="text-yellow-800">
                                                You have {formatCurrency(metrics.revenue.pending)} in pending payments
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                        <div className="flex items-center">
                                            <DollarSign className="w-5 h-5 text-green-600 mr-2" />
                                            <span className="text-green-800">
                                                All payments are up to date
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'expenses' && (
                        <div className="space-y-6">
                            <div>
                                <h4 className="font-medium mb-4">Expense Categories Breakdown</h4>
                                {metrics.expenses.categories.length > 0 ? (
                                    <div className="grid md:grid-cols-2 gap-4">
                                        {metrics.expenses.categories.map((category, index) => (
                                            <div key={category.category} className="p-4 border rounded-lg">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <div className="font-medium">{category.category}</div>
                                                        <div className="text-2xl font-bold mt-1">
                                                            {formatCurrency(category.amount)}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-sm text-gray-600">{category.percentage}%</div>
                                                    </div>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                    <div
                                                        className="h-2 rounded-full"
                                                        style={{
                                                            width: `${category.percentage}%`,
                                                            backgroundColor: CHART_COLORS[index % CHART_COLORS.length]
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 text-center py-8">No expense data available</p>
                                )}
                            </div>

                            <div className="bg-gray-50 rounded-lg p-6">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h5 className="font-medium text-gray-700">Total Operating Expenses</h5>
                                        <p className="text-3xl font-bold mt-2">{formatCurrency(metrics.expenses.total)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-gray-600">Expense Ratio</p>
                                        <p className="text-2xl font-bold text-gray-700">{metrics.kpis.expenseRatio}%</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'platform' && (
                        <div className="space-y-6">
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-medium">Platform Financial Performance</h4>
                                    {platforms && platforms.length > 0 && (
                                        <button
                                            onClick={handleExportPlatforms}
                                            className="flex items-center px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                                        >
                                            <Download className="w-4 h-4 mr-1" />
                                            Export
                                        </button>
                                    )}
                                </div>
                                {platforms && platforms.length > 0 ? (
                                    <VirtualTable
                                        data={sortedPlatforms}
                                        columns={platformColumns}
                                        height={400}
                                        loading={loading}
                                        sortBy={sortBy}
                                        sortOrder={sortOrder}
                                        onSort={handleSort}
                                        getRowId={(platform) => platform.platform}
                                        enablePagination={sortedPlatforms.length > 10}
                                        pageSize={10}
                                        enableSearch={true}
                                        searchKeys={['platform']}
                                        enableExport={true}
                                        onExport={handleExportPlatforms}
                                        selectable={true}
                                        selectedRows={selectedPlatforms}
                                        onSelectionChange={setSelectedPlatforms}
                                        emptyMessage="No platform data available"
                                        showRowNumbers={true}
                                    />
                                ) : (
                                    <p className="text-gray-500 text-center py-8">No platform data available</p>
                                )}
                            </div>

                            {platforms && platforms.length > 0 && (
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="grid md:grid-cols-4 gap-4 text-sm">
                                        <div>
                                            <span className="text-gray-600">Total Gross Revenue</span>
                                            <p className="font-bold text-lg">{formatCurrency(sumBy(platforms, p => p.grossRevenue))}</p>
                                        </div>
                                        <div>
                                            <span className="text-gray-600">Total Fees</span>
                                            <p className="font-bold text-lg text-red-600">-{formatCurrency(sumBy(platforms, p => p.fees))}</p>
                                        </div>
                                        <div>
                                            <span className="text-gray-600">Total Net Revenue</span>
                                            <p className="font-bold text-lg text-green-600">{formatCurrency(sumBy(platforms, p => p.netRevenue))}</p>
                                        </div>
                                        <div>
                                            <span className="text-gray-600">Avg Fee Rate</span>
                                            <p className="font-bold text-lg">
                                                {formatPercentage(
                                                    calculatePercentage(
                                                        sumBy(platforms, p => p.fees),
                                                        sumBy(platforms, p => p.grossRevenue)
                                                    ), 1
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {platforms && platforms.length > 0 && (
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div>
                                        <h4 className="font-medium mb-4">Revenue Distribution</h4>
                                        <div className="h-64">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={platforms.map((p, index) => ({
                                                            name: p.platform,
                                                            value: p.netRevenue,
                                                            color: CHART_COLORS[index % CHART_COLORS.length]
                                                        }))}
                                                        cx="50%"
                                                        cy="50%"
                                                        labelLine={false}
                                                        label={(entry: any) => `${entry.name} ${formatPercentage((entry.percent || 0) * 100, 0)}`}
                                                        outerRadius={80}
                                                        fill="#8884d8"
                                                        dataKey="value"
                                                    >
                                                        {platforms.map((_, index) => (
                                                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip formatter={(value) => formatCurrency(ensureNumber(value))} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="font-medium mb-4">Platform Efficiency</h4>
                                        <div className="space-y-3">
                                            {platforms.map((platform, index) => (
                                                <div key={platform.platform} className="p-3 border rounded">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="font-medium">{platform.platform}</span>
                                                        <span className="text-sm text-gray-600">{formatPercentage(platform.feeRate, 1)} fees</span>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <div className="flex-1 bg-gray-200 rounded-full h-2 mr-3">
                                                            <div
                                                                className="h-2 rounded-full"
                                                                style={{
                                                                    width: `${100 - platform.feeRate}%`,
                                                                    backgroundColor: CHART_COLORS[index % CHART_COLORS.length]
                                                                }}
                                                            />
                                                        </div>
                                                        <span className="text-sm font-medium">{(100 - platform.feeRate).toFixed(1)}%</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-bold mb-4">Financial Health Score</h3>
                <div className="grid md:grid-cols-5 gap-4">
                    {[
                        { label: 'Overall', score: 85, status: 'Excellent', color: 'green' },
                        { label: 'Liquidity', score: 92, status: 'Strong', color: 'green' },
                        { label: 'Efficiency', score: 78, status: 'Good', color: 'yellow' },
                        { label: 'Profitability', score: 88, status: 'Excellent', color: 'green' },
                        { label: 'Growth', score: 72, status: 'Moderate', color: 'yellow' }
                    ].map(item => (
                        <div key={item.label} className="text-center">
                            <div className="relative inline-flex items-center justify-center">
                                <svg className="w-20 h-20">
                                    <circle
                                        className="text-gray-200"
                                        strokeWidth="8"
                                        stroke="currentColor"
                                        fill="transparent"
                                        r="32"
                                        cx="40"
                                        cy="40"
                                    />
                                    <circle
                                        className={`text-${item.color}-500`}
                                        strokeWidth="8"
                                        strokeDasharray={201}
                                        strokeDashoffset={201 - (201 * item.score) / 100}
                                        strokeLinecap="round"
                                        stroke="currentColor"
                                        fill="transparent"
                                        r="32"
                                        cx="40"
                                        cy="40"
                                        transform="rotate(-90 40 40)"
                                    />
                                </svg>
                                <span className="absolute text-xl font-bold">{item.score}</span>
                            </div>
                            <div className="mt-2 font-medium">{item.label}</div>
                            <div className="text-sm text-gray-600">{item.status}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid md:grid-cols-4 gap-4">
                <button className="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow text-left group">
                    <Receipt className="w-6 h-6 text-blue-600 mb-2" />
                    <div className="font-medium">Generate P&L Report</div>
                    <div className="text-sm text-gray-600">For current period</div>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 mt-2" />
                </button>
                <button className="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow text-left group">
                    <Calculator className="w-6 h-6 text-green-600 mb-2" />
                    <div className="font-medium">Tax Estimator</div>
                    <div className="text-sm text-gray-600">Calculate quarterly taxes</div>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 mt-2" />
                </button>
                <button className="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow text-left group">
                    <PiggyBank className="w-6 h-6 text-purple-600 mb-2" />
                    <div className="font-medium">Investment Analysis</div>
                    <div className="text-sm text-gray-600">ROI & payback period</div>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 mt-2" />
                </button>
                <button className="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow text-left group">
                    <CreditCard className="w-6 h-6 text-orange-600 mb-2" />
                    <div className="font-medium">Payment Reconciliation</div>
                    <div className="text-sm text-gray-600">Match transactions</div>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 mt-2" />
                </button>
            </div>
        </div>
    )
}
