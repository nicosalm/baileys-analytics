import { useState, useMemo } from 'react'
import { parseISO } from 'date-fns'
import { ChevronDown, ChevronRight, Calculator, TrendingUp, ArrowRight, Calendar } from 'lucide-react'
import { formatCurrency, formatPercentage, safeDivide } from '@baileys/utils'
import { OccupancyByProperty } from '@/types/api'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSeasons } from '@/hooks/use-api'
import type { Season } from '@/types/season'

interface WhatIfCalculatorProps {
  byProperty: OccupancyByProperty[]
  dateRange: { from: string; to: string }
}

const MS_PER_DAY = 86400000

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
    const properties = selectedPropertyId === '__portfolio__'
      ? byProperty
      : byProperty.filter(p => p.propertyId === selectedPropertyId)

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
    const activeSeason = seasons.find(s => {
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

  const inputRate = rateInput === '' ? 0 : parseFloat(rateInput) || 0
  const projectableNights = nightContext.projectableOpenNights
  const additionalRevenue = projectableNights * inputRate
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

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border">
      <button
        onClick={() => setExpanded(prev => !prev)}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between px-6 py-4 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {expanded
            ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
            : <ChevronRight className="w-4 h-4 text-muted-foreground" />
          }
          <Calculator className="w-5 h-5 text-muted-foreground" />
          <span className="font-bold text-foreground">What If?</span>
          <span className="text-sm text-muted-foreground font-normal">RevPAN scenario calculator</span>
        </div>
      </button>

      {expanded && (
        <div className="px-6 pb-6 pt-2 border-t border-border">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left column — inputs */}
            <div className="space-y-4">
              <div>
                <Label className="mb-1">Scope</Label>
                <Select value={selectedPropertyId} onValueChange={handlePropertyChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__portfolio__">All Properties (Portfolio)</SelectItem>
                    {byProperty.map(p => (
                      <SelectItem key={p.propertyId} value={p.propertyId}>
                        {p.propertyName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">
                    {nightContext.historical ? 'Open nights' : isSeasonal ? 'Season nights left' : 'Remaining nights'}
                  </span>
                  <p className="font-semibold">{Math.round(projectableNights)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Current occupancy</span>
                  <p className="font-semibold">{formatPercentage(scope.currentOccupancy * 100)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Current RevPAN</span>
                  <p className="font-semibold">{formatCurrency(scope.currentRevPAN)}</p>
                </div>
              </div>

              <div>
                <Label className="mb-1">Hypothetical nightly rate</Label>
                <div className="relative w-48">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm z-10">$</span>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={rateInput}
                    onChange={e => handleRateChange(e.target.value)}
                    placeholder={scope.weightedAvgRate > 0 ? scope.weightedAvgRate.toFixed(0) : '0'}
                    className="pl-7 pr-14 text-sm"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">/night</span>
                </div>
              </div>
            </div>

            {/* Right column — results */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-4">
              {/* RevPAN transition */}
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  RevPAN
                  {isSeasonal && (
                    <span className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-success-subtle text-success-fg normal-case tracking-normal">
                      <Calendar className="w-3 h-3" />
                      {nightContext.activeSeason!.name}
                    </span>
                  )}
                </h4>
                <div className="flex items-end gap-2">
                  <div className="text-center">
                    <div className="text-lg font-bold text-foreground">{formatCurrency(scope.currentRevPAN)}</div>
                    <div className="text-xs text-muted-foreground">current</div>
                  </div>
                  <div className="pb-4">
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-foreground">{formatCurrency(projectedRevPAN)}</div>
                    <div className="text-xs text-muted-foreground">projected</div>
                  </div>
                  {inputRate > 0 && (
                    <span className={`mb-4 text-xs font-semibold px-1.5 py-0.5 rounded ${
                      revPANChangePct >= 0 ? 'bg-success-subtle text-success-fg' : 'bg-danger-subtle text-danger-fg'
                    }`}>
                      {revPANChangePct >= 0 ? '+' : ''}{formatPercentage(revPANChangePct)}
                    </span>
                  )}
                </div>
              </div>

              {/* Revenue breakdown */}
              <div className="border-t border-border pt-3 space-y-1.5">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Current revenue</span>
                  <span className="font-medium">{formatCurrency(scope.estimatedRevenue)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">
                    + {projectableNights} night{projectableNights !== 1 ? 's' : ''} × {formatCurrency(inputRate)}
                  </span>
                  <span className={`font-medium ${additionalRevenue > 0 ? 'text-success' : ''}`}>
                    {additionalRevenue > 0 ? '+' : ''}{formatCurrency(additionalRevenue)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1.5 border-t border-border">
                  <span className="text-sm font-semibold text-foreground">New total revenue</span>
                  <span className="text-lg font-bold text-foreground">{formatCurrency(newTotalRevenue)}</span>
                </div>
              </div>

              {nightContext.historical && (
                <p className="text-xs text-warning">
                  Date range is in the past · showing historical opportunity
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
