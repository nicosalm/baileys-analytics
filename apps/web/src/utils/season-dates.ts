import { formatDateISO, getYear, getMonth } from '@baileys/utils'
import type { Season } from '@/types/season'

interface DateRange {
  from: string
  to: string
}

export const getCurrentSeasonDates = (season: Season, year: number = getYear(new Date())): DateRange => {
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
    to: formatDateISO(cappedEndDate),
  }
}

export const getPreviousSeasonDates = (season: Season): DateRange => {
  const currentYear = getYear(new Date())
  return getCurrentSeasonDates(season, currentYear - 1)
}

export const isCurrentlyInSeason = (season: Season): boolean => {
  const today = new Date()
  const currentMonth = getMonth(today) + 1
  const currentDay = today.getDate()

  if (season.startMonth <= season.endMonth) {
    return (
      (currentMonth > season.startMonth || (currentMonth === season.startMonth && currentDay >= season.startDay)) &&
      (currentMonth < season.endMonth || (currentMonth === season.endMonth && currentDay <= season.endDay))
    )
  } else {
    return (
      currentMonth > season.startMonth ||
      (currentMonth === season.startMonth && currentDay >= season.startDay) ||
      currentMonth < season.endMonth ||
      (currentMonth === season.endMonth && currentDay <= season.endDay)
    )
  }
}

export const hasSeasonStartedThisYear = (season: Season): boolean => {
  const today = new Date()
  const currentYear = getYear(today)
  const seasonStart = new Date(currentYear, season.startMonth - 1, season.startDay)

  if (season.startMonth > season.endMonth) {
    const currentMonth = getMonth(today) + 1
    if (currentMonth <= season.endMonth) {
      return true
    }
  }

  return today >= seasonStart
}
