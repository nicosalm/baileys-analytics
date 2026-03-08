import React, { useState, useCallback } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Label } from 'recharts'
import type { TooltipContentProps } from 'recharts'
import { ChartWrapper } from '@/components/ChartWrapper'
import { getPlatformColor, resolveToken } from '@/lib/theme'
import { formatCurrency, formatCompactCurrency } from '@baileys/utils'

interface PlatformDistributionChartProps {
  data: Array<{
    name: string
    revenue: number
    percentage: number
  }>
  title?: string
  height?: number
}

const PlatformDistTooltip = ({ active, payload }: Partial<TooltipContentProps<number, string>>) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-card p-3 rounded-lg shadow-lg border border-border">
        <p className="font-semibold text-sm mb-2">{data.name}</p>
        <div className="space-y-1 text-xs">
          <p className="flex justify-between gap-4">
            <span className="text-muted-foreground">Revenue:</span>
            <span className="font-medium text-success">{formatCurrency(data.revenue)}</span>
          </p>
          <p className="flex justify-between gap-4">
            <span className="text-muted-foreground">Share:</span>
            <span className="font-medium">{data.percentage?.toFixed(1) || '0.0'}%</span>
          </p>
        </div>
      </div>
    )
  }
  return null
}

export const PlatformDistributionChart: React.FC<PlatformDistributionChartProps> = ({
  data,
  title = 'Revenue by Platform',
  height = 320
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  if (!data || data.length === 0) {
    return (
      <ChartWrapper title={title} height={height} noData noDataMessage="No platform data available">
        <div />
      </ChartWrapper>
    )
  }

  const chartData = data
    .map(item => ({ ...item, value: item.revenue }))
    .sort((a, b) => b.value - a.value)

  const total = chartData.reduce((sum, item) => sum + item.value, 0)

  const handleMouseEnter = useCallback((_: unknown, index: number) => {
    setActiveIndex(index)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setActiveIndex(null)
  }, [])

  return (
    <ChartWrapper title={title} height={height} responsive={false}>
      <div style={{ height: height - 40 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="80%"
              dataKey="value"
              stroke={resolveToken('--card')}
              strokeWidth={2}
              animationBegin={0}
              animationDuration={500}
              animationEasing="ease-out"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getPlatformColor(entry.name, index)}
                  opacity={activeIndex === null || activeIndex === index ? 1 : 0.3}
                  style={{ transition: 'opacity 0.2s ease' }}
                />
              ))}
              <Label
                content={({ viewBox }) => {
                  const { cx, cy } = viewBox as { cx: number; cy: number }
                  return (
                    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                      <tspan x={cx} y={cy - 8} className="fill-foreground text-lg font-bold">
                        {formatCompactCurrency(total)}
                      </tspan>
                      <tspan x={cx} y={cy + 12} className="fill-muted-foreground text-xs">
                        Revenue
                      </tspan>
                    </text>
                  )
                }}
              />
            </Pie>
            <Tooltip content={<PlatformDistTooltip />} isAnimationActive={false} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-3 justify-center text-xs px-4">
        {chartData.map((entry, index) => (
          <div key={entry.name} className="flex items-center gap-1.5">
            <div className="w-3 h-2.5 rounded-sm" style={{ backgroundColor: getPlatformColor(entry.name, index) }} />
            <span className="text-muted-foreground">{entry.name}</span>
          </div>
        ))}
      </div>
    </ChartWrapper>
  )
}
