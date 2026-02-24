import type { GoalProgress } from '@/types/goal'

export function getMonthlyGoalValue(goalProgress: GoalProgress[] | undefined, metricKey: string): number | null {
  const goal = goalProgress?.find(g => g.metricKey === metricKey)
  if (!goal) return null
  switch (goal.period) {
    case 'yearly': return goal.targetValue / 12
    case 'quarterly': return goal.targetValue / 3
    case 'monthly': return goal.targetValue
  }
}
