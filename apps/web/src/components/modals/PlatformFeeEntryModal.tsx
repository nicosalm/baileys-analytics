import { useState, FormEvent, useEffect } from 'react'
import { Modal } from '@/components/Modal'
import { useModal } from '@/contexts/modal'
import { useToast } from '@/contexts/toast'
import { api } from '@/lib/api'
import useSWR, { mutate } from 'swr'
import { Plus, X, DollarSign } from 'lucide-react'
import { formatCurrency, format } from '@baileys/utils'

interface PlatformFeeEntryModalProps {
  propertyId: string
  propertyName: string
  month?: string
  existingData?: any
}

interface PlatformRow {
  platform: string
  amount: number
  notes?: string
}

const generateMonthOptions = () => {
  const options: { value: string; label: string }[] = []
  const now = new Date()

  // last 24 months + next 6 months
  for (let i = -24; i <= 6; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const value = format(date, 'yyyy-MM')
    const label = format(date, 'MMMM yyyy')
    options.push({ value, label })
  }

  return options.reverse()
}

export const PlatformFeeEntryModal = ({
  propertyId,
  propertyName,
  month: initialMonth,
}: PlatformFeeEntryModalProps) => {
  const { closeModal } = useModal()
  const { addToast } = useToast()

  const selectedMonth = initialMonth || format(new Date(), 'yyyy-MM')

  const { data: platformsResponse } = useSWR(
    propertyId ? `/tax/platforms?propertyId=${propertyId}` : null,
    async () => {
      const result = await api.getPropertyPlatforms(propertyId)
      if (!result.success) throw new Error(result.error)
      return (result as any).data?.data || (result as any).data || []
    }
  )

  const { data: existingFeesResponse } = useSWR(
    propertyId && selectedMonth ? `/platform-fees?month=${selectedMonth}` : null,
    async () => {
      const result = await api.getPlatformFees(propertyId, selectedMonth)
      if (!result.success) return []
      return (result as any).data?.data || (result as any).data || []
    }
  )

  const availablePlatforms = platformsResponse || ['Airbnb', 'Vrbo', 'Booking.com', 'Direct']
  const existingFees = existingFeesResponse || []

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [platformRows, setPlatformRows] = useState<PlatformRow[]>([])
  const [month, setMonth] = useState(selectedMonth)

  useEffect(() => {
    if (existingFees.length > 0) {
      setPlatformRows(
        existingFees.map((fee: any) => ({
          platform: fee.platform,
          amount: parseFloat(fee.amount) || 0,
          notes: fee.notes || ''
        }))
      )
    } else {
      setPlatformRows([{ platform: '', amount: 0, notes: '' }])
    }
  }, [existingFees])

  const addPlatformRow = () => {
    setPlatformRows([...platformRows, { platform: '', amount: 0, notes: '' }])
  }

  const removePlatformRow = (index: number) => {
    setPlatformRows(platformRows.filter((_, i) => i !== index))
  }

  const updatePlatformRow = (index: number, field: keyof PlatformRow, value: string | number) => {
    const newRows = [...platformRows]
    newRows[index] = { ...newRows[index], [field]: value }
    setPlatformRows(newRows)
  }

  const totalFees = platformRows.reduce((sum, row) => sum + (row.amount || 0), 0)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    try {
      setIsSubmitting(true)

      const validRows = platformRows.filter(row => row.platform && row.amount > 0)

      if (validRows.length === 0) {
        addToast('error', 'Please add at least one platform with a fee amount')
        return
      }

      const [year, monthNum] = month.split('-')

      const result = await api.request('/platform-fees/bulk', {
        method: 'POST',
        body: JSON.stringify({
          propertyId,
          year: parseInt(year),
          month: parseInt(monthNum),
          fees: validRows.map(row => ({
            platform: row.platform,
            amount: row.amount,
            notes: row.notes || undefined
          }))
        })
      })

      if (result.success) {
        await mutate(
          (key: any) => Array.isArray(key) &&
            (key[0] === '/platform-fees' || key[0] === '/financial'),
          undefined,
          { revalidate: true }
        )

        addToast('success', 'Platform fees saved successfully')
        closeModal()
      } else {
        addToast('error', result.error || 'Failed to save platform fees')
      }
    } catch (error) {
      addToast('error', 'An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={true}
      onClose={closeModal}
      title="Platform Fees"
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
            Platform Service Fees
          </label>

          <div className="space-y-3">
            {platformRows.map((row, index) => (
              <div key={index} className="flex gap-2 items-start">
                <select
                  value={row.platform}
                  onChange={(e) => updatePlatformRow(index, 'platform', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select platform</option>
                  {availablePlatforms.map((platform: string) => (
                    <option key={platform} value={platform}>{platform}</option>
                  ))}
                </select>

                <div className="relative w-32">
                  <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.amount || ''}
                    onChange={(e) => updatePlatformRow(index, 'amount', parseFloat(e.target.value) || 0)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    required
                  />
                </div>

                {platformRows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePlatformRow(index)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    title="Remove platform"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addPlatformRow}
            className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add another platform
          </button>
        </div>

        {totalFees > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="font-medium text-blue-900">Total Platform Fees:</span>
              <span className="text-xl font-bold text-blue-900">{formatCurrency(totalFees)}</span>
            </div>
            <p className="text-xs text-blue-700 mt-2">
              These fees will be included in your financial calculations
            </p>
          </div>
        )}

        <details className="text-sm text-gray-500">
          <summary className="cursor-pointer hover:text-gray-700">Where to find these fees</summary>
          <ul className="mt-2 space-y-1 ml-4 list-disc text-gray-600">
            <li>Airbnb: Earnings → Transaction History</li>
            <li>Vrbo: Performance → Payouts</li>
            <li>Booking.com: Extranet → Finance</li>
          </ul>
        </details>

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
            {isSubmitting ? 'Saving...' : 'Save Fees'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
