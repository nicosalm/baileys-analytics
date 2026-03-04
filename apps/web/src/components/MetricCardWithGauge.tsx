import React from 'react'
import { LucideIcon } from 'lucide-react'
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
}

const colorClasses = {
  blue: 'text-primary bg-primary/10',
  green: 'text-success bg-success-subtle',
  red: 'text-danger bg-danger-subtle',
  yellow: 'text-warning bg-warning-subtle',
  purple: 'text-purple-600 bg-purple-100',
  gray: 'text-muted-foreground bg-muted',
  orange: 'text-orange-600 bg-orange-100'
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
  onClick
}) => {
  const numericValue = typeof value === 'number' ? value : parseFloat(value.toString().replace(/[^0-9.-]/g, ''))
  
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
      className={`bg-card p-4 rounded-lg shadow-sm border border-border ${onClick ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
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
            width={180}
            height={120}
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
          <div className="text-xl font-bold text-foreground">
            {formatValue(value, true)}
          </div>
          {trend && (
            <div className={`text-xs mt-1 ${trend.isPositive ? 'text-success' : 'text-danger'}`}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value).toFixed(1)}%
            </div>
          )}
        </div>
      )}
      
      {subValue && (
        <div className="text-xs text-muted-foreground mt-2">{subValue}</div>
      )}
    </div>
  )
} 
