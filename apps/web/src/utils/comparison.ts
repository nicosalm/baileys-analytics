import { parseDate, formatDateISO, subDays, subYears, getMonth, differenceInDays, eachDayOfInterval } from '@baileys/utils'
import type { DateRange } from '@/types/dashboard'
import type { Season } from '@/types/season'

export type ComparisonType = 'lastPeriod' | 'lastYear' | 'custom' | 'none'

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
    to: formatDateISO(seasonDays[seasonDays.length - 1]),
  }
}

export function calculateComparisonRange(
  filteredDateRange: DateRange,
  comparisonType: ComparisonType,
  season?: Season,
  yearOffset: number = 1,
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
      to: formatDateISO(previousEnd),
    }

    if (season) {
      const filteredComparison = filterDateRangeBySeasonMonths(comparisonRange, season)

      if (!filteredComparison) {
        return {
          isValid: false,
          message: 'No data in previous period within season months',
        }
      }

      const filteredDuration = differenceInDays(parseDate(filteredComparison.to), parseDate(filteredComparison.from)) + 1

      if (filteredDuration < originalDuration * 0.5) {
        return {
          isValid: false,
          message: 'Not enough seasonal data for last period comparison',
        }
      }

      comparisonRange = filteredComparison
    }
  } else if (comparisonType === 'lastYear') {
    const previousStart = subYears(startDate, yearOffset)
    const previousEnd = subYears(endDate, yearOffset)

    comparisonRange = {
      from: formatDateISO(previousStart),
      to: formatDateISO(previousEnd),
    }

    if (season) {
      const filteredComparison = filterDateRangeBySeasonMonths(comparisonRange, season)

      if (!filteredComparison) {
        return {
          isValid: false,
          message: `No data ${yearOffset} year${yearOffset > 1 ? 's' : ''} ago within season months`,
        }
      }

      comparisonRange = filteredComparison
    }
  } else {
    return { isValid: false }
  }

  return {
    range: comparisonRange,
    isValid: true,
  }
}

export function getComparisonLabel(
  comparisonType: ComparisonType,
  isSeasonActive: boolean,
  options?: { yearOffset?: number; seasonName?: string; baseYear?: number; customLabel?: string },
): string {
  if (comparisonType === 'none') return 'No Comparison'

  if (comparisonType === 'custom') {
    return options?.customLabel || 'vs Custom Range'
  }

  if (comparisonType === 'lastPeriod') {
    return isSeasonActive ? 'vs Previous Period' : 'vs Last Period'
  }

  if (comparisonType === 'lastYear') {
    const offset = options?.yearOffset ?? 1
    const baseYear = options?.baseYear
    if (baseYear !== undefined) {
      const targetYear = baseYear - offset
      return isSeasonActive && options?.seasonName ? `vs ${options.seasonName} ${targetYear}` : `vs ${targetYear}`
    }
    return isSeasonActive ? 'vs Last Season' : 'vs Last Year'
  }

  return 'No Comparison'
}
