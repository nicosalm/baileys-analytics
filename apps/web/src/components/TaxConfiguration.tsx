import { useState, useMemo } from 'react'
import { TaxRule, TaxRuleFormData, TaxCalculationMethod, TaxAppliesTo } from '@/types/tax'
import { formatPercentage, formatDateISO } from '@baileys/utils'
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Calculator } from 'lucide-react'
import { taxEngine } from '@/lib/taxEngine'
import { useTaxConfig } from '@/contexts/taxConfig'
import { useToast } from '@/contexts/toast'
import { createTaxRule, updateTaxRule, deleteTaxRule } from '@/hooks/use-api'
import { LoadingState } from '@/components/LoadingState'
import { SelectableTable } from '@/components/tables'

const TaxMethodBadge = ({ method }: { method: TaxCalculationMethod }) => {
  const getMethodDisplay = () => {
    switch (method.type) {
      case 'percentage':
        return `${formatPercentage(method.rate * 100)}`
      case 'flat':
        return `$${method.amount.toFixed(2)}`
      case 'tiered':
        return `Tiered (${method.tiers.length} levels)`
      case 'compound':
        return `Compound (${method.components.length} parts)`
      case 'seasonal':
        return `Seasonal (${formatPercentage(method.baseRate * 100)} base)`
      case 'custom':
        return 'Custom Formula'
    }
  }

  const colors = {
    percentage: 'bg-blue-100 text-blue-800',
    flat: 'bg-green-100 text-green-800',
    tiered: 'bg-purple-100 text-purple-800',
    compound: 'bg-orange-100 text-orange-800',
    seasonal: 'bg-yellow-100 text-yellow-800',
    custom: 'bg-red-100 text-red-800'
  }

  return (
    <span className={`px-2 py-1 rounded-sm text-xs font-medium ${colors[method.type]}`}>
      {getMethodDisplay()}
    </span>
  )
}

const AppliesToBadge = ({ appliesTo }: { appliesTo: TaxAppliesTo }) => {
  const getDisplay = () => {
    switch (appliesTo.type) {
      case 'all':
        return 'All Properties'
      case 'properties':
        return `${appliesTo.propertyIds.length} Properties`
      case 'tags':
        return `${appliesTo.tagIds.length} Tags`
      case 'dateRange':
        return `${appliesTo.from} - ${appliesTo.to}`
      case 'bookingSource':
        return `${appliesTo.sources.length} Sources`
    }
  }

  return (
    <span className="text-sm text-gray-600">
      {getDisplay()}
    </span>
  )
}

