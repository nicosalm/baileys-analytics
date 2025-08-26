import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartWrapper } from '@/components/ChartWrapper'
import { METRIC_COLORS } from '@/lib/theme'
import { chartFormatters, tooltipFormatters, formatChartData } from '@/utils/chart-helpers'

interface RevenueChartProps {
  data: Array<{
    month: string
    revenue: number
    profit?: number
  }>
  title?: string
  height?: number
  showProfit?: boolean
  onMonthClick?: (month: string) => void
}

export const RevenueChart: React.FC<RevenueChartProps> = ({
  data,
  title = 'Revenue Trend',
  height = 256,
  showProfit = false,
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
    <ChartWrapper title={title} height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={formattedData}
          onClick={(e: any) => {
            if (e && e.activeLabel && onMonthClick) {
              onMonthClick(e.activeLabel)
            }
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis tickFormatter={chartFormatters.currency} />
          <Tooltip formatter={tooltipFormatters.currency} />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke={METRIC_COLORS.revenue}
            strokeWidth={2}
            dot={{ fill: METRIC_COLORS.revenue }}
            cursor={onMonthClick ? 'pointer' : undefined}
          />
          {showProfit && (
            <Line
              type="monotone"
              dataKey="profit"
              stroke={METRIC_COLORS.profit}
              strokeWidth={2}
              dot={{ fill: METRIC_COLORS.profit }}
              cursor={onMonthClick ? 'pointer' : undefined}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}