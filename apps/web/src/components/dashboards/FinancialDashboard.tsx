import { useState, useEffect, ReactNode } from 'react'
import { api } from '@/lib/api'
import {
  isValidDateRange, formatCurrency, formatCompactCurrency,
  calculatePercentage, formatPercentage,
  calculateGrowthRate, calculateAverage, ensureNumber
} from '@baileys/utils'
import {
  DollarSign, TrendingUp, Wallet,
  AlertCircle, Calendar, CreditCard, Home, FileText
} from 'lucide-react'
import { Spinner } from '@/components/Spinner'
import { VirtualTable } from '@/components/VirtualTable'
import { useToast } from '@/contexts/toast'
import { useDashboard } from '@/contexts/dashboard'
import { useDrillDown } from '@/contexts/drillDown'
import { CHART_COLORS, METRIC_COLORS } from '@/lib/theme'
import {
  Line, Bar, BarChart, LineChart, AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

// Type definitions
interface TabButtonProps {
  active: boolean
  onClick: () => void
  children: ReactNode
}

interface MetricCardProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  previousValue?: number
  format?: 'currency' | 'percent' | 'number'
  loading?: boolean
  color?: 'blue' | 'green' | 'yellow' | 'purple' | 'red'
  subtitle?: string | null
}

interface PLViewProps {
  data: any
  loading: boolean
}

interface RevenueAnalysisProps {
  data: any
  loading: boolean
}

interface CashFlowProps {
  data: any
  loading: boolean
}

interface TaxCenterProps {
  data: any
  loading: boolean
}

