import { useState, useMemo } from 'react'
import { useDailyOccupancy } from '@/hooks/use-api'
import { cn } from '@baileys/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type DailyOccupancy = {
  date: string
  occupancyRate: number
  bookedProperties: number
  totalProperties: number
}

interface OccupancyHeatmapProps {
  dateRange: { from: string; to: string }
  tagIds: string[]
}

export const OccupancyHeatmap = ({ dateRange, tagIds }: OccupancyHeatmapProps) => {
  const { data, isLoading: loading, error } = useDailyOccupancy(
    dateRange.from, 
    dateRange.to, 
    tagIds
  )
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0)

  const monthsData = useMemo(() => {
    if (!data || !Array.isArray(data)) return []
    
    const grouped = data.reduce((acc, day) => {
      const month = day.date.substring(0, 7)
      if (!acc[month]) acc[month] = []
      acc[month].push(day)
      return acc
    }, {} as Record<string, DailyOccupancy[]>)

    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))
  }, [data])

  const currentMonthData = monthsData[currentMonthIndex] || ['', []]
  const [currentMonth, currentMonthDays] = currentMonthData as [string, DailyOccupancy[]]

  const calendarDays = useMemo(() => {
    if (!currentMonthDays.length) return []
    const firstDay = new Date(currentMonthDays[0].date).getDay()
    const days: (DailyOccupancy | null)[] = Array(firstDay).fill(null)
    days.push(...currentMonthDays)
    while (days.length % 7 !== 0) {
      days.push(null)
    }
    return days
  }, [currentMonthDays])

  const monthStats = useMemo(() => {
    if (!currentMonthDays.length) return null
    const totalBooked = currentMonthDays.reduce((sum: number, d: DailyOccupancy) => sum + d.bookedProperties, 0)
    const totalAvailable = currentMonthDays.reduce((sum: number, d: DailyOccupancy) => sum + d.totalProperties, 0)
    const avgOccupancy = currentMonthDays.reduce((sum: number, d: DailyOccupancy) => sum + d.occupancyRate, 0) / currentMonthDays.length
    return {
      avgOccupancy: Math.round(avgOccupancy * 100),
      totalBooked,
      utilizationRate: totalAvailable ? Math.round((totalBooked / totalAvailable) * 100) : 0
    }
  }, [currentMonthDays])

  const getColor = (rate: number) => {
    if (rate === 0) return 'bg-gray-100'
    if (rate < 0.25) return 'bg-red-100'
    if (rate < 0.5) return 'bg-yellow-100'
    if (rate < 0.75) return 'bg-green-100'
    if (rate < 0.9) return 'bg-green-300'
    return 'bg-green-500'
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const [year, monthNum] = currentMonth.split('-')
  const monthName = monthNames[parseInt(monthNum || '1', 10) - 1] || ''

  // ✅ Return only after all hooks are called
  if (loading) return <div className="text-center py-8 text-gray-500">Loading heatmap...</div>
  if (error) return <div className="text-center py-8 text-red-500">Error loading heatmap: {error.message}</div>
  if (!monthsData.length) return <div className="text-center py-8 text-gray-500">No data found</div>

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => setCurrentMonthIndex(i => Math.max(0, i - 1))}
          disabled={currentMonthIndex === 0}
          className={cn("p-2 rounded-sm", currentMonthIndex === 0 && "opacity-50")}
        >
          <ChevronLeft />
        </button>
        <div className="text-center">
          <h4 className="text-lg font-semibold">{monthName} {year}</h4>
          <p className="text-sm text-gray-600">{currentMonthIndex + 1} of {monthsData.length}</p>
        </div>
        <button
          onClick={() => setCurrentMonthIndex(i => Math.min(monthsData.length - 1, i + 1))}
          disabled={currentMonthIndex === monthsData.length - 1}
          className={cn("p-2 rounded-sm", currentMonthIndex === monthsData.length - 1 && "opacity-50")}
        >
          <ChevronRight />
        </button>
      </div>

      {/* Stats */}
      {monthStats && (
        <div className="grid grid-cols-3 gap-4 text-sm text-center">
          <div>
            <div className="text-gray-600">Avg Occupancy</div>
            <div className="font-semibold">{monthStats.avgOccupancy}%</div>
          </div>
          <div>
            <div className="text-gray-600">Booked Nights</div>
            <div className="font-semibold">{monthStats.totalBooked}</div>
          </div>
          <div>
            <div className="text-gray-600">Utilization</div>
            <div className="font-semibold">{monthStats.utilizationRate}%</div>
          </div>
        </div>
      )}

      {/* Calendar */}
      <div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {dayNames.map(day => (
            <div key={day} className="text-xs text-gray-500 text-center">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, idx) => (
            <div key={idx} className={cn(
              'aspect-square text-xs flex items-center justify-center rounded-sm relative group',
              day ? getColor(day.occupancyRate) : 'bg-transparent'
            )}>
              {day && (
                <>
                  <span className="font-medium">{new Date(day.date).getDate()}</span>
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                    <div className="bg-black text-white text-xs px-2 py-1 rounded-sm shadow-sm">
                      <div>{new Date(day.date).toLocaleDateString()}</div>
                      <div>{Math.round(day.occupancyRate * 100)}%</div>
                      <div>{day.bookedProperties}/{day.totalProperties}</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center space-x-3 text-xs pt-2 border-t">
        <span className="text-gray-600">Occupancy:</span>
        {[
          { color: 'bg-gray-100', label: '0%' },
          { color: 'bg-red-100', label: '<25%' },
          { color: 'bg-yellow-100', label: '25-50%' },
          { color: 'bg-green-100', label: '50-75%' },
          { color: 'bg-green-300', label: '75-90%' },
          { color: 'bg-green-500', label: '>90%' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center space-x-1">
            <div className={`w-3 h-3 ${color} rounded-sm`} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

