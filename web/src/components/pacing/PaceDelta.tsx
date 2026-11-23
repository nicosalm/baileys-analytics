import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

// changes under half a unit read as even so rounding noise never shows as a trend
const EVEN_THRESHOLD = 0.5

export function PaceDelta({ value, unit = 'pts', className }: { value: number | null; unit?: 'pts' | '%'; className?: string }) {
  if (value === null || !Number.isFinite(value)) return <span className={cn('text-xs text-muted-foreground', className)}>—</span>

  if (Math.abs(value) < EVEN_THRESHOLD) {
    return (
      <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground', className)}>
        <Minus className="w-3 h-3" aria-hidden />
        even
      </span>
    )
  }

  const ahead = value > 0
  const Icon = ahead ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
        ahead ? 'text-success-fg' : 'text-danger-fg',
        className,
      )}
    >
      <Icon className="w-3 h-3" aria-hidden />
      {ahead ? '+' : '−'}
      {Math.abs(value).toFixed(1)}
      {unit === '%' ? '%' : ' pts'}
    </span>
  )
}

export const pctChange = (current: number, prior: number): number | null => (prior > 0 ? ((current - prior) / prior) * 100 : null)
