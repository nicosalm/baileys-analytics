import type React from 'react'
import { useCallback, useEffect, useRef } from 'react'
import { ArrowUpRight, ArrowDownRight, Minus, Info, Loader2, Check, Copy } from 'lucide-react'
import { formatCurrency, formatCompactCurrency, formatPercentage } from '@baileys/utils'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { useCountUp } from '@/hooks/use-count-up'

function formatFullValue(val: number | string, format: MetricCardProps['format']): string {
  if (val === undefined || val === null) return format === 'currency' ? '$0' : '0'
  if (typeof val === 'string') return val
  switch (format) {
    case 'currency':
    case 'compact':
      return formatCurrency(val)
    case 'percent':
      return formatPercentage(val, 1)
    case 'number':
      return val.toLocaleString()
    default:
      return val?.toString() || '0'
  }
}

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
  // negative values that are bad by definition, such as a loss
  tone?: 'negative'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  error?: string
  onClick?: () => void
  className?: string
  staggerIndex?: number
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
  tone,
  size = 'md',
  loading = false,
  error,
  onClick,
  className,
  staggerIndex,
}) => {
  const sizeClasses = {
    sm: {
      padding: 'p-4',
      icon: 'w-4 h-4',
      value: 'text-xl',
      label: 'text-xs',
      sub: 'text-xs',
    },
    md: {
      padding: 'p-6',
      icon: 'w-5 h-5',
      value: 'text-3xl',
      label: 'text-sm',
      sub: 'text-sm',
    },
    lg: {
      padding: 'p-8',
      icon: 'w-6 h-6',
      value: 'text-4xl',
      label: 'text-base',
      sub: 'text-sm',
    },
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
  const trendDirection = trend ? (trend.isPositive !== undefined ? trend.isPositive : trend.value > 0) : null
  // a change that rounds to 0.0% reads as flat, not as a colored arrow
  const trendFlat = trend ? Math.abs(trend.value) < 0.05 : false

  // Calculate progress to target
  const targetProgress = target && typeof value === 'number' ? Math.min((value / target.value) * 100, 100) : null

  if (loading) {
    return (
      <div
        className={cn('bg-card rounded-lg shadow-sm border border-border flex items-center justify-center', currentSize.padding, className)}
      >
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn('bg-card rounded-lg shadow-sm border border-border', currentSize.padding, className)}>
        <div className="text-danger text-sm">{error}</div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'bg-card rounded-lg shadow-sm border border-border transition-all duration-200',
        onClick && 'cursor-pointer hover:shadow-md hover:bg-muted/30',
        staggerIndex !== undefined && 'stagger-fade-in',
        currentSize.padding,
        className,
      )}
      style={staggerIndex !== undefined ? ({ '--stagger-index': staggerIndex } as React.CSSProperties) : undefined}
      onClick={onClick}
    >
      <div className={cn('flex items-center justify-between gap-2 text-muted-foreground', currentSize.label)}>
        <span className="flex items-center gap-1.5 font-medium">
          <Icon
            className={cn('shrink-0', tone === 'negative' ? 'text-danger' : undefined, size === 'sm' ? 'w-3.5 h-3.5' : currentSize.icon)}
            aria-hidden
          />
          {label}
          {tooltip && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3 h-3 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top">{tooltip}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </span>

        {trend && (
          <span
            className={cn(
              'flex items-center font-medium tabular-nums',
              trendFlat ? 'text-muted-foreground' : trendDirection ? 'text-success' : 'text-danger',
            )}
          >
            {trendFlat ? (
              <Minus className="w-3.5 h-3.5" />
            ) : trend.value > 0 ? (
              <ArrowUpRight className="w-3.5 h-3.5" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5" />
            )}
            {Math.abs(trend.value).toFixed(1)}%
            {trend.period && <span className="text-muted-foreground ml-1 font-normal">{trend.period}</span>}
          </span>
        )}
      </div>

      <div className={cn('mt-2', tone === 'negative' && 'text-danger')}>
        <CopyableValue
          value={value}
          format={format}
          formatValue={formatValue}
          sizeClass={currentSize.value}
          staggerIndex={staggerIndex}
          hasCardClick={!!onClick}
        />
      </div>

      {(subtitle || subValue) && <div className={cn('text-muted-foreground mt-1', currentSize.sub)}>{subtitle || subValue}</div>}

      {target && targetProgress !== null && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{target.label || 'Target'}</span>
            <span>{formatValue(target.value)}</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className={cn('h-2 rounded-full transition-all', targetProgress >= 100 ? 'bg-success' : 'bg-primary')}
              style={{ width: `${targetProgress}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground mt-1 text-right">{targetProgress.toFixed(0)}% of target</div>
        </div>
      )}
    </div>
  )
}

const isTruncated = (value: number | string, format: MetricCardProps['format']): boolean => {
  if (typeof value === 'string') return false
  if (format === 'compact') return true
  if (format === 'currency' && value >= 10000) return true
  return false
}

const CopyableValue: React.FC<{
  value: number | string
  format: MetricCardProps['format']
  formatValue: (val: number | string) => string
  sizeClass: string
  staggerIndex?: number
  hasCardClick?: boolean
}> = ({ value, format, formatValue, sizeClass, staggerIndex, hasCardClick }) => {
  const truncated = isTruncated(value, format)
  const fullText = truncated ? formatFullValue(value, format) : null

  const shortRef = useRef<HTMLSpanElement>(null)
  const fullRef = useRef<HTMLSpanElement>(null)
  const iconRef = useRef<HTMLSpanElement>(null)
  const copyIconRef = useRef<SVGSVGElement>(null)
  const checkIconRef = useRef<SVGSVGElement>(null)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const isHoveredRef = useRef(false)

  const handleEnter = useCallback(() => {
    isHoveredRef.current = true
    if (iconRef.current) iconRef.current.style.display = 'inline'
    if (truncated && shortRef.current && fullRef.current) {
      shortRef.current.style.display = 'none'
      fullRef.current.style.display = 'inline'
    }
  }, [truncated])

  const handleLeave = useCallback(() => {
    isHoveredRef.current = false
    if (iconRef.current) iconRef.current.style.display = 'none'
    if (truncated && shortRef.current && fullRef.current) {
      shortRef.current.style.display = 'inline'
      fullRef.current.style.display = 'none'
    }
  }, [truncated])

  const handleCopy = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation()
      navigator.clipboard.writeText(formatFullValue(value, format))
      if (copyIconRef.current) copyIconRef.current.style.display = 'none'
      if (checkIconRef.current) checkIconRef.current.style.display = 'block'
      clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = setTimeout(() => {
        if (copyIconRef.current) copyIconRef.current.style.display = 'block'
        if (checkIconRef.current) checkIconRef.current.style.display = 'none'
      }, 1500)
    },
    [value, format],
  )

  useEffect(() => {
    return () => clearTimeout(copyTimeoutRef.current)
  }, [])

  return (
    <div
      className={cn('font-bold inline-flex items-center gap-1.5 cursor-pointer relative', sizeClass)}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onClick={handleCopy}
      role="button"
      tabIndex={hasCardClick ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleCopy(e)
        }
      }}
    >
      <span ref={shortRef}>
        {typeof value === 'number' ? (
          <AnimatedValue value={value} format={format} formatValue={formatValue} staggerIndex={staggerIndex} />
        ) : (
          formatValue(value)
        )}
      </span>
      {truncated && fullText && (
        <span ref={fullRef} style={{ display: 'none', whiteSpace: 'nowrap' }}>
          {fullText}
        </span>
      )}
      <span ref={iconRef} className="flex-shrink-0" style={{ display: 'none' }}>
        <Copy ref={copyIconRef} className="w-3.5 h-3.5 text-muted-foreground" />
        <Check ref={checkIconRef} className="w-4 h-4 text-success" style={{ display: 'none' }} />
      </span>
    </div>
  )
}

const AnimatedValue: React.FC<{
  value: number
  format: MetricCardProps['format']
  formatValue: (val: number | string) => string
  staggerIndex?: number
}> = ({ value, formatValue, staggerIndex }) => {
  const delay = staggerIndex !== undefined ? staggerIndex * 60 : 0
  const animated = useCountUp(value, 600, delay)
  const display = Number.isInteger(value) ? Math.round(animated) : animated
  return <>{formatValue(display)}</>
}
