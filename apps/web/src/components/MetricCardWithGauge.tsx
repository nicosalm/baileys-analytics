import type React from 'react'
import type { LucideIcon } from 'lucide-react'
import { SimpleGaugeChart } from './charts/SimpleGaugeChart'
import { formatCurrency, formatPercentage, formatNumber, formatCompactCurrency } from '@/utils/formatters'

interface MetricCardWithGaugeProps {
  icon: LucideIcon
  label: string
  value: number | string
  format?: 'currency' | 'percent' | 'number' | 'custom'
  subValue?: React.ReactNode
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'gray' | 'orange'
  tooltip?: string
  trend?: {
    value: number
    isPositive: boolean
  }
  gauge?: {
    enabled: boolean
    min: number
    max: number
    segments?: {
      threshold: number
      color: string
      label?: string
    }[]
    target?: number
  }
  onClick?: () => void
  comparisonMode?: 'none' | 'previous-period' | 'previous-year'
  staggerIndex?: number
}

const colorClasses = {
  blue: 'text-primary bg-primary/10',
  green: 'text-success bg-success-subtle',
  red: 'text-danger bg-danger-subtle',
  yellow: 'text-warning bg-warning-subtle',
  purple: 'text-purple-fg bg-purple-subtle',
  gray: 'text-muted-foreground bg-muted',
  orange: 'text-orange-fg bg-orange-subtle',
}

const gaugeColorMap: Record<string, string> = {
  blue: 'var(--primary)',
  green: 'var(--success)',
  red: 'var(--danger)',
  yellow: 'var(--warning)',
  purple: 'var(--purple-fg)',
  gray: 'var(--muted-foreground)',
  orange: 'var(--orange-fg)',
}

export const MetricCardWithGauge: React.FC<MetricCardWithGaugeProps> = ({
  icon: Icon,
  label,
  value,
  format = 'custom',
  subValue,
  color = 'blue',
  tooltip,
  trend,
  gauge,
  onClick,
  staggerIndex,
}) => {
  const numericValue = typeof value === 'number' ? value : parseFloat(value.toString().replace(/[^0-9.-]/g, ''))
  const gaugeColor = gaugeColorMap[color] || 'var(--primary)'

  const formatValue = (val: number | string, compact: boolean = false) => {
    if (typeof val === 'string') return val
    switch (format) {
      case 'currency':
        return compact ? formatCompactCurrency(val) : formatCurrency(val)
      case 'percent':
        return formatPercentage(val, 1)
      case 'number':
        return formatNumber(val)
      default:
        return val.toString()
    }
  }

  return (
    <div
      className={`bg-card p-4 rounded-lg shadow-sm border border-border transition-[background-color,box-shadow] duration-200 ${onClick ? 'cursor-pointer hover:shadow-md hover:bg-muted/30' : ''} ${staggerIndex !== undefined ? 'stagger-fade-in' : ''}`}
      style={staggerIndex !== undefined ? ({ '--stagger-index': staggerIndex } as React.CSSProperties) : undefined}
      title={tooltip}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
      </div>

      {gauge?.enabled && !isNaN(numericValue) ? (
        <div className="flex flex-col items-center">
          <SimpleGaugeChart
            value={numericValue}
            min={gauge.min}
            max={gauge.max}
            format={format === 'custom' ? 'number' : format}
            color={gaugeColor}
            width={180}
            height={110}
            onClick={onClick}
          />
          {trend && (
            <div className={`text-xs mt-1 ${trend.isPositive ? 'text-success' : 'text-danger'}`}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value).toFixed(1)}%
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="text-xl font-bold text-foreground">{formatValue(value, true)}</div>
          {trend && (
            <div className={`text-xs mt-1 ${trend.isPositive ? 'text-success' : 'text-danger'}`}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value).toFixed(1)}%
            </div>
          )}
        </div>
      )}

      {subValue && <div className="text-xs text-muted-foreground mt-2">{subValue}</div>}
    </div>
  )
}
