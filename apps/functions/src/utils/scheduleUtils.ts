import { addMonths, getDay, getDate } from '../utils/dates'

export interface ScheduleConfig {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly'
  time: string
  dayOfWeek?: number
  dayOfMonth?: number
}

export function calculateNextRun(schedule: ScheduleConfig): string {
  const now = new Date()
  const [hours, minutes] = schedule.time.split(':').map(Number)
  
  let nextRun = new Date()
  nextRun.setHours(hours, minutes, 0, 0)

  // If the time has already passed today, move to next occurrence
  if (nextRun <= now) {
    switch (schedule.frequency) {
      case 'daily':
        nextRun.setDate(nextRun.getDate() + 1)
        break
      case 'weekly':
        nextRun.setDate(nextRun.getDate() + 7)
        break
      case 'monthly':
        nextRun.setMonth(nextRun.getMonth() + 1)
        if (schedule.dayOfMonth) {
          nextRun.setDate(schedule.dayOfMonth)
        }
        break
      case 'quarterly':
        nextRun.setMonth(nextRun.getMonth() + 3)
        if (schedule.dayOfMonth) {
          nextRun.setDate(schedule.dayOfMonth)
        }
        break
    }
  }

  return nextRun.toISOString()
}

export function calculateNextMonthlyRun(dayOfMonth: number, time: string): string {
  const now = new Date()
  const [hours, minutes] = time.split(':').map(Number)
  
  let nextRun = new Date()
  nextRun.setDate(dayOfMonth)
  nextRun.setHours(hours, minutes, 0, 0)
  
  // If we've passed this day/time this month, move to next month
  if (nextRun <= now) {
    nextRun = addMonths(nextRun, 1)
  }
  
  return nextRun.toISOString()
}

export function calculateNextWeeklyRun(dayOfWeek: number, time: string): string {
  const now = new Date()
  const [hours, minutes] = time.split(':').map(Number)
  
  let nextRun = new Date()
  const currentDay = getDay(nextRun)
  const daysUntilTarget = (dayOfWeek - currentDay + 7) % 7
  
  nextRun.setDate(getDate(nextRun) + daysUntilTarget)
  nextRun.setHours(hours, minutes, 0, 0)
  
  // If we've passed this time today, move to next week
  if (nextRun <= now) {
    nextRun.setDate(getDate(nextRun) + 7)
  }
  
  return nextRun.toISOString()
}