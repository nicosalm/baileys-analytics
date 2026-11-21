import React, { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  formatDateISO, 
  parseDate,
  differenceInDays,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  getMonth,
  getYear,
  format,
  isSameDay,
  isAfter,
  isBefore,
  isWithinInterval,
  addDays,
  getDate,
  subDays,
  subYears,
  startOfYear,
  startOfQuarter
} from '@baileys/utils'
import { cn } from '@/lib/utils'
import { useSeasons } from '@/hooks/use-api'
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

interface InlineDateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
  maxDays?: number
  minDate?: Date
  maxDate?: Date
  className?: string
}

export const InlineDateRangePicker: React.FC<InlineDateRangePickerProps> = ({
  value,
  onChange,
  maxDays = 1825,
  minDate,
  maxDate = new Date(),
  className
}) => {
  const [localRange, setLocalRange] = useState<DateRange>(value)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  
  const { data: seasons = [] } = useSeasons()
  const activeSeasons = useMemo(() => seasons.filter(s => s.isActive), [seasons])
  
  const isDateInSeason = (date: Date): boolean => {
    if (activeSeasons.length === 0) return true

    const month = getMonth(date) + 1
    const day = getDate(date)

    return activeSeasons.some(season => {
      if (season.startMonth <= season.endMonth) {
        return (
          (month > season.startMonth || (month === season.startMonth && day >= season.startDay)) &&
          (month < season.endMonth || (month === season.endMonth && day <= season.endDay))
        )
      } else {
        return (
          (month > season.startMonth || (month === season.startMonth && day >= season.startDay)) ||
          (month < season.endMonth || (month === season.endMonth && day <= season.endDay))
        )
      }
    })
  }

  const doesRangeOverlapSeason = (from: Date, to: Date): boolean => {
    if (activeSeasons.length === 0) return true
    if (isDateInSeason(from) || isDateInSeason(to)) return true

    // check if a season start falls within the range
    // (handles ranges that span over the season without either endpoint being in it)
    const season = activeSeasons[0]
    for (let y = getYear(from); y <= getYear(to); y++) {
      const seasonStart = new Date(y, season.startMonth - 1, season.startDay)
      if (seasonStart >= from && seasonStart <= to) return true
    }

    return false
  }

  const formatDateDisplay = (dateStr: string): string => {
    const date = parseDate(dateStr)
    return format(date, 'MMM d, yyyy')
  }

  const handleDateClick = (date: Date) => {
    if (isDateDisabled(date)) return

    const clickedDate = formatDateISO(date)
    
    if (!localRange.from || (localRange.from && localRange.to)) {
      const newRange = { from: clickedDate, to: '' }
      setLocalRange(newRange)
      onChange(newRange)
    } else if (localRange.from && !localRange.to) {
      const fromDate = parseDate(localRange.from)
      
      if (isAfter(date, fromDate) || isSameDay(date, fromDate)) {
        const daysDiff = differenceInDays(date, fromDate)
        
        if (maxDays && daysDiff > maxDays) {
          const limitedTo = formatDateISO(addDays(fromDate, maxDays - 1))
          const newRange = { from: localRange.from, to: limitedTo }
          setLocalRange(newRange)
          onChange(newRange)
        } else {
          const newRange = { from: localRange.from, to: clickedDate }
          setLocalRange(newRange)
          onChange(newRange)
        }
      } else {
        const newRange = { from: clickedDate, to: localRange.from }
        setLocalRange(newRange)
        onChange(newRange)
      }
    }
  }

  const isDateInRange = (date: Date): boolean => {
    if (!localRange.from || !localRange.to) return false
    try {
      return isWithinInterval(date, {
        start: parseDate(localRange.from),
        end: parseDate(localRange.to)
      })
    } catch {
      return false
    }
  }

  const isDateDisabled = (date: Date): boolean => {
    if (minDate && isBefore(date, minDate)) return true
    if (maxDate && isAfter(date, maxDate)) return true
    if (!isDateInSeason(date)) return true
    return false
  }

  const renderMonth = () => {
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    const days: Date[] = []
    const startDay = start.getDay()
    
    for (let i = 0; i < startDay; i++) {
      days.push(addDays(start, i - startDay))
    }
    
    let day = start
    while (day <= end) {
      days.push(day)
      day = addDays(day, 1)
    }
    
    while (days.length < 42) {
      days.push(day)
      day = addDays(day, 1)
    }
    
    return days
  }

  const days = renderMonth()
  const dayCount = localRange.from && localRange.to
    ? differenceInDays(parseDate(localRange.to), parseDate(localRange.from)) + 1
    : 0

  const handleQuickSelect = (from: string, to: string) => {
    const newRange = { from, to }
    setLocalRange(newRange)
    onChange(newRange)
  }

  const commonPeriods = useMemo(() => {
    const today = new Date()
    const periods = [
      { label: 'Today', from: today, to: today },
      { label: 'Last 7 Days', from: subDays(today, 7), to: today },
      { label: 'Last 30 Days', from: subDays(today, 30), to: today },
      { label: 'Last 90 Days', from: subDays(today, 90), to: today },
      { label: 'Month to Date', from: startOfMonth(today), to: today },
      { label: 'Quarter to Date', from: startOfQuarter(today), to: today },
    ]

    if (activeSeasons.length === 0) return periods
    return periods.filter(p => doesRangeOverlapSeason(p.from, p.to))
  }, [activeSeasons])

  return (
    <div className={cn("bg-card rounded-lg", className)}>
      {/* Season Notice */}
      {activeSeasons.length > 0 && (
        <div className="mb-4 p-3 bg-success-subtle border border-success/30 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
          <div className="text-sm text-success-fg">
            <p className="font-medium mb-1">Season Filter Active</p>
            <p className="text-xs">Only dates within {activeSeasons.map(s => s.name).join(', ')} can be selected.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Calendar */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              className="p-2 hover:bg-muted rounded-lg cursor-pointer"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="font-semibold text-lg">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <button
              type="button"
              className="p-2 hover:bg-muted rounded-lg cursor-pointer"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              disabled={maxDate && currentMonth >= maxDate}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
              <div key={day} className="text-sm text-center text-muted-foreground font-medium py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((date, idx) => {
              const isCurrentMonth = date.getMonth() === currentMonth.getMonth()
              const isDisabled = isDateDisabled(date)
              const isOutOfSeason = activeSeasons.length > 0 && !isDateInSeason(date)
              const isInRange = isDateInRange(date)
              const isStart = localRange.from && isSameDay(date, parseDate(localRange.from))
              const isEnd = localRange.to && isSameDay(date, parseDate(localRange.to))

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleDateClick(date)}
                  disabled={!isCurrentMonth || isDisabled}
                  title={isOutOfSeason ? "Outside active seasons" : undefined}
                  className={cn(
                    "p-3 text-sm rounded-lg transition-colors relative",
                    !isCurrentMonth && "text-muted-foreground/50",
                    isCurrentMonth && !isDisabled && "hover:bg-muted cursor-pointer",
                    isDisabled && !isOutOfSeason && "text-muted-foreground/50 cursor-not-allowed",
                    isOutOfSeason && "text-muted-foreground cursor-not-allowed bg-muted/40",
                    isInRange && !isOutOfSeason && "bg-primary/15 cursor-pointer",
                    (isStart || isEnd) && "bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                  )}
                >
                  {date.getDate()}
                  {isOutOfSeason && isCurrentMonth && (
                    <span className="absolute inset-0 bg-muted opacity-50 rounded-lg pointer-events-none" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Quick Select & Info */}
        <div>
          <div className="mb-4">
            <h3 className="text-sm font-medium text-foreground mb-3">Quick Select</h3>
            <div className="space-y-3">
              {commonPeriods.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium uppercase">Common Periods</p>
                  <div className="grid grid-cols-2 gap-2">
                    {commonPeriods.map(period => (
                      <Button
                        key={period.label}
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="justify-start"
                        onClick={() => handleQuickSelect(formatDateISO(period.from), formatDateISO(period.to))}
                      >
                        {period.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {activeSeasons.length > 0 ? (() => {
                const season = activeSeasons[0]
                const inSeason = isCurrentlyInSeason(season)
                const seasonStarted = hasSeasonStartedThisYear(season)
                const currentYear = getYear(new Date())

                return (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2 font-medium uppercase">Season Periods</p>
                    <div className="grid grid-cols-2 gap-2">
                      {seasonStarted && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="justify-start"
                          onClick={() => {
                            const range = getCurrentSeasonDates(season)
                            handleQuickSelect(range.from, range.to)
                          }}
                        >
                          {inSeason ? 'Season to Date' : `${season.name} ${currentYear}`}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="justify-start"
                        onClick={() => {
                          const range = getPreviousSeasonDates(season)
                          handleQuickSelect(range.from, range.to)
                        }}
                      >
                        Last Season
                      </Button>
                    </div>
                  </div>
                )
              })() : (
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium uppercase">Year Periods</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="justify-start"
                      onClick={() => {
                        const today = new Date()
                        handleQuickSelect(formatDateISO(startOfYear(today)), formatDateISO(today))
                      }}
                    >
                      Year to Date
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="justify-start"
                      onClick={() => {
                        const today = new Date()
                        const lastYear = subYears(today, 1)
                        handleQuickSelect(
                          formatDateISO(startOfYear(lastYear)),
                          formatDateISO(new Date(getYear(lastYear), 11, 31))
                        )
                      }}
                    >
                      Last Year
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="justify-start"
                      onClick={() => {
                        const today = new Date()
                        const currentMonth = getMonth(today)
                        const currentYear = getYear(today)
                        const fiscalYearStart = currentMonth >= 9
                          ? new Date(currentYear, 9, 1)
                          : new Date(currentYear - 1, 9, 1)
                        handleQuickSelect(formatDateISO(fiscalYearStart), formatDateISO(today))
                      }}
                      title="Fiscal Year to Date (Oct 1 - Sep 30)"
                    >
                      Fiscal YTD
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="justify-start"
                      onClick={() => {
                        const today = new Date()
                        const currentMonth = getMonth(today)
                        const currentYear = getYear(today)
                        const lastFiscalYearStart = currentMonth >= 9
                          ? new Date(currentYear - 1, 9, 1)
                          : new Date(currentYear - 2, 9, 1)
                        const lastFiscalYearEnd = currentMonth >= 9
                          ? new Date(currentYear, 8, 30)
                          : new Date(currentYear - 1, 8, 30)
                        handleQuickSelect(formatDateISO(lastFiscalYearStart), formatDateISO(lastFiscalYearEnd))
                      }}
                      title="Previous Fiscal Year (Oct 1 - Sep 30)"
                    >
                      Last Fiscal Year
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Selected range display */}
          {localRange.from && (
            <div className="p-4 bg-primary/10 rounded-lg">
              <h3 className="text-sm font-medium text-foreground mb-2">Selected Range</h3>
              <div className="text-sm text-foreground">
                {localRange.to ? (
                  <>
                    <div>{formatDateDisplay(localRange.from)} - {formatDateDisplay(localRange.to)}</div>
                    <div className="text-muted-foreground mt-1">{dayCount} days</div>
                  </>
                ) : (
                  <div>
                    <div className="text-muted-foreground">Click another date to complete the range</div>
                    <div className="mt-1">Start: {formatDateDisplay(localRange.from)}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {!localRange.from && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <h3 className="text-sm font-medium text-foreground mb-2">How to select</h3>
              <p className="text-sm text-muted-foreground">
                Click a date to start your range, then click another date to complete it.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}