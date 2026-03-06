import React from 'react'
import { formatCompactCurrency } from '@baileys/utils'

interface SimpleGaugeChartProps {
  value: number
  min?: number
  max?: number
  format?: 'currency' | 'percent' | 'number'
  color?: string
  width?: number
  height?: number
  onClick?: () => void
}

const formatValue = (val: number, format: string) => {
  switch (format) {
    case 'currency':
      return formatCompactCurrency(val)
    case 'percent':
      return `${val.toFixed(1)}%`
    case 'number':
      return val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toString()
    default:
      return val.toString()
  }
}

// describe a 180° arc as a path so we control draw direction explicitly
function halfArcPath(cx: number, cy: number, r: number): string {
  // start at left end, sweep clockwise to right end
  return `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`
}

export const SimpleGaugeChart: React.FC<SimpleGaugeChartProps> = ({
  value,
  min = 0,
  max = 100,
  format = 'number',
  color = 'var(--primary)',
  width = 180,
  height = 110,
  onClick
}) => {
  const range = max - min
  const normalizedValue = range > 0 ? ((value - min) / range) : 0
  const clamped = Math.min(Math.max(normalizedValue, 0), 1)

  const strokeWidth = 10
  const cx = width / 2
  const r = (width - strokeWidth) / 2 - 8
  const cy = r + strokeWidth / 2 + 4

  // 180° arc length
  const arcLen = Math.PI * r
  const progressLen = arcLen * clamped
  const progressDash = `${progressLen} ${arcLen}`

  const labelY = cy + 16
  const d = halfArcPath(cx, cy, r)

  return (
    <div
      style={{ width, height, position: 'relative', cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <svg width={width} height={height} aria-hidden="true">
        {/* track */}
        <path
          d={d}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* progress */}
        {clamped > 0 && (
          <path
            d={d}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={progressDash}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.6s ease-out' }}
          />
        )}

        {/* min label */}
        <text
          x={cx - r}
          y={labelY}
          textAnchor="start"
          fontSize="10"
          fill="var(--muted-foreground)"
          fontFamily="inherit"
          dx={-4}
        >
          {formatValue(min, format)}
        </text>

        {/* max label */}
        <text
          x={cx + r}
          y={labelY}
          textAnchor="end"
          fontSize="10"
          fill="var(--muted-foreground)"
          fontFamily="inherit"
          dx={4}
        >
          {formatValue(max, format)}
        </text>
      </svg>

      {/* value label */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 4,
          transform: 'translateX(-50%)',
          fontSize: '20px',
          fontWeight: 'bold',
          textAlign: 'center',
          pointerEvents: 'none',
          lineHeight: 1,
        }}
        className="text-foreground"
      >
        {formatValue(value, format)}
      </div>
    </div>
  )
}
