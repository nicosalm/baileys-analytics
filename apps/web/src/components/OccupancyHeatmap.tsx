import { useState, useMemo, useEffect } from 'react'
import { useDailyOccupancy } from '@/hooks/use-api'
import { cn, formatDateDisplay } from '@baileys/utils'
import { ChevronLeft, ChevronRight, Calendar, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/LoadingState'
import { useModal } from '@/contexts/modal'

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
  const [currentMonthIndex, setCurrentMonthIndex] = useState(-1) // Will be set to last month
  const { openModal } = useModal()

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
  
  // Set initial month to the most recent month when data loads
  useEffect(() => {
    if (currentMonthIndex === -1 && monthsData.length > 0) {
      setCurrentMonthIndex(monthsData.length - 1)
    }
  }, [monthsData.length, currentMonthIndex])

  // Ensure currentMonthIndex is valid
  const validIndex = currentMonthIndex === -1 || currentMonthIndex >= monthsData.length 
    ? monthsData.length - 1 
    : currentMonthIndex
  const currentMonthData = monthsData[validIndex] || ['', []]
  const [currentMonth, currentMonthDays] = currentMonthData as [string, DailyOccupancy[]]

  const calendarDays = useMemo(() => {
    // Always return 42 slots (6 weeks) for consistent sizing
    const days: (DailyOccupancy | null)[] = Array(42).fill(null)
    
    if (currentMonthDays.length > 0) {
      // Parse date components to avoid timezone issues
      const [year, month, day] = currentMonthDays[0].date.split('-')
      const firstDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      const firstDay = firstDate.getDay()
      
      // Place the month's days starting at the correct position
      currentMonthDays.forEach((day, index) => {
        if (firstDay + index < 42) {
          days[firstDay + index] = day
        }
      })
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
    if (rate === 0) return 'bg-gray-50 border border-gray-200'
    if (rate < 0.25) return 'bg-red-50 border border-red-200 hover:bg-red-100'
    if (rate < 0.5) return 'bg-amber-50 border border-amber-200 hover:bg-amber-100'
    if (rate < 0.75) return 'bg-emerald-50 border border-emerald-200 hover:bg-emerald-100'
    if (rate < 0.9) return 'bg-emerald-100 border border-emerald-300 hover:bg-emerald-200'
    return 'bg-emerald-200 border border-emerald-400 hover:bg-emerald-300'
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const [year, monthNum] = currentMonth.split('-')
  const monthName = monthNames[parseInt(monthNum || '1', 10) - 1] || ''

  // ✅ Return only after all hooks are called
  if (loading) return <LoadingState message="Loading heatmap..." />
  if (error) return (
    <div className="text-center py-8">
      <AlertCircle className="w-12 h-12 text-red-500 opacity-50 mx-auto mb-2" />
      <p className="text-sm font-medium text-gray-500">Error loading heatmap</p>
      <p className="text-xs text-gray-400 mt-1">{error.message}</p>
    </div>
  )
  if (!monthsData.length) return (
    <div className="text-center py-8 text-gray-500">
      <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
      <p className="text-sm font-medium">No occupancy data available</p>
      <p className="text-xs text-gray-400 mt-1">Data will appear once bookings are synced</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {/* Navigation + Stats */}
      <div className="flex justify-between items-center">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setCurrentMonthIndex(i => Math.max(0, i - 1))}
          disabled={validIndex === 0}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <h4 className="text-sm font-semibold">{monthName} {year}</h4>
            <p className="text-xs text-gray-500">{validIndex + 1} of {monthsData.length}</p>
          </div>
          {monthStats && (
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span><span className="font-semibold text-gray-900">{monthStats.avgOccupancy}%</span> avg</span>
              <span><span className="font-semibold text-gray-900">{monthStats.totalBooked}</span> booked</span>
              <span><span className="font-semibold text-gray-900">{monthStats.utilizationRate}%</span> used</span>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setCurrentMonthIndex(i => Math.min(monthsData.length - 1, i + 1))}
          disabled={validIndex === monthsData.length - 1}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Calendar */}
      <div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {dayNames.map(day => (
            <div key={day} className="text-xs text-gray-500 text-center">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {calendarDays.map((day, idx) => {
            const handleDayClick = () => {
              if (day) {
                const [year, month, dayNum] = day.date.split('-')
                openModal({
                  type: 'period',
                  month,
                  year,
                  day: dayNum,
                  originalDate: day.date,
                  granularity: 'daily'
                })
              }
            }
            
            return (
              <div 
                key={idx} 
                onClick={handleDayClick}
                className={cn(
                  'h-9 text-[11px] flex items-center justify-center rounded relative group transition-all',
                  day ? `${getColor(day.occupancyRate)} hover:scale-105 hover:z-20 cursor-pointer` : 'bg-transparent cursor-default'
                )}
              >
                {day && (
                  <>
                    <span className="font-medium">{parseInt(day.date.split('-')[2])}</span>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 hidden group-hover:block z-30 pointer-events-none">
                      <div className="bg-gray-900 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap">
                        <div className="font-semibold">{(() => {
                          const [y, m, d] = day.date.split('-')
                          const localDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
                          return formatDateDisplay(localDate)
                        })()}</div>
                        <div>{Math.round(day.occupancyRate * 100)}% occupied</div>
                        <div className="text-gray-300">{day.bookedProperties} of {day.totalProperties} props</div>
                        <div className="text-gray-400 mt-1 border-t border-gray-700 pt-1">Click to view details</div>
                      </div>
                      <div className="absolute left-1/2 transform -translate-x-1/2 -bottom-1 w-2 h-2 bg-gray-900 rotate-45"></div>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center space-x-3 text-xs pt-1 border-t">
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

