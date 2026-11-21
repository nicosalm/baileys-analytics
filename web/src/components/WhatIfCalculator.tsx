import { useState, useMemo } from 'react'
import { parseISO } from 'date-fns'
import { ChevronDown, ArrowRight } from 'lucide-react'
import { formatCurrency, formatPercentage, safeDivide } from '@baileys/utils'
import { MS_PER_DAY } from '@baileys/constants'
import type { OccupancyByProperty } from '@/types/api'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useSeasons } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
import type { Season } from '@/types/season'

interface WhatIfCalculatorProps {
  byProperty: OccupancyByProperty[]
  dateRange: { from: string; to: string }
}

// returns the actual (uncapped) start/end dates for a season in the relevant year window
function getSeasonWindow(season: Season): { start: Date; end: Date } {
  const now = new Date()
  const year = now.getFullYear()

  if (season.startMonth <= season.endMonth) {
    return {
      start: new Date(year, season.startMonth - 1, season.startDay),
      end: new Date(year, season.endMonth - 1, season.endDay),
    }
  }

  // cross-year season (e.g. Nov–Mar)
  const currentMonth = now.getMonth() + 1
  if (currentMonth >= season.startMonth) {
    return {
      start: new Date(year, season.startMonth - 1, season.startDay),
      end: new Date(year + 1, season.endMonth - 1, season.endDay),
    }
  }
  return {
    start: new Date(year - 1, season.startMonth - 1, season.startDay),
    end: new Date(year, season.endMonth - 1, season.endDay),
  }
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY)
}

