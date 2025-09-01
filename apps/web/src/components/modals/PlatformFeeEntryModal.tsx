import { useState, FormEvent } from 'react'
import { Modal } from '@/components/Modal'
import { useModal } from '@/contexts/modal'
import { useToast } from '@/contexts/toast'
import { useTips } from '@/hooks/use-tips'
import { api } from '@/lib/api'
import useSWR, { mutate } from 'swr'
import { Calculator, Info, DollarSign, AlertCircle } from 'lucide-react'
import { formatCurrency, format } from '@baileys/utils'

interface PlatformFeeEntryModalProps {
  propertyId: string
  propertyName: string
  month?: string
  existingData?: any
}

export const PlatformFeeEntryModal = ({ 
  propertyId, 
  propertyName,
  month: initialMonth,
  existingData
}: PlatformFeeEntryModalProps) => {
  const { closeModal } = useModal()
  const { addToast } = useToast()
  const { showTips } = useTips()
  
  const { data: platformsResponse } = useSWR(
    propertyId ? `/tax/platforms?propertyId=${propertyId}` : null,
    async () => {
      const result = await api.getPropertyPlatforms(propertyId)
      if (!result.success) throw new Error(result.error)
      return result.data?.data || result.data || []
    }
  )
  
  const platforms = platformsResponse || []
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<any>({
    propertyId,
    platform: existingData?.platform || 'Airbnb',
    month: existingData?.month || initialMonth || format(new Date(), 'yyyy-MM'),
    feeAmount: existingData?.feeAmount || 0,
    platformTaxRemitted: existingData?.platformTaxRemitted || 0,
    notes: existingData?.notes || ''
  })

  const totalFees = formData.feeAmount || 0

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    
    try {
      setIsSubmitting(true)
      
      if (!formData.platform || !formData.month) {
        addToast('error', 'Please fill in all required fields')
        return
      }

      const result = await api.savePlatformFee(formData)
      
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
      title="Enter Platform Fees"
      subtitle={`${propertyName} - ${formData.month}`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Booking Platform
          </label>
          <select
            value={formData.platform}
            onChange={(e) => setFormData(prev => ({ ...prev, platform: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Select a platform</option>
            {platforms.map(platform => (
              <option key={platform} value={platform}>{platform}</option>
            ))}
          </select>
          {platforms.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">
              No platforms found. Import bookings for this property first.
            </p>
          )}
        </div>

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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Platform Service Fee
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.feeAmount || ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                feeAmount: parseFloat(e.target.value) || 0 
              }))}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
              required
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">From your monthly platform statement</p>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center mb-3">
            <Calculator className="w-4 h-4 text-gray-600 mr-2" />
            <span className="font-medium text-gray-700">Tax Already Remitted by Platform</span>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tax Amount Platform Remitted
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
            <p className="text-xs text-gray-500 mt-1">
              Only enter an amount if the platform remitted taxes on these fees directly to the government
            </p>
          </div>
        </div>

        {totalFees > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Fee Summary</h4>
            <div className="space-y-1 text-sm text-blue-800">
              <div className="flex justify-between">
                <span>Platform Fees:</span>
                <span className="font-medium">{formatCurrency(totalFees)}</span>
              </div>
              {formData.platformTaxRemitted > 0 && (
                <div className="flex justify-between">
                  <span>Platform Tax Remitted:</span>
                  <span className="font-medium">{formatCurrency(formData.platformTaxRemitted)}</span>
                </div>
              )}
              {formData.platformTaxRemitted > 0 && (
                <p className="text-xs text-blue-700 mt-2">
                  This tax amount will be excluded from your tax liability calculations
                </p>
              )}
            </div>
          </div>
        )}

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