// Tab Components
const TabButton: React.FC<TabButtonProps> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-6 py-3 font-medium text-sm ${
      active
        ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
    }`}
  >
    {children}
  </button>
)

const MetricCard: React.FC<MetricCardProps> = ({
  icon: Icon,
  label,
  value,
  previousValue,
  format = 'currency',
  loading = false,
  color = 'blue',
  subtitle
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
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600'
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
    <div className="bg-white p-6 rounded-lg shadow">
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
      <div className="text-3xl font-bold">{formatValue(value)}</div>
      <div className="text-sm text-gray-600 mt-1">{label}</div>
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
    </div>
  )
}

// P&L View Component
const PLView: React.FC<PLViewProps> = ({ data, loading }) => {
  if (loading || !data) {
    return <div className="flex justify-center py-12"><Spinner size="lg" /></div>
  }

  const { metrics, platforms, monthlyTrend, previousPeriod } = data

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid md:grid-cols-4 gap-4">
        <MetricCard
          icon={DollarSign}
          label="Total Revenue"
          value={metrics.revenue.gross}
          previousValue={previousPeriod?.revenue?.gross}
          color="green"
        />
        <MetricCard
          icon={TrendingUp}
          label="Net Revenue"
          value={metrics.revenue.net}
          previousValue={previousPeriod?.revenue?.net}
          color="blue"
        />
        <MetricCard
          icon={Wallet}
          label="Avg Booking Value"
          value={metrics.performance.avgBookingValue}
          color="purple"
        />
        <MetricCard
          icon={Calendar}
          label="Total Bookings"
          value={metrics.performance.totalBookings}
          format="number"
          color="yellow"
        />
      </div>

      {/* Revenue Breakdown */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4">Revenue Breakdown</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Gross Revenue</span>
                <span className="font-medium">{formatCurrency(metrics.revenue.gross)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '100%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
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
                <div className="flex justify-between text-sm mb-1">
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
            </div>
          </div>
        </div>

        {/* Platform Performance */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4">Platform Performance</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={platforms?.map((p: any) => ({
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
                  {platforms?.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
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
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
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
    </div>
  )
}

// Revenue Analysis Component
const RevenueAnalysis: React.FC<RevenueAnalysisProps> = ({ data, loading }) => {
  if (loading || !data) {
    return <div className="flex justify-center py-12"><Spinner size="lg" /></div>
  }

  const periodGrowth = data.lastYearData
    ? calculateGrowthRate(data.gross, data.lastYearData.gross)
    : 0

  const avgMonthlyRevenue = calculateAverage(data.byMonth.map((m: any) => m.amount))

  const cumulativeData = data.byMonth.reduce((acc: any[], month: any, index: number) => {
    const cumulative = index === 0
      ? month.amount
      : acc[index - 1].cumulative + month.amount
    return [...acc, { ...month, cumulative, revenue: month.amount }]
  }, [])

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-4">
        <MetricCard
          icon={DollarSign}
          label="Gross Revenue"
          value={data.gross}
          color="green"
        />
        <MetricCard
          icon={CreditCard}
          label="Net Revenue"
          value={data.net}
          color="blue"
        />
        <MetricCard
          icon={TrendingUp}
          label="YoY Growth"
          value={periodGrowth}
          format="percent"
          color={periodGrowth >= 0 ? 'green' : 'red'}
          subtitle={data.lastYearData ? `vs ${formatCompactCurrency(data.lastYearData.gross)} last year` : null}
        />
        <MetricCard
          icon={Calendar}
          label="Avg Monthly"
          value={avgMonthlyRevenue}
          color="purple"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4">Revenue Trend</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cumulativeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tickFormatter={(value) => value.slice(5)} />
                <YAxis tickFormatter={(value) => formatCompactCurrency(value)} />
                <Tooltip formatter={(value) => formatCurrency(ensureNumber(value))} />
                <Area type="monotone" dataKey="revenue" stroke={METRIC_COLORS.revenue}
                      fill={METRIC_COLORS.revenue} fillOpacity={0.3} name="Monthly" />
                <Area type="monotone" dataKey="cumulative" stroke={METRIC_COLORS.profit}
                      fill={METRIC_COLORS.profit} fillOpacity={0.3} name="Cumulative" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4">Revenue by Source</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.bySource}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.source} ${formatPercentage((entry.percent || 0) * 100, 0)}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="amount"
                  nameKey="source"
                >
                  {data.bySource.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(ensureNumber(value))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

// Export as named export
export { FinancialDashboard }

// Cash Flow Component
const CashFlow: React.FC<CashFlowProps> = ({ data, loading }) => {
  if (loading || !data) {
    return <div className="flex justify-center py-12"><Spinner size="lg" /></div>
  }

  const { metrics, weeklyRevenue } = data

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-4">
        <MetricCard
          icon={DollarSign}
          label="Collected"
          value={metrics.revenue.collected}
          color="green"
          subtitle={`${metrics.kpis.collectionRate.toFixed(1)}% collection rate`}
        />
        <MetricCard
          icon={AlertCircle}
          label="Pending"
          value={metrics.revenue.pending}
          color="yellow"
        />
        <MetricCard
          icon={Calendar}
          label="Next 30 Days"
          value={metrics.upcoming.next30Days}
          color="blue"
        />
        <MetricCard
          icon={TrendingUp}
          label="Next 90 Days"
          value={metrics.upcoming.next90Days}
          color="purple"
        />
      </div>

      {/* Collection Status */}
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
          </div>
        </div>
      </div>

      {/* Upcoming Revenue */}
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
      </div>

      {/* Weekly Revenue */}
      {weeklyRevenue && weeklyRevenue.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4">Weekly Revenue Pattern</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyRevenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis tickFormatter={(value) => formatCompactCurrency(value)} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="revenue" fill={METRIC_COLORS.revenue} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}

// Tax Center Component
const TaxCenter: React.FC<TaxCenterProps> = ({ data, loading }) => {
  const [viewMode, setViewMode] = useState('charts')
  const { dispatch } = useDrillDown()

  if (loading || !data) {
    return <div className="flex justify-center py-12"><Spinner size="lg" /></div>
  }

  const effectiveTaxRate = data.summary.effectiveRate * 100

  const handlePropertyClick = (property: any) => {
    dispatch({
      type: 'DRILL_TO_PROPERTY',
      propertyId: property.propertyId,
      propertyName: property.propertyName
    })
  }

  const handleMonthClick = (month: string) => {
    const [year, monthNum] = month.split('-')
    dispatch({
      type: 'DRILL_TO_MONTH',
      month: monthNum,
      year
    })
  }

  const propertyColumns = [
    {
      key: 'propertyName',
      header: 'Property',
      width: 250,
      render: (property: any) => (
        <div className="font-medium">
          {property.propertyName.length > 20
            ? property.propertyName.substring(0, 20) + '...'
            : property.propertyName}
        </div>
      )
    },
    {
      key: 'totalRent',
      header: 'Total Rent',
      width: 150,
      render: (property: any) => (
        <span className="font-medium">{formatCurrency(property.totalRent)}</span>
      )
    },
    {
      key: 'totalTax',
      header: 'Total Tax',
      width: 150,
      render: (property: any) => (
        <span className="font-medium text-green-600">
          {formatCurrency(property.totalTax)}
        </span>
      )
    },
    {
      key: 'taxRate',
      header: 'Tax Rate',
      width: 100,
      render: (property: any) => {
        const percentage = property.taxRate * 100
        const color = percentage > 15 ? 'text-red-600' : percentage > 10 ? 'text-yellow-600' : 'text-green-600'
        return (
          <span className={`font-medium ${color}`}>
            {percentage.toFixed(1)}%
          </span>
        )
      }
    }
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">Tax Analysis</h3>
        <button
          onClick={() => setViewMode(viewMode === 'charts' ? 'table' : 'charts')}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 flex items-center"
        >
          <FileText className="w-4 h-4 mr-2" />
          {viewMode === 'charts' ? 'Table View' : 'Chart View'}
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <MetricCard
          icon={TrendingUp}
          label="Total Tax Collected"
          value={data.summary.totalTax}
          color="green"
          subtitle={`${effectiveTaxRate.toFixed(1)}% effective rate`}
        />
        <MetricCard
          icon={Home}
          label="Total Rent"
          value={data.summary.totalRent}
          color="blue"
          subtitle={`across ${data.byProperty.length} properties`}
        />
        <MetricCard
          icon={Calendar}
          label="Total Bookings"
          value={data.summary.totalBookings}
          format="number"
          color="purple"
        />
      </div>

      {viewMode === 'charts' ? (
        <>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-bold mb-4">Monthly Tax Trends</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={data.byMonth}
                    onClick={(e: any) => {
                      if (e && e.activeLabel) {
                        const monthData = data.byMonth.find((m: any) => m.month === e.activeLabel)
                        if (monthData) {
                          handleMonthClick(monthData.month)
                        }
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(value) => formatCompactCurrency(value)} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Line type="monotone" dataKey="totalTax" stroke={METRIC_COLORS.tax}
                          strokeWidth={2} dot={{ fill: METRIC_COLORS.tax }}
                          cursor="pointer" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-bold mb-4">Effective Tax Rate</h3>
              <div className="h-64 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl font-bold text-blue-600">
                    {effectiveTaxRate.toFixed(1)}%
                  </div>
                  <div className="text-gray-600 mt-2">Average across all properties</div>
                  <div className="mt-4 space-y-2">
                    <div className="text-sm">
                      <span className="text-gray-600">Highest:</span>{' '}
                      <span className="font-medium">
                        {(Math.max(...data.byProperty.map((p: any) => p.taxRate)) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-600">Lowest:</span>{' '}
                      <span className="font-medium">
                        {(Math.min(...data.byProperty.map((p: any) => p.taxRate)) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h3 className="text-lg font-bold">Properties Tax Summary</h3>
          </div>
          <VirtualTable
            data={data.byProperty}
            columns={propertyColumns}
            height={400}
            getRowId={(property) => property.propertyId}
            onRowClick={handlePropertyClick}
            enablePagination={data.byProperty.length > 20}
            pageSize={20}
            emptyMessage="No properties found"
          />
        </div>
      )}
    </div>
  )
}

// Main Unified Dashboard - using default export
const FinancialDashboard = () => {
  const { addToast } = useToast()
  const { filters } = useDashboard()
  const [activeTab, setActiveTab] = useState('pl')
  const [loading, setLoading] = useState(true)
  const [financialData, setFinancialData] = useState<any>(null)
  const [revenueData, setRevenueData] = useState<any>(null)
  const [taxData, setTaxData] = useState<any>(null)

  const loadAllData = async () => {
    if (!isValidDateRange(filters.dateRange.from, filters.dateRange.to)) {
      addToast('error', 'Invalid date range selected')
      return
    }

    setLoading(true)
    try {
      const tagIds = filters.selectedTags.map(t => t.id)

      // Single API call to get all financial data
      const result = await api.getFinancial(
        filters.dateRange.from,
        filters.dateRange.to,
        tagIds
      )

      if (result.success) {
        // Set data for each tab from the unified response
        setFinancialData({
          metrics: result.data.pl.metrics,
          platforms: result.data.pl.platforms,
          monthlyTrend: result.data.pl.monthlyTrend,
          weeklyRevenue: result.data.pl.weeklyRevenue,
          previousPeriod: result.data.pl.previousPeriod
        })

        setRevenueData({
          gross: result.data.revenue.gross,
          net: result.data.revenue.net,
          taxes: result.data.revenue.taxes,
          fees: result.data.revenue.fees,
          bySource: result.data.revenue.bySource,
          byMonth: result.data.revenue.byMonth,
          lastYearData: result.data.revenue.lastYearData
        })

        setTaxData({
          summary: result.data.tax.summary,
          byProperty: result.data.tax.byProperty,
          byMonth: result.data.tax.byMonth
        })
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
    loadAllData()
  }, [filters.dateRange, filters.selectedTags])


  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Financial Center</h2>
        <p className="text-gray-600 text-sm mt-1">
          Revenue, taxes, cash flow, and P&L analytics
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow">
        <div className="flex border-b">
          <TabButton active={activeTab === 'pl'} onClick={() => setActiveTab('pl')}>
            P&L View
          </TabButton>
          <TabButton active={activeTab === 'revenue_analysis'} onClick={() => setActiveTab('revenue_analysis')}>
            Revenue Analysis
          </TabButton>
          <TabButton active={activeTab === 'cashflow'} onClick={() => setActiveTab('cashflow')}>
            Cash Flow
          </TabButton>
          <TabButton active={activeTab === 'tax_center'} onClick={() => setActiveTab('tax_center')}>
            Tax Center
          </TabButton>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'pl' && <PLView data={financialData} loading={loading} />}
          {activeTab === 'revenue_analysis' && <RevenueAnalysis data={revenueData} loading={loading} />}
          {activeTab === 'cashflow' && <CashFlow data={financialData} loading={loading} />}
          {activeTab === 'tax_center' && <TaxCenter data={taxData} loading={loading} />}
        </div>
      </div>
    </div>
  )
}
