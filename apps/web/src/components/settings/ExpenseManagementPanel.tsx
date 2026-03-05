import { useState, useEffect } from 'react'
import { useModal } from '@/contexts/modal'
import { useProperties, useOperatingExpenses, useExpenseTemplates, saveExpenseTemplates } from '@/hooks/use-api'
import { StateWrapper } from '@/components/StateWrapper'
import { formatCurrency, format } from '@baileys/utils'
import {
  Building2, Calendar, CheckCircle, Layers, Edit, Plus, X, DollarSign, AlertCircle, Save
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { useToast } from '@/contexts/toast'

function generateMonthOptions() {
  const options: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = -24; i <= 2; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
    options.push({ value: format(date, 'yyyy-MM'), label: format(date, 'MMMM yyyy') })
  }
  return options.reverse()
}

const EXPENSE_CATEGORIES = [
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'management', label: 'Management' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'other', label: 'Other' }
]

interface TemplateRow {
  category: string
  amount: number
  description?: string
}

// --- Templates view ---

interface PropertyTemplateCardProps {
  property: any
}

const PropertyTemplateCard = ({ property }: PropertyTemplateCardProps) => {
  const { data: templates, mutate } = useExpenseTemplates(property.id)
  const { addToast } = useToast()
  const templateList: any[] = Array.isArray(templates) ? templates : []

  const [rows, setRows] = useState<TemplateRow[]>([])
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (templateList.length > 0) {
      setRows(templateList.map((t: any) => ({
        category: t.category,
        amount: parseFloat(t.amount) || 0,
        description: t.description || ''
      })))
    } else {
      setRows([{ category: '', amount: 0, description: '' }])
    }
    setIsDirty(false)
  }, [templates])

  const addRow = () => {
    setRows(prev => [...prev, { category: '', amount: 0, description: '' }])
    setIsDirty(true)
  }

  const removeRow = (index: number) => {
    setRows(prev => prev.filter((_, i) => i !== index))
    setIsDirty(true)
  }

  const updateRow = (index: number, field: keyof TemplateRow, value: string | number) => {
    setRows(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
    setIsDirty(true)
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      const validRows = rows.filter(r => r.category && r.amount > 0)
      await saveExpenseTemplates({
        propertyId: property.id,
        templates: validRows.map(r => ({
          category: r.category,
          amount: r.amount,
          description: r.description || undefined
        }))
      })
      await mutate()
      setIsDirty(false)
      addToast('success', 'Template saved')
    } catch {
      addToast('error', 'Failed to save template')
    } finally {
      setIsSaving(false)
    }
  }

  const usedCategories = rows.map(r => r.category).filter(Boolean)
  // savedTotal reflects what's actually persisted, not what's in the editor
  const savedTotal = templateList.reduce((sum: number, t: any) => sum + (parseFloat(t.amount) || 0), 0)
  const hasTemplate = templateList.length > 0

  return (
    <div className="bg-card rounded-lg border shadow-sm">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-muted-foreground" />
            <div>
              <h4 className="text-sm font-medium text-foreground">{property.name}</h4>
              {hasTemplate ? (
                <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(savedTotal)}/mo</p>
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5">No template — expenses default to $0</p>
              )}
            </div>
          </div>
          {isDirty ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-warning-subtle text-warning-fg">
              Unsaved
            </span>
          ) : hasTemplate ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success-subtle text-success-fg">
              <CheckCircle className="w-3 h-3 mr-1" />
              Active
            </span>
          ) : null}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {rows.map((row, index) => (
          <div key={index} className="flex gap-2 items-center">
            <Select value={row.category || undefined} onValueChange={v => updateRow(index, 'category', v)}>
              <SelectTrigger className="flex-1 h-8 text-sm">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map(cat => (
                  <SelectItem
                    key={cat.value}
                    value={cat.value}
                    disabled={usedCategories.includes(cat.value) && row.category !== cat.value}
                  >
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative w-28">
              <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground z-10" />
              <Input
                type="number"
                min="0"
                step="0.01"
                value={row.amount || ''}
                onChange={e => updateRow(index, 'amount', parseFloat(e.target.value) || 0)}
                className="pl-7 h-8 text-sm"
                placeholder="0.00"
              />
            </div>

            <Input
              type="text"
              value={row.description || ''}
              onChange={e => updateRow(index, 'description', e.target.value)}
              className="w-32 h-8 text-sm"
              placeholder="Note"
            />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeRow(index)}
              className="h-8 w-8 text-muted-foreground hover:text-danger hover:bg-danger-subtle"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ))}

        <div className="flex items-center justify-between pt-1">
          {rows.length < EXPENSE_CATEGORIES.length ? (
            <Button type="button" variant="link" onClick={addRow} className="text-xs px-0 h-auto">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add category
            </Button>
          ) : (
            <span />
          )}

          {isDirty ? (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              loading={isSaving}
              loadingText="Saving..."
            >
              <Save className="w-3.5 h-3.5" />
              Save Template
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled className="text-muted-foreground">
              <CheckCircle className="w-3.5 h-3.5" />
              {hasTemplate ? 'Saved' : 'Save Template'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// --- Overrides view ---

interface PropertyOverrideRowProps {
  property: any
  month: string
  onOverride: (propertyId: string, propertyName: string, templateData?: TemplateRow[]) => void
}

const PropertyOverrideRow = ({ property, month, onOverride }: PropertyOverrideRowProps) => {
  const { data: expenses } = useOperatingExpenses(property.id, month)
  const { data: templates } = useExpenseTemplates(property.id)

  const expensesList: any[] = Array.isArray(expenses) ? expenses : []
  const templateList: any[] = Array.isArray(templates) ? templates : []

  const hasOverride = expensesList.length > 0
  const hasTemplate = templateList.length > 0

  const overrideTotal = expensesList.reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0)
  const templateTotal = templateList.reduce((sum: number, t: any) => sum + (parseFloat(t.amount) || 0), 0)

  const handleOverride = () => {
    const templateRows: TemplateRow[] = hasTemplate
      ? templateList.map((t: any) => ({
          category: t.category,
          amount: parseFloat(t.amount) || 0,
          description: t.description || undefined
        }))
      : []
    onOverride(property.id, property.name, hasOverride ? undefined : templateRows)
  }

  return (
    <div className={`bg-card rounded-lg shadow-sm border transition-colors hover:bg-muted/30 ${
      hasOverride ? 'border-success/30' : 'border-border'
    }`}>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-muted-foreground" />
            <div>
              <h4 className="text-sm font-medium text-foreground">{property.name}</h4>
              <div className="flex items-center gap-1.5 mt-0.5">
                {hasOverride ? (
                  <span className="inline-flex items-center gap-1 text-xs text-success-fg">
                    <CheckCircle className="w-3 h-3" />
                    Custom override ({formatCurrency(overrideTotal)})
                  </span>
                ) : hasTemplate ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Layers className="w-3 h-3" />
                    Using template ({formatCurrency(templateTotal)}/mo)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertCircle className="w-3 h-3" />
                    No template set
                  </span>
                )}
              </div>
            </div>
          </div>

          <Button
            onClick={handleOverride}
            size="sm"
            variant={hasOverride ? 'default' : 'outline'}
            className={hasOverride ? 'bg-success hover:bg-success/90' : ''}
          >
            <Edit className="w-4 h-4" />
            {hasOverride ? 'Edit Override' : hasTemplate ? 'Override This Month' : 'Add Expenses'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// --- Main panel ---

export const ExpenseManagementPanel = () => {
  const { openModal } = useModal()
  const { data: properties, isLoading } = useProperties()

  const [activeView, setActiveView] = useState<'templates' | 'overrides'>('templates')

  const currentDate = new Date()
  const [selectedPeriod, setSelectedPeriod] = useState(
    `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
  )

  const handleOverride = (propertyId: string, propertyName: string, templateData?: TemplateRow[]) => {
    openModal({
      type: 'operating-expense-entry',
      propertyId,
      propertyName,
      month: selectedPeriod,
      templateData
    })
  }

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-lg shadow-sm border p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Operating Expenses</h2>
            <p className="text-muted-foreground text-sm">
              Set monthly templates to auto-fill expenses, or add overrides for months that differ
            </p>
          </div>
          <div className="bg-muted/40 rounded-lg px-4 py-3">
            <div className="text-2xl font-bold text-info">
              {properties?.length || 0}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Properties</div>
          </div>
        </div>
      </div>

      {/* segmented control */}
      <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg w-fit">
        <button
          onClick={() => setActiveView('templates')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            activeView === 'templates'
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Templates
        </button>
        <button
          onClick={() => setActiveView('overrides')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            activeView === 'overrides'
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Overrides
        </button>
      </div>

      {activeView === 'templates' && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-foreground">Monthly Templates</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Template amounts are used automatically for any month with no explicit override
              </p>
            </div>
          </div>
          <StateWrapper
            loading={isLoading}
            empty={!properties?.length && !isLoading}
            loadingMessage="Loading properties..."
            emptyMessage="No properties found. Sync your properties from OwnerRez first."
            minHeight={400}
          >
            <div className="space-y-4">
              {(properties || []).map((property: any) => (
                <PropertyTemplateCard key={property.id} property={property} />
              ))}
            </div>
          </StateWrapper>
        </>
      )}

      {activeView === 'overrides' && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">Monthly Overrides</h3>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-44 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {generateMonthOptions().map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <StateWrapper
            loading={isLoading}
            empty={!properties?.length && !isLoading}
            loadingMessage="Loading properties..."
            emptyMessage="No properties found. Sync your properties from OwnerRez first."
            minHeight={400}
          >
            <div className="space-y-3">
              {(properties || []).map((property: any) => (
                <PropertyOverrideRow
                  key={property.id}
                  property={property}
                  month={selectedPeriod}
                  onOverride={handleOverride}
                />
              ))}
            </div>
          </StateWrapper>
        </>
      )}
    </div>
  )
}
