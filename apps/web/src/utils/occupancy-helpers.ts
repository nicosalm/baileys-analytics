// Helper function to aggregate daily occupancy data into weekly periods
export function aggregateDailyToWeekly(dailyData: Array<{
    date: string
    occupancyRate: number
    bookedProperties: number
    totalProperties: number
}>) {
    if (!dailyData.length) return []
    
    const weeks: Array<{
        month: string
        rate: number
        bookedNights: number
        availableNights: number
    }> = []
    
    let currentWeek = {
        startDate: dailyData[0].date,
        bookedNights: 0,
        availableNights: 0,
        days: 0
    }
    
    for (const day of dailyData) {
        const dayDate = new Date(day.date)
        const weekStart = new Date(currentWeek.startDate)
        const daysSinceStart = Math.floor((dayDate.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24))
        
        if (daysSinceStart >= 7) {
            // Save current week
            weeks.push({
                month: currentWeek.startDate, // Using 'month' field for consistency
                rate: currentWeek.availableNights > 0 
                    ? currentWeek.bookedNights / currentWeek.availableNights 
                    : 0,
                bookedNights: currentWeek.bookedNights,
                availableNights: currentWeek.availableNights
            })
            
            // Start new week
            currentWeek = {
                startDate: day.date,
                bookedNights: day.bookedProperties,
                availableNights: day.totalProperties,
                days: 1
            }
        } else {
            // Add to current week
            currentWeek.bookedNights += day.bookedProperties
            currentWeek.availableNights += day.totalProperties
            currentWeek.days++
        }
    }
    
    // Don't forget the last week
    if (currentWeek.days > 0) {
        weeks.push({
            month: currentWeek.startDate,
            rate: currentWeek.availableNights > 0 
                ? currentWeek.bookedNights / currentWeek.availableNights 
                : 0,
            bookedNights: currentWeek.bookedNights,
            availableNights: currentWeek.availableNights
        })
    }
    
    return weeks
}

// Transform daily data to the expected period format
export function transformDailyToPeriodFormat(dailyData: Array<{
    date: string
    occupancyRate: number
    bookedProperties: number
    totalProperties: number
}>) {
    return dailyData.map(day => ({
        month: day.date, // Using 'month' field name for consistency
        rate: day.occupancyRate,
        bookedNights: day.bookedProperties,
        availableNights: day.totalProperties
    }))
}