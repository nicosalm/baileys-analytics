import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { TooltipContentProps } from 'recharts'
import type { MouseHandlerDataParam } from 'recharts'
import { ChartWrapper } from '@/components/ChartWrapper'
import { METRIC_COLORS, CHART_INFRA, resolveToken } from '@/lib/theme'
import { chartFormatters, formatChartData } from '@/utils/chart-helpers'
import { formatCurrency } from '@/utils/formatters'

const TaxChartTooltip = ({ active, payload, label }: Partial<TooltipContentProps<number, string>>) => {
  if (!active || !payload?.length) return null
  const data = payload[0].payload

  return (
    <div className="bg-card p-3 rounded-lg shadow-lg border border-border">
      <p className="font-semibold text-sm mb-2">{label}</p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: METRIC_COLORS.tax }} />
            <span className="text-muted-foreground">Total Tax:</span>
          </div>
          <span className="font-medium">{formatCurrency(data.totalTax)}</span>
        </div>
        {data.ownerRemitted !== undefined && (
          <div className="flex justify-between gap-4">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: resolveToken('--warning') }} />
              <span className="text-muted-foreground">Owner Remitted:</span>
            </div>
            <span className="font-medium">{formatCurrency(data.ownerRemitted)}</span>
          </div>
        )}
        {data.platformRemitted !== undefined && (
          <div className="flex justify-between gap-4">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: resolveToken('--success') }} />
              <span className="text-muted-foreground">Platform Remitted:</span>
            </div>
            <span className="font-medium">{formatCurrency(data.platformRemitted)}</span>
          </div>
        )}
        {data.ownerRemitted !== undefined && data.platformRemitted !== undefined && (
          <div className="pt-1 mt-1 border-t border-border">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Your responsibility:</span>
              <span className="font-medium text-warning">{formatCurrency(data.ownerRemitted)}</span>
            </div>
          </div>
        )}
        <p className="text-muted-foreground/70 pt-1 mt-1 border-t border-border">Click to view details</p>
      </div>
    </div>
  )
}

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
      <ChartWrapper title={title} height={height} noData noDataMessage="No tax data available">
        <div />
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
          onClick={(e: MouseHandlerDataParam) => {
            if (e?.activeLabel && onPeriodClick) {
              const dataPoint = formattedData.find(d => d.month === e.activeLabel)
              if (dataPoint) {
                // Look for the original date in the source data
                const index = formattedData.indexOf(dataPoint)
                const originalDate = data[index]?.month
                if (originalDate) {
                  onPeriodClick(originalDate)
                } else {
                  // Fallback to the formatted label
                  onPeriodClick(String(e.activeLabel))
                }
              }
            }
          }}
          style={{ cursor: onPeriodClick ? 'pointer' : 'default' }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_INFRA.grid} />
          <XAxis dataKey="month" stroke={CHART_INFRA.axis} tick={{ fill: CHART_INFRA.axis }} />
          <YAxis tickFormatter={chartFormatters.currency} stroke={CHART_INFRA.axis} tick={{ fill: CHART_INFRA.axis }} />
          <Tooltip content={<TaxChartTooltip />} isAnimationActive={false} />
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
              stroke={resolveToken('--warning')}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: resolveToken('--warning') }}
              name="Owner Remitted"
            />
          )}
          {data[0]?.platformRemitted !== undefined && (
            <Line
              type="monotone"
              dataKey="platformRemitted"
              stroke={resolveToken('--success')}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: resolveToken('--success') }}
              name="Platform Remitted"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}