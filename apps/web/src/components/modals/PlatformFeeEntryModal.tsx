import { useState } from 'react'
import { Modal } from '@/components/Modal'
import { useModal } from '@/contexts/modal'
import { useToast } from '@/contexts/toast'
import { api } from '@/lib/api'
import { mutate } from 'swr'
import { Calculator, Info, DollarSign } from 'lucide-react'
import { formatCurrency } from '@baileys/utils'
import { format } from 'date-fns'
import { platformFeeSchema as PlatformFeeSchema, type PlatformFee as PlatformFeeData } from '@/schemas/taxConfig'

interface PlatformFeeEntryModalProps {
  propertyId: string
  propertyName: string
  month?: string
  existingData?: Partial<PlatformFeeData>
}

const PLATFORMS = [
  { value: 'airbnb', label: 'Airbnb', remitsTax: true },
  { value: 'vrbo', label: 'VRBO', remitsTax: false },
  { value: 'booking.com', label: 'Booking.com', remitsTax: false },
  { value: 'direct', label: 'Direct Booking', remitsTax: false },
  { value: 'other', label: 'Other', remitsTax: false }
]

export const PlatformFeeEntryModal = ({ 
  propertyId, 
  propertyName,
  month: initialMonth,
  existingData
}: PlatformFeeEntryModalProps) => {
  const { closeModal } = useModal()
  const { addToast } = useToast()
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<Partial<PlatformFeeData>>({
    propertyId,
    platform: existingData?.platform || 'airbnb',
    month: existingData?.month || initialMonth || format(new Date(), 'yyyy-MM'),
    guestServiceFee: existingData?.guestServiceFee || 0,
    hostServiceFee: existingData?.hostServiceFee || 0,
    platformRemitsTax: existingData?.platformRemitsTax ?? PLATFORMS[0].remitsTax,
    platformTaxRemitted: existingData?.platformTaxRemitted || 0,
    notes: existingData?.notes || ''
  })

  const selectedPlatform = PLATFORMS.find(p => p.value === formData.platform)
  const totalFees = (formData.guestServiceFee || 0) + (formData.hostServiceFee || 0)

  const handlePlatformChange = (platform: string) => {
    const platformConfig = PLATFORMS.find(p => p.value === platform)
    setFormData(prev => ({
      ...prev,
      platform: platform as any,
      platformRemitsTax: platformConfig?.remitsTax || false,
      platformTaxRemitted: platformConfig?.remitsTax ? 0 : 0
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      setIsSubmitting(true)
      
      const validation = PlatformFeeSchema.safeParse(formData)
      if (!validation.success) {
        addToast('error', 'Please fill in all required fields')
        return
      }

      const result = await api.savePlatformFee(validation.data)
      
      if (result.success) {
        // Invalidate platform fees cache
        await mutate(
          (key: any) => {
            if (Array.isArray(key)) {
              return key[0] === '/platform-fees' && key[1] === propertyId
            }
            return false
          },
          undefined,
          { revalidate: true }
        )
        
        // Invalidate financial data cache to reflect new platform fees
        await mutate(
          (key: any) => {
            if (Array.isArray(key)) {
              return key[0] === '/financial'
            }
            return false
          },
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
      title="Enter Platform Fees"
      subtitle={`${propertyName} - ${formData.month}`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
            <div className="text-sm text-blue-800">
              <strong>Platform Fee Tracking:</strong> Enter the service fees charged by booking platforms. 
              These fees are taxable in many jurisdictions. Some platforms like Airbnb remit taxes on their 
              fees directly, while others require you to remit the tax.
            </div>
          </div>
        </div>

        {/* Platform Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Booking Platform
          </label>
          <select
            value={formData.platform}
            onChange={(e) => handlePlatformChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {PLATFORMS.map(platform => (
              <option key={platform.value} value={platform.value}>
                {platform.label}
              </option>
            ))}
          </select>
        </div>

        {/* Month Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Month
          </label>
          <div className="flex gap-2">
            <select
              value={(formData.month || format(new Date(), 'yyyy-MM')).split('-')[1]}
              onChange={(e) => {
                const year = (formData.month || format(new Date(), 'yyyy-MM')).split('-')[0]
                setFormData(prev => ({ ...prev, month: `${year}-${e.target.value}` }))
              }}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="01">January</option>
              <option value="02">February</option>
              <option value="03">March</option>
              <option value="04">April</option>
              <option value="05">May</option>
              <option value="06">June</option>
              <option value="07">July</option>
              <option value="08">August</option>
              <option value="09">September</option>
              <option value="10">October</option>
              <option value="11">November</option>
              <option value="12">December</option>
            </select>
            <select
              value={(formData.month || format(new Date(), 'yyyy-MM')).split('-')[0]}
              onChange={(e) => {
                const month = (formData.month || format(new Date(), 'yyyy-MM')).split('-')[1]
                setFormData(prev => ({ ...prev, month: `${e.target.value}-${month}` }))
              }}
              className="w-24 px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Fee Inputs */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Guest Service Fee
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.guestServiceFee || ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  guestServiceFee: parseFloat(e.target.value) || 0 
                }))}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Paid by guests</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Host Service Fee
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.hostServiceFee || ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  hostServiceFee: parseFloat(e.target.value) || 0 
                }))}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Deducted from payout</p>
          </div>
        </div>

        {/* Tax Remittance */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center mb-3">
            <Calculator className="w-4 h-4 text-gray-600 mr-2" />
            <span className="font-medium text-gray-700">Tax Remittance</span>
          </div>
          
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.platformRemitsTax}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  platformRemitsTax: e.target.checked,
                  platformTaxRemitted: e.target.checked ? prev.platformTaxRemitted || 0 : 0
                }))}
                className="mr-2"
              />
              <span className="text-sm">
                {selectedPlatform?.label} remits taxes on their fees
              </span>
            </label>

            {formData.platformRemitsTax && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tax Amount Platform Remits
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.platformTaxRemitted || ''}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      platformTaxRemitted: parseFloat(e.target.value) || 0 
                    }))}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Fee Summary */}
        {totalFees > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Fee Summary</h4>
            <div className="space-y-1 text-sm text-blue-800">
              <div className="flex justify-between">
                <span>Guest Service Fee:</span>
                <span className="font-medium">{formatCurrency(formData.guestServiceFee || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Host Service Fee:</span>
                <span className="font-medium">{formatCurrency(formData.hostServiceFee || 0)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-blue-300">
                <span className="font-medium">Total Platform Fees:</span>
                <span className="font-bold">{formatCurrency(totalFees)}</span>
              </div>
              {formData.platformRemitsTax && (
                <p className="text-xs text-blue-700 mt-2">
                  ℹ️ Platform remits taxes on their fees directly
                </p>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes (Optional)
          </label>
          <textarea
            value={formData.notes || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="Add any relevant notes about these fees..."
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button
            type="button"
            onClick={closeModal}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-sm"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save Platform Fees'}
          </button>
        </div>
      </form>
    </Modal>
  )
}