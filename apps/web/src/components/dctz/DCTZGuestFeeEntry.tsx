import { useState, FormEvent, useEffect } from 'react'
import { Modal } from '@/components/Modal'
import { useToast } from '@/contexts/toast'
import { api } from '@/lib/api'
import { formatCurrency, format } from '@baileys/utils'
import { Plus, X, DollarSign, Info } from 'lucide-react'
import { PLATFORM_REMITS_TAX } from './constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

interface DCTZGuestFeeEntryProps {
  propertyId: string
  propertyName: string
  month: string
  onClose: () => void
  onSaved: () => void
}

interface FeeRow {
  platform: string
  guestServiceFee: number
  hostServiceFee: number
}

const PLATFORMS = ['Airbnb', 'Vrbo', 'Expedia', 'Booking.com', 'Evolve', 'Direct']

const generateMonthOptions = () => {
  const options: { value: string; label: string }[] = []
  const now = new Date()

  for (let i = -12; i <= 0; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const value = format(date, 'yyyy-MM')
    const label = format(date, 'MMMM yyyy')
    options.push({ value, label })
  }

  return options.reverse()
}

export const DCTZGuestFeeEntry = ({
  propertyId,
  propertyName,
  month: initialMonth,
  onClose,
  onSaved
}: DCTZGuestFeeEntryProps) => {
  const { addToast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feeRows, setFeeRows] = useState<FeeRow[]>([
    { platform: 'Airbnb', guestServiceFee: 0, hostServiceFee: 0 }
  ])
  const [month, setMonth] = useState(initialMonth)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadExistingFees()
  }, [month])

  const loadExistingFees = async () => {
    setIsLoading(true)
    const [year, monthNum] = month.split('-')

    try {
      const result = await api.request(
        `/dctz/fee-status?propertyId=${propertyId}&year=${year}&month=${monthNum}`
      )

      if (result.success && (result as any).data?.fees?.length > 0) {
        const fees = (result as any).data.fees
        setFeeRows(
          fees.map((fee: any) => ({
            platform: fee.platform,
            guestServiceFee: parseFloat(fee.guest_service_fee) || 0,
            hostServiceFee: parseFloat(fee.host_service_fee) || 0
          }))
        )
      } else {
        setFeeRows([{ platform: 'Airbnb', guestServiceFee: 0, hostServiceFee: 0 }])
      }
    } catch {
      // silent fail, use default
    } finally {
      setIsLoading(false)
    }
  }

  const addRow = () => {
    setFeeRows([...feeRows, { platform: '', guestServiceFee: 0, hostServiceFee: 0 }])
  }

  const removeRow = (index: number) => {
    setFeeRows(feeRows.filter((_, i) => i !== index))
  }

  const updateRow = (
    index: number,
    field: keyof FeeRow,
    value: string | number
  ) => {
    const newRows = [...feeRows]
    newRows[index] = { ...newRows[index], [field]: value }
    setFeeRows(newRows)
  }

  const totalGuestFees = feeRows.reduce((sum, row) => sum + (row.guestServiceFee || 0), 0)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    // validate propertyId looks like a uuid (loose check for test data)
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    if (!propertyId || !uuidRegex.test(propertyId)) {
      addToast('error', 'Invalid property selected')
      console.error('Invalid propertyId:', propertyId)
      return
    }

    const validRows = feeRows.filter(
      (row) => row.platform && row.guestServiceFee > 0
    )

    setIsSubmitting(true)
    const [year, monthNum] = month.split('-')

    try {
      if (validRows.length === 0) {
        // clear all fees for this property/month
        const result = await api.request(
          `/dctz/guest-fees?propertyId=${propertyId}&year=${year}&month=${monthNum}`,
          { method: 'DELETE' }
        )

        if (!result.success) {
          throw new Error((result as any).error || 'Failed to clear fees')
        }

        addToast('success', 'Guest service fees cleared')
      } else {
        // save each row
        for (const row of validRows) {
          const result = await api.request('/dctz/guest-fee', {
            method: 'POST',
            body: JSON.stringify({
              propertyId,
              platform: row.platform,
              year: parseInt(year),
              month: parseInt(monthNum),
              guestServiceFee: row.guestServiceFee,
              hostServiceFee: row.hostServiceFee
            })
          })

          if (!result.success) {
            throw new Error((result as any).error || 'Failed to save')
          }
        }

        addToast('success', 'Guest service fees saved')
      }

      onSaved()
    } catch (error) {
      addToast(
        'error',
        error instanceof Error ? error.message : 'Failed to save fees'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Guest Service Fees"
      subtitle={`${propertyName} - ${format(new Date(month + '-01'), 'MMMM yyyy')}`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* info box */}
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-teal-800">
              <p className="font-medium">Why enter guest service fees?</p>
              <p className="mt-1 text-teal-700">
                DCTZ requires reporting total taxable amount = your revenue + platform
                guest fees. Airbnb guest fees are not available via API, so they must be
                entered manually from your earnings statements.
              </p>
            </div>
          </div>
        </div>

        {/* month selector */}
        <div>
          <Label className="mb-2">
            Month
          </Label>
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

        {/* fee rows */}
        <div>
          <Label className="mb-3">
            Platform Guest Service Fees
          </Label>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : feeRows.length === 0 ? (
            <div className="text-sm text-gray-500 py-4 text-center border border-dashed border-gray-300 rounded-lg">
              No guest fees entered. Click "Add platform" below to add fees.
            </div>
          ) : (
            <div className="space-y-3">
              {feeRows.map((row, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <Select value={row.platform || undefined} onValueChange={(v) => updateRow(index, 'platform', v)}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map((platform) => (
                        <SelectItem key={platform} value={platform}>
                          {platform}
                          {PLATFORM_REMITS_TAX[platform.toLowerCase()] ? ' ✓' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="relative w-32">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.guestServiceFee || ''}
                      onChange={(e) =>
                        updateRow(index, 'guestServiceFee', parseFloat(e.target.value) || 0)
                      }
                      className="pl-9"
                      placeholder="0.00"
                      title="Guest service fee (what platform charged guests)"
                    />
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(index)}
                    className="text-gray-400 hover:text-red-600 hover:bg-red-50"
                    title="Remove platform"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Button
            type="button"
            variant="link"
            onClick={addRow}
            className="mt-3 text-sm text-teal-600 hover:text-teal-700 px-0"
          >
            <Plus className="w-4 h-4" />
            {feeRows.length === 0 ? 'Add platform' : 'Add another platform'}
          </Button>
        </div>

        {/* total */}
        {totalGuestFees > 0 && (
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="font-medium text-teal-900">Total Guest Service Fees:</span>
              <span className="text-xl font-bold text-teal-900">
                {formatCurrency(totalGuestFees)}
              </span>
            </div>
            <p className="text-xs text-teal-700 mt-2">
              This amount will be added to gross lodging sales for DCTZ reporting
            </p>
          </div>
        )}

        {/* where to find */}
        <details className="text-sm text-gray-500">
          <summary className="cursor-pointer hover:text-gray-700">
            Where to find guest service fees
          </summary>
          <ul className="mt-2 space-y-1 ml-4 list-disc text-gray-600">
            <li>
              <strong>Airbnb:</strong> Earnings → Transaction History → look for "Guest service
              fee" on each reservation
            </li>
            <li>
              <strong>Vrbo:</strong> Performance → Payouts → reservation details
            </li>
            <li>
              <strong>Booking.com:</strong> Finance → Reservations tab
            </li>
          </ul>
        </details>

        {/* actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-teal-600 hover:bg-teal-700"
            disabled={isSubmitting || isLoading}
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
