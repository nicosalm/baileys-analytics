export type GoalPeriod = 'monthly' | 'quarterly' | 'yearly'

export interface Goal {
  id: string
  metricKey: string
  targetValue: number
  isEnabled: boolean
  period: GoalPeriod
}

export interface GoalFormData {
  metricKey: string
  targetValue: number
  isEnabled: boolean
  period: GoalPeriod
}

export interface GoalProgress {
  metricKey: string
  targetValue: number
  currentValue: number
  progress: number
  period: GoalPeriod
  periodLabel: string
  dateRange: { from: string; to: string }
}
