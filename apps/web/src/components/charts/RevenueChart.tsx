import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { ChartWrapper } from '@/components/ChartWrapper'
import { METRIC_COLORS } from '@/lib/theme'
import { chartFormatters, formatChartData } from '@/utils/chart-helpers'
import { formatCurrency } from '@/utils/formatters'

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
  onPeriodClick?: (period: string) => void
}

const RevenueChartTooltip = ({ active, payload, label, showProfit, showComparison, comparisonMode }: any) => {
  if (!active || !payload?.length) return null
  const data = payload[0].payload

  return (
    <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
      <p className="font-semibold text-sm mb-2">{label}</p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: METRIC_COLORS.revenue }} />
            <span className="text-gray-600">Revenue:</span>
          </div>
          <span className="font-medium">{formatCurrency(data.revenue)}</span>
        </div>
        {showComparison && data.previousRevenue !== undefined && (
          <div className="flex justify-between gap-4">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-slate-400" />
              <span className="text-gray-600">{comparisonMode === 'previous-year' ? 'Last Year' : 'Previous'}:</span>
            </div>
            <span className="font-medium">{formatCurrency(data.previousRevenue)}</span>
          </div>
        )}
        {showProfit && data.profit !== undefined && (
          <>
            <div className="pt-1 mt-1 border-t border-gray-200" />
            <div className="flex justify-between gap-4">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: METRIC_COLORS.profit }} />
                <span className="text-gray-600">Profit:</span>
              </div>
              <span className={`font-medium ${data.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(data.profit)}</span>
            </div>
            {data.revenue > 0 && (
              <div className="flex justify-between gap-4">
                <span className="text-gray-600">Margin:</span>
                <span className="font-medium">{((data.profit / data.revenue) * 100).toFixed(1)}%</span>
              </div>
            )}
            {showComparison && data.previousProfit !== undefined && (
              <div className="flex justify-between gap-4">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-sm bg-slate-300" />
                  <span className="text-gray-600">{comparisonMode === 'previous-year' ? 'Last Year' : 'Previous'}:</span>
                </div>
                <span className="font-medium">{formatCurrency(data.previousProfit)}</span>
              </div>
            )}
          </>
        )}
        <p className="text-gray-400 pt-1 mt-1 border-t border-gray-200">Click to view details</p>
      </div>
    </div>
  )
}

export const RevenueChart: React.FC<RevenueChartProps> = ({
  data,
  title = 'Revenue Trend',
  subtitle,
  height = 320,
  showProfit = false,
  showComparison = false,
  comparisonMode = 'none',
  onPeriodClick
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
          style={{ cursor: onPeriodClick ? 'pointer' : 'default' }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis tickFormatter={chartFormatters.currency} />
          <Tooltip content={<RevenueChartTooltip showProfit={showProfit} showComparison={showComparison} comparisonMode={comparisonMode} />} />
          <Legend />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke={METRIC_COLORS.revenue}
            strokeWidth={3}
            dot={{ fill: METRIC_COLORS.revenue, r: 5 }}
            activeDot={{ r: 7 }}
            cursor={onPeriodClick ? 'pointer' : undefined}
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
              cursor={onPeriodClick ? 'pointer' : undefined}
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