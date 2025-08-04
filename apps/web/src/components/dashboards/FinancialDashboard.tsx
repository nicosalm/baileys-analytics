import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { formatCurrency } from '@baileys/utils'
import {
    DollarSign, TrendingUp, PiggyBank,
    Receipt, CreditCard, Calculator, AlertCircle,
    ArrowUpRight, ArrowDownRight, Wallet, Target,
    ChevronRight
} from 'lucide-react'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/contexts/toast'
import { useDashboard } from '@/contexts/dashboard'
import {
    Line, Bar, AreaChart, Area,
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

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']

// Metric Card Component
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
                return formatCurrency(val)
            case 'percent':
                return `${val.toFixed(1)}%`
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
                            style={{ width: `${Math.min((value / target) * 100, 100)}%` }}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}

// Main Financial Dashboard Component
export const FinancialDashboard = () => {
    const { addToast } = useToast()
    const { filters } = useDashboard()
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<FinancialData | null>(null)
    const [activeTab, setActiveTab] = useState<'overview' | 'cashflow' | 'expenses' | 'platform'>('overview')

    const loadFinancialData = async () => {
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
        color: COLORS[index % COLORS.length]
    }))

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold">Financial Dashboard</h2>
                <p className="text-gray-600">Complete financial overview and profitability analysis</p>
            </div>

            {/* Key Financial Metrics */}
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

            {/* Revenue, Expenses, and KPIs */}
            <div className="grid md:grid-cols-3 gap-6">
                {/* Revenue Breakdown */}
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

                {/* Operating Expenses */}
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
                                            style={{ backgroundColor: COLORS[index] }}
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

                {/* Key Performance Indicators */}
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
                            <span className="font-medium">{metrics.kpis.expenseRatio}%</span>
                        </div>
                        <div className="flex justify-between pt-3 border-t">
                            <span className="font-medium">EBITDA</span>
                            <span className="font-bold text-green-600">{formatCurrency(metrics.profitability.ebitda)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabbed Content */}
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
                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            {/* Monthly Profitability Trend */}
                            <div>
                                <h4 className="font-medium mb-4">Monthly Profitability Trend</h4>
                                {monthlyProfitability && monthlyProfitability.length > 0 ? (
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={monthlyProfitability}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="month" />
                                                <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                                                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                                                <Legend />
                                                <Bar dataKey="revenue" fill="#3B82F6" name="Revenue" />
                                                <Bar dataKey="expenses" fill="#EF4444" name="Expenses" />
                                                <Line
                                                    type="monotone"
                                                    dataKey="profit"
                                                    stroke="#10B981"
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

                            {/* Budget vs Actual */}
                            <div>
                                <h4 className="font-medium mb-4">Budget vs Actual</h4>
                                {budget && budget.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full">
                                            <thead>
                                                <tr className="border-b">
                                                    <th className="text-left py-2">Category</th>
                                                    <th className="text-right py-2">Budgeted</th>
                                                    <th className="text-right py-2">Actual</th>
                                                    <th className="text-right py-2">Variance</th>
                                                    <th className="text-right py-2">%</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {budget.map(item => (
                                                    <tr key={item.category} className="border-b">
                                                        <td className="py-2">{item.category}</td>
                                                        <td className="py-2 text-right">{formatCurrency(item.budgeted)}</td>
                                                        <td className="py-2 text-right">{formatCurrency(item.actual)}</td>
                                                        <td className={`py-2 text-right ${item.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {item.variance >= 0 ? '+' : ''}{formatCurrency(item.variance)}
                                                        </td>
                                                        <td className={`py-2 text-right ${item.variancePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {item.variancePercent >= 0 ? '+' : ''}{item.variancePercent.toFixed(1)}%
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                        <p className="text-gray-500 text-center py-8">No budget data available</p>
                                    )}
                            </div>
                        </div>
                    )}

                    {/* Cash Flow Tab */}
                    {activeTab === 'cashflow' && (
                        <div className="space-y-6">
                            {/* Cash Flow Summary Cards */}
                            <div className="grid md:grid-cols-4 gap-4">
                                <div className="p-4 bg-green-50 rounded-lg">
                                    <div className="text-sm text-green-600">Cash Inflow</div>
                                    <div className="text-2xl font-bold text-green-700">
                                        {formatCurrency(metrics.cashFlow.inflow)}
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

                            {/* Cash Flow Trend */}
                            <div>
                                <h4 className="font-medium mb-4">Cash Flow Trend</h4>
                                {cashFlow && cashFlow.length > 0 ? (
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={cashFlow}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="date" />
                                                <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                                                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                                                <Legend />
                                                <Area
                                                    type="monotone"
                                                    dataKey="inflow"
                                                    stackId="1"
                                                    stroke="#10B981"
                                                    fill="#10B981"
                                                    fillOpacity={0.6}
                                                    name="Inflow"
                                                />
                                                <Area
                                                    type="monotone"
                                                    dataKey="outflow"
                                                    stackId="2"
                                                    stroke="#EF4444"
                                                    fill="#EF4444"
                                                    fillOpacity={0.6}
                                                    name="Outflow"
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="balance"
                                                    stroke="#3B82F6"
                                                    strokeWidth={2}
                                                    name="Balance"
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                        <p className="text-gray-500 text-center py-8">No cash flow data available</p>
                                    )}
                            </div>

                            {/* Pending Receivables */}
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

                    {/* Expenses Tab */}
                    {activeTab === 'expenses' && (
                        <div className="space-y-6">
                            {/* Expense Categories Breakdown */}
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
                                                            backgroundColor: COLORS[index % COLORS.length]
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

                            {/* Total Expenses Summary */}
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

                    {/* Platform Tab */}
                    {activeTab === 'platform' && (
                        <div className="space-y-6">
                            {/* Platform Financial Performance */}
                            <div>
                                <h4 className="font-medium mb-4">Platform Financial Performance</h4>
                                {platforms && platforms.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full">
                                            <thead>
                                                <tr className="border-b">
                                                    <th className="text-left py-2">Platform</th>
                                                    <th className="text-right py-2">Gross Revenue</th>
                                                    <th className="text-right py-2">Fees</th>
                                                    <th className="text-right py-2">Net Revenue</th>
                                                    <th className="text-right py-2">Fee Rate</th>
                                                    <th className="text-right py-2">Bookings</th>
                                                    <th className="text-right py-2">Avg/Booking</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {platforms.map(platform => (
                                                    <tr key={platform.platform} className="border-b">
                                                        <td className="py-2 font-medium">{platform.platform}</td>
                                                        <td className="py-2 text-right">{formatCurrency(platform.grossRevenue)}</td>
                                                        <td className="py-2 text-right text-red-600">
                                                            -{formatCurrency(platform.fees)}
                                                        </td>
                                                        <td className="py-2 text-right font-medium">
                                                            {formatCurrency(platform.netRevenue)}
                                                        </td>
                                                        <td className="py-2 text-right">{platform.feeRate}%</td>
                                                        <td className="py-2 text-right">{platform.bookingCount}</td>
                                                        <td className="py-2 text-right">
                                                            {formatCurrency(platform.netRevenue / platform.bookingCount)}
                                                        </td>
                                                    </tr>
                                                ))}
                                                <tr className="font-bold">
                                                    <td className="py-2">Total</td>
                                                    <td className="py-2 text-right">
                                                        {formatCurrency(platforms.reduce((sum, p) => sum + p.grossRevenue, 0))}
                                                    </td>
                                                    <td className="py-2 text-right text-red-600">
                                                        -{formatCurrency(platforms.reduce((sum, p) => sum + p.fees, 0))}
                                                    </td>
                                                    <td className="py-2 text-right">
                                                        {formatCurrency(platforms.reduce((sum, p) => sum + p.netRevenue, 0))}
                                                    </td>
                                                    <td className="py-2 text-right">
                                                        {platforms.length > 0
                                                            ? (platforms.reduce((sum, p) => sum + p.fees, 0) /
                                                                platforms.reduce((sum, p) => sum + p.grossRevenue, 0) * 100).toFixed(1)
                                                            : '0.0'}%
                                                    </td>
                                                    <td className="py-2 text-right">
                                                        {platforms.reduce((sum, p) => sum + p.bookingCount, 0)}
                                                    </td>
                                                    <td className="py-2 text-right">
                                                        {platforms.reduce((sum, p) => sum + p.bookingCount, 0) > 0
                                                            ? formatCurrency(
                                                                platforms.reduce((sum, p) => sum + p.netRevenue, 0) /
                                                                    platforms.reduce((sum, p) => sum + p.bookingCount, 0)
                                                            )
                                                            : '$0'}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                        <p className="text-gray-500 text-center py-8">No platform data available</p>
                                    )}
                            </div>

                            {/* Platform Revenue Distribution */}
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
                                                            color: COLORS[index % COLORS.length]
                                                        }))}
                                                        cx="50%"
                                                        cy="50%"
                                                        labelLine={false}
                                                        label={(entry: any) => {
                                                            const percent = entry.percent || 0;
                                                            return `${entry.name} ${(percent * 100).toFixed(0)}%`;
                                                        }}
                                                        outerRadius={80}
                                                        fill="#8884d8"
                                                        dataKey="value"
                                                    >
                                                        {platforms.map((_, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="font-medium mb-4">Platform Efficiency</h4>
                                        <div className="space-y-3">
                                            {platforms.map((platform) => (
                                                <div key={platform.platform} className="p-3 border rounded">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="font-medium">{platform.platform}</span>
                                                        <span className="text-sm text-gray-600">{platform.feeRate}% fees</span>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <div className="flex-1 bg-gray-200 rounded-full h-2 mr-3">
                                                            <div
                                                                className="h-2 rounded-full bg-gradient-to-r from-green-500 to-green-600"
                                                                style={{ width: `${100 - platform.feeRate}%` }}
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

            {/* Financial Health Score */}
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

            {/* Quick Actions */}
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

export default FinancialDashboard
