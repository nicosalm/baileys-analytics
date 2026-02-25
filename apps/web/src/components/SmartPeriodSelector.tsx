import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Calendar, ChevronDown, Check, GitCompare } from 'lucide-react'
import {
  cn,
  formatDateISO,
  parseDate,
  format,
  startOfMonth,
  startOfYear,
  subDays,
  subYears,
  getYear
} from '@baileys/utils'
import { useSeasons } from '@/hooks/use-api'
import { InlineDateRangePicker } from './InlineDateRangePicker'
import { Modal } from './Modal'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import type { Season } from '@/types/season'
import {
  calculateComparisonRange,
  getComparisonLabel,
  type ComparisonType
} from '@/utils/comparison'
import {
  getCurrentSeasonDates,
  getPreviousSeasonDates,
  isCurrentlyInSeason,
  hasSeasonStartedThisYear
} from '@/utils/season-dates'

interface DateRange {
  from: string
  to: string
}

interface SmartPeriodSelectorProps {
  value: DateRange
  onChange: (range: DateRange, comparison?: DateRange, label?: string) => void
  comparisonRange?: DateRange
  className?: string
}

type PeriodOption = {
  id: string
  label: string
  getRange: (seasons?: Season[]) => DateRange
  requiresSeasons?: boolean
}


