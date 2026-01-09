import { useState } from 'react'
import { useModal } from '@/contexts/modal'
import { useProperties, useOperatingExpenses } from '@/hooks/use-api'
import { StateWrapper } from '@/components/StateWrapper'
import { formatCurrency } from '@baileys/utils'
import {
  Receipt, Building2,
  Calendar, CheckCircle
} from 'lucide-react'

interface PropertyExpenseRowProps {
  property: any
  month: string
  onManageExpenses: (propertyId: string, propertyName: string) => void
}

const PropertyExpenseRow = ({ property, month, onManageExpenses }: PropertyExpenseRowProps) => {
  const { data: expenses } = useOperatingExpenses(property.id, month)
  const expensesList = Array.isArray(expenses) ? expenses : []
  const hasData = expensesList.length > 0
  const totalExpenses = expensesList.reduce((sum: number, exp: any) => sum + (parseFloat(exp.amount) || 0), 0)

  return (
    <div
      key={property.id}
      className={`bg-white rounded-lg shadow-sm border transition-colors ${
        hasData
          ? 'border-green-200 hover:bg-gray-50/50'
          : 'border-gray-200 hover:bg-gray-50/50'
      }`}
    >
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-gray-500" />
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium text-gray-900">{property.name}</h4>
                {hasData && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    {formatCurrency(totalExpenses)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onManageExpenses(property.id, property.name)}
              className={`px-3 py-1.5 text-white text-sm rounded-lg flex items-center gap-1 transition-opacity cursor-pointer ${
                hasData
                  ? 'bg-green-600 hover:opacity-90'
                  : 'bg-blue-600 hover:opacity-90'
              }`}
              title="Track monthly operating expenses"
            >
              <Receipt className="w-4 h-4" />
              {hasData ? 'Update' : 'Manage'} Expenses
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export const ExpenseManagementPanel = () => {
  const { openModal } = useModal()
  const { data: properties, isLoading } = useProperties()

  const currentDate = new Date()
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1)

  const formattedMonth = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`

  const handleManageExpenses = (propertyId: string, propertyName: string) => {
    openModal({
      type: 'operating-expense-entry',
      propertyId,
      propertyName,
      month: formattedMonth
    })
  }

  return (
    <div className="space-y-6">

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Operating Expenses</h2>
            <p className="text-gray-600 text-sm">
              Track cleaning, management, utilities, and other operating costs per property
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg px-4 py-3">
            <div className="text-2xl font-bold text-blue-600">
              {properties?.length || 0}
            </div>
            <div className="text-xs text-gray-500 mt-1">Properties</div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Properties</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Expense Period:</span>
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
            <Calendar className="w-4 h-4 text-gray-400" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="text-sm font-medium text-gray-700 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value={1}>January</option>
              <option value={2}>February</option>
              <option value={3}>March</option>
              <option value={4}>April</option>
              <option value={5}>May</option>
              <option value={6}>June</option>
              <option value={7}>July</option>
              <option value={8}>August</option>
              <option value={9}>September</option>
              <option value={10}>October</option>
              <option value={11}>November</option>
              <option value={12}>December</option>
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="text-sm font-medium text-gray-700 bg-transparent focus:outline-none cursor-pointer"
            >
              {Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
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
            <PropertyExpenseRow
              key={property.id}
              property={property}
              month={formattedMonth}
              onManageExpenses={handleManageExpenses}
            />
          ))}
        </div>
      </StateWrapper>

    </div>
  )
}
