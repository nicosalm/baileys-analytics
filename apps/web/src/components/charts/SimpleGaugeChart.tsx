import React from 'react'
import { PieChart, Pie, Cell } from 'recharts'
import { formatCompactCurrency } from '@baileys/utils'

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

// Minimal needle component
const renderNeedle = (value: number, data: any[], cx: number, cy: number, iR: number, oR: number) => {
  const total = Math.max(data[0].value, 1)
  const ang = 180.0 * (1 - value / total)
  const length = (iR + 2 * oR) / 3
  const sin = Math.sin(-RADIAN * ang)
  const cos = Math.cos(-RADIAN * ang)
  const r = 3
  const x0 = cx
  const y0 = cy
  const xp = x0 + length * cos
  const yp = y0 + length * sin

  return (
    <g>
      {/* Main needle - thinner and cleaner */}
      <path
        d={`M${x0} ${y0} L${xp} ${yp}`}
        stroke="#6B7280"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* Smaller center dot */}
      <circle cx={x0} cy={y0} r={r} fill="#6B7280" />
    </g>
  )
}

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
  
  // Create gauge data with dashboard-consistent colors (using Tailwind palette)
  const gaugeData = [
    { name: 'Low', value: 33.33, color: '#FCA5A5' },     // red-300
    { name: 'Medium', value: 33.33, color: '#FCD34D' },  // amber-300
    { name: 'High', value: 33.34, color: '#86EFAC' }     // green-300
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
        <PieChart width={width} height={height - 25}>
          <Pie
            dataKey="value"
            startAngle={180}
            endAngle={0}
            data={gaugeData}
            cx={cx}
            cy={cy}
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            fill="#8884d8"
            stroke="none"
          >
            {gaugeData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          {renderNeedle(clampedValue, [{ value: 100 }], cx, cy, innerRadius, outerRadius)}
        </PieChart>
      </div>
      
      {/* Value label - positioned well below the gauge to avoid overlap */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 10,
          transform: 'translateX(-50%)',
          fontSize: '22px',
          fontWeight: 'bold',
          color: '#111827',
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
          color: '#6B7280',
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
          color: '#6B7280',
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