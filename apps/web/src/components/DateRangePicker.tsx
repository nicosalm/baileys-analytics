import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Calendar, AlertCircle, RefreshCw } from 'lucide-react'

// Result type for explicit error handling
type Result<T, E> =
  | { type: 'success'; value: T }
  | { type: 'error'; error: E }

type DateRange = {
  from: string
  to: string
}

type ValidationError =
  | { type: 'INVALID_FORMAT'; field: 'from' | 'to' }
  | { type: 'END_BEFORE_START' }
  | { type: 'FUTURE_DATE'; field: 'from' | 'to'; maxDate: string }
  | { type: 'BEFORE_MIN_DATE'; field: 'from' | 'to'; minDate: string }
  | { type: 'EXCEEDS_MAX_DAYS'; maxDays: number; actualDays: number }

// Pure validation functions
const isValidDateFormat = (dateStr: string): boolean => {
  const date = new Date(dateStr)
  return !isNaN(date.getTime()) && dateStr.match(/^\d{4}-\d{2}-\d{2}$/) !== null
}

const calculateDaysBetween = (from: string, to: string): number => {
  const fromDate = new Date(from)
  const toDate = new Date(to)
  return Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0]
}

const getToday = (): string => formatDate(new Date())

const getTwoYearsAgo = (): string => {
  const date = new Date()
  date.setFullYear(date.getFullYear() - 2)
  return formatDate(date)
}

// Main validation function using Result type
const validateDateRange = (
  range: DateRange,
  constraints: {
    minDate?: string
    maxDate?: string
    maxDays?: number
    allowFutureDates?: boolean
  } = {}
): Result<DateRange, ValidationError> => {
  // Check format validity
  if (!isValidDateFormat(range.from)) {
    return { type: 'error', error: { type: 'INVALID_FORMAT', field: 'from' } }
  }
  if (!isValidDateFormat(range.to)) {
    return { type: 'error', error: { type: 'INVALID_FORMAT', field: 'to' } }
  }

  const fromDate = new Date(range.from)
  const toDate = new Date(range.to)
  const today = new Date(getToday())

  // Check if end is before start
  if (toDate < fromDate) {
    return { type: 'error', error: { type: 'END_BEFORE_START' } }
  }

  // Check future dates
  if (!constraints.allowFutureDates) {
    if (fromDate > today) {
      return { type: 'error', error: { type: 'FUTURE_DATE', field: 'from', maxDate: getToday() } }
    }
    if (toDate > today) {
      return { type: 'error', error: { type: 'FUTURE_DATE', field: 'to', maxDate: getToday() } }
    }
  }

  // Check minimum date
  if (constraints.minDate) {
    const minDate = new Date(constraints.minDate)
    if (fromDate < minDate) {
      return { type: 'error', error: { type: 'BEFORE_MIN_DATE', field: 'from', minDate: constraints.minDate } }
    }
    if (toDate < minDate) {
      return { type: 'error', error: { type: 'BEFORE_MIN_DATE', field: 'to', minDate: constraints.minDate } }
    }
  }

  // Check maximum date
  const effectiveMaxDate = constraints.maxDate || getToday()
  const maxDate = new Date(effectiveMaxDate)
  if (fromDate > maxDate) {
    return { type: 'error', error: { type: 'FUTURE_DATE', field: 'from', maxDate: effectiveMaxDate } }
  }
  if (toDate > maxDate) {
    return { type: 'error', error: { type: 'FUTURE_DATE', field: 'to', maxDate: effectiveMaxDate } }
  }

  // Check maximum days
  if (constraints.maxDays) {
    const days = calculateDaysBetween(range.from, range.to)
    if (days > constraints.maxDays) {
      return { type: 'error', error: { type: 'EXCEEDS_MAX_DAYS', maxDays: constraints.maxDays, actualDays: days } }
    }
  }

  return { type: 'success', value: range }
}

// Error message formatting
const formatValidationError = (error: ValidationError): string => {
  switch (error.type) {
    case 'INVALID_FORMAT':
      return `Invalid date format in ${error.field} field`
    case 'END_BEFORE_START':
      return 'End date must be after start date'
    case 'FUTURE_DATE':
      return `${error.field === 'from' ? 'Start' : 'End'} date cannot be in the future`
    case 'BEFORE_MIN_DATE':
      return `${error.field === 'from' ? 'Start' : 'End'} date cannot be before ${new Date(error.minDate).toLocaleDateString()}`
    case 'EXCEEDS_MAX_DAYS':
      return `Date range cannot exceed ${error.maxDays} days (currently ${error.actualDays} days)`
  }
}

