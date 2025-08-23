import { 
  parseDate, 
  formatDateISO, 
  subDays, 
  subYears,
  getMonth,
  differenceInDays,
  eachDayOfInterval
} from '@baileys/utils'
import type { DateRange } from '@/types/dashboard'
import type { Season } from '@/types/season'

export type ComparisonType = 'lastPeriod' | 'lastYear' | 'none'

export interface ComparisonResult {
  range?: DateRange
  isValid: boolean
  message?: string
}

function filterDateRangeBySeasonMonths(range: DateRange, season: Season): DateRange | null {
  const startDate = parseDate(range.from)
  const endDate = parseDate(range.to)
  
  const allDays = eachDayOfInterval({ start: startDate, end: endDate })
  
  const seasonDays = allDays.filter((day: Date) => {
    const month = getMonth(day) + 1
    
    if (season.startMonth <= season.endMonth) {
      return month >= season.startMonth && month <= season.endMonth
    } else {
      return month >= season.startMonth || month <= season.endMonth
    }
  })
  
  if (seasonDays.length === 0) {
    return null
  }
  
  return {
    from: formatDateISO(seasonDays[0]),
    to: formatDateISO(seasonDays[seasonDays.length - 1])
  }
}

export function calculateComparisonRange(
  filteredDateRange: DateRange,
  comparisonType: ComparisonType,
  season?: Season
): ComparisonResult {
  if (comparisonType === 'none') {
    return { isValid: false }
  }
  
  const startDate = parseDate(filteredDateRange.from)
  const endDate = parseDate(filteredDateRange.to)
  const originalDuration = differenceInDays(endDate, startDate) + 1
  
  let comparisonRange: DateRange
  
  if (comparisonType === 'lastPeriod') {
    const previousEnd = subDays(startDate, 1)
    const previousStart = subDays(previousEnd, originalDuration - 1)
    
    comparisonRange = {
      from: formatDateISO(previousStart),
      to: formatDateISO(previousEnd)
    }
    
    if (season) {
      const filteredComparison = filterDateRangeBySeasonMonths(comparisonRange, season)
      
      if (!filteredComparison) {
        return {
          isValid: false,
          message: 'No data in previous period within season months'
        }
      }
      
      const filteredDuration = differenceInDays(
        parseDate(filteredComparison.to),
        parseDate(filteredComparison.from)
      ) + 1
      
      if (filteredDuration < originalDuration * 0.5) {
        return {
          isValid: false,
          message: 'Not enough seasonal data for last period comparison'
        }
      }
      
      comparisonRange = filteredComparison
    }
  } else if (comparisonType === 'lastYear') {
    const previousStart = subYears(startDate, 1)
    const previousEnd = subYears(endDate, 1)
    
    comparisonRange = {
      from: formatDateISO(previousStart),
      to: formatDateISO(previousEnd)
    }
    
    if (season) {
      const filteredComparison = filterDateRangeBySeasonMonths(comparisonRange, season)
      
      if (!filteredComparison) {
        return {
          isValid: false,
          message: 'No data in last year within season months'
        }
      }
      
      comparisonRange = filteredComparison
    }
  } else {
    return { isValid: false }
  }
  
  return {
    range: comparisonRange,
    isValid: true
  }
}

export function getComparisonLabel(
  comparisonType: ComparisonType,
  isSeasonActive: boolean
): string {
  if (comparisonType === 'none') return 'No Comparison'
  
  if (comparisonType === 'lastPeriod') {
    return isSeasonActive ? 'vs Previous Period (in season)' : 'vs Previous Period'
  }
  
  if (comparisonType === 'lastYear') {
    return isSeasonActive ? 'vs Last Year (same season)' : 'vs Last Year'
  }
  
  return 'No Comparison'
}

export function isSeasonSelection(
  dateRange: DateRange,
  season?: Season
): boolean {
  if (!season) return false
  
  const startDate = parseDate(dateRange.from)
  const endDate = parseDate(dateRange.to)
  
  const startMonth = getMonth(startDate) + 1
  const endMonth = getMonth(endDate) + 1
  
  const monthMatches = 
    Math.abs(startMonth - season.startMonth) <= 1 &&
    Math.abs(endMonth - season.endMonth) <= 1
  
  return monthMatches
}