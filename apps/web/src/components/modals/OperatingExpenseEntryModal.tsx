import { useState, FormEvent, useEffect } from 'react'
import { Modal } from '@/components/Modal'
import { useModal } from '@/contexts/modal'
import { useToast } from '@/contexts/toast'
import { useOperatingExpenses, saveOperatingExpensesBulk } from '@/hooks/use-api'
import { Plus, X, DollarSign } from 'lucide-react'
import { formatCurrency, format } from '@baileys/utils'

interface OperatingExpenseEntryModalProps {
  propertyId: string
  propertyName: string
  month?: string
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
  { value: 'other', label: 'Other' }
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
        existingExpenses.map((exp: any) => ({
          category: exp.category,
          amount: parseFloat(exp.amount) || 0,
          description: exp.description || ''
        }))
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

      const validRows = expenseRows.filter(row => row.category && row.amount > 0)

      if (validRows.length === 0) {
        addToast('error', 'Please add at least one expense with an amount')
        return
      }

      const [year, monthNum] = month.split('-')

      await saveOperatingExpensesBulk({
        propertyId,
        year: parseInt(year),
        month: parseInt(monthNum),
        expenses: validRows.map(row => ({
          category: row.category,
          amount: row.amount,
          description: row.description || undefined
        }))
      })

      addToast('success', 'Operating expenses saved successfully')
      closeModal()
    } catch (error) {
      addToast('error', 'Failed to save operating expenses')
    } finally {
      setIsSubmitting(false)
    }
  }

  const usedCategories = expenseRows.map(row => row.category).filter(Boolean)

  return (
    <Modal
      isOpen={true}
      onClose={closeModal}
      title="Operating Expenses"
      subtitle={`${propertyName} - ${format(new Date(month + '-01'), 'MMMM yyyy')}`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Month
          </label>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            {generateMonthOptions().map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Expenses
          </label>

          <div className="space-y-3">
            {expenseRows.map((row, index) => (
              <div key={index} className="flex gap-2 items-start">
                <select
                  value={row.category}
                  onChange={(e) => updateExpenseRow(index, 'category', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select category</option>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option
                      key={cat.value}
                      value={cat.value}
                      disabled={usedCategories.includes(cat.value) && row.category !== cat.value}
                    >
                      {cat.label}
                    </option>
                  ))}
                </select>

                <div className="relative w-32">
                  <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.amount || ''}
                    onChange={(e) => updateExpenseRow(index, 'amount', parseFloat(e.target.value) || 0)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    required
                  />
                </div>

                <input
                  type="text"
                  value={row.description || ''}
                  onChange={(e) => updateExpenseRow(index, 'description', e.target.value)}
                  className="w-40 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Description"
                />

                {expenseRows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeExpenseRow(index)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    title="Remove expense"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {expenseRows.length < EXPENSE_CATEGORIES.length && (
            <button
              type="button"
              onClick={addExpenseRow}
              className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add another expense
            </button>
          )}
        </div>

        {totalExpenses > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="font-medium text-blue-900">Total Operating Expenses:</span>
              <span className="text-xl font-bold text-blue-900">{formatCurrency(totalExpenses)}</span>
            </div>
            <p className="text-xs text-blue-700 mt-2">
              These expenses will be subtracted from Net Revenue to calculate Operating Profit
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={closeModal}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg cursor-pointer"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:opacity-90 disabled:opacity-50 cursor-pointer font-medium"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save Expenses'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
