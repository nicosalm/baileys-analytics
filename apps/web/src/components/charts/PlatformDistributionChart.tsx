import React from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartWrapper } from '@/components/ChartWrapper'
import { getPlatformColor } from '@/lib/theme'
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

export const PlatformDistributionChart: React.FC<PlatformDistributionChartProps> = ({
  data,
  title = 'Revenue by Platform',
  height = 320
}) => {
  if (!data || data.length === 0) {
    return (
      <ChartWrapper title={title} height={height}>
        <div className="flex items-center justify-center h-full text-gray-500">
          No platform data available
        </div>
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
              const percent = ((entry.value / data.reduce((sum, item) => sum + item.revenue, 0)) * 100).toFixed(0)
              const name = entry.name.length > 18 ? entry.name.substring(0, 18) + '...' : entry.name
              return parseInt(percent) > 5 ? `${name} (${percent}%)` : ''
            }}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={getPlatformColor(entry.name, index)} 
              />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '6px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}