const TaxRuleForm = ({
  rule,
  onSave,
  onCancel
}: {
  rule?: TaxRule
  onSave: (rule: TaxRuleFormData) => void
  onCancel: () => void
}) => {
  const [formData, setFormData] = useState<TaxRuleFormData>(rule || {
    name: '',
    description: '',
    method: { type: 'percentage', rate: 0 },
    appliesTo: { type: 'all' },
    effectiveFrom: formatDateISO(new Date()),
    priority: 0,
    isActive: true
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = () => {

    const validationErrors = taxEngine.validateRule(formData)
    if (validationErrors.length > 0) {
      const errorMap = validationErrors.reduce((acc, err) => {
        acc[err.field] = err.message
        return acc
      }, {} as Record<string, string>)
      setErrors(errorMap)
      return
    }

    onSave(formData)
  }

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-sm">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            className="w-full p-2 border rounded-sm"
            required
          />
          {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Priority</label>
          <input
            type="number"
            value={formData.priority}
            onChange={e => setFormData({ ...formData, priority: parseInt(e.target.value) })}
            className="w-full p-2 border rounded-sm"
            required
          />
          {errors.priority && <p className="text-red-500 text-sm mt-1">{errors.priority}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          value={formData.description || ''}
          onChange={e => setFormData({ ...formData, description: e.target.value })}
          className="w-full p-2 border rounded-sm"
          rows={2}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Calculation Method</label>
        <select
          value={formData.method.type}
          onChange={e => {
            const type = e.target.value as TaxCalculationMethod['type']
            let method: TaxCalculationMethod

            switch (type) {
              case 'percentage':
                method = { type, rate: 0 }
                break
              case 'flat':
                method = { type, amount: 0 }
                break
              case 'tiered':
                method = { type, tiers: [{ min: 0, max: null, rate: 0 }] }
                break
              case 'compound':
                method = { type, components: [] }
                break
              case 'seasonal':
                method = { type, baseRate: 0, seasonalMultipliers: [] }
                break
              case 'custom':
                method = { type, formula: '', variables: {} }
                break
            }

            setFormData({ ...formData, method })
          }}
          className="w-full p-2 border rounded-sm"
        >
          <option value="percentage">Percentage</option>
          <option value="flat">Flat Amount</option>
          <option value="tiered">Tiered</option>
          <option value="compound">Compound</option>
          <option value="seasonal">Seasonal</option>
          <option value="custom">Custom Formula</option>
        </select>
      </div>

      {formData.method.type === 'percentage' && (
        <div>
          <label className="block text-sm font-medium mb-1">Tax Rate (%)</label>
          <input
            type="number"
            step="0.001"
            value={formData.method.rate * 100}
            onChange={e => setFormData({
              ...formData,
              method: { type: 'percentage', rate: parseFloat(e.target.value) / 100 }
            })}
            className="w-full p-2 border rounded-sm"
            required
          />
        </div>
      )}

      {formData.method.type === 'flat' && (
        <div>
          <label className="block text-sm font-medium mb-1">Tax Amount ($)</label>
          <input
            type="number"
            step="0.01"
            value={formData.method.amount}
            onChange={e => setFormData({
              ...formData,
              method: { type: 'flat', amount: parseFloat(e.target.value) }
            })}
            className="w-full p-2 border rounded-sm"
            required
          />
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Effective From</label>
          <input
            type="date"
            value={formData.effectiveFrom}
            onChange={e => setFormData({ ...formData, effectiveFrom: e.target.value })}
            className="w-full p-2 border rounded-sm"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Effective To (Optional)</label>
          <input
            type="date"
            value={formData.effectiveTo || ''}
            onChange={e => setFormData({ ...formData, effectiveTo: e.target.value || undefined })}
            className="w-full p-2 border rounded-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Applies To</label>
        <select
          value={formData.appliesTo.type}
          onChange={e => {
            const type = e.target.value as TaxAppliesTo['type']
            let appliesTo: TaxAppliesTo

            switch (type) {
              case 'all':
                appliesTo = { type }
                break
              case 'properties':
                appliesTo = { type, propertyIds: [] }
                break
              case 'tags':
                appliesTo = { type, tagIds: [] }
                break
              case 'dateRange':
                appliesTo = { type, from: '', to: '' }
                break
              case 'bookingSource':
                appliesTo = { type, sources: [] }
                break
            }

            setFormData({ ...formData, appliesTo })
          }}
          className="w-full p-2 border rounded-sm"
        >
          <option value="all">All Properties</option>
          <option value="properties">Specific Properties</option>
          <option value="tags">By Tags</option>
          <option value="dateRange">Date Range</option>
          <option value="bookingSource">Booking Source</option>
        </select>
      </div>

      <div className="flex justify-end space-x-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-200 rounded-sm hover:bg-gray-300"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700"
        >
          {rule ? 'Update' : 'Create'} Rule
        </button>
      </div>
    </div>
  )
}

export const TaxConfiguration = () => {
  const { rules, propertyConfigs, isLoading, error, mutateRules, mutatePropertyConfigs } = useTaxConfig()
  const { addToast } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [editingRule, setEditingRule] = useState<TaxRule | undefined>(undefined)
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null)

  const handleSaveRule = async (ruleData: TaxRuleFormData) => {
    try {
      if (editingRule) {
        await updateTaxRule(editingRule.id, ruleData)
        addToast('success', 'Tax rule updated successfully')
      } else {
        await createTaxRule(ruleData)
        addToast('success', 'Tax rule created successfully')
      }
      setShowForm(false)
      setEditingRule(undefined)
    } catch (error) {
      // The optimistic update will be rolled back automatically
      addToast('error', error instanceof Error ? error.message : 'Failed to save tax rule')
    }
  }

  const handleDeleteRule = async (ruleId: string) => {
    setDeletingRuleId(ruleId)
    try {
      await deleteTaxRule(ruleId)
      addToast('success', 'Tax rule deleted successfully')
    } catch (error) {
      // The optimistic update will be rolled back automatically
      addToast('error', error instanceof Error ? error.message : 'Failed to delete tax rule')
    } finally {
      setDeletingRuleId(null)
    }
  }

  const handleToggleRule = async (ruleId: string) => {
    const rule = rules?.find((r: any) => r.id === ruleId)
    if (!rule) return

    try {
      await updateTaxRule(ruleId, {
        ...rule,
        isActive: !rule.isActive
      })
      addToast('success', `Tax rule ${!rule.isActive ? 'enabled' : 'disabled'}`)
    } catch (error) {
      // The optimistic update will be rolled back automatically
      addToast('error', error instanceof Error ? error.message : 'Failed to toggle tax rule')
    }
  }

  const columns = useMemo(() => [
    {
      key: 'name',
      header: 'Rule Name',
      sortable: true,
      width: 250,
      render: (rule: TaxRule) => (
        <div>
          <div className="font-medium">{rule.name}</div>
          {rule.description && (
            <div className="text-sm text-gray-500">{rule.description}</div>
          )}
        </div>
      )
    },
    {
      key: 'method',
      header: 'Method',
      width: 150,
      render: (rule: TaxRule) => <TaxMethodBadge method={rule.method} />
    },
    {
      key: 'appliesTo',
      header: 'Applies To',
      width: 200,
      render: (rule: TaxRule) => <AppliesToBadge appliesTo={rule.appliesTo} />
    },
    {
      key: 'priority',
      header: 'Priority',
      sortable: true,
      width: 100,
      render: (rule: TaxRule) => (
        <span className="font-medium">{rule.priority}</span>
      )
    },
    {
      key: 'isActive',
      header: 'Status',
      width: 100,
      render: (rule: TaxRule) => (
        <button
          onClick={() => handleToggleRule(rule.id)}
          className="flex items-center"
        >
          {rule.isActive ? (
            <ToggleRight className="w-6 h-6 text-green-600" />
          ) : (
            <ToggleLeft className="w-6 h-6 text-gray-400" />
          )}
        </button>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 120,
      render: (rule: TaxRule) => (
        <div className="flex space-x-2">
          <button
            onClick={() => {
              setEditingRule(rule)
              setShowForm(true)
            }}
            className="p-1 text-blue-600 hover:bg-blue-50 rounded-sm"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteRule(rule.id)}
            disabled={deletingRuleId === rule.id}
            className="p-1 text-red-600 hover:bg-red-50 rounded-sm disabled:opacity-50"
          >
            {deletingRuleId === rule.id ? (
              <LoadingState />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      )
    }
  ], [rules, deletingRuleId])

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingState />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">Failed to load tax configuration</p>
        <button
          onClick={() => {
            mutateRules()
            mutatePropertyConfigs()
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Tax Configuration</h2>
        <button
          onClick={() => {
            setEditingRule(undefined)
            setShowForm(true)
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-sm flex items-center hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Tax Rule
        </button>
      </div>

      {showForm && (
        <TaxRuleForm
          rule={editingRule}
          onSave={handleSaveRule}
          onCancel={() => {
            setShowForm(false)
            setEditingRule(undefined)
          }}
        />
      )}

      <div className="bg-white rounded-lg shadow-sm">
        <SelectableTable
          data={rules || []}
          columns={columns}
          getRowId={(rule) => rule.id}
          sortBy="priority"
          sortOrder="desc"
          enableSearch={true}
          searchKeys={['name', 'description']}
          emptyMessage="No tax rules configured. Click 'Add Tax Rule' to create one."
          bulkActions={[
            { label: 'Delete Selected', action: 'delete', icon: <Trash2 className="w-4 h-4" /> }
          ]}
          onBulkAction={(action, selectedIds) => {
            if (action === 'delete') {
              // Handle bulk delete
              console.log('Delete rules:', selectedIds)
            }
          }}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-bold mb-4 flex items-center">
            <Calculator className="w-5 h-5 mr-2" />
            Property Tax Summary
          </h3>
          <div className="space-y-2">
            {propertyConfigs?.map((config: any) => (
              <div key={config.propertyId} className="flex justify-between items-center py-2 border-b">
                <span className="font-medium">{config.propertyName}</span>
                <div className="text-right">
                  <span className="text-sm text-gray-600">Effective Rate: </span>
                  <span className="font-medium">{formatPercentage(config.effectiveRate * 100)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-bold mb-4">Tax Calculation Preview</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Test Amount</label>
              <input
                type="number"
                placeholder="1000"
                className="w-full p-2 border rounded-sm"
                onChange={e => {
                  const amount = parseFloat(e.target.value) || 0
                  const result = taxEngine.calculateTax(amount, rules || [], {
                    bookingDate: new Date().toISOString(),
                  })

                  // Display result (you could add state for this)
                  console.log('Tax calculation:', result)
                }}
              />
            </div>
            <p className="text-sm text-gray-600">
              Enter an amount to preview tax calculations based on current rules
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
