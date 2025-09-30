import React from 'react'
import { LucideIcon } from 'lucide-react'
import { SimpleGaugeChart } from './charts/SimpleGaugeChart'
import { formatCurrency, formatPercentage, formatNumber, formatCompactCurrency } from '@/utils/formatters'

interface MetricCardWithGaugeProps {
  icon: LucideIcon
  label: string
  value: number | string
  format?: 'currency' | 'percent' | 'number' | 'custom'
  subValue?: string
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
  blue: 'text-blue-600 bg-blue-100',
  green: 'text-green-600 bg-green-100',
  red: 'text-red-600 bg-red-100',
  yellow: 'text-yellow-600 bg-yellow-100',
  purple: 'text-purple-600 bg-purple-100',
  gray: 'text-gray-600 bg-gray-100',
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
        return formatPercentage(val, 0)
      case 'number':
        return formatNumber(val)
      default:
        return val.toString()
    }
  }

  return (
    <div 
      className={`bg-white p-4 rounded-lg shadow-sm border border-gray-200 ${onClick ? 'cursor-pointer hover:shadow-md hover:border-blue-200 transition-all' : ''}`} 
      title={tooltip}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="text-xs font-medium text-gray-600">{label}</div>
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
          />
          {trend && (
            <div className={`text-xs mt-1 ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value).toFixed(1)}%
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="text-xl font-bold text-gray-900">
            {formatValue(value, true)}
          </div>
          {trend && (
            <div className={`text-xs mt-1 ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value).toFixed(1)}%
            </div>
          )}
        </div>
      )}
      
      {subValue && (
        <div className="text-xs text-gray-500 mt-2">{subValue}</div>
      )}
    </div>
  )
}