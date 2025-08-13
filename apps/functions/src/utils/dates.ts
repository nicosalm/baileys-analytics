import { format, parse, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, addDays, differenceInDays, getYear, getMonth, addMonths, setYear, setMonth, getDaysInMonth, getDay, getDate } from 'date-fns'

// Standard date format for API responses
export const DATE_FORMAT = 'yyyy-MM-dd'

// Format date to standard string
export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, DATE_FORMAT)
}

// Parse date string to Date object
export const parseDate = (dateString: string): Date => {
  return parse(dateString, DATE_FORMAT, new Date())
}

// Get date range for common periods
export const getDateRange = (period: 'month' | 'year' | 'last30' | 'last90' | 'custom', customFrom?: string, customTo?: string) => {
  const now = new Date()
  
  switch (period) {
    case 'month':
      return {
        from: formatDate(startOfMonth(now)),
        to: formatDate(endOfMonth(now))
      }
    case 'year':
      return {
        from: formatDate(startOfYear(now)),
        to: formatDate(endOfYear(now))
      }
    case 'last30':
      return {
        from: formatDate(subDays(now, 30)),
        to: formatDate(now)
      }
    case 'last90':
      return {
        from: formatDate(subDays(now, 90)),
        to: formatDate(now)
      }
    case 'custom':
      return {
        from: customFrom || formatDate(startOfYear(now)),
        to: customTo || formatDate(now)
      }
  }
}

// Calculate nights between dates
export const calculateNights = (arrival: string | Date, departure: string | Date): number => {
  const arrivalDate = typeof arrival === 'string' ? parseDate(arrival) : arrival
  const departureDate = typeof departure === 'string' ? parseDate(departure) : departure
  return Math.max(0, differenceInDays(departureDate, arrivalDate))
}

// Get default date ranges for queries
export const getDefaultDateRange = (lookback: 'short' | 'medium' | 'long' = 'medium') => {
  const now = new Date()
  const lookbackDays = {
    short: 30,
    medium: 90,
    long: 365 * 4 // 4 years
  }
  
  return {
    from: formatDate(subDays(now, lookbackDays[lookback])),
    to: formatDate(now)
  }
}

// Format date to ISO string (YYYY-MM-DD)
export const formatDateISO = (date: Date): string => {
  return format(date, DATE_FORMAT)
}

// Format date for display
export const formatDateDisplay = (date: Date, formatString: string = 'MM/dd/yyyy'): string => {
  return format(date, formatString)
}

// Export date-fns functions for direct use
export { getYear, getMonth, addMonths, setYear, setMonth, differenceInDays, getDaysInMonth, getDay, getDate, subDays }