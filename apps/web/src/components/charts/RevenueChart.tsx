import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts'
import { ChartWrapper } from '@/components/ChartWrapper'
import { METRIC_COLORS, CHART_INFRA } from '@/lib/theme'
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
  comparisonLabel?: string
  onPeriodClick?: (period: string) => void
  revenueGoal?: number | null
}

const RevenueChartTooltip = ({ active, payload, label, showProfit, showComparison, comparisonLabel }: any) => {
  if (!active || !payload?.length) return null
  const data = payload[0].payload

  return (
    <div className="bg-card p-3 rounded-lg shadow-lg border border-border">
      <p className="font-semibold text-sm mb-2">{label}</p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: METRIC_COLORS.revenue }} />
            <span className="text-muted-foreground">Revenue:</span>
          </div>
          <span className="font-medium">{formatCurrency(data.revenue)}</span>
        </div>
        {showComparison && data.previousRevenue !== undefined && (
          <div className="flex justify-between gap-4">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-chart-comparison" />
              <span className="text-muted-foreground">{comparisonLabel || 'Previous'}:</span>
            </div>
            <span className="font-medium">{formatCurrency(data.previousRevenue)}</span>
          </div>
        )}
        {showProfit && data.profit !== undefined && (
          <>
            <div className="pt-1 mt-1 border-t border-border" />
            <div className="flex justify-between gap-4">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: METRIC_COLORS.profit }} />
                <span className="text-muted-foreground">Profit:</span>
              </div>
              <span className={`font-medium ${data.profit >= 0 ? 'text-success' : 'text-danger'}`}>{formatCurrency(data.profit)}</span>
            </div>
            {data.revenue > 0 && (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Margin:</span>
                <span className="font-medium">{((data.profit / data.revenue) * 100).toFixed(1)}%</span>
              </div>
            )}
            {showComparison && data.previousProfit !== undefined && (
              <div className="flex justify-between gap-4">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-sm bg-chart-comparison/70" />
                  <span className="text-muted-foreground">{comparisonLabel || 'Previous'}:</span>
                </div>
                <span className="font-medium">{formatCurrency(data.previousProfit)}</span>
              </div>
            )}
          </>
        )}
        <p className="text-muted-foreground pt-1 mt-1 border-t border-border">Click to view details</p>
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
  comparisonLabel = '',
  onPeriodClick,
  revenueGoal
}) => {
  if (!data || data.length === 0) {
    return (
      <ChartWrapper title={title} height={height} noData noDataMessage="No data available">
        <div />
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
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_INFRA.grid} />
          <XAxis dataKey="month" stroke={CHART_INFRA.axis} tick={{ fill: CHART_INFRA.axis }} />
          <YAxis tickFormatter={chartFormatters.currency} stroke={CHART_INFRA.axis} tick={{ fill: CHART_INFRA.axis }} />
          <Tooltip content={<RevenueChartTooltip showProfit={showProfit} showComparison={showComparison} comparisonLabel={comparisonLabel} />} />
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
                stroke={CHART_INFRA.comparison}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name={comparisonLabel ? `${comparisonLabel} Revenue` : 'Previous Revenue'}
              />
              {showProfit && (
                <Line
                  type="monotone"
                  dataKey="previousProfit"
                  stroke={CHART_INFRA.comparison}
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  dot={false}
                  name={comparisonLabel ? `${comparisonLabel} Profit` : 'Previous Profit'}
                />
              )}
            </>
          )}
          {revenueGoal != null && (
            <ReferenceLine
              y={revenueGoal}
              stroke={CHART_INFRA.goal}
              strokeDasharray="6 4"
              strokeWidth={1.5}
              label={{
                value: `⬥ Goal: ${formatCurrency(revenueGoal)}`,
                position: 'insideTopLeft',
                fill: CHART_INFRA.goal,
                fontSize: 12,
                fontWeight: 600,
                offset: 4
              }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}