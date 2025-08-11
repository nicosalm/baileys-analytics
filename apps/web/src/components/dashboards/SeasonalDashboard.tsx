import { useEffect } from 'react'
import { useSeasonalAnalysis } from '@/hooks/use-api'
import {
  formatCurrency,
  formatCompactCurrency,
  calculateGrowthRate,
  formatPercentage,
  ensureNumber,
} from '@baileys/utils'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { TrendingUp, TrendingDown, Calendar, Sun, Snowflake, AlertCircle, BarChart3, Info, DollarSign, Percent } from 'lucide-react'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/contexts/toast'
import { useModal } from '@/contexts/modal'
import { useDashboard } from '@/contexts/dashboard'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const SeasonalDashboard = () => {
  const { addToast } = useToast()
  const { openModal } = useModal()
  const { filters } = useDashboard()

  // Extract year from the date range filter
  const getYearFromFilters = () => {
    if (filters.dateRange.from) {
      const fromDate = new Date(filters.dateRange.from)
      return fromDate.getFullYear()
    }
    return new Date().getFullYear()
  }

  const selectedYear = getYearFromFilters()
  const { data, error, isLoading } = useSeasonalAnalysis(selectedYear)

  // Handle error state
  useEffect(() => {
    if (error) {
      addToast('error', 'Failed to load seasonal data')
    }
  }, [error?.message, addToast])

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-gray-600">Failed to load seasonal analysis</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    )
  }

  // Check for sufficient data
  const hasSeasonalData = data.seasonalPatterns.peakMonths?.length > 0 &&
                          data.seasonalPatterns.lowMonths?.length > 0
  const hasYearData = data.yearOverYear.years?.length > 0
  const hasMonthlyData = data.monthlyTrends?.length > 0

  if (!hasSeasonalData && !hasYearData && !hasMonthlyData) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Calendar className="w-12 h-12 text-gray-400 mb-4" />
        <p className="text-gray-600">Insufficient data for seasonal analysis</p>
        <p className="text-sm text-gray-500 mt-2">Please ensure you have bookings data for the selected period</p>
      </div>
    )
  }

  // Prepare chart data
  const yearOverYearChart = data.yearOverYear.years
    .filter((y: any) => y.year && !isNaN(y.revenue))
    .sort((a: any, b: any) => a.year - b.year)
    .map((year: any) => ({
      year: year.year,
      revenue: year.revenue || 0,
      occupancy: Math.min(100, year.occupancy || 0), // Cap at 100%
      avgRate: year.avgNightlyRate || 0
    }))

  const monthlyComparison = data.monthlyTrends
    .filter((m: any) => m.monthName && m.monthName.trim() !== '')
    .map((month: any) => ({
      month: month.monthName.slice(0, 3),
      current: month.currentYear.revenue || 0,
      previous: month.previousYear.revenue || 0,
      growth: month.yoyGrowth.revenue || 0
    }))

  const getSeasonEmoji = (month: string) => {
    if (!month) return null
    const monthNum = MONTHS.indexOf(month.slice(0, 3)) + 1
    if (monthNum >= 6 && monthNum <= 8) return <Sun className="w-4 h-4 text-yellow-500" />
    if (monthNum === 12 || monthNum <= 2) return <Snowflake className="w-4 h-4 text-blue-500" />
    return null
  }

  const yearGrowthRate = calculateGrowthRate(
    data.yearOverYear.currentYear,
    data.yearOverYear.previousYear
  )

  // Custom tooltip formatters
  const formatTooltipValue = (value: any, name: string) => {
    const numValue = ensureNumber(value)
    if (name === 'Nights Booked %') return `${numValue.toFixed(1)}%`
    if (name === 'growth') return `${numValue.toFixed(1)}%`
    return formatCurrency(numValue)
  }

  const formatYAxisTick = (value: number) => formatCompactCurrency(value)
  const formatPercentageTick = (value: number) => `${value}%`

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Seasonal Insights</h2>
        <p className="text-gray-600 text-sm mt-1">
          Understand when your properties perform best and find pricing opportunities
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
          <div className="text-sm text-blue-800">
            <strong>What This Shows:</strong> Your business patterns throughout the year, helping you identify busy seasons, 
            slow periods, and opportunities to adjust pricing for maximum revenue.
          </div>
        </div>
      </div>


      {/* Key Metrics Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow" title="Your busiest time of year">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <Calendar className="w-4 h-4 mr-1" />
            Your Busiest Month
          </div>
          <div className="text-2xl font-bold flex items-center">
            {data.seasonalPatterns.peakMonths[0]?.month || 'N/A'}
            {data.seasonalPatterns.peakMonths[0] && getSeasonEmoji(data.seasonalPatterns.peakMonths[0].month)}
          </div>
          <div className="text-sm text-gray-500">
            {data.seasonalPatterns.avgPeakOccupancy > 0
              ? `${formatPercentage(data.seasonalPatterns.avgPeakOccupancy, 0)} of nights booked`
              : 'No data'}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow" title="Your quietest time of year">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <Calendar className="w-4 h-4 mr-1" />
            Your Quietest Month
          </div>
          <div className="text-2xl font-bold flex items-center">
            {data.seasonalPatterns.lowMonths[0]?.month || 'N/A'}
            {data.seasonalPatterns.lowMonths[0] && getSeasonEmoji(data.seasonalPatterns.lowMonths[0].month)}
          </div>
          <div className="text-sm text-gray-500">
            {data.seasonalPatterns.avgLowOccupancy >= 0
              ? `${formatPercentage(data.seasonalPatterns.avgLowOccupancy, 0)} of nights booked`
              : 'No data'}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow" title="How this year compares to last year">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <TrendingUp className="w-4 h-4 mr-1" />
            Year-Over-Year Growth
          </div>
          <div className="text-2xl font-bold flex items-center">
            {yearGrowthRate >= 0 ? '+' : ''}{formatPercentage(yearGrowthRate, 1)}
            {yearGrowthRate >= 0
              ? <TrendingUp className="w-5 h-5 ml-2 text-green-600" />
              : <TrendingDown className="w-5 h-5 ml-2 text-red-600" />
            }
          </div>
          <div className="text-sm text-gray-500">
            This year: {formatCompactCurrency(data.yearOverYear.currentYear)}
          </div>
        </div>
      </div>

      {/* Charts */}
      {!hasYearData && !hasMonthlyData && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-yellow-800 font-medium">Building Your History</p>
              <p className="text-sm text-yellow-700 mt-1">
                We need at least 2 years of data to show year-over-year comparisons. 
                Keep using the platform and these insights will become available!
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Year-over-Year Performance Chart */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            Historical Performance
          </h3>
          {yearOverYearChart.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={yearOverYearChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="year" tick={{ fontSize: 12 }} stroke="#666" />
                  <YAxis yAxisId="left" tickFormatter={formatYAxisTick} tick={{ fontSize: 12 }} stroke="#666" />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={formatPercentageTick} tick={{ fontSize: 12 }} stroke="#666" />
                  <Tooltip formatter={formatTooltipValue} contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '6px' }} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} iconType="line" />
                  <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#3B82F6" name="Total Revenue" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line yAxisId="right" type="monotone" dataKey="occupancy" stroke="#10B981" name="Nights Booked %" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line yAxisId="left" type="monotone" dataKey="avgRate" stroke="#F59E0B" name="Avg Nightly Rate" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <BarChart3 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No historical data available</p>
                <p className="text-xs text-gray-400 mt-2">Data will appear once you have multiple years of bookings</p>
              </div>
            </div>
          )}
        </div>

        {/* Monthly Revenue Comparison Chart */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            Monthly Revenue Comparison
          </h3>
          {monthlyComparison.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlyComparison}
                  onClick={(data: any) => {
                    if (data && data.activeLabel) {
                      const monthData = monthlyComparison.find((m: any) => m.month === data.activeLabel)
                      if (monthData) {
                        const monthNum = MONTHS.indexOf(monthData.month) + 1
                        openModal({
                          type: 'month',
                          month: monthNum.toString().padStart(2, '0'),
                          year: selectedYear.toString()
                        })
                      }
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#666" />
                  <YAxis tickFormatter={formatYAxisTick} tick={{ fontSize: 12 }} stroke="#666" />
                  <Tooltip formatter={(value: any) => formatCurrency(ensureNumber(value))} contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '6px' }} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} iconType="rect" />
                  <Bar dataKey="previous" fill="#E5E7EB" name={`${selectedYear - 1}`} cursor="pointer" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="current" fill="#3B82F6" name={`${selectedYear}`} cursor="pointer" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <BarChart3 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No comparison data available</p>
                <p className="text-xs text-gray-400 mt-2">Requires data from {selectedYear - 1} and {selectedYear}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Property Seasonality and Price Optimization */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Property Seasonality */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4 flex items-center">
            <Percent className="w-5 h-5 mr-2" />
            How Seasonal Each Property Is
          </h3>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {data.propertySeasonality?.length > 0 ? (
              data.propertySeasonality
                .sort((a: any, b: any) => b.seasonalityScore - a.seasonalityScore)
                .map((property: any) => (
                <div
                  key={property.propertyId}
                  className="p-3 border rounded hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => openModal({
                    type: 'property',
                    propertyId: property.propertyId,
                    propertyName: property.propertyName
                  })}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium truncate">{property.propertyName}</h4>
                      <p className="text-sm text-gray-600">
                        Peak: {property.peakMonth} | Low: {property.lowMonth}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-sm font-medium">
                        {formatPercentage(property.seasonalityScore, 0)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {property.seasonalityScore > 50 ? 'Very seasonal' : property.seasonalityScore > 25 ? 'Somewhat seasonal' : 'Steady year-round'}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-8">No property data available</p>
            )}
          </div>
        </div>

        {/* Price Optimization */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4 flex items-center">
            <DollarSign className="w-5 h-5 mr-2" />
            Pricing Suggestions
          </h3>
          {(data.priceOptimization?.underpriced?.length > 0 || data.priceOptimization?.overpriced?.length > 0) ? (
            <div className="space-y-4 max-h-80 overflow-y-auto">
              {/* Underpriced Properties */}
              {data.priceOptimization.underpriced?.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center text-sm">
                    <TrendingUp className="w-4 h-4 mr-2 text-green-600" />
                    You Could Charge More
                  </h4>
                  <div className="space-y-2">
                    {data.priceOptimization.underpriced.slice(0, 3).map((opp: any, index: any) => (
                      <div
                        key={`${opp.propertyId}-${opp.month}-${index}`}
                        className="p-2 bg-green-50 rounded hover:bg-green-100 cursor-pointer text-sm transition-colors"
                        onClick={() => {
                          const monthNum = MONTHS.findIndex(m => opp.month.toLowerCase().startsWith(m.toLowerCase())) + 1
                          if (monthNum > 0) {
                            openModal({
                              type: 'property-month',
                              propertyId: opp.propertyId,
                              propertyName: opp.propertyName,
                              month: monthNum.toString().padStart(2, '0'),
                              year: selectedYear.toString()
                            })
                          }
                        }}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{opp.propertyName}</p>
                            <p className="text-xs text-gray-600">{opp.month}</p>
                          </div>
                          <div className="text-right ml-2">
                            <p className="font-medium text-green-700">
                              +{formatCompactCurrency(opp.revenueOpportunity)}
                            </p>
                            <p className="text-xs text-gray-600 whitespace-nowrap">
                              {formatCompactCurrency(opp.currentRate)} → {formatCompactCurrency(opp.suggestedRate)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Overpriced Properties */}
              {data.priceOptimization.overpriced?.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center text-sm">
                    <TrendingDown className="w-4 h-4 mr-2 text-orange-600" />
                    Consider Lowering Prices
                  </h4>
                  <div className="space-y-2">
                    {data.priceOptimization.overpriced.slice(0, 3).map((opp: any, index: any) => (
                      <div
                        key={`${opp.propertyId}-${opp.month}-${index}`}
                        className="p-2 bg-orange-50 rounded hover:bg-orange-100 cursor-pointer text-sm transition-colors"
                        onClick={() => {
                          const monthNum = MONTHS.findIndex(m => opp.month.toLowerCase().startsWith(m.toLowerCase())) + 1
                          if (monthNum > 0) {
                            openModal({
                              type: 'property-month',
                              propertyId: opp.propertyId,
                              propertyName: opp.propertyName,
                              month: monthNum.toString().padStart(2, '0'),
                              year: selectedYear.toString()
                            })
                          }
                        }}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{opp.propertyName}</p>
                            <p className="text-xs text-gray-600">{opp.month}</p>
                          </div>
                          <div className="text-right ml-2">
                            <p className="text-xs text-gray-600 whitespace-nowrap">
                              {formatCompactCurrency(opp.currentRate)} → {formatCompactCurrency(opp.suggestedRate)}
                            </p>
                            <p className="text-xs text-orange-600">
                              Could boost bookings
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-500 text-center py-8">
              <DollarSign className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No pricing suggestions available</p>
              <p className="text-xs text-gray-400 mt-2">
                {data.priceOptimization ? 'Your prices look good!' : 'Need more booking data to analyze'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
