import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { formatCurrency, formatCompactCurrency, calculateGrowthRate, formatPercentage, ensureNumber } from '@baileys/utils'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { TrendingUp, TrendingDown, Calendar, Sun, Snowflake } from 'lucide-react'
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

  // Extract year from date range
  const selectedYear = filters.dateRange.from
    ? new Date(filters.dateRange.from).getFullYear()
    : new Date().getFullYear()

  const loadSeasonalData = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.append('year', selectedYear.toString())

    if (filters.selectedTags.length > 0) {
      params.append('tags', filters.selectedTags.map(t => t.id).join(','))
    }

    const result = await api.request<SeasonalData>(`/seasonal-analysis?${params}`)

    if (result.success) {
      setData(result.data)
    } else {
      addToast('error', 'Failed to load seasonal data')
    }
    setLoading(false)
  }

  useEffect(() => {
    loadSeasonalData()
  }, [selectedYear, filters.selectedTags])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!data) return null

  // Check for sufficient data
  if (!data.seasonalPatterns.peakMonths?.length || !data.seasonalPatterns.lowMonths?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Calendar className="w-12 h-12 text-gray-400 mb-4" />
        <p className="text-gray-600">Insufficient data for seasonal analysis</p>
        <p className="text-sm text-gray-500 mt-2">Please ensure you have bookings data for the selected period</p>
      </div>
    )
  }

  const yearOverYearChart = data.yearOverYear.years.map(year => ({
    year: year.year,
    revenue: year.revenue,
    occupancy: year.occupancy,
    avgRate: year.avgNightlyRate
  }))

  const monthlyComparison = data.monthlyTrends.map(month => ({
    month: month.monthName.slice(0, 3),
    current: month.currentYear.revenue,
    previous: month.previousYear.revenue,
    growth: month.yoyGrowth.revenue
  }))

  const getSeasonEmoji = (month: string) => {
    const monthNum = MONTHS.indexOf(month.slice(0, 3)) + 1
    if (monthNum >= 6 && monthNum <= 8) return <Sun className="w-4 h-4 text-yellow-500" />
    if (monthNum === 12 || monthNum <= 2) return <Snowflake className="w-4 h-4 text-blue-500" />
    return null
  }

  const yearGrowthRate = calculateGrowthRate(
    data.yearOverYear.currentYear,
    data.yearOverYear.previousYear
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Seasonal Analysis</h2>
        <div className="text-sm text-gray-600">Year: {selectedYear}</div>
      </div>

      {filters.selectedTags.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
          Filtered by tags: {filters.selectedTags.map(t => t.name).join(', ')}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <Calendar className="w-4 h-4 mr-1" />
            Peak Season
          </div>
          <div className="text-2xl font-bold flex items-center">
            {data.seasonalPatterns.peakMonths[0]?.month}
            {getSeasonEmoji(data.seasonalPatterns.peakMonths[0]?.month || '')}
          </div>
          <div className="text-sm text-gray-500">
            {formatPercentage(data.seasonalPatterns.avgPeakOccupancy, 0)} occupancy
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <Calendar className="w-4 h-4 mr-1" />
            Low Season
          </div>
          <div className="text-2xl font-bold flex items-center">
            {data.seasonalPatterns.lowMonths[0]?.month}
            {getSeasonEmoji(data.seasonalPatterns.lowMonths[0]?.month || '')}
          </div>
          <div className="text-sm text-gray-500">
            {formatPercentage(data.seasonalPatterns.avgLowOccupancy, 0)} occupancy
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
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4">Year-over-Year Performance</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={yearOverYearChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis yAxisId="left" tickFormatter={(value) => formatCompactCurrency(value)} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `${value}%`} />
                <Tooltip formatter={(value: any, name: string) => {
                  if (name === 'Occupancy %') return `${ensureNumber(value).toFixed(1)}%`
                  return formatCurrency(ensureNumber(value))
                }} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#3B82F6" name="Revenue" strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="occupancy" stroke="#10B981" name="Occupancy %" strokeWidth={2} />
                <Line yAxisId="left" type="monotone" dataKey="avgRate" stroke="#F59E0B" name="Avg Rate" strokeWidth={2} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4">Monthly Revenue Comparison</h3>
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
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => formatCompactCurrency(value)} />
                <Tooltip formatter={(value) => formatCurrency(ensureNumber(value))} />
                <Legend />
                <Bar dataKey="previous" fill="#E5E7EB" name={`${selectedYear - 1}`} cursor="pointer" />
                <Bar dataKey="current" fill="#3B82F6" name={`${selectedYear}`} cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4">Property Seasonality</h3>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {data.propertySeasonality?.length > 0 ? (
              data.propertySeasonality.map(property => (
                <div
                  key={property.propertyId}
                  className="p-3 border rounded hover:bg-gray-50 cursor-pointer"
                  onClick={() => dispatch({
                    type: 'DRILL_TO_PROPERTY',
                    propertyId: property.propertyId,
                    propertyName: property.propertyName
                  })}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">{property.propertyName}</h4>
                      <p className="text-sm text-gray-600">
                        Peak: {property.peakMonth} | Low: {property.lowMonth}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        Variation: {formatPercentage(property.seasonalityScore, 0)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {property.seasonalityScore > 50 ? 'High' : 'Low'} seasonality
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

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4">Price Optimization Opportunities</h3>
          {data.priceOptimization?.underpriced?.length > 0 || data.priceOptimization?.overpriced?.length > 0 ? (
            <div className="space-y-4 max-h-80 overflow-y-auto">
              {data.priceOptimization.underpriced?.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center text-sm">
                    <TrendingUp className="w-4 h-4 mr-2 text-green-600" />
                    Potential Rate Increases
                  </h4>
                  <div className="space-y-2">
                    {data.priceOptimization.underpriced.slice(0, 3).map((opp) => (
                      <div
                        key={`${opp.propertyId}-${opp.month}`}
                        className="p-2 bg-green-50 rounded hover:bg-green-100 cursor-pointer text-sm"
                        onClick={() => {
                          const monthNum = MONTHS.findIndex(m =>
                            opp.month.toLowerCase().startsWith(m.toLowerCase())
                          ) + 1
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
                          <div>
                            <p className="font-medium">{opp.propertyName}</p>
                            <p className="text-xs text-gray-600">{opp.month}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-green-700">
                              +{formatCompactCurrency(opp.revenueOpportunity)}
                            </p>
                            <p className="text-xs text-gray-600">
                              {formatCompactCurrency(opp.currentRate)} → {formatCompactCurrency(opp.suggestedRate)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.priceOptimization.overpriced?.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center text-sm">
                    <TrendingDown className="w-4 h-4 mr-2 text-orange-600" />
                    Consider Rate Adjustments
                  </h4>
                  <div className="space-y-2">
                    {data.priceOptimization.overpriced.slice(0, 3).map((opp) => (
                      <div
                        key={`${opp.propertyId}-${opp.month}`}
                        className="p-2 bg-orange-50 rounded hover:bg-orange-100 cursor-pointer text-sm"
                        onClick={() => {
                          const monthNum = MONTHS.findIndex(m =>
                            opp.month.toLowerCase().startsWith(m.toLowerCase())
                          ) + 1
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
                          <div>
                            <p className="font-medium">{opp.propertyName}</p>
                            <p className="text-xs text-gray-600">{opp.month}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-600">
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
            <p className="text-gray-500 text-center py-8">No optimization opportunities identified</p>
          )}
        </div>
      </div>
    </div>
  )
}
