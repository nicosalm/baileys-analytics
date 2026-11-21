import { formatDateISO, startOfMonth, startOfYear, subDays, subYears, getYear } from '@baileys/utils'
import type { Season } from '@/types/season'
import { getCurrentSeasonDates, getPreviousSeasonDates, isCurrentlyInSeason, hasSeasonStartedThisYear } from '@/utils/season-dates'

export interface DateRange {
  from: string
  to: string
}

export type PeriodOption = {
  id: string
  label: string
  getRange: (seasons?: Season[]) => DateRange
  requiresSeasons?: boolean
}

// quick periods shared by the period selector and the command palette; season-aware when a season is active
export function buildPeriodOptions(activeSeasons: Season[], earliestDate?: string | null): PeriodOption[] {
  const today = new Date()
  const options: PeriodOption[] = []

  if (activeSeasons.length > 0) {
    const season = activeSeasons[0]
    const inSeason = isCurrentlyInSeason(season)
    const seasonStarted = hasSeasonStartedThisYear(season)

    if (!seasonStarted) {
      options.push(
        {
          id: 'last-season',
          label: `${season.name} ${getYear(today) - 1}`,
          getRange: () => getPreviousSeasonDates(season),
        },
        {
          id: 'upcoming-season',
          label: `${season.name} ${getYear(today)} (upcoming)`,
          getRange: () => {
            const seasonStart = new Date(getYear(today), season.startMonth - 1, season.startDay)
            const seasonEnd = new Date(getYear(today), season.endMonth - 1, season.endDay)
            return {
              from: formatDateISO(seasonStart),
              to: formatDateISO(seasonEnd),
            }
          },
        },
      )
    } else {
      options.push(
        {
          id: 'current-season',
          label: inSeason ? 'Season to date' : `${season.name} ${getYear(today)} (ended)`,
          getRange: () => getCurrentSeasonDates(season),
        },
        {
          id: 'last-season',
          label: `${season.name} ${getYear(today) - 1}`,
          getRange: () => getPreviousSeasonDates(season),
        },
      )
    }
  } else {
    options.push(
      {
        id: 'ytd',
        label: 'Year to date',
        getRange: () => ({
          from: formatDateISO(new Date(getYear(today), 0, 1)), // Jan 1st of current year
          to: formatDateISO(today),
        }),
      },
      {
        id: 'last-year',
        label: 'Last year',
        getRange: () => {
          const lastYear = subYears(today, 1)
          return {
            from: formatDateISO(startOfYear(lastYear)),
            to: formatDateISO(new Date(getYear(lastYear), 11, 31)),
          }
        },
      },
    )
  }

  options.push(
    {
      id: 'last-30',
      label: 'Last 30 days',
      getRange: () => ({
        from: formatDateISO(subDays(today, 30)),
        to: formatDateISO(today),
      }),
    },
    {
      id: 'last-7',
      label: 'Last 7 days',
      getRange: () => ({
        from: formatDateISO(subDays(today, 7)),
        to: formatDateISO(today),
      }),
    },
    {
      id: 'month-to-date',
      label: 'Month to date',
      getRange: () => ({
        from: formatDateISO(startOfMonth(today)),
        to: formatDateISO(today),
      }),
    },
    ...(earliestDate
      ? [
          {
            id: 'all-time',
            label: 'All time',
            getRange: () => ({
              from: earliestDate,
              to: formatDateISO(today),
            }),
          },
        ]
      : []),
  )

  return options
}