export const WhatIfCalculator = ({ byProperty, dateRange }: WhatIfCalculatorProps) => {
  const [expanded, setExpanded] = useState(false)
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('__portfolio__')
  const [rateInput, setRateInput] = useState('')
  const { data: seasons = [] } = useSeasons()

  const scope = useMemo(() => {
    const properties = selectedPropertyId === '__portfolio__' ? byProperty : byProperty.filter((p) => p.propertyId === selectedPropertyId)

    const availableNights = properties.reduce((sum, p) => sum + p.availableNights, 0)
    const bookedNights = properties.reduce((sum, p) => sum + p.bookedNights, 0)
    const openNights = availableNights - bookedNights
    const estimatedRevenue = properties.reduce((sum, p) => sum + p.bookedNights * p.avgNightlyRate, 0)
    const currentRevPAN = safeDivide(estimatedRevenue, availableNights)
    const currentOccupancy = safeDivide(bookedNights, availableNights)
    const weightedAvgRate = safeDivide(estimatedRevenue, bookedNights)

    return { availableNights, bookedNights, openNights, estimatedRevenue, currentRevPAN, currentOccupancy, weightedAvgRate }
  }, [byProperty, selectedPropertyId])

  // Determine projectable open nights — future nights within the season window (if any)
  const nightContext = useMemo(() => {
    const rangeStart = parseISO(dateRange.from)
    const rangeEnd = parseISO(dateRange.to)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const rangeDays = Math.max(1, daysBetween(rangeStart, rangeEnd) + 1)
    const rangeIsAllPast = rangeEnd < today

    // Find an active season whose window overlaps with the selected range
    const activeSeason =
      seasons.find((s) => {
        if (!s.isActive) return false
        const { start, end } = getSeasonWindow(s)
        return start <= rangeEnd && end >= rangeStart
      }) ?? null

    if (rangeIsAllPast) {
      // Historical view — all open nights are already missed; show as-is with a note
      return { projectableOpenNights: scope.openNights, activeSeason, historical: true }
    }

    if (activeSeason) {
      const { start: sStart, end: sEnd } = getSeasonWindow(activeSeason)
      // overlap of range ∩ season
      const overlapStart = sStart > rangeStart ? sStart : rangeStart
      const overlapEnd = sEnd < rangeEnd ? sEnd : rangeEnd
      // clamp to future
      const futureOverlapStart = overlapStart < today ? today : overlapStart
      const seasonFutureDays = Math.max(0, daysBetween(futureOverlapStart, overlapEnd) + 1)
      const fraction = seasonFutureDays / rangeDays
      return {
        projectableOpenNights: scope.openNights * fraction,
        activeSeason,
        historical: false,
      }
    }

    // No season — use remaining future fraction of range
    const futureStart = rangeStart < today ? today : rangeStart
    const futureDays = Math.max(0, daysBetween(futureStart, rangeEnd) + 1)
    const fraction = futureDays / rangeDays
    return {
      projectableOpenNights: scope.openNights * fraction,
      activeSeason: null,
      historical: false,
    }
  }, [dateRange, seasons, scope.openNights])

  const inputRate = rateInput === '' ? scope.weightedAvgRate : parseFloat(rateInput) || 0
  const projectableNights = nightContext.projectableOpenNights
  const additionalRevenue = Math.round(projectableNights) * inputRate
  const newTotalRevenue = scope.estimatedRevenue + additionalRevenue
  const projectedRevPAN = safeDivide(newTotalRevenue, scope.availableNights)
  const revPANChangePct = safeDivide(projectedRevPAN - scope.currentRevPAN, scope.currentRevPAN) * 100

  const handlePropertyChange = (propertyId: string) => {
    setSelectedPropertyId(propertyId)
    setRateInput('')
  }

  const handleRateChange = (value: string) => {
    if (value !== '' && !/^\d*\.?\d*$/.test(value)) return
    setRateInput(value)
  }

  if (byProperty.length === 0) return null

  const isSeasonal = nightContext.activeSeason !== null
  const nights = Math.round(projectableNights)
  const nightsLabel = nightContext.historical ? 'Open nights' : isSeasonal ? 'Season nights left' : 'Open nights left'

  return (
    <section className="bg-card rounded-lg shadow-sm border border-border">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        className="w-full flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 text-left cursor-pointer"
      >
        <span className="flex items-center gap-2 mr-auto">
          <span className="font-semibold">Rate scenario</span>
          <span className="hidden sm:inline text-sm text-muted-foreground">RevPAN if open nights book at a set rate</span>
        </span>
        <span className="flex items-baseline gap-2">
          <span className="text-xs text-muted-foreground">{nightsLabel}</span>
          <span className="text-sm font-semibold tabular-nums">{nights.toLocaleString()}</span>
        </span>
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', !expanded && '-rotate-90')} aria-hidden />
      </button>

      {expanded && (
        <div className="border-t border-border px-5 py-5">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <Label className="mb-1.5">Properties</Label>
                <Select value={selectedPropertyId} onValueChange={handlePropertyChange}>
                  <SelectTrigger className="w-full max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__portfolio__">All properties</SelectItem>
                    {byProperty.map((p) => (
                      <SelectItem key={p.propertyId} value={p.propertyId}>
                        {p.propertyName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="what-if-rate" className="mb-1.5">
                  Nightly rate
                </Label>
                <div className="relative w-48">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    id="what-if-rate"
                    type="text"
                    inputMode="decimal"
                    value={rateInput}
                    onChange={(e) => handleRateChange(e.target.value)}
                    placeholder={scope.weightedAvgRate > 0 ? scope.weightedAvgRate.toFixed(0) : '0'}
                    className="pl-7 pr-14 text-sm tabular-nums"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">/night</span>
                </div>
              </div>

              <dl className="flex flex-wrap gap-x-8 gap-y-3 pt-1 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">{nightsLabel}</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums">{nights.toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Occupancy</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums">{formatPercentage(scope.currentOccupancy * 100)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Avg rate</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums">{formatCurrency(scope.weightedAvgRate)}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">RevPAN</span>
                {isSeasonal && <Badge variant="neutral">{nightContext.activeSeason?.name}</Badge>}
              </div>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-lg font-semibold tabular-nums text-muted-foreground">{formatCurrency(scope.currentRevPAN)}</span>
                <ArrowRight className="size-4 self-center text-muted-foreground" aria-hidden />
                <span className="text-2xl font-semibold tabular-nums">{formatCurrency(projectedRevPAN)}</span>
                {inputRate > 0 && scope.currentRevPAN > 0 && (
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {revPANChangePct >= 0 ? '+' : ''}
                    {formatPercentage(revPANChangePct)}
                  </span>
                )}
              </div>

              <dl className="mt-4 space-y-2 border-t border-border pt-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Booked revenue</dt>
                  <dd className="tabular-nums">{formatCurrency(scope.estimatedRevenue)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">
                    {nights.toLocaleString()} {nights === 1 ? 'night' : 'nights'} at {formatCurrency(inputRate)}
                  </dt>
                  <dd className="tabular-nums">+{formatCurrency(additionalRevenue)}</dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-border pt-2 font-semibold">
                  <dt>Projected revenue</dt>
                  <dd className="tabular-nums">{formatCurrency(newTotalRevenue)}</dd>
                </div>
              </dl>

              {nightContext.historical && (
                <p className="mt-3 text-xs text-muted-foreground">
                  This range has ended, so the projection shows revenue the open nights missed.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
