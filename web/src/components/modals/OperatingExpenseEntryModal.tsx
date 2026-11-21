import { useState, type FormEvent, useEffect } from 'react'
import { Modal } from '@/components/Modal'
import { useModal } from '@/contexts/modal'
import { useToast } from '@/contexts/toast'
import { useOperatingExpenses, saveOperatingExpensesBulk } from '@/hooks/use-api'
import { Plus, X, DollarSign } from 'lucide-react'
import { formatCurrency, format } from '@baileys/utils'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface OperatingExpenseEntryModalProps {
  propertyId: string
  propertyName: string
  month?: string
  templateData?: { category: string; amount: number; description?: string }[]
}

interface ExpenseRow {
  category: string
  amount: number
  description?: string
}

const EXPENSE_CATEGORIES = [
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'management', label: 'Management' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'other', label: 'Other' },
]

const generateMonthOptions = () => {
  const options: { value: string; label: string }[] = []
  const now = new Date()

  for (let i = -24; i <= 6; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const value = format(date, 'yyyy-MM')
    const label = format(date, 'MMMM yyyy')
    options.push({ value, label })
  }

  return options.reverse()
}

export const OperatingExpenseEntryModal = ({
  propertyId,
  propertyName,
  month: initialMonth,
  templateData,
}: OperatingExpenseEntryModalProps) => {
  const { closeModal } = useModal()
  const { addToast } = useToast()

  const [month, setMonth] = useState(initialMonth || format(new Date(), 'yyyy-MM'))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [expenseRows, setExpenseRows] = useState<ExpenseRow[]>([])

  const { data: existingExpenses } = useOperatingExpenses(propertyId, month)

  useEffect(() => {
    if (existingExpenses && existingExpenses.length > 0) {
      setExpenseRows(
        existingExpenses.map((exp) => ({
          category: exp.category,
          amount: parseFloat(String(exp.amount)) || 0,
          description: exp.description || '',
        })),
      )
    } else if (templateData && templateData.length > 0) {
      setExpenseRows(
        templateData.map((t) => ({
          category: t.category,
          amount: t.amount,
          description: t.description || '',
        })),
      )
    } else {
      setExpenseRows([{ category: '', amount: 0, description: '' }])
    }
  }, [existingExpenses])

  const addExpenseRow = () => {
    setExpenseRows([...expenseRows, { category: '', amount: 0, description: '' }])
  }

  const removeExpenseRow = (index: number) => {
    setExpenseRows(expenseRows.filter((_, i) => i !== index))
  }

  const updateExpenseRow = (index: number, field: keyof ExpenseRow, value: string | number) => {
    const newRows = [...expenseRows]
    newRows[index] = { ...newRows[index], [field]: value }
    setExpenseRows(newRows)
  }

  const totalExpenses = expenseRows.reduce((sum, row) => sum + (row.amount || 0), 0)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    try {
      setIsSubmitting(true)

      const validRows = expenseRows.filter((row) => row.category && row.amount > 0)

      if (validRows.length === 0) {
        addToast('error', 'Please add at least one expense with an amount')
        return
      }

      const [year, monthNum] = month.split('-')

      await saveOperatingExpensesBulk({
        propertyId,
        year: parseInt(year, 10),
        month: parseInt(monthNum, 10),
        expenses: validRows.map((row) => ({
          category: row.category,
          amount: row.amount,
          description: row.description || undefined,
        })),
      })

      addToast('success', 'Operating expenses saved successfully')
      closeModal()
    } catch (error) {
      addToast('error', 'Failed to save operating expenses')
    } finally {
      setIsSubmitting(false)
    }
  }

  const usedCategories = expenseRows.map((row) => row.category).filter(Boolean)

  return (
    <Modal
      isOpen={true}
      onClose={closeModal}
      title="Operating Expenses"
      subtitle={`${propertyName} - ${format(new Date(`${month}-01`), 'MMMM yyyy')}`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label className="mb-2">Month</Label>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {generateMonthOptions().map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="mb-3">Expenses</Label>

          <div className="space-y-3">
            {expenseRows.map((row, index) => (
              <div key={index} className="flex gap-2 items-start">
                <Select value={row.category || undefined} onValueChange={(v) => updateExpenseRow(index, 'category', v)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((cat) => (
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

                <div className="relative w-32">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.amount || ''}
                    onChange={(e) => updateExpenseRow(index, 'amount', parseFloat(e.target.value) || 0)}
                    className="pl-9"
                    placeholder="0.00"
                    required
                  />
                </div>

                <Input
                  type="text"
                  value={row.description || ''}
                  onChange={(e) => updateExpenseRow(index, 'description', e.target.value)}
                  className="w-40"
                  placeholder="Description"
                />

                {expenseRows.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeExpenseRow(index)}
                    className="text-muted-foreground hover:text-danger hover:bg-danger-subtle"
                    title="Remove expense"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {expenseRows.length < EXPENSE_CATEGORIES.length && (
            <Button type="button" variant="link" onClick={addExpenseRow} className="mt-3 text-sm px-0">
              <Plus className="w-4 h-4" />
              Add another expense
            </Button>
          )}
        </div>

        {totalExpenses > 0 && (
          <div className="bg-info-subtle border border-info/30 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="font-medium text-info-fg">Total Operating Expenses:</span>
              <span className="text-xl font-bold text-info-fg">{formatCurrency(totalExpenses)}</span>
            </div>
            <p className="text-xs text-info-fg mt-2">These expenses will be subtracted from Net Revenue to calculate Operating Profit</p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="ghost" onClick={closeModal} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} loading={isSubmitting} loadingText="Saving...">
            Save Expenses
          </Button>
        </div>
      </form>
    </Modal>
  )
}
