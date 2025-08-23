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
  getDaysInMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  getDay,
  setYear,
  setMonth,
  formatDistanceToNow
} from 'date-fns'

export const DATE_FORMAT = 'yyyy-MM-dd'
export const DATE_DISPLAY_FORMAT = 'MMM d, yyyy'
export const DATE_TIME_FORMAT = 'MMM d, yyyy h:mm a'
export const MONTH_YEAR_FORMAT = 'MMMM yyyy'

export const formatDateISO = (date: Date | string): string => {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, DATE_FORMAT)
}

export const formatDateDisplay = (date: Date | string): string => {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, DATE_DISPLAY_FORMAT)
}

export const formatDateTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, DATE_TIME_FORMAT)
}

export const parseDate = (dateString: string): Date => {
  return parseISO(dateString)
}

export const calculateNights = (arrival: Date | string, departure: Date | string): number => {
  const arrivalDate = typeof arrival === 'string' ? parseISO(arrival) : arrival
  const departureDate = typeof departure === 'string' ? parseISO(departure) : departure
  return Math.max(0, differenceInDays(departureDate, arrivalDate))
}


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

export const getDaysInRange = (from: string, to: string): number => {
  return differenceInDays(parseISO(to), parseISO(from)) + 1
}

export const isDateInRange = (date: Date | string, from: string, to: string): boolean => {
  const d = typeof date === 'string' ? parseISO(date) : date
  return isWithinInterval(d, { 
    start: startOfDay(parseISO(from)), 
    end: endOfDay(parseISO(to)) 
  })
}

export const getRelativeDateDescription = (from: string, to: string): string => {
  const days = getDaysInRange(from, to)
  
  if (days === 1) return 'Today'
  if (days === 7) return 'Last 7 days'
  if (days === 30) return 'Last 30 days'
  if (days === 90) return 'Last 90 days'
  
  const fromDate = parseISO(from)
  const toDate = parseISO(to)
  
  if (
    fromDate.getDate() === 1 && 
    toDate.getDate() === new Date(toDate.getFullYear(), toDate.getMonth() + 1, 0).getDate()
  ) {
    return format(fromDate, MONTH_YEAR_FORMAT)
  }
  
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
  getDayOfMonth as getDate,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  getDaysInMonth,
  eachDayOfInterval,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  getDay,
  setYear,
  setMonth,
  formatDistanceToNow
}