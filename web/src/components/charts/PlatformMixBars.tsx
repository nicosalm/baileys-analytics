import { useMemo, useState } from 'react'
import { formatCurrency, formatPercentage } from '@/utils/formatters'
import { getPlatformColor } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface PropertyPlatformMix {
  propertyId: string
  propertyName: string
  propertyCode?: string | null
  platforms: Array<{ platform: string; bookings: number; revenue: number }>
}

interface PlatformMixBarsProps {
  data: PropertyPlatformMix[]
  onPropertyClick?: (propertyId: string, propertyName: string) => void
}

type Mode = 'revenue' | 'share'

const MODE_OPTIONS = [
  { value: 'revenue', label: 'Revenue' },
  { value: 'share', label: 'Share' },
] as const

// one stacked bar per property; every row stacks platforms in the same order so segments line up
export const PlatformMixBars = ({ data, onPropertyClick }: PlatformMixBarsProps) => {
  const [mode, setMode] = useState<Mode>('revenue')
  const [focus, setFocus] = useState<string | null>(null)

  const { platforms, rows, max } = useMemo(() => {
    const totals = new Map<string, number>()
    for (const property of data) {
      for (const entry of property.platforms ?? []) {
        if (entry.revenue > 0) totals.set(entry.platform, (totals.get(entry.platform) ?? 0) + entry.revenue)
      }
    }
    const platforms = Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name], i) => ({ name, color: getPlatformColor(name, i) }))

    const rows = data
      .map((property) => {
        const byPlatform = new Map((property.platforms ?? []).map((e) => [e.platform, e]))
        const total = (property.platforms ?? []).reduce((sum, e) => sum + Math.max(0, e.revenue), 0)
        return {
          id: property.propertyId,
          name: property.propertyName,
          total,
          segments: platforms
            .map(({ name, color }) => ({
              platform: name,
              color,
              revenue: byPlatform.get(name)?.revenue ?? 0,
              bookings: byPlatform.get(name)?.bookings ?? 0,
            }))
            .filter((s) => s.revenue > 0),
        }
      })
      .filter((row) => row.total > 0)
      .sort((a, b) => b.total - a.total)

    return { platforms, rows, max: rows[0]?.total ?? 0 }
  }, [data])

  if (rows.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">No platform revenue in this range</p>
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5" aria-label="Platforms">
          {platforms.map(({ name, color }) => (
            <li key={name}>
              <button
                type="button"
                onMouseEnter={() => setFocus(name)}
                onMouseLeave={() => setFocus(null)}
                onFocus={() => setFocus(name)}
                onBlur={() => setFocus(null)}
                className={cn(
                  'flex items-center gap-1.5 text-xs text-muted-foreground transition-opacity cursor-default',
                  focus && focus !== name && 'opacity-40',
                )}
              >
                <span className="h-2.5 w-3 rounded-sm" style={{ backgroundColor: color }} aria-hidden />
                {name}
              </button>
            </li>
          ))}
        </ul>
        <SegmentedControl label="Bar scale" value={mode} onChange={setMode} options={MODE_OPTIONS} />
      </div>

      <div className="space-y-1">
        {rows.map((row) => (
          <div key={row.id} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_5.5rem] items-center gap-4 py-1.5">
            <button
              type="button"
              onClick={() => onPropertyClick?.(row.id, row.name)}
              disabled={!onPropertyClick}
              className="truncate text-left text-sm text-foreground hover:underline underline-offset-2 disabled:no-underline cursor-pointer disabled:cursor-default"
              title={row.name}
            >
              {row.name}
            </button>

            <div className="flex h-5 gap-[2px]" style={{ width: mode === 'revenue' ? `${(row.total / max) * 100}%` : '100%' }}>
              {row.segments.map((segment) => {
                const share = (segment.revenue / row.total) * 100
                return (
                  <Tooltip key={segment.platform}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={`${row.name}, ${segment.platform}: ${formatCurrency(segment.revenue)}, ${formatPercentage(share, 0)}`}
                        onMouseEnter={() => setFocus(segment.platform)}
                        onMouseLeave={() => setFocus(null)}
                        className={cn(
                          'h-full min-w-[3px] last:rounded-r-[4px] transition-opacity cursor-default',
                          focus && focus !== segment.platform && 'opacity-25',
                        )}
                        style={{ flexGrow: segment.revenue, flexBasis: 0, backgroundColor: segment.color }}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-left">
                      <p className="font-medium">
                        {segment.platform} at {row.name}
                      </p>
                      <p className="tabular-nums opacity-80">
                        {formatCurrency(segment.revenue)}, {formatPercentage(share, 0)} of the property, {segment.bookings}{' '}
                        {segment.bookings === 1 ? 'booking' : 'bookings'}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>

            <span className="text-right text-sm font-medium tabular-nums">{formatCurrency(row.total)}</span>
          </div>
        ))}
      </div>
    </TooltipProvider>
  )
}
