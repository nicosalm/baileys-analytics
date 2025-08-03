import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { formatCurrency } from '@baileys/utils'
import {
  LineChart, Line, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { TrendingUp, TrendingDown, Calendar, Sun, Snowflake } from 'lucide-react'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/contexts/toast'
import { useDrillDown } from '@/contexts/drillDown'
import { SeasonalData } from '@/types/seasonal'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const SeasonalDashboard = () => {
  const { addToast } = useToast()
  const { dispatch } = useDrillDown()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<SeasonalData | null>(null)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  const loadSeasonalData = async () => {
    setLoading(true)
    const result = await api.request<SeasonalData>(
      `/seasonal-analysis?year=${selectedYear}`
    )

    if (result.success) {
      setData(result.data)
    } else {
      addToast('error', 'Failed to load seasonal data')
    }
    setLoading(false)
  }

  useEffect(() => {
    loadSeasonalData()
  }, [selectedYear])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!data) return null

  const yearOverYearChart = data.yearOverYear.years.map(year => ({
    year: year.year,
    revenue: year.revenue,
    occupancy: year.occupancy * 100,
    avgRate: year.avgNightlyRate
  }))

  const monthlyComparison = data.monthlyTrends.map(month => ({
    month: month.monthName.slice(0, 3),
    current: month.currentYear.revenue,
    previous: month.previousYear.revenue,
    growth: month.yoyGrowth.revenue
  }))

  const seasonalRadarData = MONTHS.map((month, index) => {
    const monthData = data.propertySeasonality[0]?.monthlyOccupancy.find(m => m.month === index + 1)
    return {
      month,
      occupancy: monthData?.occupancy || 0
    }
  })

  const getSeasonEmoji = (month: string) => {
    const monthNum = MONTHS.indexOf(month.slice(0, 3)) + 1
    if (monthNum >= 6 && monthNum <= 8) return <Sun className="w-4 h-4 text-yellow-500" />
    if (monthNum === 12 || monthNum <= 2) return <Snowflake className="w-4 h-4 text-blue-500" />
    return null
  }

  const formatGrowthPercent = (value: number) => {
    const formatted = (value * 100).toFixed(1)
    return value >= 0 ? `+${formatted}%` : `${formatted}%`
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Seasonal Analysis</h2>
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-600">Year:</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 border rounded"
          >
            {[...Array(5)].map((_, i) => {
              const year = new Date().getFullYear() - i
              return <option key={year} value={year}>{year}</option>
            })}
          </select>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
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
            {(data.seasonalPatterns.avgPeakOccupancy * 100).toFixed(0)}% occupancy
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
            {(data.seasonalPatterns.avgLowOccupancy * 100).toFixed(0)}% occupancy
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <TrendingUp className="w-4 h-4 mr-1" />
            YoY Revenue
          </div>
          <div className="text-2xl font-bold flex items-center">
            {formatGrowthPercent(
              (data.yearOverYear.currentYear - data.yearOverYear.previousYear) /
              data.yearOverYear.previousYear
            )}
            {data.yearOverYear.currentYear > data.yearOverYear.previousYear
              ? <TrendingUp className="w-5 h-5 ml-2 text-green-600" />
              : <TrendingDown className="w-5 h-5 ml-2 text-red-600" />
            }
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-2">Seasonality Index</div>
          <div className="text-2xl font-bold">
            {(data.seasonalPatterns.seasonalityIndex * 100).toFixed(0)}%
          </div>
          <div className="text-sm text-gray-500">
            {data.seasonalPatterns.seasonalityIndex > 0.5 ? 'High' : 'Low'} variation
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4">Year-over-Year Performance</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={yearOverYearChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis yAxisId="left" tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `${value}%`} />
                <Tooltip formatter={(value, name) =>
                  name === 'occupancy' ? `${value}%` : formatCurrency(Number(value))
                } />
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
          <div className="h-80">
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
                <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
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
          <h3 className="text-lg font-bold mb-4">Seasonal Occupancy Pattern</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={seasonalRadarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="month" />
                <PolarRadiusAxis angle={90} domain={[0, 100]} />
                <Radar name="Occupancy %" dataKey="occupancy" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} />
                <Tooltip formatter={(value) => `${value}%`} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4">Property Seasonality</h3>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {data.propertySeasonality.map(property => (
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
                      Seasonality: {(property.seasonalityScore * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs text-gray-500">
                      {property.seasonalityScore > 0.5 ? 'High' : 'Low'} variation
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-bold mb-4">Price Optimization Opportunities</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-3 flex items-center">
              <TrendingUp className="w-4 h-4 mr-2 text-green-600" />
              Underpriced Periods
            </h4>
            <div className="space-y-2">
              {data.priceOptimization.underpriced.slice(0, 5).map((opp, index) => (
                <div
                  key={index}
                  className="p-2 bg-green-50 rounded hover:bg-green-100 cursor-pointer"
                  onClick={() => {
                    const monthNum = MONTHS.indexOf(opp.month.slice(0, 3)) + 1
                    dispatch({
                      type: 'DRILL_TO_PROPERTY_MONTH',
                      propertyId: opp.propertyId,
                      propertyName: opp.propertyName,
                      month: monthNum.toString().padStart(2, '0'),
                      year: selectedYear.toString()
                    })
                  }}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-sm">{opp.propertyName}</p>
                      <p className="text-xs text-gray-600">{opp.month}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">
                        ${opp.currentRate} → ${opp.suggestedRate}
                      </p>
                      <p className="text-xs text-green-600">
                        +{formatCurrency(opp.revenueOpportunity)} potential
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3 flex items-center">
              <TrendingDown className="w-4 h-4 mr-2 text-red-600" />
              Overpriced Periods
            </h4>
            <div className="space-y-2">
              {data.priceOptimization.overpriced.slice(0, 5).map((opp, index) => (
                <div
                  key={index}
                  className="p-2 bg-red-50 rounded hover:bg-red-100 cursor-pointer"
                  onClick={() => {
                    const monthNum = MONTHS.indexOf(opp.month.slice(0, 3)) + 1
                    dispatch({
                      type: 'DRILL_TO_PROPERTY_MONTH',
                      propertyId: opp.propertyId,
                      propertyName: opp.propertyName,
                      month: monthNum.toString().padStart(2, '0'),
                      year: selectedYear.toString()
                    })
                  }}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-sm">{opp.propertyName}</p>
                      <p className="text-xs text-gray-600">{opp.month}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">
                        ${opp.currentRate} → ${opp.suggestedRate}
                      </p>
                      <p className="text-xs text-red-600">
                        Low occupancy impact
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
