import type React from 'react'
import { useState, useEffect } from 'react'
import { useGoals, saveGoals } from '@/hooks/use-api'
import { useToast } from '@/contexts/toast'
import { LoadingState } from '@/components/LoadingState'
import type { GoalFormData, GoalPeriod } from '@/types/goal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { SettingsSection, SettingsError } from './SettingsSection'

const METRIC_CATALOG = [
  { key: 'revenue', label: 'Total Revenue', format: 'currency', placeholder: '50000' },
  { key: 'bookings', label: 'Total Bookings', format: 'number', placeholder: '100' },
  { key: 'occupancy', label: 'Occupancy Rate', format: 'percent', placeholder: '80' },
  { key: 'guests', label: 'Total Guests', format: 'number', placeholder: '200' },
  { key: 'avgBookingValue', label: 'Avg Booking Value', format: 'currency', placeholder: '500' },
  { key: 'repeatRate', label: 'Repeat Guest Rate', format: 'percent', placeholder: '25' },
  { key: 'avgStayLength', label: 'Avg Stay Length', format: 'nights', placeholder: '4' },
] as const

// two columns on phones (label and switch, then target and period), four from sm up
const GRID = 'grid-cols-[1fr_auto] sm:grid-cols-[minmax(0,1fr)_9rem_7rem_auto] gap-x-4'

type MetricKey = (typeof METRIC_CATALOG)[number]['key']

type GoalState = Record<MetricKey, { isEnabled: boolean; targetValue: string; period: GoalPeriod }>

function getFormatting(metric: (typeof METRIC_CATALOG)[number]) {
  return {
    prefix: metric.format === 'currency' ? '$' : '',
    suffix: metric.format === 'percent' ? '%' : metric.format === 'nights' ? ' nights' : '',
  }
}

const buildInitialState = (savedGoals: GoalFormData[]): GoalState => {
  const state: GoalState = {} as GoalState
  for (const metric of METRIC_CATALOG) {
    const saved = savedGoals.find((g) => g.metricKey === metric.key)
    state[metric.key] = {
      isEnabled: saved?.isEnabled ?? false,
      targetValue: saved ? String(saved.targetValue) : '',
      period: saved?.period ?? 'yearly',
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

  const isDirty = JSON.stringify(goalState) !== JSON.stringify(buildInitialState(goals))

  const handleToggle = (key: MetricKey) => {
    setGoalState((prev) => ({
      ...prev,
      [key]: { ...prev[key], isEnabled: !prev[key].isEnabled },
    }))
  }

  const handleValueChange = (key: MetricKey, value: string) => {
    if (value !== '' && !/^\d*\.?\d*$/.test(value)) return
    setGoalState((prev) => ({
      ...prev,
      [key]: { ...prev[key], targetValue: value },
    }))
  }

  const handlePeriodChange = (key: MetricKey, period: GoalPeriod) => {
    setGoalState((prev) => ({
      ...prev,
      [key]: { ...prev[key], period },
    }))
  }

  const handleSave = async () => {
    const goalsToSave: GoalFormData[] = METRIC_CATALOG.filter((m) => goalState[m.key].isEnabled && goalState[m.key].targetValue !== '').map(
      (m) => ({
        metricKey: m.key,
        targetValue: Number(goalState[m.key].targetValue),
        isEnabled: true,
        period: goalState[m.key].period,
      }),
    )

    const disabledGoals: GoalFormData[] = METRIC_CATALOG.filter(
      (m) => !goalState[m.key].isEnabled && goals.some((g) => g.metricKey === m.key),
    ).map((m) => ({
      metricKey: m.key,
      targetValue: Number(goalState[m.key].targetValue) || 0,
      isEnabled: false,
      period: goalState[m.key].period,
    }))

    const allGoals = [...goalsToSave, ...disabledGoals]

    if (allGoals.length === 0 && goals.length === 0) {
      addToast('info', 'Enable a goal and set its target')
      return
    }

    setIsSaving(true)
    try {
      const result = await saveGoals(allGoals)
      if (result.success) {
        addToast('success', 'Goals saved')
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
    return <SettingsError message={`Failed to load goals: ${error.message}`} />
  }

  return (
    <SettingsSection
      title="Goals"
      description="Enabled goals appear on the Overview."
      flush
      action={
        <Button size="sm" onClick={handleSave} loading={isSaving} loadingText="Saving..." disabled={!isDirty}>
          Save
        </Button>
      }
    >
      <div className={`hidden sm:grid ${GRID} px-6 py-2.5 border-b border-border text-xs font-medium text-muted-foreground`}>
        <span>Metric</span>
        <span>Target</span>
        <span>Period</span>
        <span className="justify-self-end">Enabled</span>
      </div>

      <div className="divide-y divide-border/60">
        {METRIC_CATALOG.map((metric) => {
          const state = goalState[metric.key]
          const { prefix, suffix } = getFormatting(metric)
          const inputId = `goal-${metric.key}`

          return (
            <div key={metric.key} className={`grid ${GRID} items-center gap-y-2 px-4 sm:px-6 py-3`}>
              <label htmlFor={inputId} className={`text-sm font-medium ${state.isEnabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                {metric.label}
              </label>

              <div className="relative order-3 sm:order-none">
                {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{prefix}</span>}
                <Input
                  id={inputId}
                  type="text"
                  inputMode="decimal"
                  value={state.targetValue}
                  onChange={(e) => handleValueChange(metric.key, e.target.value)}
                  placeholder={metric.placeholder}
                  disabled={!state.isEnabled}
                  className={`h-8 text-sm tabular-nums ${prefix ? 'pl-6' : ''} ${suffix ? 'pr-14' : ''}`}
                />
                {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}
              </div>

              <Select
                value={state.period}
                onValueChange={(v) => handlePeriodChange(metric.key, v as GoalPeriod)}
                disabled={!state.isEnabled}
              >
                <SelectTrigger className="order-4 sm:order-none w-28 h-8 text-sm" aria-label={`${metric.label} period`}>
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
                aria-label={`Enable ${metric.label} goal`}
                className="order-2 sm:order-none justify-self-end"
              />
            </div>
          )
        })}
      </div>
    </SettingsSection>
  )
}
