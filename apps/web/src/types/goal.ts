export interface Goal {
  id: string
  metricKey: string
  targetValue: number
  isEnabled: boolean
}

export interface GoalFormData {
  metricKey: string
  targetValue: number
  isEnabled: boolean
}
