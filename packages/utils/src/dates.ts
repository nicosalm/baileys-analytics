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
  formatDistanceToNow,
} from 'date-fns'

export const DATE_FORMAT = 'yyyy-MM-dd'
export const DATE_DISPLAY_FORMAT = 'MMM d, yyyy'

export const formatDateISO = (date: Date | string): string => {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, DATE_FORMAT)
}

export const formatDateDisplay = (date: Date | string): string => {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, DATE_DISPLAY_FORMAT)
}

export const parseDate = (dateString: string): Date => {
  return parseISO(dateString)
}

export const getDaysInRange = (from: string, to: string): number => {
  return differenceInDays(parseISO(to), parseISO(from)) + 1
}

export const isDateInRange = (date: Date | string, from: string, to: string): boolean => {
  const d = typeof date === 'string' ? parseISO(date) : date
  return isWithinInterval(d, {
    start: startOfDay(parseISO(from)),
    end: endOfDay(parseISO(to)),
  })
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
  formatDistanceToNow,
}
