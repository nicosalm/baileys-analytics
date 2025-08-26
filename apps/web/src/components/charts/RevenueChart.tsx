import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { ChartWrapper } from '@/components/ChartWrapper'
import { METRIC_COLORS } from '@/lib/theme'
import { chartFormatters, tooltipFormatters, formatChartData } from '@/utils/chart-helpers'

interface RevenueChartProps {
  data: Array<{
    month: string
    revenue: number
    profit?: number
    previousRevenue?: number
    previousProfit?: number
  }>
  title?: string
  subtitle?: string
  height?: number
  showProfit?: boolean
  showComparison?: boolean
  comparisonMode?: 'none' | 'previous-period' | 'previous-year'
  onMonthClick?: (month: string) => void
}

export const RevenueChart: React.FC<RevenueChartProps> = ({
  data,
  title = 'Revenue Trend',
  subtitle,
  height = 320,
  showProfit = false,
  showComparison = false,
  comparisonMode = 'none',
  onMonthClick
}) => {
  if (!data || data.length === 0) {
    return (
      <ChartWrapper title={title} height={height}>
        <div className="flex items-center justify-center h-full text-gray-500">
          No data available
        </div>
      </ChartWrapper>
    )
  }
  
  const formattedData = formatChartData(data, 'month')
  return (
    <ChartWrapper title={title} subtitle={subtitle} height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={formattedData}
          onClick={(e: any) => {
            if (e && e.activeLabel && onMonthClick) {
              // Find the original data point using the formatted label
              const dataPoint = formattedData.find(d => d.month === e.activeLabel)
              if (dataPoint) {
                // Look for the original date in the source data
                const index = formattedData.indexOf(dataPoint)
                const originalDate = data[index]?.month
                if (originalDate) {
                  onMonthClick(originalDate)
                } else {
                  // Fallback to the formatted label
                  onMonthClick(e.activeLabel)
                }
              }
            }
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis tickFormatter={chartFormatters.currency} />
          <Tooltip 
            formatter={(value: number, name: string) => {
              if (name === 'revenue') return [tooltipFormatters.currency(value), 'Current']
              if (name === 'previousRevenue') {
                return [tooltipFormatters.currency(value), 
                  comparisonMode === 'previous-year' ? 'Last Year' : 'Previous Period']
              }
              if (name === 'profit') return [tooltipFormatters.currency(value), 'Profit']
              if (name === 'previousProfit') {
                return [tooltipFormatters.currency(value), 
                  comparisonMode === 'previous-year' ? 'Last Year Profit' : 'Previous Profit']
              }
              return [tooltipFormatters.currency(value), name]
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke={METRIC_COLORS.revenue}
            strokeWidth={3}
            dot={{ fill: METRIC_COLORS.revenue, r: 5 }}
            activeDot={{ r: 7 }}
            cursor={onMonthClick ? 'pointer' : undefined}
            name="Gross Revenue"
          />
          {showProfit && (
            <Line
              type="monotone"
              dataKey="profit"
              stroke={METRIC_COLORS.profit}
              strokeWidth={3}
              dot={{ fill: METRIC_COLORS.profit, r: 5 }}
              activeDot={{ r: 7 }}
              cursor={onMonthClick ? 'pointer' : undefined}
              name="Net Profit"
            />
          )}
          {showComparison && (
            <>
              <Line
                type="monotone"
                dataKey="previousRevenue"
                stroke="#94a3b8"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name={comparisonMode === 'previous-year' ? 'Last Year Revenue' : 'Previous Revenue'}
              />
              {showProfit && (
                <Line
                  type="monotone"
                  dataKey="previousProfit"
                  stroke="#cbd5e1"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  dot={false}
                  name={comparisonMode === 'previous-year' ? 'Last Year Profit' : 'Previous Profit'}
                />
              )}
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}