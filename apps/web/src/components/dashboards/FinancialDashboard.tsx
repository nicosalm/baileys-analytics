import { useState, useEffect, ReactNode } from 'react'
import { useFinancial } from '@/hooks/use-api'
import {
  formatCurrency, formatCompactCurrency,
  calculatePercentage,
  calculateGrowthRate, calculateAverage, ensureNumber
} from '@baileys/utils'
import {
  DollarSign, TrendingUp, Wallet,
  AlertCircle, Calendar, Home, FileText,
  Info, Target, TrendingDown, PiggyBank, Receipt, CheckCircle,
  AlertTriangle, Settings, ArrowRight, X
} from 'lucide-react'
import { SimpleTable } from '@/components/tables'
import { MetricCard } from '@/components/MetricCard'
import { ChartWrapper } from '@/components/ChartWrapper'
import { StateWrapper } from '@/components/StateWrapper'
import { useToast } from '@/contexts/toast'
import { useDashboard } from '@/contexts/dashboard'
import { useModal } from '@/contexts/modal'
import { CHART_COLORS, METRIC_COLORS } from '@/lib/theme'
import { TaxRemittanceWidget } from '@/components/tax/TaxRemittanceWidget'
import { usePropertyTaxStatus } from '@/hooks/use-api'
import { useNavigate } from 'react-router-dom'
import {
  Line, Bar, BarChart, LineChart, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts'

// Type definitions
interface TabButtonProps {
  active: boolean
  onClick: () => void
  children: ReactNode
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

interface QuickInsightsProps {
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


// P&L View Component - Shows profitability (what you keep after costs)
const PLView: React.FC<PLViewProps> = ({ data, loading }) => {
  if (loading || !data) {
    return (
      <StateWrapper
        loading={loading}
        empty={!data && !loading}
        loadingMessage="Loading profit & loss data..."
        emptyMessage="No financial data available"
        minHeight={300}
      >
        <div />
      </StateWrapper>
    )
  }

  const { metrics, platforms, previousPeriod } = data
  
  // Calculate profit margin
  const profitMargin = metrics.revenue.gross > 0 
    ? ((metrics.revenue.net / metrics.revenue.gross) * 100).toFixed(1)
    : 0
  
  // Calculate effective fee rate
  const effectiveFeeRate = metrics.revenue.gross > 0
    ? ((metrics.revenue.platformFees / metrics.revenue.gross) * 100).toFixed(1)
    : 0

  return (
    <div className="space-y-6">
      {/* What This Tab Shows */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
          <div className="text-sm text-blue-800">
            <strong>Profit & Loss:</strong> Shows how much money you actually keep after platforms take their fees and taxes
          </div>
        </div>
      </div>

      {/* Key P&L Metrics - Focus on costs and what you keep */}
      <div className="grid md:grid-cols-4 gap-4">
        <MetricCard
          icon={PiggyBank}
          label="What You Keep"
          value={metrics.revenue.net}
          format="currency"
          trend={previousPeriod?.revenue?.net ? {
            value: ((metrics.revenue.net - previousPeriod.revenue.net) / previousPeriod.revenue.net) * 100,
            isPositive: metrics.revenue.net > previousPeriod.revenue.net
          } : undefined}
          color="green"
          subValue={`${profitMargin}% of total bookings`}
          tooltip="Money after all platform fees and taxes"
        />
        <MetricCard
          icon={Receipt}
          label="Platform Fees"
          value={metrics.revenue.platformFees}
          format="currency"
          color="red"
          subValue={`${effectiveFeeRate}% average`}
          tooltip="Total fees charged by booking platforms"
        />
        <MetricCard
          icon={Wallet}
          label="Per Booking Average"
          value={metrics.performance.avgBookingValue}
          format="currency"
          color="purple"
          subValue="Before fees"
          tooltip="Average amount per reservation"
        />
        <MetricCard
          icon={Home}
          label="Revenue Per Room"
          value={metrics.kpis.revpar}
          format="currency"
          color="blue"
          subValue="Daily average"
          tooltip="Revenue per available room per day"
        />
      </div>

      {/* Profitability Breakdown */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-bold mb-4">Where Your Money Goes</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Guest Payments</span>
                <span className="font-medium">{formatCurrency(metrics.revenue.gross)}</span>
              </div>
              <div className="text-xs text-gray-500 mb-1">Total amount guests paid</div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '100%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Platform Commissions</span>
                <span className="font-medium text-red-600">
                  -{formatCurrency(metrics.revenue.platformFees)}
                </span>
              </div>
              <div className="text-xs text-gray-500 mb-1">Airbnb, VRBO, etc. take this</div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-red-500 h-2 rounded-full"
                     style={{ width: `${calculatePercentage(metrics.revenue.platformFees, metrics.revenue.gross)}%` }} />
              </div>
            </div>
            {metrics.revenue.taxes > 0 && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Taxes & Fees</span>
                  <span className="font-medium text-orange-600">
                    -{formatCurrency(metrics.revenue.taxes)}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mb-1">Government taxes</div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-orange-500 h-2 rounded-full"
                       style={{ width: `${calculatePercentage(metrics.revenue.taxes, metrics.revenue.gross)}%` }} />
                </div>
              </div>
            )}
            <div className="pt-3 border-t">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium">Your Take-Home</span>
                  <div className="text-xs text-gray-500">After all fees</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-green-600 text-lg">
                    {formatCurrency(metrics.revenue.net)}
                  </div>
                  <div className="text-xs text-gray-500">{profitMargin}% margin</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Platform Fee Comparison */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-bold mb-4">Platform Fee Comparison</h3>
          <div className="space-y-4">
            {platforms?.map((platform: any) => {
              const feePercentage = platform.grossRevenue > 0 
                ? ((platform.fees / platform.grossRevenue) * 100).toFixed(1)
                : 0
              return (
                <div key={platform.platform} className="border-b pb-3 last:border-0">
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <span className="font-medium">{platform.platform}</span>
                      <div className="text-xs text-gray-500">
                        {platform.bookingCount} bookings
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-red-600">
                        {feePercentage}% fee
                      </div>
                      <div className="text-xs text-gray-500">
                        -{formatCurrency(platform.fees)}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    You keep: {formatCurrency(platform.netRevenue)} of {formatCurrency(platform.grossRevenue)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// Revenue Analysis Component - Track income trends over time
const RevenueAnalysis: React.FC<RevenueAnalysisProps> = ({ data, loading }) => {
  const [viewMode, setViewMode] = useState<'trend' | 'comparison'>('trend')
  
  if (loading || !data) {
    return (
      <StateWrapper
        loading={loading}
        empty={!data && !loading}
        loadingMessage="Loading profit & loss data..."
        emptyMessage="No financial data available"
        minHeight={300}
      >
        <div />
      </StateWrapper>
    )
  }

  const periodGrowth = data.lastYearData
    ? calculateGrowthRate(data.gross, data.lastYearData.gross)
    : 0

  const avgMonthlyRevenue = calculateAverage(data.byMonth.map((m: any) => m.amount))
  
  // Calculate best and worst months
  const sortedMonths = [...data.byMonth].sort((a, b) => b.amount - a.amount)
  const bestMonth = sortedMonths[0]
  const worstMonth = sortedMonths[sortedMonths.length - 1]

  const cumulativeData = data.byMonth.reduce((acc: any[], month: any, index: number) => {
    const cumulative = index === 0
      ? month.amount
      : acc[index - 1].cumulative + month.amount
    return [...acc, { ...month, cumulative, revenue: month.amount }]
  }, [])
  
  // Prepare comparison data if last year data exists
  const comparisonData = data.lastYearData && data.byMonth.map((month: any, index: number) => ({
    month: month.month,
    currentYear: month.amount,
    lastYear: data.lastYearData.byMonth?.[index]?.amount || 0,
    growth: data.lastYearData.byMonth?.[index]?.amount 
      ? ((month.amount - data.lastYearData.byMonth[index].amount) / data.lastYearData.byMonth[index].amount * 100).toFixed(1)
      : 0
  }))

  return (
    <div className="space-y-6">
      {/* What This Tab Shows */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
          <div className="text-sm text-blue-800">
            <strong>Revenue Trends:</strong> Analyzes booking patterns, seasonal changes, and which platforms/sources bring the most income
          </div>
        </div>
      </div>

      {/* Revenue Growth Metrics */}
      <div className="grid md:grid-cols-4 gap-4">
        <MetricCard
          icon={TrendingUp}
          label="Year-over-Year"
          value={periodGrowth}
          format="percent"
          color={periodGrowth >= 0 ? 'green' : 'red'}
          subValue={data.lastYearData ? `Was ${formatCompactCurrency(data.lastYearData.gross)}` : 'No prior data'}
          tooltip="Growth compared to same period last year"
        />
        <MetricCard
          icon={Calendar}
          label="Monthly Average"
          value={avgMonthlyRevenue}
          format="currency"
          color="purple"
          subValue="Typical income"
          tooltip="Average monthly booking revenue"
        />
        <MetricCard
          icon={TrendingUp}
          label="Best Month"
          value={bestMonth?.amount || 0}
          format="currency"
          color="green"
          subValue={bestMonth?.month?.slice(5) || ''}
          tooltip="Highest revenue month"
        />
        <MetricCard
          icon={TrendingDown}
          label="Slowest Month"
          value={worstMonth?.amount || 0}
          format="currency"
          color="yellow"
          subValue={worstMonth?.month?.slice(5) || ''}
          tooltip="Lowest revenue month"
        />
      </div>

      {/* Chart Toggle */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold">Income Patterns</h3>
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('trend')}
            className={`px-3 py-1 rounded-sm ${viewMode === 'trend' ? 'bg-white shadow-xs' : ''}`}
          >
            Trend View
          </button>
          {data.lastYearData && (
            <button
              onClick={() => setViewMode('comparison')}
              className={`px-3 py-1 rounded-sm ${viewMode === 'comparison' ? 'bg-white shadow-xs' : ''}`}
            >
              Year Comparison
            </button>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <ChartWrapper
          title={viewMode === 'trend' ? 'Monthly Income & Total' : 'This Year vs Last Year'}
          height={320}
        >
              {viewMode === 'trend' ? (
                <AreaChart data={cumulativeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tickFormatter={(value) => value.slice(5)} />
                  <YAxis tickFormatter={(value) => formatCompactCurrency(value)} />
                  <Tooltip formatter={(value) => formatCurrency(ensureNumber(value))} />
                  <Area type="monotone" dataKey="revenue" stroke={METRIC_COLORS.revenue}
                        fill={METRIC_COLORS.revenue} fillOpacity={0.3} name="Monthly" />
                  <Area type="monotone" dataKey="cumulative" stroke={METRIC_COLORS.profit}
                        fill={METRIC_COLORS.profit} fillOpacity={0.3} name="Running Total" />
                </AreaChart>
              ) : (
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tickFormatter={(value) => value.slice(5)} />
                  <YAxis tickFormatter={(value) => formatCompactCurrency(value)} />
                  <Tooltip 
                    formatter={(value) => formatCurrency(ensureNumber(value))}
                    content={(props: any) => {
                      const { active, payload } = props
                      if (active && payload && payload.length) {
                        const data = payload[0].payload
                        return (
                          <div className="bg-white p-2 border rounded-sm shadow-sm">
                            <p className="font-medium">{data.month}</p>
                            <p className="text-sm">Current: {formatCurrency(data.currentYear)}</p>
                            <p className="text-sm">Previous: {formatCurrency(data.lastYear)}</p>
                            <p className="text-sm font-medium">Growth: {data.growth}%</p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Bar dataKey="lastYear" fill="#94a3b8" name="Last Year" />
                  <Bar dataKey="currentYear" fill={METRIC_COLORS.revenue} name="Current Year" />
                </BarChart>
              )}
        </ChartWrapper>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-bold mb-4">Income by Platform</h3>
          <div className="space-y-3">
            {data.bySource.map((source: any, index: number) => {
              const percentage = (source.amount / data.gross * 100).toFixed(1)
              return (
                <div key={source.source} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-full mr-2" 
                        style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                      />
                      <span className="font-medium">{source.source}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium">{formatCurrency(source.amount)}</span>
                      <span className="text-sm text-gray-500 ml-2">({percentage}%)</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full transition-all duration-500" 
                      style={{ 
                        width: `${percentage}%`,
                        backgroundColor: CHART_COLORS[index % CHART_COLORS.length]
                      }}
                    />
                  </div>
                </div>
              )
            })}
            <div className="pt-2 mt-2 border-t text-xs text-gray-500">
              Tip: Higher percentages from direct bookings mean you keep more money
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Quick Insights Component - Actionable insights for vacation rental owners
const QuickInsights: React.FC<QuickInsightsProps> = ({ data, loading }) => {
  if (loading || !data) {
    return (
      <StateWrapper
        loading={loading}
        empty={!data && !loading}
        loadingMessage="Loading profit & loss data..."
        emptyMessage="No financial data available"
        minHeight={300}
      >
        <div />
      </StateWrapper>
    )
  }

  const { metrics, monthlyTrend, previousPeriod } = data
  
  // Calculate insights
  const insights = []
  
  // Revenue growth insight
  if (previousPeriod) {
    const growthRate = calculateGrowthRate(metrics.revenue.net, previousPeriod.revenue.net)
    if (growthRate < -10) {
      insights.push({
        type: 'warning',
        icon: TrendingDown,
        title: 'Revenue Decline',
        message: `Revenue is down ${Math.abs(growthRate).toFixed(0)}% from last period`,
        action: 'Review pricing strategy and occupancy rates'
      })
    } else if (growthRate > 20) {
      insights.push({
        type: 'success',
        icon: TrendingUp,
        title: 'Strong Growth',
        message: `Revenue is up ${growthRate.toFixed(0)}% from last period`,
        action: 'Consider expanding or optimizing high-performing properties'
      })
    }
  }
  
  // Platform fee optimization
  const avgFeeRate = metrics.revenue.gross > 0 
    ? (metrics.revenue.platformFees / metrics.revenue.gross * 100)
    : 0
  if (avgFeeRate > 15) {
    insights.push({
      type: 'warning',
      icon: DollarSign,
      title: 'High Platform Fees',
      message: `Paying ${avgFeeRate.toFixed(1)}% in platform fees`,
      action: 'Consider diversifying to lower-fee platforms or direct bookings'
    })
  }
  
  // Collection rate insight
  if (metrics.kpis.collectionRate < 90) {
    insights.push({
      type: 'alert',
      icon: AlertCircle,
      title: 'Collection Issues',
      message: `Only ${metrics.kpis.collectionRate.toFixed(0)}% of revenue collected`,
      action: 'Review payment terms and follow up on outstanding amounts'
    })
  }
  
  // Upcoming revenue insight
  const next30DaysRevenue = metrics.upcoming.next30Days
  const avgMonthly = monthlyTrend ? calculateAverage(monthlyTrend.map((m: any) => m.revenue)) : 0
  if (next30DaysRevenue < avgMonthly * 0.7) {
    insights.push({
      type: 'alert',
      icon: Calendar,
      title: 'Low Future Bookings',
      message: `Next 30 days revenue ${formatCompactCurrency(next30DaysRevenue)} is below average`,
      action: 'Consider promotional campaigns or pricing adjustments'
    })
  }
  
  // RevPAR optimization
  if (metrics.kpis.revpar < metrics.kpis.adr * 0.6) {
    insights.push({
      type: 'info',
      icon: Target,
      title: 'Occupancy Opportunity',
      message: `RevPAR is ${formatCurrency(metrics.kpis.revpar)}, suggesting low occupancy`,
      action: 'Focus on increasing occupancy through marketing or dynamic pricing'
    })
  }
  
  if (insights.length === 0) {
    insights.push({
      type: 'success',
      icon: TrendingUp,
      title: 'All Systems Go',
      message: 'Your financial metrics are looking healthy',
      action: 'Keep up the great work!'
    })
  }
  
  const typeStyles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    alert: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  }
  
  const iconStyles = {
    success: 'text-green-600',
    warning: 'text-yellow-600',
    alert: 'text-red-600',
    info: 'text-blue-600'
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold flex items-center">
          <Info className="w-5 h-5 mr-2" />
          Quick Insights & Actions
        </h3>
        <span className="text-sm text-gray-500">
          {insights.length} {insights.length === 1 ? 'insight' : 'insights'}
        </span>
      </div>
      
      <div className="space-y-3">
        {insights.map((insight, index) => {
          const Icon = insight.icon
          return (
            <div 
              key={index} 
              className={`p-4 rounded-lg border ${typeStyles[insight.type as keyof typeof typeStyles]}`}
            >
              <div className="flex items-start">
                <Icon className={`w-5 h-5 mr-3 mt-0.5 ${iconStyles[insight.type as keyof typeof iconStyles]}`} />
                <div className="flex-1">
                  <div className="font-medium">{insight.title}</div>
                  <div className="text-sm mt-1">{insight.message}</div>
                  <div className="text-sm font-medium mt-2 flex items-center">
                    <span className="mr-2">→</span>
                    {insight.action}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Export as named export
export { FinancialDashboard }

// Cash Flow Component - Track actual money in your bank
const CashFlow: React.FC<CashFlowProps> = ({ data, loading }) => {
  if (loading || !data) {
    return (
      <StateWrapper
        loading={loading}
        empty={!data && !loading}
        loadingMessage="Loading profit & loss data..."
        emptyMessage="No financial data available"
        minHeight={300}
      >
        <div />
      </StateWrapper>
    )
  }

  const { metrics, weeklyRevenue } = data
  
  // Calculate days to collect
  const avgDaysToCollect = metrics.revenue.pending > 0 && metrics.performance.totalBookings > 0
    ? Math.round((metrics.revenue.pending / metrics.revenue.collected) * 30)
    : 0

  return (
    <div className="space-y-6">
      {/* What This Tab Shows */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
          <div className="text-sm text-blue-800">
            <strong>Cash Flow:</strong> Tracks actual money in your bank vs waiting to be paid, plus future income from confirmed bookings
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <MetricCard
          icon={DollarSign}
          label="In Your Bank"
          value={metrics.revenue.collected}
          format="currency"
          color="green"
          subValue="Already received"
          tooltip="Money that has been deposited to your account"
        />
        <MetricCard
          icon={AlertCircle}
          label="Awaiting Payment"
          value={metrics.revenue.pending}
          format="currency"
          color="yellow"
          subValue={avgDaysToCollect > 0 ? `~${avgDaysToCollect} days to receive` : 'From platforms'}
          tooltip="Money earned but not yet received"
        />
        <MetricCard
          icon={Calendar}
          label="Next 30 Days"
          value={metrics.upcoming.next30Days}
          format="currency"
          color="blue"
          subValue="Confirmed bookings"
          tooltip="Expected income from existing reservations"
        />
        <MetricCard
          icon={TrendingUp}
          label="Next 3 Months"
          value={metrics.upcoming.next90Days}
          format="currency"
          color="purple"
          subValue="Expected income"
          tooltip="Projected revenue from confirmed bookings"
        />
      </div>

      {/* Cash Flow Health */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-bold mb-4">Payment Status</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm text-gray-600">Outstanding Payments</div>
                <div className="text-2xl font-bold text-yellow-600">
                  {formatCurrency(metrics.revenue.pending)}
                </div>
                {avgDaysToCollect > 0 && (
                  <div className="text-xs text-gray-500 mt-1">
                    Typically takes {avgDaysToCollect} days to receive
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">Collection Rate</div>
                <div className="text-3xl font-bold text-green-600">
                  {metrics.kpis.collectionRate.toFixed(1)}%
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Received</span>
                <span className="font-medium text-green-600">
                  {formatCurrency(metrics.revenue.collected)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Waiting</span>
                <span className="font-medium text-yellow-600">
                  {formatCurrency(metrics.revenue.pending)}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 mt-2">
                <div className="bg-green-500 h-3 rounded-full transition-all duration-500"
                     style={{ width: `${metrics.kpis.collectionRate}%` }} />
              </div>
            </div>
          </div>
        </div>
        
        {/* Cash Flow Forecast */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-bold mb-4">Income Forecast</h3>
          <div className="space-y-3">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm text-green-700">Next Week</div>
                  <div className="text-xs text-green-600 mt-1">High confidence</div>
                </div>
                <div className="text-xl font-bold text-green-700">
                  {formatCurrency(metrics.upcoming.next30Days * 0.25)}
                </div>
              </div>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm text-blue-700">Next Month</div>
                  <div className="text-xs text-blue-600 mt-1">From bookings</div>
                </div>
                <div className="text-xl font-bold text-blue-700">
                  {formatCurrency(metrics.upcoming.next30Days)}
                </div>
              </div>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm text-purple-700">3 Month Outlook</div>
                  <div className="text-xs text-purple-600 mt-1">Projected</div>
                </div>
                <div className="text-xl font-bold text-purple-700">
                  {formatCurrency(metrics.upcoming.next90Days)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Weekly Revenue Pattern */}
      {weeklyRevenue && weeklyRevenue.length > 0 && (
        <ChartWrapper
          title="Weekly Cash Flow Pattern"
          height={192}
        >
          <BarChart data={weeklyRevenue}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" />
            <YAxis tickFormatter={(value) => formatCompactCurrency(value)} />
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            <Bar dataKey="revenue" fill={METRIC_COLORS.revenue} />
          </BarChart>
        </ChartWrapper>
      )}
    </div>
  )
}

// Tax Center Component - Track tax obligations
const TaxCenter: React.FC<TaxCenterProps> = ({ data, loading }) => {
  const [viewMode, setViewMode] = useState('summary')
  const { openModal } = useModal()
  const navigate = useNavigate()
  const { data: taxStatusData, isLoading: taxStatusLoading } = usePropertyTaxStatus()
  const [isDismissed, setIsDismissed] = useState(false)
  
  // Ensure tax status data is an array
  const taxStatus = Array.isArray(taxStatusData) ? taxStatusData : []
  
  // Count properties needing configuration
  const missingConfigs = taxStatus.filter((p: any) => !p.hasConfig)
  const missingFees = taxStatus.filter((p: any) => p.feeStatus === 'none')
  const partialFees = taxStatus.filter((p: any) => p.feeStatus === 'partial')
  const totalIssues = missingConfigs.length + missingFees.length + partialFees.length
  
  const handleGoToSettings = () => {
    navigate('/settings?tab=tax')
  }
  const { filters } = useDashboard()

  if (loading || !data) {
    return (
      <StateWrapper
        loading={loading}
        empty={!data && !loading}
        loadingMessage="Loading profit & loss data..."
        emptyMessage="No financial data available"
        minHeight={300}
      >
        <div />
      </StateWrapper>
    )
  }

  const effectiveTaxRate = data.summary.effectiveRate * 100

  const handlePropertyClick = (property: any) => {
    openModal({
      type: 'property',
      propertyId: property.propertyId,
      propertyName: property.propertyName
    })
  }

  const handleMonthClick = (month: string) => {
    const [year, monthNum] = month.split('-')
    openModal({
      type: 'month',
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
      {/* Tax Configuration Alert */}
      {!taxStatusLoading && !isDismissed && (totalIssues > 0 || taxStatus.length === 0) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg shadow-sm">
          <div className="p-4">
            <div className="flex justify-between items-start">
              <div className="flex">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mr-3 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-yellow-900">
                    {taxStatus.length === 0 ? 'No Properties Found' : 'Tax Configuration Required'}
                  </h3>
                  <div className="mt-1 text-sm text-yellow-700">
                    {taxStatus.length === 0 ? (
                      <p>
                        Sync your properties from OwnerRez to configure taxes
                      </p>
                    ) : (
                      <>
                        {missingConfigs.length > 0 && (
                          <p>
                            {missingConfigs.length} {missingConfigs.length === 1 ? 'property needs' : 'properties need'} tax configuration
                          </p>
                        )}
                        {missingFees.length > 0 && (
                          <p>
                            {missingFees.length} {missingFees.length === 1 ? 'property has' : 'properties have'} no platform fee data
                          </p>
                        )}
                        {partialFees.length > 0 && (
                          <p className="text-orange-700">
                            ⚠️ {partialFees.length} {partialFees.length === 1 ? 'property has' : 'properties have'} incomplete fee data 
                            {partialFees[0]?.missingFeeMonths?.length > 0 && 
                              ` (missing ${partialFees[0].missingFeeMonths.length} month${partialFees[0].missingFeeMonths.length > 1 ? 's' : ''})`
                            }
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    {taxStatus.length === 0 ? (
                      <button
                        onClick={() => navigate('/settings')}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-sm hover:bg-blue-700 transition-colors"
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Sync Properties
                      </button>
                    ) : missingConfigs.length > 0 ? (
                      <button
                        onClick={() => {
                          const firstMissing = missingConfigs[0]
                          if (firstMissing) {
                            openModal({
                              type: 'tax-config-wizard',
                              defaultPropertyId: firstMissing.propertyId
                            })
                          }
                        }}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-sm hover:bg-blue-700 transition-colors"
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Configure Now
                      </button>
                    ) : missingFees.length > 0 || partialFees.length > 0 ? (
                      <button
                        onClick={() => navigate('/settings?tab=tax')}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-sm hover:bg-blue-700 transition-colors"
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        {missingFees.length > 0 ? 'Add Platform Fees' : 'Complete Fee Data'}
                      </button>
                    ) : null}
                    <button
                      onClick={handleGoToSettings}
                      className="inline-flex items-center px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-sm hover:bg-yellow-700 transition-colors"
                    >
                      View All Settings
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </button>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsDismissed(true)}
                className="p-1 text-yellow-600 hover:bg-yellow-100 rounded transition-colors"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* What This Tab Shows */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
          <div className="text-sm text-blue-800">
            <strong>Tax Tracking:</strong> Monitors occupancy taxes collected from guests that you'll need to pay to local authorities, including platform fee taxes
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">Tax Summary</h3>
        <button
          onClick={() => setViewMode(viewMode === 'summary' ? 'table' : 'summary')}
          className="px-4 py-2 bg-gray-200 rounded-sm hover:bg-gray-300 flex items-center"
        >
          <FileText className="w-4 h-4 mr-2" />
          {viewMode === 'summary' ? 'Property Details' : 'Summary View'}
        </button>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <MetricCard
          icon={FileText}
          label="Total Tax Due"
          value={data.summary.totalTax}
          format="currency"
          color="green"
          subValue={`${effectiveTaxRate.toFixed(1)}% rate`}
          tooltip="Total tax liability including platform fees"
        />
        <MetricCard
          icon={DollarSign}
          label="You Remit"
          value={data.summary.ownerRemitted || data.summary.totalTax}
          format="currency"
          color="blue"
          subValue="Your responsibility"
          tooltip="Tax amount you need to pay directly"
        />
        <MetricCard
          icon={CheckCircle}
          label="Platform Remits"
          value={data.summary.platformRemitted || 0}
          format="currency"
          color="green"
          subValue="Paid by platforms"
          tooltip="Tax paid directly by booking platforms"
        />
        <MetricCard
          icon={Home}
          label="Properties"
          value={data.byProperty.length}
          format="number"
          color="yellow"
          subValue="Being tracked"
          tooltip="Number of properties with tax data"
        />
      </div>

      {/* Tax Remittance Display */}
      <TaxRemittanceWidget
        periodStart={filters.dateRange.from}
        periodEnd={filters.dateRange.to}
      />

      {viewMode === 'summary' ? (
        <>
          <div className="grid md:grid-cols-2 gap-6">
            <ChartWrapper
              title="Monthly Tax Trend"
              height={256}
            >
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
            </ChartWrapper>

            <ChartWrapper
              title="Tax Rate by Property"
              height={256}
            >
                  <BarChart data={data.byProperty.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="propertyName" 
                      tickFormatter={(value) => value.length > 15 ? value.substring(0, 15) + '...' : value}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis tickFormatter={(value) => `${(value * 100).toFixed(0)}%`} />
                    <Tooltip 
                      formatter={(value: any) => `${(value * 100).toFixed(1)}%`}
                      labelFormatter={(label) => label.length > 20 ? label.substring(0, 20) + '...' : label}
                    />
                    <Bar dataKey="taxRate" fill={METRIC_COLORS.tax} />
                  </BarChart>
            </ChartWrapper>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-4 border-b">
            <h3 className="text-lg font-bold">Properties Tax Summary</h3>
          </div>
          <SimpleTable
            data={data.byProperty}
            columns={propertyColumns}
            getRowId={(property) => property.propertyId}
            onRowClick={handlePropertyClick}
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
  const { openModal } = useModal()
  const [activeTab, setActiveTab] = useState('insights')
  
  const tagIds = filters.selectedTags.map(t => t.id)
  const { data, error, isLoading } = useFinancial(
    filters.dateRange.from,
    filters.dateRange.to,
    tagIds
  )

  // Process data for each tab from the unified response
  const financialData = data ? {
    metrics: data.pl.metrics,
    platforms: data.pl.platforms,
    monthlyTrend: data.pl.monthlyTrend,
    weeklyRevenue: data.pl.weeklyRevenue,
    previousPeriod: data.pl.previousPeriod
  } : null

  const revenueData = data ? {
    gross: data.revenue.gross,
    net: data.revenue.net,
    taxes: data.revenue.taxes,
    fees: data.revenue.fees,
    bySource: data.revenue.bySource,
    byMonth: data.revenue.byMonth,
    lastYearData: data.revenue.lastYearData
  } : null

  const taxData = data ? {
    summary: data.tax.summary,
    byProperty: data.tax.byProperty,
    byMonth: data.tax.byMonth
  } : null

  useEffect(() => {
    if (error) {
      addToast('error', `Failed to load financial data: ${error.message}`)
    }
  }, [error?.message, addToast])


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold">Financial Center</h2>
          <p className="text-gray-600 text-sm mt-1">
            Track your vacation rental income, expenses, and profitability
          </p>
        </div>
        <button
          onClick={() => openModal({ type: 'financial-summary' })}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
        >
          <DollarSign className="w-4 h-4 mr-2" />
          Quick Summary
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="flex border-b overflow-x-auto">
          <TabButton active={activeTab === 'insights'} onClick={() => setActiveTab('insights')}>
            Insights
          </TabButton>
          <TabButton active={activeTab === 'pl'} onClick={() => setActiveTab('pl')}>
            Profit & Loss
          </TabButton>
          <TabButton active={activeTab === 'revenue_analysis'} onClick={() => setActiveTab('revenue_analysis')}>
            Revenue Trends
          </TabButton>
          <TabButton active={activeTab === 'cashflow'} onClick={() => setActiveTab('cashflow')}>
            Cash Flow
          </TabButton>
          <TabButton active={activeTab === 'tax_center'} onClick={() => setActiveTab('tax_center')}>
            Taxes
          </TabButton>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'insights' && <QuickInsights data={financialData} loading={isLoading} />}
          {activeTab === 'pl' && <PLView data={financialData} loading={isLoading} />}
          {activeTab === 'revenue_analysis' && <RevenueAnalysis data={revenueData} loading={isLoading} />}
          {activeTab === 'cashflow' && <CashFlow data={financialData} loading={isLoading} />}
          {activeTab === 'tax_center' && <TaxCenter data={taxData} loading={isLoading} />}
        </div>
      </div>
    </div>
  )
}