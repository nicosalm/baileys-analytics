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
  getYear,
  getMonth
} from '@baileys/utils'
import { useSeasons } from '@/hooks/use-api'
import { InlineDateRangePicker } from './InlineDateRangePicker'
import { Modal } from './Modal'
import type { Season } from '@/types/season'
import { 
  calculateComparisonRange, 
  getComparisonLabel, 
  type ComparisonType 
} from '@/utils/comparison'

interface DateRange {
  from: string
  to: string
}

interface SmartPeriodSelectorProps {
  value: DateRange
  onChange: (range: DateRange, comparison?: DateRange) => void
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

const getCurrentSeasonDates = (season: Season, year: number = getYear(new Date())) => {
  const today = new Date()
  
  let startDate: Date
  let endDate: Date
  
  if (season.startMonth <= season.endMonth) {
    startDate = new Date(year, season.startMonth - 1, season.startDay)
    endDate = new Date(year, season.endMonth - 1, season.endDay)
  } else {
    const currentMonth = getMonth(today) + 1
    if (currentMonth >= season.startMonth) {
      startDate = new Date(year, season.startMonth - 1, season.startDay)
      endDate = new Date(year + 1, season.endMonth - 1, season.endDay)
    } else {
      startDate = new Date(year - 1, season.startMonth - 1, season.startDay)
      endDate = new Date(year, season.endMonth - 1, season.endDay)
    }
  }
  
  const cappedEndDate = endDate > today ? today : endDate
  
  return {
    from: formatDateISO(startDate),
    to: formatDateISO(cappedEndDate)
  }
}

const getPreviousSeasonDates = (season: Season) => {
  const currentYear = getYear(new Date())
  return getCurrentSeasonDates(season, currentYear - 1)
}

const isCurrentlyInSeason = (season: Season): boolean => {
  const today = new Date()
  const currentMonth = getMonth(today) + 1
  const currentDay = today.getDate()
  
  if (season.startMonth <= season.endMonth) {
    // Season doesn't cross year boundary
    return (
      (currentMonth > season.startMonth || (currentMonth === season.startMonth && currentDay >= season.startDay)) &&
      (currentMonth < season.endMonth || (currentMonth === season.endMonth && currentDay <= season.endDay))
    )
  } else {
    // Season crosses year boundary
    return (
      (currentMonth > season.startMonth || (currentMonth === season.startMonth && currentDay >= season.startDay)) ||
      (currentMonth < season.endMonth || (currentMonth === season.endMonth && currentDay <= season.endDay))
    )
  }
}

const hasSeasonStartedThisYear = (season: Season): boolean => {
  const today = new Date()
  const currentYear = getYear(today)
  const seasonStart = new Date(currentYear, season.startMonth - 1, season.startDay)
  
  // For cross-year seasons, check if we're in the latter part
  if (season.startMonth > season.endMonth) {
    const currentMonth = getMonth(today) + 1
    if (currentMonth <= season.endMonth) {
      // We're in the end part of a season that started last year
      return true
    }
  }
  
  return today >= seasonStart
}

export const SmartPeriodSelector: React.FC<SmartPeriodSelectorProps> = ({
  value,
  onChange,
  comparisonRange,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [comparisonType, setComparisonType] = useState<ComparisonType>('none')
  const [comparisonDropdownOpen, setComparisonDropdownOpen] = useState(false)
  const [customRangeOpen, setCustomRangeOpen] = useState(false)
  const [tempCustomRange, setTempCustomRange] = useState<DateRange>(value)
  const containerRef = useRef<HTMLDivElement>(null)
  const comparisonRef = useRef<HTMLDivElement>(null)

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
          const comparisonResult = calculateComparisonRange(lastSeasonDates, comparisonType, activeSeason)
          onChangeRef.current(lastSeasonDates, comparisonResult.isValid ? comparisonResult.range : undefined)
        } else {
          const currentSeasonDates = getCurrentSeasonDates(season)
          const activeSeason = activeSeasons[0]
          const comparisonResult = calculateComparisonRange(currentSeasonDates, comparisonType, activeSeason)
          onChangeRef.current(currentSeasonDates, comparisonResult.isValid ? comparisonResult.range : undefined)
        }
      }
    }
  }, [seasonsLoading, activeSeasons, value.from, comparisonType])
  
  // Check if current comparison is still valid when date range changes
  useEffect(() => {
    if (comparisonType !== 'none' && value.from && value.to) {
      const activeSeason = activeSeasons.length > 0 ? activeSeasons[0] : undefined
      const comparisonResult = calculateComparisonRange(value, comparisonType, activeSeason)

      if (!comparisonResult.isValid) {
        setComparisonType('none')
        onChangeRef.current(value, undefined)
      }
    }
  }, [value, activeSeasons, comparisonType])
  
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
            label: `${season.name} ${getYear(today)}${inSeason ? '' : ' (Ended)'}`,
            getRange: () => getCurrentSeasonDates(season)
          },
          {
            id: 'last-season',
            label: `${season.name} ${getYear(today) - 1}`,
            getRange: () => getPreviousSeasonDates(season)
          }
        )
        
        if (inSeason) {
          options.push({
            id: 'season-ytd',
            label: 'Season to Date',
            getRange: () => getCurrentSeasonDates(season)
          })
        }
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
    
    if (comparisonType !== 'none') {
      const activeSeason = activeSeasons.length > 0 ? activeSeasons[0] : undefined
      const comparisonResult = calculateComparisonRange(range, comparisonType, activeSeason)
      
      onChange(range, comparisonResult.isValid ? comparisonResult.range : undefined)
    } else {
      onChange(range, undefined)
    }
    
    setIsOpen(false)
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
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
      if (comparisonRef.current && !comparisonRef.current.contains(event.target as Node)) {
        setComparisonDropdownOpen(false)
      }
    }
    
    if (isOpen || comparisonDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, comparisonDropdownOpen])
  
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
    <div className={cn("relative", className)} ref={containerRef}>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        {/* Main selector button */}
        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen)
            setComparisonDropdownOpen(false)
          }}
          className={cn(
            "flex items-center gap-2 px-3 md:px-4 py-2 bg-white border rounded-lg cursor-pointer",
            "hover:bg-gray-50 transition-all text-sm font-medium text-gray-700",
            isOpen && "ring-2 ring-blue-600 border-blue-600",
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
            isOpen && "rotate-180"
          )} />
        </button>

        {/* Comparison toggle */}
        <div className="relative" ref={comparisonRef}>
          <button
            type="button"
            onClick={() => {
              setComparisonDropdownOpen(!comparisonDropdownOpen)
              setIsOpen(false)
            }}
            className={cn(
              "flex items-center gap-2 px-3 md:px-4 py-2 bg-white border rounded-lg cursor-pointer w-full sm:w-auto",
              "hover:bg-gray-50 transition-all text-sm font-medium text-gray-700",
              comparisonDropdownOpen && "ring-2 ring-blue-600 border-blue-600",
              comparisonType !== 'none' && "border-blue-600 bg-blue-50/50"
            )}
          >
            <GitCompare className={cn(
              "w-4 h-4 flex-shrink-0",
              comparisonType !== 'none' ? "text-blue-600" : "text-gray-500"
            )} />
            <span className="truncate">
              {getComparisonLabel(comparisonType, activeSeasons.length > 0)}
              {comparisonRangeLabel && (
                <span className="text-gray-400 font-normal"> ({comparisonRangeLabel})</span>
              )}
            </span>
            <ChevronDown className={cn(
              "w-4 h-4 text-gray-500 transition-transform flex-shrink-0",
              comparisonDropdownOpen && "rotate-180"
            )} />
          </button>
          
          {/* Comparison Dropdown */}
          {comparisonDropdownOpen && (
            <div className="absolute z-40 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl min-w-[200px] left-0 sm:left-auto sm:right-0">
              <div className="p-1">
                <button
                  onClick={() => {
                    setComparisonType('none')
                    setComparisonDropdownOpen(false)
                    if (value.from && value.to) {
                      onChange(value, undefined)
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
                
                {/* Check if Last Period is valid for current selection */}
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
                          setComparisonDropdownOpen(false)
                          if (value.from && value.to && lastPeriodResult.isValid && lastPeriodResult.range) {
                            onChange(value, lastPeriodResult.range)
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
                      <span>vs Last Period</span>
                      {comparisonType === 'lastPeriod' && !isDisabled && <Check className="w-4 h-4" />}
                    </button>
                  )
                })()}
                
                {/* Check if Last Year is valid for current selection */}
                {(() => {
                  const activeSeason = activeSeasons.length > 0 ? activeSeasons[0] : undefined
                  const lastYearResult = value.from && value.to 
                    ? calculateComparisonRange(value, 'lastYear', activeSeason)
                    : { isValid: true }
                  const isDisabled = !lastYearResult.isValid
                  
                  return (
                    <button
                      onClick={() => {
                        if (!isDisabled) {
                          setComparisonType('lastYear')
                          setComparisonDropdownOpen(false)
                          if (value.from && value.to && lastYearResult.isValid && lastYearResult.range) {
                            onChange(value, lastYearResult.range)
                          }
                        }
                      }}
                      disabled={isDisabled}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between",
                        isDisabled
                          ? "opacity-50 cursor-not-allowed text-gray-400"
                          : comparisonType === 'lastYear'
                            ? "bg-blue-50 text-blue-700 cursor-pointer"
                            : "hover:bg-gray-100 text-gray-700 cursor-pointer"
                      )}
                      title={isDisabled ? "No data available in last year for selected season" : undefined}
                    >
                      <span>vs Last Year</span>
                      {comparisonType === 'lastYear' && !isDisabled && <Check className="w-4 h-4" />}
                    </button>
                  )
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute z-40 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl min-w-[280px]">
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
                  setIsOpen(false)
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-gray-100 text-gray-700 cursor-pointer"
              >
                Custom Range...
              </button>
            </div>
          </div>
        </div>
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
              <button
                onClick={() => setCustomRangeOpen(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onChange(tempCustomRange)
                  setCustomRangeOpen(false)
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:opacity-90 transition-opacity font-medium cursor-pointer"
                disabled={!tempCustomRange.from || !tempCustomRange.to}
              >
                Apply Range
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}