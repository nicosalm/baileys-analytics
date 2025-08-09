import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
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
import { TrendingUp, TrendingDown, Calendar, Sun, Snowflake, AlertCircle, BarChart3 } from 'lucide-react'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/contexts/toast'
import { useDrillDown } from '@/contexts/drillDown'
import { useDashboard } from '@/contexts/dashboard'
import { SeasonalData } from '@/types/seasonal'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const SeasonalDashboard = () => {
  const { addToast } = useToast()
  const { dispatch } = useDrillDown()
  const { filters } = useDashboard()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<SeasonalData | null>(null)

  // Extract year from the date range filter
  const getYearFromFilters = () => {
    if (filters.dateRange.from) {
      const fromDate = new Date(filters.dateRange.from)
      return fromDate.getFullYear()
    }
    return new Date().getFullYear()
  }

  const selectedYear = getYearFromFilters()

  const loadSeasonalData = async () => {
    setLoading(true)
    try {
      // Build the API call with filters
      const tagIds = filters.selectedTags.map(t => t.id)

      // Use the direct API request to pass all parameters
      const params = new URLSearchParams()
      params.append('year', selectedYear.toString())

      if (tagIds.length > 0) {
        params.append('tags', tagIds.join(','))
      }

      if (filters.dateRange.from) {
        params.append('from', filters.dateRange.from)
      }

      if (filters.dateRange.to) {
        params.append('to', filters.dateRange.to)
      }

      const result = await api.request<SeasonalData>(
        `/seasonal-analysis?${params.toString()}`
      )

      console.log('API Response:', result) // Debug log

      if (result.success && result.data) {
        console.log('Raw seasonal data:', result.data) // Debug log
        setData(result.data)
      } else {
        console.error('API Error:', result)
        const errorMessage = !result.success && 'error' in result
          ? result.error
          : 'Failed to load seasonal data'
        addToast('error', errorMessage)
        setData(null)
      }
    } catch (error) {
      console.error('Error loading seasonal data:', error)
      addToast('error', 'Failed to load seasonal data')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  // Reload data when filters change
  useEffect(() => {
    loadSeasonalData()
  }, [filters.dateRange.from, filters.dateRange.to, filters.selectedTags])

  if (loading) {
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
          onClick={loadSeasonalData}
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
    .filter(y => y.year && !isNaN(y.revenue))
    .sort((a, b) => a.year - b.year)
    .map(year => ({
      year: year.year,
      revenue: year.revenue || 0,
      occupancy: Math.min(100, year.occupancy || 0), // Cap at 100%
      avgRate: year.avgNightlyRate || 0
    }))

  const monthlyComparison = data.monthlyTrends
    .filter(m => m.monthName && m.monthName.trim() !== '')
    .map(month => ({
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
    if (name === 'Occupancy %') return `${numValue.toFixed(1)}%`
    if (name === 'growth') return `${numValue.toFixed(1)}%`
    return formatCurrency(numValue)
  }

  const formatYAxisTick = (value: number) => formatCompactCurrency(value)
  const formatPercentageTick = (value: number) => `${value}%`

  // Display the date range being analyzed
  const dateRangeDisplay = filters.dateRange.from && filters.dateRange.to
    ? `${new Date(filters.dateRange.from).toLocaleDateString()} - ${new Date(filters.dateRange.to).toLocaleDateString()}`
    : `Year ${selectedYear}`

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Seasonal Analysis</h2>
        <div className="text-sm text-gray-600">
          Analyzing: {dateRangeDisplay}
        </div>
      </div>


      {/* Key Metrics Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <Calendar className="w-4 h-4 mr-1" />
            Peak Season
          </div>
          <div className="text-2xl font-bold flex items-center">
            {data.seasonalPatterns.peakMonths[0]?.month || 'N/A'}
            {data.seasonalPatterns.peakMonths[0] && getSeasonEmoji(data.seasonalPatterns.peakMonths[0].month)}
          </div>
          <div className="text-sm text-gray-500">
            {data.seasonalPatterns.avgPeakOccupancy > 0
              ? `${formatPercentage(data.seasonalPatterns.avgPeakOccupancy, 0)} occupancy`
              : 'No data'}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <Calendar className="w-4 h-4 mr-1" />
            Low Season
          </div>
          <div className="text-2xl font-bold flex items-center">
            {data.seasonalPatterns.lowMonths[0]?.month || 'N/A'}
            {data.seasonalPatterns.lowMonths[0] && getSeasonEmoji(data.seasonalPatterns.lowMonths[0].month)}
          </div>
          <div className="text-sm text-gray-500">
            {data.seasonalPatterns.avgLowOccupancy >= 0
              ? `${formatPercentage(data.seasonalPatterns.avgLowOccupancy, 0)} occupancy`
              : 'No data'}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <TrendingUp className="w-4 h-4 mr-1" />
            YoY Revenue
          </div>
          <div className="text-2xl font-bold flex items-center">
            {formatPercentage(yearGrowthRate, 1)}
            {yearGrowthRate >= 0
              ? <TrendingUp className="w-5 h-5 ml-2 text-green-600" />
              : <TrendingDown className="w-5 h-5 ml-2 text-red-600" />
            }
          </div>
          <div className="text-sm text-gray-500">
            {formatCompactCurrency(data.yearOverYear.currentYear)} vs {formatCompactCurrency(data.yearOverYear.previousYear)}
          </div>
        </div>
      </div>

      {/* Charts */}
      {!hasYearData && !hasMonthlyData && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-yellow-800 font-medium">Limited Historical Data</p>
              <p className="text-sm text-yellow-700 mt-1">
                Year-over-year and monthly comparison charts require historical booking data.
                These charts will populate as more data becomes available.
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
            Year-over-Year Performance
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
                  <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#3B82F6" name="Revenue" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line yAxisId="right" type="monotone" dataKey="occupancy" stroke="#10B981" name="Occupancy %" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line yAxisId="left" type="monotone" dataKey="avgRate" stroke="#F59E0B" name="Avg Rate" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} activeDot={{ r: 5 }} />
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
                      const monthData = monthlyComparison.find(m => m.month === data.activeLabel)
                      if (monthData) {
                        const monthNum = MONTHS.indexOf(monthData.month) + 1
                        dispatch({
                          type: 'DRILL_TO_MONTH',
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
                  <Tooltip formatter={(value) => formatCurrency(ensureNumber(value))} contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '6px' }} />
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
          <h3 className="text-lg font-bold mb-4">Property Seasonality</h3>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {data.propertySeasonality?.length > 0 ? (
              data.propertySeasonality
                .sort((a, b) => b.seasonalityScore - a.seasonalityScore)
                .map(property => (
                <div
                  key={property.propertyId}
                  className="p-3 border rounded hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => dispatch({
                    type: 'DRILL_TO_PROPERTY',
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
                        {property.seasonalityScore > 50 ? 'High' : property.seasonalityScore > 25 ? 'Moderate' : 'Low'} variation
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
          <h3 className="text-lg font-bold mb-4">Price Optimization Opportunities</h3>
          {(data.priceOptimization?.underpriced?.length > 0 || data.priceOptimization?.overpriced?.length > 0) ? (
            <div className="space-y-4 max-h-80 overflow-y-auto">
              {/* Underpriced Properties */}
              {data.priceOptimization.underpriced?.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center text-sm">
                    <TrendingUp className="w-4 h-4 mr-2 text-green-600" />
                    Potential Rate Increases
                  </h4>
                  <div className="space-y-2">
                    {data.priceOptimization.underpriced.slice(0, 3).map((opp, index) => (
                      <div
                        key={`${opp.propertyId}-${opp.month}-${index}`}
                        className="p-2 bg-green-50 rounded hover:bg-green-100 cursor-pointer text-sm transition-colors"
                        onClick={() => {
                          const monthNum = MONTHS.findIndex(m => opp.month.toLowerCase().startsWith(m.toLowerCase())) + 1
                          if (monthNum > 0) {
                            dispatch({
                              type: 'DRILL_TO_PROPERTY_MONTH',
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
                    Consider Rate Adjustments
                  </h4>
                  <div className="space-y-2">
                    {data.priceOptimization.overpriced.slice(0, 3).map((opp, index) => (
                      <div
                        key={`${opp.propertyId}-${opp.month}-${index}`}
                        className="p-2 bg-orange-50 rounded hover:bg-orange-100 cursor-pointer text-sm transition-colors"
                        onClick={() => {
                          const monthNum = MONTHS.findIndex(m => opp.month.toLowerCase().startsWith(m.toLowerCase())) + 1
                          if (monthNum > 0) {
                            dispatch({
                              type: 'DRILL_TO_PROPERTY_MONTH',
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
                              +{formatPercentage(Math.min(opp.occupancyImpact * 100, 100), 0)} occupancy
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
              <p>No optimization opportunities identified</p>
              <p className="text-xs text-gray-400 mt-2">
                {data.priceOptimization ? 'All properties appear to be optimally priced' : 'Insufficient data for analysis'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
