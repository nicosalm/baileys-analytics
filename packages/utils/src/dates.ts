import { 
  format, 
  parseISO, 
  formatISO,
  startOfMonth, 
  endOfMonth, 
  startOfYear, 
  endOfYear,
  startOfQuarter,
  endOfQuarter, 
  subDays, 
  addDays,
  addYears,
  subYears, 
  differenceInDays,
  differenceInMonths,
  isAfter,
  isBefore,
  isWithinInterval,
  startOfDay,
  endOfDay,
  getMonth,
  getYear,
  getDate as getDayOfMonth,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  getDaysInMonth
} from 'date-fns'

// Standard date formats
export const DATE_FORMAT = 'yyyy-MM-dd'
export const DATE_DISPLAY_FORMAT = 'MMM d, yyyy'
export const DATE_TIME_FORMAT = 'MMM d, yyyy h:mm a'
export const MONTH_YEAR_FORMAT = 'MMMM yyyy'

// Format date to ISO string (YYYY-MM-DD)
export const formatDateISO = (date: Date | string): string => {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, DATE_FORMAT)
}

// Format date for display
export const formatDateDisplay = (date: Date | string): string => {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, DATE_DISPLAY_FORMAT)
}

// Format date with time for display
export const formatDateTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, DATE_TIME_FORMAT)
}

// Parse ISO date string to Date object
export const parseDate = (dateString: string): Date => {
  return parseISO(dateString)
}

// Calculate nights between dates
export const calculateNights = (arrival: Date | string, departure: Date | string): number => {
  const arrivalDate = typeof arrival === 'string' ? parseISO(arrival) : arrival
  const departureDate = typeof departure === 'string' ? parseISO(departure) : departure
  return Math.max(0, differenceInDays(departureDate, arrivalDate))
}


// Get date range for common periods
export const getDateRange = (period: 'month' | 'year' | 'last7' | 'last30' | 'last90' | 'yearToDate') => {
  const now = new Date()
  
  switch (period) {
    case 'month':
      return {
        from: formatDateISO(startOfMonth(now)),
        to: formatDateISO(endOfMonth(now))
      }
    case 'year':
      return {
        from: formatDateISO(startOfYear(now)),
        to: formatDateISO(endOfYear(now))
      }
    case 'last7':
      return {
        from: formatDateISO(subDays(now, 7)),
        to: formatDateISO(now)
      }
    case 'last30':
      return {
        from: formatDateISO(subDays(now, 30)),
        to: formatDateISO(now)
      }
    case 'last90':
      return {
        from: formatDateISO(subDays(now, 90)),
        to: formatDateISO(now)
      }
    case 'yearToDate':
      return {
        from: formatDateISO(startOfYear(now)),
        to: formatDateISO(now)
      }
  }
}

// Get days in range
export const getDaysInRange = (from: string, to: string): number => {
  return differenceInDays(parseISO(to), parseISO(from)) + 1
}

// Check if date is in range
export const isDateInRange = (date: Date | string, from: string, to: string): boolean => {
  const d = typeof date === 'string' ? parseISO(date) : date
  return isWithinInterval(d, { 
    start: startOfDay(parseISO(from)), 
    end: endOfDay(parseISO(to)) 
  })
}

// Get relative date descriptions
export const getRelativeDateDescription = (from: string, to: string): string => {
  const days = getDaysInRange(from, to)
  
  if (days === 1) return 'Today'
  if (days === 7) return 'Last 7 days'
  if (days === 30) return 'Last 30 days'
  if (days === 90) return 'Last 90 days'
  
  const fromDate = parseISO(from)
  const toDate = parseISO(to)
  
  // Check if it's a complete month
  if (
    fromDate.getDate() === 1 && 
    toDate.getDate() === new Date(toDate.getFullYear(), toDate.getMonth() + 1, 0).getDate()
  ) {
    return format(fromDate, MONTH_YEAR_FORMAT)
  }
  
  // Check if it's a complete year
  if (
    fromDate.getMonth() === 0 && 
    fromDate.getDate() === 1 &&
    toDate.getMonth() === 11 && 
    toDate.getDate() === 31
  ) {
    return format(fromDate, 'yyyy')
  }
  
  return `${formatDateDisplay(from)} - ${formatDateDisplay(to)}`
}

// Export commonly used date-fns functions for convenience
export {
  format,
  parseISO,
  formatISO,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  startOfQuarter,
  endOfQuarter,
  subDays,
  addDays,
  addYears,
  subYears,
  differenceInDays,
  differenceInMonths,
  isAfter,
  isBefore,
  isWithinInterval,
  getMonth,
  getYear,
  getDayOfMonth,
  getDayOfMonth as getDate, // Re-export with alias for consistency
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  getDaysInMonth
}