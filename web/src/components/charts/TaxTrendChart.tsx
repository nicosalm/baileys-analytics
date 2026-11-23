import type React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { TooltipContentProps } from 'recharts'
import type { MouseHandlerDataParam } from 'recharts'
import { ChartWrapper } from '@/components/ChartWrapper'
import { METRIC_COLORS, CHART_INFRA, resolveToken } from '@/lib/theme'
import { chartFormatters, formatChartData } from '@/utils/chart-helpers'
import { formatCurrency } from '@/utils/formatters'
import { ChartLegend } from './ChartLegend'
import { getChargeColor, getChartColor } from '@/lib/theme'

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
              <span className="font-medium text-warning-fg">{formatCurrency(data.ownerRemitted)}</span>
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

// shared with the remittance summary so the split reads the same in both places
export const TAX_COLORS = {
  get total() {
    return getChargeColor('tax')
  },
  get owner() {
    return getChartColor(0)
  },
  get platform() {
    return getChartColor(4)
  },
}

export const TaxTrendChart: React.FC<TaxTrendChartProps> = ({ data, title = 'Monthly tax', height = 320, onPeriodClick }) => {
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
    <ChartWrapper title={title} height={height} responsive={false}>
      <div className="h-full flex flex-col">
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={formattedData}
              onClick={(e: MouseHandlerDataParam) => {
                if (e?.activeLabel && onPeriodClick) {
                  const dataPoint = formattedData.find((d) => d.month === e.activeLabel)
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
              <CartesianGrid vertical={false} stroke={CHART_INFRA.grid} strokeOpacity={0.6} />
              <XAxis dataKey="month" tick={{ fill: CHART_INFRA.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={chartFormatters.currency}
                tick={{ fill: CHART_INFRA.axis, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<TaxChartTooltip />} isAnimationActive={false} />
              <Line
                type="monotone"
                dataKey="totalTax"
                stroke={TAX_COLORS.total}
                strokeWidth={2}
                dot={false}
                cursor={onPeriodClick ? 'pointer' : undefined}
                name="Total tax"
              />
              {data[0]?.ownerRemitted !== undefined && (
                <Line
                  type="monotone"
                  dataKey="ownerRemitted"
                  stroke={TAX_COLORS.owner}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                  name="You remit"
                />
              )}
              {data[0]?.platformRemitted !== undefined && (
                <Line
                  type="monotone"
                  dataKey="platformRemitted"
                  stroke={TAX_COLORS.platform}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                  name="Platforms remit"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <ChartLegend
          className="mt-2"
          items={[
            { label: 'Total tax', color: TAX_COLORS.total },
            ...(data[0]?.ownerRemitted !== undefined ? [{ label: 'You remit', color: TAX_COLORS.owner, dashed: true }] : []),
            ...(data[0]?.platformRemitted !== undefined ? [{ label: 'Platforms remit', color: TAX_COLORS.platform, dashed: true }] : []),
          ]}
        />
      </div>
    </ChartWrapper>
  )
}
