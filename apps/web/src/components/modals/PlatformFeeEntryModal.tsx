import { useState, FormEvent, useEffect } from 'react'
import { Modal } from '@/components/Modal'
import { useModal } from '@/contexts/modal'
import { useToast } from '@/contexts/toast'
import { api } from '@/lib/api'
import useSWR, { mutate } from 'swr'
import { Plus, X, DollarSign } from 'lucide-react'
import { formatCurrency, format } from '@baileys/utils'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [platformRows, setPlatformRows] = useState<PlatformRow[]>([])
  const [month, setMonth] = useState(selectedMonth)

  useEffect(() => {
    if (existingFeesResponse && existingFeesResponse.length > 0) {
      setPlatformRows(
        existingFeesResponse.map((fee: any) => ({
          platform: fee.platform,
          amount: parseFloat(fee.amount) || 0,
          notes: fee.notes || ''
        }))
      )
    } else if (existingFeesResponse) {
      setPlatformRows([{ platform: '', amount: 0, notes: '' }])
    }
  }, [existingFeesResponse])

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
          <Label className="mb-2">
            Month
          </Label>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {generateMonthOptions().map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="mb-3">
            Platform Service Fees
          </Label>

          <div className="space-y-3">
            {platformRows.map((row, index) => (
              <div key={index} className="flex gap-2 items-start">
                <Select value={row.platform || undefined} onValueChange={(v) => updatePlatformRow(index, 'platform', v)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePlatforms.map((platform: string) => (
                      <SelectItem key={platform} value={platform}>{platform}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="relative w-32">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.amount || ''}
                    onChange={(e) => updatePlatformRow(index, 'amount', parseFloat(e.target.value) || 0)}
                    className="pl-9"
                    placeholder="0.00"
                    required
                  />
                </div>

                {platformRows.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removePlatformRow(index)}
                    className="text-gray-400 hover:text-red-600 hover:bg-red-50"
                    title="Remove platform"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="link"
            onClick={addPlatformRow}
            className="mt-3 text-sm px-0"
          >
            <Plus className="w-4 h-4" />
            Add another platform
          </Button>
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
          <Button
            type="button"
            variant="ghost"
            onClick={closeModal}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            loading={isSubmitting}
            loadingText="Saving..."
          >
            Save Fees
          </Button>
        </div>
      </form>
    </Modal>
  )
}
