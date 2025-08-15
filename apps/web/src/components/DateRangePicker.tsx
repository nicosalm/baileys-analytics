import React, { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { 
  cn, 
  formatDateISO, 
  parseDate,
  differenceInDays,
  subDays,
  addMonths,
  subMonths,
  startOfMonth,
  startOfYear,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  getMonth,
  getYear,
  format,
  isSameDay,
  isAfter,
  isBefore,
  isWithinInterval,
  addDays
} from '@baileys/utils'

interface DateRange {
  from: string
  to: string
}

interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
  maxDays?: number
  minDate?: Date
  maxDate?: Date
  disabled?: boolean
  className?: string
  placeholder?: string
  debounceMs?: number
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  onChange,
  maxDays = 1825,
  minDate,
  maxDate = new Date(),
  disabled = false,
  className,
  placeholder = "Select date range",
  debounceMs = 0
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [localRange, setLocalRange] = useState<DateRange>(value)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  // Using date-fns functions from utils package

  const formatDateDisplay = (dateStr: string): string => {
    const date = parseDate(dateStr)
    return format(date, 'MMM d, yyyy')
  }

  useEffect(() => {
    setLocalRange(value)
  }, [value])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleDateClick = (date: Date) => {
    if (isDateDisabled(date)) return

    const clickedDate = formatDateISO(date)
    
    if (!localRange.from || (localRange.from && localRange.to && localRange.from !== localRange.to)) {
      // Start new range
      const newRange = { from: clickedDate, to: '' }
      setLocalRange(newRange)
      // Don't apply debounce yet - wait for the second click
    } else if (localRange.from && !localRange.to) {
      // Complete range
      const fromDate = parseDate(localRange.from)
      
      if (isAfter(date, fromDate) || isSameDay(date, fromDate)) {
        const daysDiff = differenceInDays(date, fromDate)
        
        if (maxDays && daysDiff > maxDays) {
          // Limit to maxDays
          const limitedTo = formatDateISO(addDays(fromDate, maxDays - 1))
          const newRange = { from: localRange.from, to: limitedTo }
          setLocalRange(newRange)
          applyDebounce(newRange)
        } else {
          const newRange = { from: localRange.from, to: clickedDate }
          setLocalRange(newRange)
          applyDebounce(newRange)
        }
      } else {
        // Clicked before from date, set as new range
        const newRange = { from: clickedDate, to: localRange.from }
        setLocalRange(newRange)
        applyDebounce(newRange)
      }
    } else if (localRange.from === localRange.to) {
      // Single day selected, treat next click as range end
      const fromDate = parseDate(localRange.from)
      
      if (isAfter(date, fromDate)) {
        const newRange = { from: localRange.from, to: clickedDate }
        setLocalRange(newRange)
        applyDebounce(newRange)
      } else if (isBefore(date, fromDate)) {
        const newRange = { from: clickedDate, to: localRange.from }
        setLocalRange(newRange)
        applyDebounce(newRange)
      }
    }
  }

  const applyDebounce = (range: DateRange) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    if (debounceMs > 0) {
      debounceTimer.current = setTimeout(() => {
        onChange(range)
      }, debounceMs)
    } else {
      onChange(range)
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
    return false
  }



  const dayCount = localRange.from && localRange.to
    ? differenceInDays(parseDate(localRange.to), parseDate(localRange.from)) + 1
    : 0

  const monthStart = startOfMonth(currentMonth)
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()

  // Generate days array for the month
  const days: Date[] = []
  const firstDayOfWeek = monthStart.getDay()
  
  // Add empty slots for days before month starts
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), -firstDayOfWeek + i + 1))
  }
  
  // Add all days of the month
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i)
    days.push(date)
  }

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 px-3 py-2 bg-white border rounded-sm",
          "hover:bg-gray-50 transition-colors",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        <Calendar className="w-4 h-4 text-gray-500" />
        <span className="text-sm">
          {value.from && value.to ? (
            <>
              {formatDateDisplay(value.from)} - {formatDateDisplay(value.to)}
              <span className="ml-2 text-gray-500">({dayCount} days)</span>
            </>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 p-4 bg-white border rounded-lg shadow-lg min-w-[320px]">
          {/* Quick Select Buttons */}
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
              onClick={() => {
                const today = formatDateISO(new Date())
                const newRange = { from: today, to: today }
                setLocalRange(newRange)
                onChange(newRange)
              }}
            >
              Today
            </button>
            <button
              type="button"
              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
              onClick={() => {
                const today = formatDateISO(new Date())
                const sevenDaysAgo = formatDateISO(subDays(new Date(), 7))
                const newRange = { from: sevenDaysAgo, to: today }
                setLocalRange(newRange)
                onChange(newRange)
              }}
            >
              Last 7 days
            </button>
            <button
              type="button"
              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
              onClick={() => {
                const today = formatDateISO(new Date())
                const thirtyDaysAgo = formatDateISO(subDays(new Date(), 30))
                const newRange = { from: thirtyDaysAgo, to: today }
                setLocalRange(newRange)
                onChange(newRange)
              }}
            >
              Last 30 days
            </button>
            <button
              type="button"
              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
              onClick={() => {
                const today = formatDateISO(new Date())
                const ninetyDaysAgo = formatDateISO(subDays(new Date(), 90))
                const newRange = { from: ninetyDaysAgo, to: today }
                setLocalRange(newRange)
                onChange(newRange)
              }}
            >
              Last 90 days
            </button>
            <button
              type="button"
              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
              onClick={() => {
                const today = new Date()
                const yearStart = formatDateISO(startOfYear(today))
                const todayStr = formatDateISO(today)
                const newRange = { from: yearStart, to: todayStr }
                setLocalRange(newRange)
                onChange(newRange)
              }}
            >
              Year to Date
            </button>
            <button
              type="button"
              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
              onClick={() => {
                const today = new Date()
                const currentMonth = getMonth(today)
                const currentYear = getYear(today)
                // Fiscal year typically starts Oct 1 (month 9 in 0-indexed JS)
                // If we're in Oct-Dec, fiscal year started this calendar year
                // If we're in Jan-Sep, fiscal year started last calendar year
                const fiscalYearStart = currentMonth >= 9 
                  ? new Date(currentYear, 9, 1) // Oct 1 of current year
                  : new Date(currentYear - 1, 9, 1) // Oct 1 of last year
                const fiscalYearEnd = currentMonth >= 9
                  ? endOfMonth(new Date(currentYear + 1, 8, 1)) // Sep 30 of next year
                  : endOfMonth(new Date(currentYear, 8, 1)) // Sep 30 of current year
                
                // Use today if it's before fiscal year end, otherwise use fiscal year end
                const endDate = isBefore(today, fiscalYearEnd) ? today : fiscalYearEnd
                
                const newRange = { 
                  from: formatDateISO(fiscalYearStart), 
                  to: formatDateISO(endDate)
                }
                setLocalRange(newRange)
                onChange(newRange)
              }}
              title="Fiscal Year to Date (Oct 1 - Sep 30)"
            >
              Fiscal YTD
            </button>
            <button
              type="button"
              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
              onClick={() => {
                const today = new Date()
                const currentMonth = getMonth(today)
                const currentYear = getYear(today)
                // Last fiscal year
                const lastFiscalYearStart = currentMonth >= 9 
                  ? new Date(currentYear - 1, 9, 1) // Oct 1 of last year
                  : new Date(currentYear - 2, 9, 1) // Oct 1 of 2 years ago
                const lastFiscalYearEnd = currentMonth >= 9
                  ? endOfMonth(new Date(currentYear, 8, 1)) // Sep 30 of current year
                  : endOfMonth(new Date(currentYear - 1, 8, 1)) // Sep 30 of last year
                
                const newRange = { 
                  from: formatDateISO(lastFiscalYearStart), 
                  to: formatDateISO(lastFiscalYearEnd)
                }
                setLocalRange(newRange)
                onChange(newRange)
              }}
              title="Previous Fiscal Year (Oct 1 - Sep 30)"
            >
              Last FY
            </button>
            <button
              type="button"
              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
              onClick={() => {
                const today = new Date()
                const quarterStart = startOfQuarter(today)
                const quarterEnd = endOfQuarter(today)
                
                // Use today if it's before quarter end, otherwise use quarter end
                const endDate = isBefore(today, quarterEnd) ? today : quarterEnd
                
                const newRange = { 
                  from: formatDateISO(quarterStart), 
                  to: formatDateISO(endDate)
                }
                setLocalRange(newRange)
                onChange(newRange)
              }}
              title="Current Quarter to Date"
            >
              Quarter to Date
            </button>
          </div>

          {/* Calendar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                className="p-1 hover:bg-gray-100 rounded"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-medium">
                {format(currentMonth, 'MMMM yyyy')}
              </span>
              <button
                type="button"
                className="p-1 hover:bg-gray-100 rounded"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                disabled={maxDate && currentMonth >= maxDate}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                <div key={day} className="text-xs text-center text-gray-500 font-medium py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((date, idx) => {
                const isCurrentMonth = date.getMonth() === currentMonth.getMonth()
                const isDisabled = isDateDisabled(date)
                const isInRange = isDateInRange(date)
                const isStart = localRange.from && localRange.from !== '' && isSameDay(date, parseDate(localRange.from))
                const isEnd = localRange.to && localRange.to !== '' && isSameDay(date, parseDate(localRange.to))

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleDateClick(date)}
                    disabled={!isCurrentMonth || isDisabled}
                    className={cn(
                      "p-2 text-xs rounded transition-colors",
                      !isCurrentMonth && "text-gray-300",
                      isCurrentMonth && !isDisabled && "hover:bg-gray-100",
                      isDisabled && "text-gray-300 cursor-not-allowed",
                      isInRange && "bg-blue-100",
                      (isStart || isEnd) && "bg-blue-500 text-white hover:bg-blue-600"
                    )}
                  >
                    {date.getDate()}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Selected range display */}
          {localRange.from && localRange.to && (
            <div className="text-sm text-center text-gray-600 border-t pt-2">
              {formatDateDisplay(localRange.from)} - {formatDateDisplay(localRange.to)}
              <span className="ml-2">({dayCount} days)</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

