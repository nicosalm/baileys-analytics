import React from 'react'
import { ArrowUpRight, ArrowDownRight, Info, Loader2 } from 'lucide-react'
import { formatCurrency, formatCompactCurrency, formatPercentage } from '@baileys/utils'
import { cn } from '@baileys/utils'

export interface MetricCardProps {
  // Core props
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string
  
  // Formatting
  format?: 'currency' | 'percent' | 'number' | 'compact' | 'custom'
  
  // Additional information
  subValue?: string
  subtitle?: string
  tooltip?: string
  
  // Trend indicator
  trend?: {
    value: number
    isPositive?: boolean
    period?: string
  }
  
  // Target/Goal
  target?: {
    value: number
    label?: string
  }
  
  // Styling
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'yellow' | 'gray'
  size?: 'sm' | 'md' | 'lg'
  
  // State
  loading?: boolean
  error?: string
  
  // Interaction
  onClick?: () => void
  className?: string
}

export const MetricCard: React.FC<MetricCardProps> = ({
  icon: Icon,
  label,
  value,
  format = 'custom',
  subValue,
  subtitle,
  tooltip,
  trend,
  target,
  color = 'blue',
  size = 'md',
  loading = false,
  error,
  onClick,
  className
}) => {
  // Color schemes
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    gray: 'bg-gray-50 text-gray-600'
  }

  const sizeClasses = {
    sm: {
      padding: 'p-4',
      icon: 'w-4 h-4',
      iconWrapper: 'p-1.5',
      value: 'text-xl',
      label: 'text-xs',
      sub: 'text-xs'
    },
    md: {
      padding: 'p-6',
      icon: 'w-5 h-5',
      iconWrapper: 'p-2',
      value: 'text-3xl',
      label: 'text-sm',
      sub: 'text-sm'
    },
    lg: {
      padding: 'p-8',
      icon: 'w-6 h-6',
      iconWrapper: 'p-3',
      value: 'text-4xl',
      label: 'text-base',
      sub: 'text-sm'
    }
  }

  const currentSize = sizeClasses[size]

  // Format the value based on format prop
  const formatValue = (val: number | string): string => {
    if (typeof val === 'string') return val
    
    switch (format) {
      case 'currency':
        return val >= 10000 ? formatCompactCurrency(val) : formatCurrency(val)
      case 'compact':
        return formatCompactCurrency(val)
      case 'percent':
        return formatPercentage(val, val < 1 ? 0 : 1)
      case 'number':
        return val.toLocaleString()
      default:
        return val.toString()
    }
  }

  // Calculate trend comparison
  const trendDirection = trend ? (
    trend.isPositive !== undefined 
      ? trend.isPositive 
      : trend.value > 0
  ) : null

  // Calculate progress to target
  const targetProgress = target && typeof value === 'number' 
    ? Math.min((value / target.value) * 100, 100)
    : null

  if (loading) {
    return (
      <div className={cn(
        "bg-white rounded-lg shadow-sm flex items-center justify-center",
        currentSize.padding,
        className
      )}>
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn(
        "bg-white rounded-lg shadow-sm",
        currentSize.padding,
        className
      )}>
        <div className="text-red-500 text-sm">{error}</div>
      </div>
    )
  }

  return (
    <div 
      className={cn(
        "bg-white rounded-lg shadow-sm transition-all",
        onClick && "cursor-pointer hover:shadow-md",
        currentSize.padding,
        className
      )}
      onClick={onClick}
      title={tooltip}
    >
      {/* Header with icon and trend */}
      <div className="flex items-center justify-between mb-4">
        <div className={cn(
          "rounded-lg",
          currentSize.iconWrapper,
          colorClasses[color]
        )}>
          <Icon className={currentSize.icon} />
        </div>
        
        {trend && (
          <div className={cn(
            "flex items-center font-medium",
            currentSize.sub,
            trendDirection ? 'text-green-600' : 'text-red-600'
          )}>
            {trendDirection ? (
              <ArrowUpRight className="w-4 h-4" />
            ) : (
              <ArrowDownRight className="w-4 h-4" />
            )}
            <span>{Math.abs(trend.value).toFixed(1)}%</span>
            {trend.period && (
              <span className="text-gray-500 ml-1 font-normal">
                {trend.period}
              </span>
            )}
          </div>
        )}

        {tooltip && !trend && (
          <Info className="w-4 h-4 text-gray-400" />
        )}
      </div>

      {/* Main value */}
      <div className={cn("font-bold", currentSize.value)}>
        {formatValue(value)}
      </div>

      {/* Label */}
      <div className={cn("text-gray-600 mt-1", currentSize.label)}>
        {label}
      </div>

      {/* Subtitle or subValue */}
      {(subtitle || subValue) && (
        <div className={cn("text-gray-500 mt-1", currentSize.sub)}>
          {subtitle || subValue}
        </div>
      )}

      {/* Target progress bar */}
      {target && targetProgress !== null && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{target.label || 'Target'}</span>
            <span>{formatValue(target.value)}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={cn(
                "h-2 rounded-full transition-all",
                targetProgress >= 100 ? 'bg-green-500' : 
                targetProgress >= 75 ? 'bg-blue-500' : 
                targetProgress >= 50 ? 'bg-yellow-500' : 
                'bg-red-500'
              )}
              style={{ width: `${targetProgress}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-1 text-right">
            {targetProgress.toFixed(0)}% of target
          </div>
        </div>
      )}
    </div>
  )
}

// Export a simplified version for backwards compatibility
export const SimpleMetricCard: React.FC<{
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  subtext?: string
}> = ({ icon, label, value, subtext }) => (
  <MetricCard
    icon={icon}
    label={label}
    value={value}
    subValue={subtext}
    size="md"
  />
)