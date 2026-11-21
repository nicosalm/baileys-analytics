import { useState, useEffect, useMemo } from 'react'
import { useModal } from '@/contexts/modal'
import { useProperties, useOperatingExpenses, useExpenseTemplates, saveExpenseTemplates } from '@/hooks/use-api'
import type { PropertyRow, ExpenseTemplateRow, OperatingExpenseRow } from '@/hooks/use-api'
import { StateWrapper } from '@/components/StateWrapper'
import { tableStyles } from '@/components/tables/table-styles'
import { formatCurrency, format } from '@baileys/utils'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { useToast } from '@/contexts/toast'
import { cn } from '@/lib/utils'
import { SettingsSection } from './SettingsSection'

const EXPENSE_CATEGORIES = [
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'management', label: 'Management' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'other', label: 'Other' },
] as const

const VIEW_OPTIONS = [
  { value: 'templates', label: 'Templates' },
  { value: 'overrides', label: 'Overrides' },
] as const

type ExpenseView = (typeof VIEW_OPTIONS)[number]['value']

// property id -> category -> amount as typed
type TemplateDraft = Record<string, Record<string, string>>

interface TemplateRow {
  category: string
  amount: number
  description?: string
}

// stable fallbacks so memoized drafts do not reset on every render while loading
const NO_TEMPLATES: ExpenseTemplateRow[] = []
const NO_PROPERTIES: PropertyRow[] = []

const AMOUNT_PATTERN = /^\d*\.?\d{0,2}$/

const toNumber = (value: number | string | null | undefined) => (typeof value === 'string' ? parseFloat(value) : (value ?? 0)) || 0

function generateMonthOptions() {
  const options: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = -24; i <= 2; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
    options.push({ value: format(date, 'yyyy-MM'), label: format(date, 'MMMM yyyy') })
  }
  return options.reverse()
}

const buildDraft = (properties: PropertyRow[], templates: ExpenseTemplateRow[]): TemplateDraft => {
  const draft: TemplateDraft = {}
  for (const property of properties) draft[property.id] = {}
  for (const t of templates) {
    if (draft[t.property_id]) draft[t.property_id][t.category] = String(toNumber(t.amount))
  }
  return draft
}

const sumRow = (row: Record<string, string> | undefined) => Object.values(row ?? {}).reduce((sum, v) => sum + toNumber(v), 0)

const sameRow = (a: Record<string, string> = {}, b: Record<string, string> = {}) =>
  EXPENSE_CATEGORIES.every(({ value }) => toNumber(a[value]) === toNumber(b[value]))

interface TemplateGridProps {
  properties: PropertyRow[]
}

