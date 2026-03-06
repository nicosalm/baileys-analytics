import React from 'react'
import { ArrowUpRight, ArrowDownRight, Minus, Info, Loader2 } from 'lucide-react'
import { formatCurrency, formatCompactCurrency, formatPercentage } from '@baileys/utils'
import { cn } from '@baileys/utils'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { useCountUp } from '@/hooks/use-count-up'

export interface MetricCardProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string
  format?: 'currency' | 'percent' | 'number' | 'compact' | 'custom'
  subValue?: React.ReactNode
  subtitle?: string
  tooltip?: string
  trend?: {
    value: number
    isPositive?: boolean
    period?: string
  }
  target?: {
    value: number
    label?: string
  }
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'yellow' | 'gray'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  error?: string
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
  const colorClasses = {
    blue:   'bg-info-subtle text-info-fg',
    green:  'bg-success-subtle text-success-fg',
    purple: 'bg-purple-subtle text-purple-fg',
    orange: 'bg-orange-subtle text-orange-fg',
    red:    'bg-danger-subtle text-danger-fg',
    yellow: 'bg-warning-subtle text-warning-fg',
    gray:   'bg-muted text-muted-foreground'
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
    // Safety check for undefined/null values
    if (val === undefined || val === null) {
      return format === 'currency' ? '$0' : '0'
    }
    
    if (typeof val === 'string') return val
    
    switch (format) {
      case 'currency':
        return val >= 10000 ? formatCompactCurrency(val) : formatCurrency(val)
      case 'compact':
        return formatCompactCurrency(val)
      case 'percent':
        return formatPercentage(val, 1)
      case 'number':
        return val.toLocaleString()
      default:
        return val?.toString() || '0'
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
        "bg-card rounded-lg shadow-sm border border-border flex items-center justify-center",
        currentSize.padding,
        className
      )}>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn(
        "bg-card rounded-lg shadow-sm border border-border",
        currentSize.padding,
        className
      )}>
        <div className="text-danger text-sm">{error}</div>
      </div>
    )
  }

  return (
    <div 
      className={cn(
        "bg-card rounded-lg shadow-sm border border-border transition-all",
        onClick && "cursor-pointer hover:bg-muted/30",
        currentSize.padding,
        className
      )}
      onClick={onClick}
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
            trend.value === 0 ? 'text-muted-foreground' :
            trendDirection ? 'text-success' : 'text-danger'
          )}>
            {trend.value === 0 ? (
              <Minus className="w-4 h-4" />
            ) : trendDirection ? (
              <ArrowUpRight className="w-4 h-4" />
            ) : (
              <ArrowDownRight className="w-4 h-4" />
            )}
            <span>{Math.abs(trend.value).toFixed(1)}%</span>
            {trend.period && (
              <span className="text-muted-foreground ml-1 font-normal">
                {trend.period}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main value */}
      <div className={cn("font-bold", currentSize.value)}>
        {typeof value === 'number'
          ? <AnimatedValue value={value} format={format} formatValue={formatValue} />
          : formatValue(value)
        }
      </div>

      {/* Label with tooltip */}
      <div className={cn("text-muted-foreground mt-1 flex items-center gap-1", currentSize.label)}>
        {label}
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Subtitle or subValue */}
      {(subtitle || subValue) && (
        <div className={cn("text-muted-foreground mt-1", currentSize.sub)}>
          {subtitle || subValue}
        </div>
      )}

      {/* Target progress bar */}
      {target && targetProgress !== null && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{target.label || 'Target'}</span>
            <span>{formatValue(target.value)}</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className={cn(
                "h-2 rounded-full transition-all",
                targetProgress >= 100 ? 'bg-success' :
                targetProgress >= 75  ? 'bg-info' :
                targetProgress >= 50  ? 'bg-warning' :
                'bg-danger'
              )}
              style={{ width: `${targetProgress}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground mt-1 text-right">
            {targetProgress.toFixed(0)}% of target
          </div>
        </div>
      )}
    </div>
  )
}

const AnimatedValue: React.FC<{
  value: number
  format: MetricCardProps['format']
  formatValue: (val: number | string) => string
}> = ({ value, formatValue }) => {
  const animated = useCountUp(value)
  const display = Number.isInteger(value) ? Math.round(animated) : animated
  return <>{formatValue(display)}</>
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