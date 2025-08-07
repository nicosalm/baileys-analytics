import { useState, useEffect } from 'react'
import { RevenueMetrics } from '@/types/dashboard'
import { formatCurrency, formatCompactCurrency, calculateGrowthRate, formatPercentage, calculateAverage, ensureNumber, isValidDateRange } from '@baileys/utils'
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, CreditCard } from 'lucide-react'
import { useDashboard } from '@/contexts/dashboard'
import { api } from '@/lib/api'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/contexts/toast'
import { CHART_COLORS, METRIC_COLORS } from '@/lib/theme'

export const RevenueDashboard = () => {
  const { filters } = useDashboard()
  const { addToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<RevenueMetrics | null>(null)
  const [lastYearData, setLastYearData] = useState<RevenueMetrics | null>(null)

  const loadRevenue = async () => {
    if (!isValidDateRange(filters.dateRange.from, filters.dateRange.to)) {
      addToast('error', 'Invalid date range selected')
      return
    }

    setLoading(true)

    // Load current period data
    const result = await api.getRevenue(
      filters.dateRange.from,
      filters.dateRange.to,
      filters.selectedTags.map(t => t.id)
    )

    // Calculate last year's dates for the same period
    const fromDate = new Date(filters.dateRange.from)
    const toDate = new Date(filters.dateRange.to)
    const lastYearFrom = new Date(fromDate.setFullYear(fromDate.getFullYear() - 1)).toISOString().split('T')[0]
    const lastYearTo = new Date(toDate.setFullYear(toDate.getFullYear() - 1)).toISOString().split('T')[0]

    // Load last year's data for comparison
    const lastYearResult = await api.getRevenue(
      lastYearFrom,
      lastYearTo,
      filters.selectedTags.map(t => t.id)
    )

    if (result.success) {
      setData(result.data)
    } else {
      addToast('error', 'Failed to load revenue data')
    }

    if (lastYearResult.success) {
      setLastYearData(lastYearResult.data)
    }

    setLoading(false)
  }

  useEffect(() => {
    loadRevenue()
  }, [filters.dateRange, filters.selectedTags])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!data) return null

  // Period-over-Period growth (Year-over-Year for same date range)
  const periodGrowth = lastYearData
    ? calculateGrowthRate(data.gross, lastYearData.gross)
    : 0

  const avgMonthlyRevenue = calculateAverage(data.byMonth.map(m => m.amount))

  const cumulativeData = data.byMonth.reduce((acc, month, index) => {
    const cumulative = index === 0
      ? month.amount
      : acc[index - 1].cumulative + month.amount
    return [...acc, { ...month, cumulative, revenue: month.amount }]
  }, [] as Array<{ month: string; amount: number; cumulative: number; revenue: number }>)

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Revenue Analytics</h2>

      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <DollarSign className="w-4 h-4 mr-1" />
            Gross Revenue
          </div>
          <div className="text-3xl font-bold">{formatCompactCurrency(data.gross)}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <CreditCard className="w-4 h-4 mr-1" />
            Net Revenue
          </div>
          <div className="text-3xl font-bold">{formatCompactCurrency(data.net)}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <TrendingUp className="w-4 h-4 mr-1" />
            YoY Growth
          </div>
          <div className="text-3xl font-bold flex items-center">
            {lastYearData ? (
              <>
                {formatPercentage(periodGrowth, 1)}
                {periodGrowth >= 0
                  ? <TrendingUp className="w-6 h-6 ml-2 text-green-600" />
                  : <TrendingDown className="w-6 h-6 ml-2 text-red-600" />
                }
              </>
            ) : (
              <span className="text-gray-400 text-lg">No prior data</span>
            )}
          </div>
          {lastYearData && (
            <div className="text-xs text-gray-500 mt-1">
              vs {formatCompactCurrency(lastYearData.gross)} last year
            </div>
          )}
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-2">Avg Monthly</div>
          <div className="text-3xl font-bold">
            {formatCompactCurrency(avgMonthlyRevenue)}
          </div>
        </div>
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
                <Area type="monotone" dataKey="revenue" stroke={METRIC_COLORS.revenue} fill={METRIC_COLORS.revenue} fillOpacity={0.3} name="Monthly" />
                <Area type="monotone" dataKey="cumulative" stroke={METRIC_COLORS.profit} fill={METRIC_COLORS.profit} fillOpacity={0.3} name="Cumulative" />
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
                  label={({ source, percent }) => `${source} ${formatPercentage((percent || 0) * 100, 0)}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="amount"
                >
                  {data.bySource.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(ensureNumber(value))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-bold mb-4">Revenue Breakdown</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded">
            <span className="font-medium">Gross Revenue</span>
            <span className="font-bold">{formatCurrency(data.gross)}</span>
          </div>
          <div className="flex items-center justify-between p-4 border rounded">
            <span>Platform Fees</span>
            <span className="text-red-600">-{formatCurrency(data.fees)}</span>
          </div>
          <div className="flex items-center justify-between p-4 border rounded">
            <span>Taxes Collected</span>
            <span className="text-red-600">-{formatCurrency(data.taxes)}</span>
          </div>
          <div className="flex items-center justify-between p-4 bg-green-50 rounded">
            <span className="font-medium">Net Revenue</span>
            <span className="font-bold text-green-600">{formatCurrency(data.net)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
