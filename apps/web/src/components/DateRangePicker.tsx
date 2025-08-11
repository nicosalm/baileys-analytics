import React, { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@baileys/utils'

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
  maxDays = 365,
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

  // Format date to ISO format (YYYY-MM-DD)
  const formatDateISO = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Parse ISO date string to Date object
  const parseISODate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  // Format date for display (MM/DD/YYYY)
  const formatDateDisplay = (dateStr: string): string => {
    const date = parseISODate(dateStr)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const year = date.getFullYear()
    return `${month}/${day}/${year}`
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

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleDateSelect = (date: Date) => {
    const dateStr = formatDateISO(date)
    const fromDate = parseISODate(localRange.from)
    const toDate = parseISODate(localRange.to)

    let newRange: DateRange

    if (!localRange.from || date < fromDate) {
      // Starting new range
      newRange = { from: dateStr, to: dateStr }
    } else if (date > toDate) {
      // Extending range
      const daysDiff = Math.floor((date.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24))
      if (daysDiff <= maxDays) {
        newRange = { from: localRange.from, to: dateStr }
      } else {
        // Reset if exceeds max days
        newRange = { from: dateStr, to: dateStr }
      }
    } else {
      // Date is within current range, start new selection
      newRange = { from: dateStr, to: dateStr }
    }

    setLocalRange(newRange)

    // Debounced onChange
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(() => {
      onChange(newRange)
    }, debounceMs)
  }

  const isDateInRange = (date: Date): boolean => {
    if (!localRange.from || !localRange.to) return false
    const dateTime = date.getTime()
    const fromTime = parseISODate(localRange.from).getTime()
    const toTime = parseISODate(localRange.to).getTime()
    return dateTime >= fromTime && dateTime <= toTime
  }

  const isDateDisabled = (date: Date): boolean => {
    if (minDate && date < minDate) return true
    if (maxDate && date > maxDate) return true
    return false
  }

  const getDaysInMonth = (date: Date): Date[] => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const days: Date[] = []

    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(new Date(year, month, -i))
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d))
    }

    return days
  }

  const monthYear = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const displayValue = localRange.from && localRange.to
    ? `${formatDateDisplay(localRange.from)} - ${formatDateDisplay(localRange.to)}`
    : placeholder

  const daysDiff = localRange.from && localRange.to
    ? Math.floor((parseISODate(localRange.to).getTime() - parseISODate(localRange.from).getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 px-4 py-2 border rounded-lg bg-white hover:bg-gray-50 transition-colors",
          "text-sm font-medium text-gray-700",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <Calendar className="w-4 h-4" />
        <span>{displayValue}</span>
        {daysDiff > 0 && (
          <span className="text-gray-500">({daysDiff} days)</span>
        )}
      </button>

      {isOpen && !disabled && (
        <div className="absolute top-full mt-2 left-0 bg-white border rounded-lg shadow-lg p-4 z-50">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="font-semibold">{monthYear}</h3>
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
              <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {getDaysInMonth(currentMonth).map((date, index) => {
              const isCurrentMonth = date.getMonth() === currentMonth.getMonth()
              const isInRange = isDateInRange(date)
              const isStart = localRange.from && formatDateISO(date) === localRange.from
              const isEnd = localRange.to && formatDateISO(date) === localRange.to
              const isDisabled = isDateDisabled(date)

              return (
                <button
                  key={index}
                  onClick={() => !isDisabled && isCurrentMonth && handleDateSelect(date)}
                  disabled={isDisabled || !isCurrentMonth}
                  className={cn(
                    "p-2 text-sm rounded transition-colors",
                    isCurrentMonth ? "text-gray-900" : "text-gray-300",
                    isInRange && "bg-blue-100",
                    (isStart || isEnd) && "bg-blue-500 text-white",
                    !isDisabled && isCurrentMonth && "hover:bg-gray-100",
                    isDisabled && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>

          <div className="mt-4 flex justify-between text-sm">
            <button
              onClick={() => {
                const today = formatDateISO(new Date())
                const thirtyDaysAgo = formatDateISO(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
                const newRange = { from: thirtyDaysAgo, to: today }
                setLocalRange(newRange)
                onChange(newRange)
                setIsOpen(false)
              }}
              className="text-blue-600 hover:underline"
            >
              Last 30 days
            </button>
            <button
              onClick={() => {
                const today = formatDateISO(new Date())
                const ninetyDaysAgo = formatDateISO(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000))
                const newRange = { from: ninetyDaysAgo, to: today }
                setLocalRange(newRange)
                onChange(newRange)
                setIsOpen(false)
              }}
              className="text-blue-600 hover:underline"
            >
              Last 90 days
            </button>
            <button
              onClick={() => {
                const today = new Date()
                const yearStart = formatDateISO(new Date(today.getFullYear(), 0, 1))
                const todayStr = formatDateISO(today)
                const newRange = { from: yearStart, to: todayStr }
                setLocalRange(newRange)
                onChange(newRange)
                setIsOpen(false)
              }}
              className="text-blue-600 hover:underline"
            >
              Year to date
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
