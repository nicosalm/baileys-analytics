import { cn } from '@/lib/utils'

export interface LegendItem {
  label: string
  color: string
  // dashed for comparison or derived series drawn with a dashed stroke
  dashed?: boolean
  // filled square for bars and areas, short line for line series
  shape?: 'line' | 'square'
}

export function ChartLegend({ items, className }: { items: LegendItem[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground', className)}>
      {items.map(({ label, color, dashed, shape = 'line' }) => (
        <li key={label} className="flex items-center gap-1.5">
          {shape === 'square' ? (
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} aria-hidden />
          ) : (
            <span
              className={cn('w-4', dashed ? 'border-t-2 border-dashed' : 'h-0.5 rounded-full')}
              style={dashed ? { borderColor: color } : { backgroundColor: color }}
              aria-hidden
            />
          )}
          {label}
        </li>
      ))}
    </ul>
  )
}
