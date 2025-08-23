import React from 'react'
import { useSeasons } from '@/hooks/use-api'
import { Calendar, AlertCircle } from 'lucide-react'
import { cn, parseDate, getMonth, getDate } from '@baileys/utils'
import type { Season } from '@/types/season'

const isDateInSeason = (date: Date, season: Season): boolean => {
  const month = getMonth(date) + 1 // getMonth is 0-indexed
  const day = getDate(date)
  
  // Handle seasons that don't cross year boundary
  if (season.startMonth <= season.endMonth) {
    return (
      (month > season.startMonth || (month === season.startMonth && day >= season.startDay)) &&
      (month < season.endMonth || (month === season.endMonth && day <= season.endDay))
    )
  } else {
    // Handle seasons that cross year boundary (e.g., Dec to Feb)
    return (
      (month > season.startMonth || (month === season.startMonth && day >= season.startDay)) ||
      (month < season.endMonth || (month === season.endMonth && day <= season.endDay))
    )
  }
}

export const SeasonIndicator: React.FC<{
  dateRange: { from: string; to: string }
  className?: string
}> = ({ dateRange, className }) => {
  const { data: seasons = [], isLoading } = useSeasons()
  
  if (isLoading || seasons.length === 0) {
    return null
  }

  const activeSeasons = seasons.filter(s => s.isActive)
  
  if (activeSeasons.length === 0) {
    return null
  }

  const rangeStart = parseDate(dateRange.from)
  const rangeEnd = parseDate(dateRange.to)
  
  // Check which seasons overlap with the date range
  const overlappingSeasons = activeSeasons.filter(season => {
    // Check if either the start or end date falls within the season
    return isDateInSeason(rangeStart, season) || isDateInSeason(rangeEnd, season)
  })

  const isFullyWithinSeasons = activeSeasons.some(season => {
    return isDateInSeason(rangeStart, season) && isDateInSeason(rangeEnd, season)
  })

  const isPartiallyOutside = overlappingSeasons.length > 0 && !isFullyWithinSeasons

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {overlappingSeasons.length > 0 ? (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-sm">
          <Calendar className="w-4 h-4 text-green-600" />
          <span className="text-green-700 font-medium">
            {overlappingSeasons.map(s => s.name).join(', ')}
          </span>
          {isPartiallyOutside && (
            <span title="Date range extends beyond season boundaries">
              <AlertCircle className="w-4 h-4 text-amber-500 ml-1" />
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 text-amber-600" />
          <span className="text-amber-700">
            Outside defined seasons
          </span>
        </div>
      )}
      
      <div className="group relative">
        <button className="p-1 hover:bg-gray-100 rounded">
          <AlertCircle className="w-4 h-4 text-gray-400" />
        </button>
        <div className="absolute bottom-full mb-2 right-0 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
          <p className="mb-1">Active seasons filter your data to show only in-season bookings.</p>
          <p>Bookings tagged as "Blocked" are automatically excluded.</p>
          <div className="absolute bottom-0 right-4 transform translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
        </div>
      </div>
    </div>
  )
}