const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const SmartPeriodSelector: React.FC<SmartPeriodSelectorProps> = ({
  value,
  onChange,
  comparisonRange,
  className
}) => {
  const [dateOpen, setDateOpen] = useState(false)
  const [comparisonType, setComparisonType] = useState<ComparisonType>('none')
  const [comparisonYearOffset, setComparisonYearOffset] = useState(1)
  const [compOpen, setCompOpen] = useState(false)
  const [customRangeOpen, setCustomRangeOpen] = useState(false)
  const [tempCustomRange, setTempCustomRange] = useState<DateRange>(value)
  const [customCompRangeOpen, setCustomCompRangeOpen] = useState(false)
  const [tempCustomCompRange, setTempCustomCompRange] = useState<DateRange>(value)

  // store onChange in ref to avoid dependency array issues
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const { data: seasons = [], isLoading: seasonsLoading } = useSeasons()
  const activeSeasons = useMemo(() => seasons.filter(s => s.isActive), [seasons])

  const hasSetInitialSeason = useRef(false)
  useEffect(() => {
    if (!seasonsLoading && activeSeasons.length > 0 && !hasSetInitialSeason.current) {
      const today = new Date()
      const ytdFrom = formatDateISO(new Date(getYear(today), 0, 1))

      if (value.from === ytdFrom && activeSeasons.length === 1) {
        hasSetInitialSeason.current = true
        const season = activeSeasons[0]

        if (!hasSeasonStartedThisYear(season)) {
          const lastSeasonDates = getPreviousSeasonDates(season)
          const activeSeason = activeSeasons[0]
          const offset = comparisonType === 'lastYear' ? comparisonYearOffset : undefined
          const comparisonResult = calculateComparisonRange(lastSeasonDates, comparisonType, activeSeason, offset)
          const label = buildComparisonLabel(comparisonType, comparisonYearOffset, lastSeasonDates.from)
          onChangeRef.current(lastSeasonDates, comparisonResult.isValid ? comparisonResult.range : undefined, label)
        } else {
          const currentSeasonDates = getCurrentSeasonDates(season)
          const activeSeason = activeSeasons[0]
          const offset = comparisonType === 'lastYear' ? comparisonYearOffset : undefined
          const comparisonResult = calculateComparisonRange(currentSeasonDates, comparisonType, activeSeason, offset)
          const label = buildComparisonLabel(comparisonType, comparisonYearOffset, currentSeasonDates.from)
          onChangeRef.current(currentSeasonDates, comparisonResult.isValid ? comparisonResult.range : undefined, label)
        }
      }
    }
  }, [seasonsLoading, activeSeasons, value.from, comparisonType])

  // Check if current comparison is still valid when date range changes
  useEffect(() => {
    if (comparisonType !== 'none' && comparisonType !== 'custom' && value.from && value.to) {
      const activeSeason = activeSeasons.length > 0 ? activeSeasons[0] : undefined
      const offset = comparisonType === 'lastYear' ? comparisonYearOffset : undefined
      const comparisonResult = calculateComparisonRange(value, comparisonType, activeSeason, offset)

      if (!comparisonResult.isValid) {
        setComparisonType('none')
        onChangeRef.current(value, undefined, '')
      }
    }
  }, [value, activeSeasons, comparisonType, comparisonYearOffset])

  const uiMode = useMemo(() => {
    if (activeSeasons.length === 0) return 'year-round'
    return 'single-season'
  }, [activeSeasons])

  const periodOptions: PeriodOption[] = useMemo(() => {
    const today = new Date()
    const options: PeriodOption[] = []

    if (uiMode === 'single-season') {
      const season = activeSeasons[0]
      const inSeason = isCurrentlyInSeason(season)
      const seasonStarted = hasSeasonStartedThisYear(season)

      if (!seasonStarted) {
        options.push(
          {
            id: 'last-season',
            label: `${season.name} ${getYear(today) - 1}`,
            getRange: () => getPreviousSeasonDates(season)
          },
          {
            id: 'upcoming-season',
            label: `${season.name} ${getYear(today)} (Upcoming)`,
            getRange: () => {
              const seasonStart = new Date(getYear(today), season.startMonth - 1, season.startDay)
              const seasonEnd = new Date(getYear(today), season.endMonth - 1, season.endDay)
              return {
                from: formatDateISO(seasonStart),
                to: formatDateISO(seasonEnd)
              }
            }
          }
        )
      } else {
        options.push(
          {
            id: 'current-season',
            label: inSeason ? 'Season to Date' : `${season.name} ${getYear(today)} (Ended)`,
            getRange: () => getCurrentSeasonDates(season)
          },
          {
            id: 'last-season',
            label: `${season.name} ${getYear(today) - 1}`,
            getRange: () => getPreviousSeasonDates(season)
          }
        )
      }
    } else {
      options.push(
        {
          id: 'ytd',
          label: 'Year to Date',
          getRange: () => ({
            from: formatDateISO(new Date(getYear(today), 0, 1)), // Jan 1st of current year
            to: formatDateISO(today)
          })
        },
        {
          id: 'last-year',
          label: 'Last Year',
          getRange: () => {
            const lastYear = subYears(today, 1)
            return {
              from: formatDateISO(startOfYear(lastYear)),
              to: formatDateISO(new Date(getYear(lastYear), 11, 31))
            }
          }
        }
      )
    }

    options.push(
      {
        id: 'last-30',
        label: 'Last 30 Days',
        getRange: () => ({
          from: formatDateISO(subDays(today, 30)),
          to: formatDateISO(today)
        })
      },
      {
        id: 'last-7',
        label: 'Last 7 Days',
        getRange: () => ({
          from: formatDateISO(subDays(today, 7)),
          to: formatDateISO(today)
        })
      },
      {
        id: 'month-to-date',
        label: 'Month to Date',
        getRange: () => ({
          from: formatDateISO(startOfMonth(today)),
          to: formatDateISO(today)
        })
      }
    )

    return options
  }, [uiMode, activeSeasons])

  const handlePeriodSelect = (option: PeriodOption) => {
    const range = option.getRange(activeSeasons)

    if (comparisonType === 'custom' && comparisonRange) {
      // Keep existing custom comparison when changing period
      onChange(range, comparisonRange, buildComparisonLabel(comparisonType, comparisonYearOffset, range.from))
    } else if (comparisonType !== 'none') {
      const activeSeason = activeSeasons.length > 0 ? activeSeasons[0] : undefined
      const offset = comparisonType === 'lastYear' ? comparisonYearOffset : undefined
      const comparisonResult = calculateComparisonRange(range, comparisonType, activeSeason, offset)
      const label = buildComparisonLabel(comparisonType, comparisonYearOffset, range.from)

      onChange(range, comparisonResult.isValid ? comparisonResult.range : undefined, label)
    } else {
      onChange(range, undefined, '')
    }

    setDateOpen(false)
  }

  const formatRangeDisplay = () => {
    if (!value.from || !value.to) return 'Select period'

    const from = parseDate(value.from)
    const to = parseDate(value.to)
    const dayCount = Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1

    const matchedOption = periodOptions.find(opt => {
      const range = opt.getRange(activeSeasons)
      const rangeDaysDiff = Math.abs(new Date(range.from).getTime() - new Date(value.from).getTime()) / (1000 * 60 * 60 * 24)
      const toRangeDaysDiff = Math.abs(new Date(range.to).getTime() - new Date(value.to).getTime()) / (1000 * 60 * 60 * 24)
      return rangeDaysDiff <= 1 && toRangeDaysDiff <= 1
    })

    if (matchedOption) {
      return `${matchedOption.label} (${dayCount} days)`
    }

    return `${format(from, 'MMM d, yyyy')} - ${format(to, 'MMM d, yyyy')} (${dayCount} days)`
  }

  const comparisonRangeLabel = useMemo(() => {
    if (comparisonType === 'none' || !comparisonRange) return ''
    const fromDate = parseDate(comparisonRange.from)
    const toDate = parseDate(comparisonRange.to)
    const fmtShort = (d: Date) => format(d, 'MMM d')
    const fmtWithYear = (d: Date) => format(d, 'MMM d, yyyy')
    if (fromDate.getFullYear() === toDate.getFullYear()) {
      return `${fmtShort(fromDate)} – ${fmtShort(toDate)}, ${toDate.getFullYear()}`
    }
    return `${fmtWithYear(fromDate)} – ${fmtWithYear(toDate)}`
  }, [comparisonType, comparisonRange])

  const buildComparisonLabel = (type: ComparisonType, offset: number, rangeFrom?: string): string => {
    if (type === 'none') return ''
    if (type === 'lastPeriod') {
      return activeSeasons.length > 0 ? 'Previous Period' : 'Last Period'
    }
    const baseYear = rangeFrom ? getYear(parseDate(rangeFrom)) : getYear(new Date())
    const targetYear = baseYear - offset
    return activeSeasons.length > 0 && activeSeasons[0]
      ? `${activeSeasons[0].name} ${targetYear}`
      : `${targetYear}`
  }

  const seasonStatus = useMemo(() => {
    if (activeSeasons.length === 0) return null
    const season = activeSeasons[0]
    const inSeason = isCurrentlyInSeason(season)
    const seasonStarted = hasSeasonStartedThisYear(season)

    if (!seasonStarted) return 'pre-season'
    if (inSeason) return 'in-season'
    return 'post-season'
  }, [activeSeasons])

  return (
    <div className={cn("relative", className)}>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        {/* Main date range selector */}
        <Popover open={dateOpen} onOpenChange={(open) => {
          setDateOpen(open)
          if (open) setCompOpen(false)
        }}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "flex items-center gap-2 px-3 md:px-4 py-2 cursor-pointer",
                "hover:bg-gray-50 transition-all text-sm font-medium text-gray-700",
                dateOpen && "ring-2 ring-blue-600 border-blue-600",
                seasonStatus === 'in-season' && "border-green-600 bg-green-50/50",
                seasonStatus === 'pre-season' && "border-blue-600 bg-blue-50/50",
                seasonStatus === 'post-season' && "border-gray-400 bg-gray-50/50"
              )}
            >
              <Calendar className={cn(
                "w-4 h-4 flex-shrink-0",
                seasonStatus === 'in-season' && "text-green-600",
                seasonStatus === 'pre-season' && "text-blue-600",
                seasonStatus === 'post-season' && "text-gray-500",
                !seasonStatus && "text-gray-500"
              )} />
              <span className="truncate">
                {formatRangeDisplay()}
              </span>
              <ChevronDown className={cn(
                "w-4 h-4 text-gray-500 transition-transform flex-shrink-0",
                dateOpen && "rotate-180"
              )} />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="min-w-[280px] p-0">
            {/* Season status indicator */}
            {seasonStatus && activeSeasons.length > 0 && (
              <div className={cn(
                "px-3 py-2 border-b",
                seasonStatus === 'pre-season' && "bg-blue-50",
                seasonStatus === 'in-season' && "bg-green-50",
                seasonStatus === 'post-season' && "bg-gray-50"
              )}>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    seasonStatus === 'pre-season' && "bg-blue-500",
                    seasonStatus === 'in-season' && "bg-green-500",
                    seasonStatus === 'post-season' && "bg-gray-400"
                  )} />
                  <span className="text-xs font-medium text-gray-700">
                    {seasonStatus === 'pre-season' && `${activeSeasons[0].name} starts ${months[activeSeasons[0].startMonth - 1]} ${activeSeasons[0].startDay}`}
                    {seasonStatus === 'in-season' && `Currently in ${activeSeasons[0].name}`}
                    {seasonStatus === 'post-season' && `${activeSeasons[0].name} ended ${months[activeSeasons[0].endMonth - 1]} ${activeSeasons[0].endDay}`}
                  </span>
                </div>
              </div>
            )}

            {/* Period options */}
            <div className="p-2">
              <div className="text-xs font-medium text-gray-500 px-2 py-1 uppercase">
                Quick Periods
              </div>
              {periodOptions.map(option => {
                const range = option.getRange(activeSeasons)
                const isSelected = range.from === value.from && range.to === value.to

                return (
                  <button
                    key={option.id}
                    onClick={() => handlePeriodSelect(option)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between cursor-pointer",
                      isSelected
                        ? "bg-blue-50 text-blue-700"
                        : "hover:bg-gray-100 text-gray-700"
                    )}
                  >
                    <span>{option.label}</span>
                    {isSelected && <Check className="w-4 h-4" />}
                  </button>
                )
              })}

              <div className="border-t mt-2 pt-2">
                <button
                  onClick={() => {
                    setTempCustomRange(value)
                    setCustomRangeOpen(true)
                    setDateOpen(false)
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-gray-100 text-gray-700 cursor-pointer"
                >
                  Custom Range...
                </button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Comparison selector */}
        <Popover open={compOpen} onOpenChange={(open) => {
          setCompOpen(open)
          if (open) setDateOpen(false)
        }}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "flex items-center gap-2 px-3 md:px-4 py-2 cursor-pointer w-full sm:w-auto",
                "hover:bg-gray-50 transition-all text-sm font-medium text-gray-700",
                compOpen && "ring-2 ring-blue-600 border-blue-600",
                comparisonType !== 'none' && "border-blue-600 bg-blue-50/50"
              )}
            >
              <GitCompare className={cn(
                "w-4 h-4 flex-shrink-0",
                comparisonType !== 'none' ? "text-blue-600" : "text-gray-500"
              )} />
              <span className="truncate">
                {getComparisonLabel(comparisonType, activeSeasons.length > 0, {
                  yearOffset: comparisonYearOffset,
                  seasonName: activeSeasons.length > 0 ? activeSeasons[0].name : undefined,
                  baseYear: value.from ? getYear(parseDate(value.from)) : undefined
                })}
                {comparisonRangeLabel && (
                  <span className="text-gray-400 font-normal"> ({comparisonRangeLabel})</span>
                )}
              </span>
              <ChevronDown className={cn(
                "w-4 h-4 text-gray-500 transition-transform flex-shrink-0",
                compOpen && "rotate-180"
              )} />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="min-w-[200px] p-1">
            <button
              onClick={() => {
                setComparisonType('none')
                setCompOpen(false)
                if (value.from && value.to) {
                  onChange(value, undefined, '')
                }
              }}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between cursor-pointer",
                comparisonType === 'none'
                  ? "bg-blue-50 text-blue-700"
                  : "hover:bg-gray-100 text-gray-700"
              )}
            >
              <span>No Comparison</span>
              {comparisonType === 'none' && <Check className="w-4 h-4" />}
            </button>

            {(() => {
              const activeSeason = activeSeasons.length > 0 ? activeSeasons[0] : undefined
              const lastPeriodResult = value.from && value.to
                ? calculateComparisonRange(value, 'lastPeriod', activeSeason)
                : { isValid: true }
              const isDisabled = !lastPeriodResult.isValid

              return (
                <button
                  onClick={() => {
                    if (!isDisabled) {
                      setComparisonType('lastPeriod')
                      setCompOpen(false)
                      if (value.from && value.to && lastPeriodResult.isValid && lastPeriodResult.range) {
                        onChange(value, lastPeriodResult.range, buildComparisonLabel('lastPeriod', 0, value.from))
                      }
                    }
                  }}
                  disabled={isDisabled}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between",
                    isDisabled
                      ? "opacity-50 cursor-not-allowed text-gray-400"
                      : comparisonType === 'lastPeriod'
                        ? "bg-blue-50 text-blue-700 cursor-pointer"
                        : "hover:bg-gray-100 text-gray-700 cursor-pointer"
                  )}
                  title={isDisabled ? "No data available in previous period for selected season" : undefined}
                >
                  <span>{activeSeasons.length > 0 ? 'vs Previous Period' : 'vs Last Period'}</span>
                  {comparisonType === 'lastPeriod' && !isDisabled && <Check className="w-4 h-4" />}
                </button>
              )
            })()}

            <div className="border-t my-1" />
            {Array.from({ length: 3 }, (_, i) => i + 1).map(offset => {
              const activeSeason = activeSeasons.length > 0 ? activeSeasons[0] : undefined
              const result = value.from && value.to
                ? calculateComparisonRange(value, 'lastYear', activeSeason, offset)
                : { isValid: true }
              const isDisabled = !result.isValid
              const baseYear = value.from ? getYear(parseDate(value.from)) : getYear(new Date())
              const targetYear = baseYear - offset
              const label = activeSeason
                ? `vs ${activeSeason.name} ${targetYear}`
                : `vs ${targetYear}`
              const isSelected = comparisonType === 'lastYear' && comparisonYearOffset === offset

              return (
                <button
                  key={offset}
                  onClick={() => {
                    if (!isDisabled) {
                      setComparisonType('lastYear')
                      setComparisonYearOffset(offset)
                      setCompOpen(false)
                      if (value.from && value.to && result.isValid && result.range) {
                        onChange(value, result.range, buildComparisonLabel('lastYear', offset, value.from))
                      }
                    }
                  }}
                  disabled={isDisabled}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between",
                    isDisabled
                      ? "opacity-50 cursor-not-allowed text-gray-400"
                      : isSelected
                        ? "bg-blue-50 text-blue-700 cursor-pointer"
                        : "hover:bg-gray-100 text-gray-700 cursor-pointer"
                  )}
                >
                  <span>{label}</span>
                  {isSelected && !isDisabled && <Check className="w-4 h-4" />}
                </button>
              )
            })}
            <div className="border-t my-1" />
            <button
              onClick={() => {
                setTempCustomCompRange(value)
                setCustomCompRangeOpen(true)
                setCompOpen(false)
              }}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between cursor-pointer",
                comparisonType === 'custom'
                  ? "bg-blue-50 text-blue-700"
                  : "hover:bg-gray-100 text-gray-700"
              )}
            >
              <span>Custom Comparison...</span>
              {comparisonType === 'custom' && <Check className="w-4 h-4" />}
            </button>
          </PopoverContent>
        </Popover>
      </div>

      {/* Custom Comparison Range Modal */}
      {customCompRangeOpen && (
        <Modal
          isOpen={customCompRangeOpen}
          onClose={() => setCustomCompRangeOpen(false)}
          title="Select Comparison Date Range"
          size="xl"
        >
          <div>
            <p className="text-sm text-gray-500 mb-4">Choose a date range to compare against your current selection.</p>
            <InlineDateRangePicker
              value={tempCustomCompRange}
              onChange={setTempCustomCompRange}
              maxDays={1825}
              className="w-full"
            />
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
              <Button variant="ghost" onClick={() => setCustomCompRangeOpen(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  if (tempCustomCompRange.from && tempCustomCompRange.to) {
                    setComparisonType('custom')
                    const fromDate = parseDate(tempCustomCompRange.from)
                    const toDate = parseDate(tempCustomCompRange.to)
                    const label = `vs ${format(fromDate, 'MMM d')} – ${format(toDate, 'MMM d, yyyy')}`
                    onChange(value, tempCustomCompRange, label)
                  }
                  setCustomCompRangeOpen(false)
                }}
                disabled={!tempCustomCompRange.from || !tempCustomCompRange.to}
              >
                Apply Comparison
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Custom Range Modal */}
      {customRangeOpen && (
        <Modal
          isOpen={customRangeOpen}
          onClose={() => setCustomRangeOpen(false)}
          title="Select Custom Date Range"
          size="xl"
        >
          <div>
            <InlineDateRangePicker
              value={tempCustomRange}
              onChange={setTempCustomRange}
              maxDays={1825}
              className="w-full"
            />

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
              <Button
                variant="ghost"
                onClick={() => setCustomRangeOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (comparisonType !== 'none' && tempCustomRange.from && tempCustomRange.to) {
                    const activeSeason = activeSeasons.length > 0 ? activeSeasons[0] : undefined
                    const offset = comparisonType === 'lastYear' ? comparisonYearOffset : undefined
                    const comparisonResult = calculateComparisonRange(tempCustomRange, comparisonType, activeSeason, offset)
                    const label = comparisonResult.isValid ? buildComparisonLabel(comparisonType, comparisonYearOffset, tempCustomRange.from) : ''
                    onChange(tempCustomRange, comparisonResult.isValid ? comparisonResult.range : undefined, label)
                    if (!comparisonResult.isValid) {
                      setComparisonType('none')
                    }
                  } else {
                    onChange(tempCustomRange, undefined, '')
                  }
                  setCustomRangeOpen(false)
                }}
                disabled={!tempCustomRange.from || !tempCustomRange.to}
              >
                Apply Range
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
