import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartWrapper } from '@/components/ChartWrapper'
import { METRIC_COLORS } from '@/lib/theme'
import { chartFormatters, tooltipFormatters, formatChartData } from '@/utils/chart-helpers'

interface TaxTrendChartProps {
  data: Array<{
    month: string
    totalTax: number
    ownerRemitted?: number
    platformRemitted?: number
  }>
  title?: string
  height?: number
  onPeriodClick?: (period: string) => void
}

export const TaxTrendChart: React.FC<TaxTrendChartProps> = ({
  data,
  title = 'Monthly Tax Trend',
  height = 320,
  onPeriodClick
}) => {
  if (!data || data.length === 0) {
    return (
      <ChartWrapper title={title} height={height}>
        <div className="flex items-center justify-center h-full text-gray-500">
          No tax data available
        </div>
      </ChartWrapper>
    )
  }
  
  // Format the dates for display
  const formattedData = formatChartData(data, 'month')
  
  return (
    <ChartWrapper title={title} height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={formattedData}
          onClick={(e: any) => {
            if (e && e.activeLabel && onPeriodClick) {
              // Find the original data point using the formatted label
              const dataPoint = formattedData.find(d => d.month === e.activeLabel)
              if (dataPoint) {
                // Look for the original date in the source data
                const index = formattedData.indexOf(dataPoint)
                const originalDate = data[index]?.month
                if (originalDate) {
                  onPeriodClick(originalDate)
                } else {
                  // Fallback to the formatted label
                  onPeriodClick(e.activeLabel)
                }
              }
            }
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis tickFormatter={chartFormatters.currency} />
          <Tooltip formatter={tooltipFormatters.currency} />
          <Line
            type="monotone"
            dataKey="totalTax"
            stroke={METRIC_COLORS.tax}
            strokeWidth={2}
            dot={{ fill: METRIC_COLORS.tax }}
            cursor={onPeriodClick ? 'pointer' : undefined}
            name="Total Tax"
          />
          {data[0]?.ownerRemitted !== undefined && (
            <Line
              type="monotone"
              dataKey="ownerRemitted"
              stroke={METRIC_COLORS.primary}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: METRIC_COLORS.primary }}
              name="Owner Remitted"
            />
          )}
          {data[0]?.platformRemitted !== undefined && (
            <Line
              type="monotone"
              dataKey="platformRemitted"
              stroke={METRIC_COLORS.success}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: METRIC_COLORS.success }}
              name="Platform Remitted"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}