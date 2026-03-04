import React, { useState, useEffect } from 'react'
import { useGoals, saveGoals } from '@/hooks/use-api'
import { DollarSign, Calendar, Percent, Users, TrendingUp, Clock, Target } from 'lucide-react'
import { useToast } from '@/contexts/toast'
import { LoadingState } from '@/components/LoadingState'
import type { GoalFormData, GoalPeriod } from '@/types/goal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

const METRIC_CATALOG = [
  { key: 'revenue', label: 'Total Revenue', icon: DollarSign, format: 'currency', placeholder: 'e.g. 50000' },
  { key: 'bookings', label: 'Total Bookings', icon: Calendar, format: 'number', placeholder: 'e.g. 100' },
  { key: 'occupancy', label: 'Occupancy Rate', icon: Percent, format: 'percent', placeholder: 'e.g. 80' },
  { key: 'guests', label: 'Total Guests', icon: Users, format: 'number', placeholder: 'e.g. 200' },
  { key: 'avgBookingValue', label: 'Avg Booking Value', icon: DollarSign, format: 'currency', placeholder: 'e.g. 500' },
  { key: 'repeatRate', label: 'Repeat Guest Rate', icon: TrendingUp, format: 'percent', placeholder: 'e.g. 25' },
  { key: 'avgStayLength', label: 'Avg Stay Length', icon: Clock, format: 'nights', placeholder: 'e.g. 4' },
] as const

type MetricKey = typeof METRIC_CATALOG[number]['key']

type GoalState = Record<MetricKey, { isEnabled: boolean; targetValue: string; period: GoalPeriod }>

function getFormatting(metric: typeof METRIC_CATALOG[number]) {
  return {
    prefix: metric.format === 'currency' ? '$' : '',
    suffix: metric.format === 'percent' ? '%' : metric.format === 'nights' ? ' nights' : ''
  }
}

const buildInitialState = (savedGoals: GoalFormData[]): GoalState => {
  const state: GoalState = {} as GoalState
  for (const metric of METRIC_CATALOG) {
    const saved = savedGoals.find(g => g.metricKey === metric.key)
    state[metric.key] = {
      isEnabled: saved?.isEnabled ?? false,
      targetValue: saved ? String(saved.targetValue) : '',
      period: saved?.period ?? 'yearly'
    }
  }
  return state
}

export const GoalManagementPanel: React.FC = () => {
  const { data: goals = [], isLoading, error } = useGoals()
  const { addToast } = useToast()
  const [goalState, setGoalState] = useState<GoalState>(() => buildInitialState([]))
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (goals.length > 0) {
      setGoalState(buildInitialState(goals))
    }
  }, [goals])

  const handleToggle = (key: MetricKey) => {
    setGoalState(prev => ({
      ...prev,
      [key]: { ...prev[key], isEnabled: !prev[key].isEnabled }
    }))
  }

  const handleValueChange = (key: MetricKey, value: string) => {
    if (value !== '' && !/^\d*\.?\d*$/.test(value)) return
    setGoalState(prev => ({
      ...prev,
      [key]: { ...prev[key], targetValue: value }
    }))
  }

  const handlePeriodChange = (key: MetricKey, period: GoalPeriod) => {
    setGoalState(prev => ({
      ...prev,
      [key]: { ...prev[key], period }
    }))
  }

  const handleSave = async () => {
    const goalsToSave: GoalFormData[] = METRIC_CATALOG
      .filter(m => goalState[m.key].isEnabled && goalState[m.key].targetValue !== '')
      .map(m => ({
        metricKey: m.key,
        targetValue: Number(goalState[m.key].targetValue),
        isEnabled: true,
        period: goalState[m.key].period
      }))

    const disabledGoals: GoalFormData[] = METRIC_CATALOG
      .filter(m => !goalState[m.key].isEnabled && goals.some(g => g.metricKey === m.key))
      .map(m => ({
        metricKey: m.key,
        targetValue: Number(goalState[m.key].targetValue) || 0,
        isEnabled: false,
        period: goalState[m.key].period
      }))

    const allGoals = [...goalsToSave, ...disabledGoals]

    if (allGoals.length === 0 && goals.length === 0) {
      addToast('info', 'Enable at least one goal and set a target value')
      return
    }

    setIsSaving(true)
    try {
      const result = await saveGoals(allGoals)
      if (result.success) {
        addToast('success', 'Goals saved successfully')
      } else {
        addToast('error', result.error || 'Failed to save goals')
      }
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <LoadingState />
  }

  if (error) {
    return (
      <div className="bg-danger-subtle border border-danger/30 rounded-lg p-4">
        <p className="text-danger-fg">Failed to load goals: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-lg shadow-sm border p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-1">Goals</h2>
            <p className="text-muted-foreground text-sm">
              Set targets for the metrics that matter most to your business. Enabled goals appear on your Overview dashboard.
            </p>
          </div>
          <div className="w-10 h-10 bg-info-subtle rounded-lg flex items-center justify-center">
            <Target className="w-5 h-5 text-info" />
          </div>
        </div>
      </div>

      <div className="bg-card rounded-lg shadow-sm border overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-2 border-b bg-muted text-xs font-medium text-muted-foreground">
          <span className="w-44">Goal</span>
          <span className="w-36">Target</span>
          <span className="w-28">Period</span>
          <span className="ml-auto">Enabled</span>
        </div>

        <div className="divide-y divide-border/60">
          {METRIC_CATALOG.map((metric) => {
            const state = goalState[metric.key]
            const Icon = metric.icon
            const { prefix, suffix } = getFormatting(metric)

            return (
              <div key={metric.key} className="flex items-center gap-4 px-4 py-3">
                <div className="flex items-center gap-2 w-44 shrink-0">
                  <Icon className={`w-4 h-4 shrink-0 ${state.isEnabled ? 'text-info' : 'text-muted-foreground/50'}`} />
                  <span className={`text-sm font-medium ${state.isEnabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {metric.label}
                  </span>
                </div>

                <div className="relative w-36">
                  {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground z-10">{prefix}</span>}
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={state.targetValue}
                    onChange={e => handleValueChange(metric.key, e.target.value)}
                    placeholder={metric.placeholder}
                    disabled={!state.isEnabled}
                    className={`h-8 text-sm ${prefix ? 'pl-6' : ''} ${suffix ? 'pr-10' : ''}`}
                  />
                  {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}
                </div>

                <Select
                  value={state.period}
                  onValueChange={(v) => handlePeriodChange(metric.key, v as GoalPeriod)}
                  disabled={!state.isEnabled}
                >
                  <SelectTrigger className="w-28 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>

                <Switch
                  checked={state.isEnabled}
                  onCheckedChange={() => handleToggle(metric.key)}
                  className="ml-auto"
                />
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          loading={isSaving}
          loadingText="Saving..."
        >
          Save Goals
        </Button>
      </div>
    </div>
  )
}
