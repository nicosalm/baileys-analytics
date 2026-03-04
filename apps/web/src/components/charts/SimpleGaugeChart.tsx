import React from 'react'
import { PieChart, Pie, Cell } from 'recharts'
import { formatCompactCurrency } from '@baileys/utils'
import { GAUGE_COLORS, resolveToken } from '@/lib/theme'

interface SimpleGaugeChartProps {
  value: number
  min?: number
  max?: number
  format?: 'currency' | 'percent' | 'number'
  width?: number
  height?: number
  onClick?: () => void
}

const RADIAN = Math.PI / 180

export const SimpleGaugeChart: React.FC<SimpleGaugeChartProps> = ({
  value,
  min = 0,
  max = 100,
  format = 'number',
  width = 200,
  height = 120,
  onClick
}) => {
  // Normalize value to 0-100 range
  const normalizedValue = (max - min) > 0 ? ((value - min) / (max - min)) * 100 : 0
  const clampedValue = Math.min(Math.max(normalizedValue, 0), 100)
  
  const gaugeData = [
    { name: 'Low',    value: 33.33, color: GAUGE_COLORS.low },
    { name: 'Medium', value: 33.33, color: GAUGE_COLORS.medium },
    { name: 'High',   value: 33.34, color: GAUGE_COLORS.high }
  ]

  const cx = width / 2
  const cy = height - 45
  const innerRadius = width * 0.25
  const outerRadius = width * 0.35

  // Format the display value
  const formatValue = (val?: number) => {
    const displayVal = val ?? value
    switch (format) {
      case 'currency':
        return formatCompactCurrency(displayVal)
      case 'percent':
        return `${displayVal.toFixed(1)}%`
      case 'number':
        return displayVal >= 1000 ? `${(displayVal / 1000).toFixed(1)}k` : displayVal.toString()
      default:
        return displayVal.toString()
    }
  }

  // Calculate needle geometry for SVG overlay
  const needleAngle = 180 - (clampedValue / 100 * 180)
  const radianAngle = needleAngle * RADIAN
  const needleLength = (innerRadius + 2 * outerRadius) / 3
  const needleX = cx + needleLength * Math.cos(-radianAngle)
  const needleY = cy + needleLength * Math.sin(-radianAngle)
  const chartHeight = height - 25

  return (
    <div
      style={{
        width,
        height,
        position: 'relative',
        cursor: onClick ? 'pointer' : 'default'
      }}
      onClick={onClick}
    >
      <div style={{ pointerEvents: onClick ? 'none' : 'auto' }}>
        <PieChart width={width} height={chartHeight}>
          <Pie
            dataKey="value"
            startAngle={180}
            endAngle={0}
            data={gaugeData}
            cx={cx}
            cy={cy}
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            fill={resolveToken('--chart-series-5')}
            stroke="none"
          >
            {gaugeData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </div>

      {/* Needle rendered as SVG overlay so it appears above the pie */}
      <svg
        width={width}
        height={chartHeight}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none'
        }}
      >
        <line
          x1={cx}
          y1={cy}
          x2={needleX}
          y2={needleY}
          stroke={resolveToken('--muted-foreground')}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={3} fill={resolveToken('--muted-foreground')} />
      </svg>
      
      {/* Value label - positioned well below the gauge to avoid overlap */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 10,
          transform: 'translateX(-50%)',
          fontSize: '22px',
          fontWeight: 'bold',
          color: resolveToken('--foreground'),
          textAlign: 'center',
          pointerEvents: 'none',
          zIndex: 10
        }}
      >
        {formatValue()}
      </div>

      {/* Min label - positioned at left edge of gauge */}
      <div
        style={{
          position: 'absolute',
          left: cx - outerRadius - 20,
          top: cy + 2,
          fontSize: '11px',
          color: resolveToken('--muted-foreground'),
          fontWeight: '400',
          pointerEvents: 'none',
          zIndex: 10
        }}
      >
        {formatValue(min)}
      </div>

      {/* Max label - positioned at right edge of gauge */}
      <div
        style={{
          position: 'absolute',
          right: cx - outerRadius - 20,
          top: cy + 2,
          fontSize: '11px',
          color: resolveToken('--muted-foreground'),
          fontWeight: '400',
          pointerEvents: 'none',
          zIndex: 10
        }}
      >
        {formatValue(max)}
      </div>
    </div>
  )
}