// Debounced date range picker component
interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
  minDate?: string
  maxDate?: string
  maxDays?: number
  allowFutureDates?: boolean
  debounceMs?: number
  className?: string
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  onChange,
  minDate = getTwoYearsAgo(),
  maxDate = getToday(),
  maxDays = 365,
  allowFutureDates = false,
  debounceMs = 500,
  className = ''
}) => {
  const [localRange, setLocalRange] = useState(value)
  const [validation, setValidation] = useState<Result<DateRange, ValidationError>>({ type: 'success', value })
  const debounceTimeout = useRef<NodeJS.Timeout>()

  // Update local range when value changes externally
  useEffect(() => {
    setLocalRange(value)
  }, [value])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current)
      }
    }
  }, [])

  // Validate and debounce changes
  const handleRangeChange = useCallback((newRange: DateRange) => {
    setLocalRange(newRange)

    const validationResult = validateDateRange(newRange, {
      minDate,
      maxDate,
      maxDays,
      allowFutureDates
    })

    setValidation(validationResult)

    // Clear existing timeout
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current)
    }

    // Only propagate valid changes after debounce
    if (validationResult.type === 'success') {
      debounceTimeout.current = setTimeout(() => {
        onChange(validationResult.value)
      }, debounceMs)
    }
  }, [minDate, maxDate, maxDays, allowFutureDates, onChange, debounceMs])

  const handleDateChange = (field: 'from' | 'to', value: string) => {
    handleRangeChange({ ...localRange, [field]: value })
  }

  const resetToDefault = () => {
    const defaultRange: DateRange = {
      from: formatDate(new Date(new Date().getFullYear(), 0, 1)),
      to: getToday()
    }
    handleRangeChange(defaultRange)
  }

  const isError = validation.type === 'error'
  const dayCount = isError ? 0 : calculateDaysBetween(localRange.from, localRange.to)

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center space-x-2">
        <div className={`flex items-center space-x-2 bg-white border rounded-lg px-3 py-2 ${
          isError ? 'border-red-300' : 'border-gray-300'
        }`}>
          <Calendar className={`w-4 h-4 ${isError ? 'text-red-500' : 'text-gray-500'}`} />

          <input
            type="date"
            value={localRange.from}
            onChange={(e) => handleDateChange('from', e.target.value)}
            min={minDate}
            max={localRange.to || maxDate}
            className={`px-2 py-1 text-sm border-0 focus:outline-none ${
              isError && validation.error.type !== 'END_BEFORE_START' &&
              (validation.error.type === 'INVALID_FORMAT' && validation.error.field === 'from' ||
               validation.error.type === 'FUTURE_DATE' && validation.error.field === 'from' ||
               validation.error.type === 'BEFORE_MIN_DATE' && validation.error.field === 'from')
                ? 'text-red-600'
                : ''
            }`}
          />

          <span className="text-gray-500 text-sm">to</span>

          <input
            type="date"
            value={localRange.from}
            onChange={(e) => handleDateChange('from', e.target.value)}
            min={minDate}
            max={localRange.to || maxDate}
            className={`px-2 py-1 text-sm border-0 focus:outline-none ${
              isError && validation.error.type !== 'END_BEFORE_START' &&
              (validation.error.type === 'INVALID_FORMAT' && validation.error.field === 'from' ||
               validation.error.type === 'FUTURE_DATE' && validation.error.field === 'from' ||
               validation.error.type === 'BEFORE_MIN_DATE' && validation.error.field === 'from')
                ? 'text-red-600'
                : ''
            }`}
          />

          {!isError && (
            <div className="text-sm text-gray-600 border-l pl-2">
              {dayCount} {dayCount === 1 ? 'day' : 'days'}
            </div>
          )}
        </div>

        <button
          onClick={resetToDefault}
          className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
          title="Reset to current year"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {isError && (
        <div className="flex items-center text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
          <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
          {formatValidationError(validation.error)}
        </div>
      )}
    </div>
  )
}
