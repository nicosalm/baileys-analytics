import type React from 'react'
import { ArrowDownRight, ArrowUpRight, Info, type LucideIcon } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatCompactCurrency, formatNumber, formatPercentage } from '@/utils/formatters'
import { cn } from '@/lib/utils'

interface HeadlineMetricProps {
  icon: LucideIcon
  label: string
  value: number
  format: 'currency' | 'percent' | 'number'
  subValue?: React.ReactNode
  tooltip?: string
  trend?: { value: number; isPositive: boolean }
  // a bounded 0-100 measure such as occupancy; previous draws a tick for the comparison period
  progress?: { previous?: number }
  onClick?: () => void
  staggerIndex?: number
}

const formatValue = (value: number, format: HeadlineMetricProps['format']) => {
  if (format === 'currency') return formatCompactCurrency(value)
  if (format === 'percent') return formatPercentage(value, 1)
  return formatNumber(value)
}

export const HeadlineMetric: React.FC<HeadlineMetricProps> = ({
  icon: Icon,
  label,
  value,
  format,
  subValue,
  tooltip,
  trend,
  progress,
  onClick,
  staggerIndex,
}) => {
  const TrendIcon = trend?.isPositive ? ArrowUpRight : ArrowDownRight
  const clamp = (n: number) => Math.min(100, Math.max(0, n))

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'flex flex-col text-left bg-card p-4 md:p-5 rounded-lg border border-border shadow-sm transition-[background-color,box-shadow] duration-200',
        onClick && 'cursor-pointer hover:shadow-md hover:bg-muted/30',
        staggerIndex !== undefined && 'stagger-fade-in',
      )}
      style={staggerIndex !== undefined ? ({ '--stagger-index': staggerIndex } as React.CSSProperties) : undefined}
    >
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="w-3.5 h-3.5" aria-hidden />
        {label}
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </span>

      <span className="mt-3 flex items-baseline gap-2 flex-wrap">
        <span className="text-2xl md:text-3xl font-semibold tracking-tight tabular-nums text-foreground">{formatValue(value, format)}</span>
        {trend && (
          <span
            className={cn('inline-flex items-center text-xs font-medium tabular-nums', trend.isPositive ? 'text-success' : 'text-danger')}
          >
            <TrendIcon className="w-3.5 h-3.5" aria-hidden />
            {Math.abs(trend.value).toFixed(1)}%<span className="sr-only">{trend.isPositive ? ' increase' : ' decrease'}</span>
          </span>
        )}
      </span>

      {progress && (
        <span className="relative mt-3 h-1.5 rounded-full bg-muted" aria-hidden>
          <span className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${clamp(value)}%` }} />
          {progress.previous !== undefined && (
            <span
              className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-foreground/60"
              style={{ left: `${clamp(progress.previous)}%` }}
            />
          )}
        </span>
      )}

      {subValue && <span className="mt-3 text-xs text-muted-foreground leading-relaxed">{subValue}</span>}
    </button>
  )
}
