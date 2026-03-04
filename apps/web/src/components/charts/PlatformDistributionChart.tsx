import React from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartWrapper } from '@/components/ChartWrapper'
import { getPlatformColor, resolveToken } from '@/lib/theme'
import { formatCurrency } from '@baileys/utils'

interface PlatformDistributionChartProps {
  data: Array<{
    name: string
    revenue: number
    percentage: number
  }>
  title?: string
  height?: number
}

const PlatformDistTooltip = ({ active, payload }: any) => {
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
  if (!data || data.length === 0) {
    return (
      <ChartWrapper title={title} height={height} noData noDataMessage="No platform data available">
        <div />
      </ChartWrapper>
    )
  }

  const chartData = data.map(item => ({
    ...item,
    value: item.revenue
  }))

  return (
    <ChartWrapper title={title} height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={(entry: any) => {
              const percent = ((entry.percent || 0) * 100).toFixed(0)
              const name = entry.name.length > 18 ? entry.name.substring(0, 18) + '...' : entry.name
              return parseInt(percent) > 5 ? `${name} (${percent}%)` : ''
            }}
            outerRadius="70%"
            dataKey="value"
            stroke={resolveToken('--card')}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getPlatformColor(entry.name, index)}
              />
            ))}
          </Pie>
          <Tooltip content={<PlatformDistTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}