const TemplateGrid = ({ properties }: TemplateGridProps) => {
  const { data: templates = NO_TEMPLATES, isLoading } = useExpenseTemplates()
  const { addToast } = useToast()
  const saved = useMemo(() => buildDraft(properties, templates), [properties, templates])
  const [draft, setDraft] = useState<TemplateDraft>(saved)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => setDraft(saved), [saved])

  const dirtyIds = properties.filter((p) => !sameRow(draft[p.id], saved[p.id])).map((p) => p.id)

  const updateCell = (propertyId: string, category: string, value: string) => {
    if (!AMOUNT_PATTERN.test(value)) return
    setDraft((prev) => ({ ...prev, [propertyId]: { ...prev[propertyId], [category]: value } }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await Promise.all(
        dirtyIds.map((propertyId) =>
          saveExpenseTemplates({
            propertyId,
            templates: EXPENSE_CATEGORIES.filter(({ value }) => toNumber(draft[propertyId]?.[value]) > 0).map(({ value }) => ({
              category: value,
              amount: toNumber(draft[propertyId][value]),
              // notes are not edited here, so carry over whatever was saved
              description: templates.find((t) => t.property_id === propertyId && t.category === value)?.description || undefined,
            })),
          }),
        ),
      )
      addToast('success', dirtyIds.length === 1 ? 'Template saved' : `${dirtyIds.length} templates saved`)
    } catch {
      addToast('error', 'Failed to save templates')
    } finally {
      setIsSaving(false)
    }
  }

  const columnTotal = (category: string) => properties.reduce((sum, p) => sum + toNumber(draft[p.id]?.[category]), 0)
  const grandTotal = properties.reduce((sum, p) => sum + sumRow(draft[p.id]), 0)

  return (
    <StateWrapper loading={isLoading} minHeight={240}>
      <div className="overflow-x-auto">
        <table className={tableStyles.table}>
          <thead>
            <tr className={tableStyles.headRow}>
              <th className={cn(tableStyles.th, 'pl-4 sm:pl-6')}>Property</th>
              {EXPENSE_CATEGORIES.map(({ value, label }) => (
                <th key={value} className={cn(tableStyles.th, 'pl-1.5 pr-[18px] text-right')}>
                  {label}
                </th>
              ))}
              <th className={cn(tableStyles.th, 'pr-4 sm:pr-6 text-right')}>Per month</th>
            </tr>
          </thead>
          <tbody>
            {properties.map((property) => {
              const isDirty = dirtyIds.includes(property.id)
              return (
                <tr key={property.id} className={tableStyles.row}>
                  <td className={cn(tableStyles.td, 'pl-4 sm:pl-6 font-medium whitespace-nowrap')}>
                    <span className="flex items-center gap-2">
                      {property.name}
                      {isDirty && <span className="size-1.5 rounded-full bg-warning" title="Unsaved" />}
                    </span>
                  </td>
                  {EXPENSE_CATEGORIES.map(({ value, label }) => (
                    <td key={value} className="px-1.5 py-1.5">
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={draft[property.id]?.[value] ?? ''}
                        onChange={(e) => updateCell(property.id, value, e.target.value)}
                        placeholder="0"
                        aria-label={`${property.name} ${label}`}
                        className="h-8 w-24 text-sm text-right tabular-nums"
                      />
                    </td>
                  ))}
                  <td className={cn(tableStyles.td, 'pr-4 sm:pr-6 text-right tabular-nums')}>
                    {formatCurrency(sumRow(draft[property.id]))}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-border">
              <td className={cn(tableStyles.td, 'pl-4 sm:pl-6 text-muted-foreground')}>Total</td>
              {EXPENSE_CATEGORIES.map(({ value }) => (
                <td key={value} className="pl-1.5 pr-[18px] py-2.5 text-right text-muted-foreground tabular-nums">
                  {formatCurrency(columnTotal(value))}
                </td>
              ))}
              <td className={cn(tableStyles.td, 'pr-4 sm:pr-6 text-right font-medium tabular-nums')}>{formatCurrency(grandTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2 px-4 sm:px-6 py-3 border-t border-border">
        {dirtyIds.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setDraft(saved)} disabled={isSaving}>
            Discard
          </Button>
        )}
        <Button size="sm" onClick={handleSave} disabled={dirtyIds.length === 0} loading={isSaving} loadingText="Saving...">
          Save
        </Button>
      </div>
    </StateWrapper>
  )
}

interface PropertyOverrideRowProps {
  property: PropertyRow
  month: string
  onOverride: (propertyId: string, propertyName: string, templateData?: TemplateRow[]) => void
}

const PropertyOverrideRow = ({ property, month, onOverride }: PropertyOverrideRowProps) => {
  const { data: expenses } = useOperatingExpenses(property.id, month)
  const { data: templates } = useExpenseTemplates(property.id)

  const expensesList: OperatingExpenseRow[] = Array.isArray(expenses) ? expenses : []
  const templateList: ExpenseTemplateRow[] = Array.isArray(templates) ? templates : []

  const hasOverride = expensesList.length > 0
  const hasTemplate = templateList.length > 0

  const overrideTotal = expensesList.reduce((sum, e) => sum + toNumber(e.amount), 0)
  const templateTotal = templateList.reduce((sum, t) => sum + toNumber(t.amount), 0)

  const handleOverride = () => {
    const templateRows: TemplateRow[] = templateList.map((t) => ({
      category: t.category,
      amount: toNumber(t.amount),
      description: t.description || undefined,
    }))
    onOverride(property.id, property.name, hasOverride ? undefined : templateRows)
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 sm:px-6 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{property.name}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
          {hasOverride ? (
            <>
              <Badge variant="info">Override</Badge>
              {formatCurrency(overrideTotal)}
            </>
          ) : hasTemplate ? (
            `Template, ${formatCurrency(templateTotal)}`
          ) : (
            'No template'
          )}
        </p>
      </div>
      <Button onClick={handleOverride} size="sm" variant="outline">
        {hasOverride ? 'Edit' : hasTemplate ? 'Override' : 'Add expenses'}
      </Button>
    </div>
  )
}

export const ExpenseManagementPanel = () => {
  const { openModal } = useModal()
  const { data: properties = NO_PROPERTIES, isLoading } = useProperties()
  const [activeView, setActiveView] = useState<ExpenseView>('templates')
  const monthOptions = useMemo(generateMonthOptions, [])
  const [selectedPeriod, setSelectedPeriod] = useState(() => format(new Date(), 'yyyy-MM'))

  const handleOverride = (propertyId: string, propertyName: string, templateData?: TemplateRow[]) => {
    openModal({
      type: 'operating-expense-entry',
      propertyId,
      propertyName,
      month: selectedPeriod,
      templateData,
    })
  }

  return (
    <SettingsSection
      title="Operating expenses"
      description="Templates set each property's monthly costs. An override replaces the template for one month."
      flush
      action={<SegmentedControl label="Expense view" size="default" value={activeView} onChange={setActiveView} options={VIEW_OPTIONS} />}
    >
      <StateWrapper
        loading={isLoading}
        empty={!isLoading && properties.length === 0}
        emptyMessage="No properties. Connect OwnerRez under Integrations to sync them."
        minHeight={240}
      >
        {activeView === 'templates' ? (
          <TemplateGrid properties={properties} />
        ) : (
          <>
            <div className={tableStyles.toolbar}>
              <span className="pl-0 sm:pl-2 text-sm text-muted-foreground">Month</span>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-44 h-8 text-sm" aria-label="Month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {monthOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="divide-y divide-border/60">
              {properties.map((property) => (
                <PropertyOverrideRow key={property.id} property={property} month={selectedPeriod} onOverride={handleOverride} />
              ))}
            </div>
          </>
        )}
      </StateWrapper>
    </SettingsSection>
  )
}
