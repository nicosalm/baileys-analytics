import React from 'react'
import { LucideIcon, HelpCircle } from 'lucide-react'
import { GaugeChart } from './charts/GaugeChart'
import { formatCurrency, formatPercentage, formatNumber } from '@/utils/formatters'

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
  onClick,
  comparisonMode = 'none'
}) => {
  const numericValue = typeof value === 'number' ? value : parseFloat(value.toString().replace(/[^0-9.-]/g, ''))
  
  const formatValue = (val: number | string) => {
    if (typeof val === 'string') return val
    switch (format) {
      case 'currency':
        return formatCurrency(val)
      case 'percent':
        return formatPercentage(val, 0)
      case 'number':
        return formatNumber(val)
      default:
        return val.toString()
    }
  }

  const getGaugeSegments = () => {
    if (gauge?.segments) return gauge.segments
    
    // Default segments based on metric type
    if (format === 'percent') {
      return [
        { threshold: 50, color: '#EF4444', label: 'Low' },
        { threshold: 70, color: '#F59E0B', label: 'Good' },
        { threshold: 100, color: '#10B981', label: 'Excellent' }
      ]
    }
    
    // For currency/revenue metrics, use comparison to max
    const max = gauge?.max || 100
    return [
      { threshold: max * 0.33, color: '#EF4444', label: 'Low' },
      { threshold: max * 0.66, color: '#F59E0B', label: 'Medium' },
      { threshold: max, color: '#10B981', label: 'High' }
    ]
  }

  return (
    <div 
      className={`bg-white p-5 rounded-lg shadow-sm border border-gray-200 ${onClick ? 'cursor-pointer hover:shadow-md hover:border-blue-200 transition-all' : ''}`} 
      title={tooltip}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="text-sm font-medium text-gray-600">{label}</div>
        </div>
        {gauge?.enabled && (
          <div className="group relative">
            <HelpCircle className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
            <div className="absolute right-0 top-5 z-20 w-80 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
              <p className="font-semibold mb-2">How Performance Zones are Calculated</p>
              {gauge?.target && comparisonMode !== 'none' ? (
                <>
                  <p className="mb-2 text-gray-300">Comparing current performance to {comparisonMode === 'previous-year' ? 'same period last year' : 'previous period'}:</p>
                  <div className="space-y-1.5 text-gray-300">
                    <div>
                      <span className="font-medium">🔴 Below Target (Red)</span>
                      <p className="ml-5 text-gray-400">Less than 80% of {comparisonMode === 'previous-year' ? "last year's" : 'previous'} {formatValue(gauge.target)}</p>
                      <p className="ml-5 text-gray-400">Range: {formatValue(gauge.min)} - {formatValue(gauge.target * 0.8)}</p>
                    </div>
                    <div>
                      <span className="font-medium">🟡 Near Target (Yellow)</span>
                      <p className="ml-5 text-gray-400">80-100% of previous performance</p>
                      <p className="ml-5 text-gray-400">Range: {formatValue(gauge.target * 0.8)} - {formatValue(gauge.target)}</p>
                    </div>
                    <div>
                      <span className="font-medium">🟢 Above Target (Green)</span>
                      <p className="ml-5 text-gray-400">Exceeding previous performance</p>
                      <p className="ml-5 text-gray-400">Range: Above {formatValue(gauge.target)}</p>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-700 text-gray-400">
                    <p className="font-medium">Current: {formatValue(value)}</p>
                    <p>Target: {formatValue(gauge.target)}</p>
                    <p>Gauge max: {formatValue(gauge.max)}</p>
                  </div>
                </>
              ) : format === 'percent' ? (
                <>
                  <p className="mb-2 text-gray-300">Industry standard occupancy benchmarks:</p>
                  <div className="space-y-1.5 text-gray-300">
                    <div>
                      <span className="font-medium">🔴 Low Occupancy</span>
                      <p className="ml-5 text-gray-400">Under 50% of nights booked</p>
                      <p className="ml-5 text-gray-400">May indicate pricing or marketing issues</p>
                    </div>
                    <div>
                      <span className="font-medium">🟡 Good Occupancy</span>
                      <p className="ml-5 text-gray-400">50-75% of nights booked</p>
                      <p className="ml-5 text-gray-400">Healthy performance for most markets</p>
                    </div>
                    <div>
                      <span className="font-medium">🟢 Excellent Occupancy</span>
                      <p className="ml-5 text-gray-400">Over 75% of nights booked</p>
                      <p className="ml-5 text-gray-400">Consider raising prices to optimize revenue</p>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-700 text-gray-400">
                    <p className="font-medium">Current occupancy: {formatValue(value)}</p>
                  </div>
                </>
              ) : (
                <>
                  <p className="mb-2 text-gray-300">Performance zones based on historical range:</p>
                  <div className="space-y-1.5 text-gray-300">
                    <div>
                      <span className="font-medium">🔴 Low Performance</span>
                      <p className="ml-5 text-gray-400">Bottom 30% of your typical range</p>
                      <p className="ml-5 text-gray-400">Range: {formatValue(gauge.min)} - {formatValue(gauge.min + (gauge.max - gauge.min) * 0.3)}</p>
                    </div>
                    <div>
                      <span className="font-medium">🟡 Medium Performance</span>
                      <p className="ml-5 text-gray-400">Middle 40% of your typical range</p>
                      <p className="ml-5 text-gray-400">Range: {formatValue(gauge.min + (gauge.max - gauge.min) * 0.3)} - {formatValue(gauge.min + (gauge.max - gauge.min) * 0.6)}</p>
                    </div>
                    <div>
                      <span className="font-medium">🟢 High Performance</span>
                      <p className="ml-5 text-gray-400">Top 40% of your typical range</p>
                      <p className="ml-5 text-gray-400">Range: {formatValue(gauge.min + (gauge.max - gauge.min) * 0.6)} - {formatValue(gauge.max)}</p>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-700 text-gray-400">
                    <p className="font-medium">Current: {formatValue(value)}</p>
                    <p>Range: {formatValue(gauge.min)} - {formatValue(gauge.max)}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      <div>
          
        {gauge?.enabled && !isNaN(numericValue) ? (
          <div className="flex justify-center">
            <GaugeChart
              value={numericValue}
              min={gauge.min}
              max={gauge.max}
              segments={getGaugeSegments()}
              width={260}
              height={110}
              format={(v) => formatValue(v)}
              label={gauge.target ? `Target: ${formatValue(gauge.target)}` : undefined}
              showMinMax={true}
            />
          </div>
        ) : (
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {formatValue(value)}
              </div>
              {trend && (
                <div className={`text-sm mt-1 ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value).toFixed(1)}%
                </div>
              )}
            </div>
          )}
          
          {subValue && (
            <div className="text-xs text-gray-500 mt-2">{subValue}</div>
        )}
      </div>
    </div>
  )
}