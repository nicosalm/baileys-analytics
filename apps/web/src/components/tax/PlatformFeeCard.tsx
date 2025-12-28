import { useState } from 'react'
import { DollarSign, Plus, AlertCircle, Edit2, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react'
import { formatCurrency, format } from '@baileys/utils'
import { usePlatformFees } from '@/hooks/use-api'
import { StateWrapper } from '@/components/StateWrapper'
import { useModal } from '@/contexts/modal'

const formatMonth = (month: string): string => {
  if (!month || month.length < 7) return ''
  
  const [year, monthNum] = month.split('-')
  const date = new Date(parseInt(year), parseInt(monthNum) - 1)
  return format(date, 'MMMM yyyy')
}

const getCurrentMonth = (): string => {
  return format(new Date(), 'yyyy-MM')
}

interface PlatformFeeCardProps {
  propertyId: string
  propertyName: string
  month?: string
}

export const PlatformFeeCard = ({ 
  propertyId, 
  propertyName,
  month = getCurrentMonth() 
}: PlatformFeeCardProps) => {
  const { openModal } = useModal()
  const { data: platformFees, error, isLoading } = usePlatformFees(propertyId, month)
  const [isExpanded, setIsExpanded] = useState(false)
  
  const fees = Array.isArray(platformFees) ? platformFees : []
  
  const totals = fees.reduce(
    (acc: any, fee: any) => ({
      guestFees: acc.guestFees + (parseFloat(fee.guestServiceFee) || 0),
      hostFees: acc.hostFees + (parseFloat(fee.hostServiceFee) || 0),
      platformTax: acc.platformTax + (parseFloat(fee.platformTaxRemitted) || 0)
    }),
    { guestFees: 0, hostFees: 0, platformTax: 0 }
  )
  
  const totalFees = totals.guestFees + totals.hostFees
  const hasData = fees.length > 0
  
  const handleAddFees = () => {
    openModal({
      type: 'platform-fee-entry',
      propertyId,
      propertyName,
      month
    })
  }
  
  const handleEditFee = (platform: string) => {
    const fee = fees.find((f: any) => f.platform === platform)
    openModal({
      type: 'platform-fee-entry',
      propertyId,
      propertyName,
      month,
      existingData: fee
    })
  }
  
  return (
    <StateWrapper
      loading={isLoading}
      error={error}
      empty={!hasData && !isLoading}
      emptyMessage="No platform fees recorded"
      emptyIcon={
        <button
          onClick={handleAddFees}
          className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
        >
          Add platform fees
        </button>
      }
      minHeight={120}
    >
      <div className={`bg-white p-4 rounded-lg shadow-sm border transition-colors ${
        hasData ? 'border-green-200 bg-green-50/30' : 'border-gray-200'
      }`}>
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Platform Fees - {formatMonth(month)}
              {hasData && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Configured
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-600 mt-1">{propertyName}</p>
          </div>
          <button
            onClick={handleAddFees}
            className={`p-1 rounded transition-colors ${
              hasData
                ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
            }`}
            title={hasData ? 'Add another platform' : 'Add platform fees'}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        
        {hasData ? (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <p className="text-xs text-gray-500">Guest Fees</p>
                <p className="font-semibold text-gray-900">
                  {formatCurrency(totals.guestFees)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Host Fees</p>
                <p className="font-semibold text-gray-900">
                  {formatCurrency(totals.hostFees)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Platform Tax</p>
                <p className="font-semibold text-green-600">
                  {formatCurrency(totals.platformTax)}
                </p>
              </div>
            </div>
            
            {/* Platform breakdown (collapsible) */}
            <div className="border-t pt-3">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full text-left text-sm text-gray-600 hover:text-gray-900 font-medium flex items-center"
              >
                {isExpanded ? 'Hide' : 'Show'} platform breakdown
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 ml-1" />
                ) : (
                  <ChevronDown className="w-4 h-4 ml-1" />
                )}
              </button>
              
              {isExpanded && (
                <div className="mt-3 space-y-2">
                  {fees.map((fee: any) => (
                    <div 
                      key={fee.platform}
                      className="flex justify-between items-center p-2 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center">
                        <span className="font-medium text-sm capitalize">
                          {fee.platform}
                        </span>
                        {fee.platformRemitsTax && (
                          <span className="ml-2 px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                            Remits tax
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {formatCurrency(fee.guestServiceFee + fee.hostServiceFee)}
                          </p>
                          {fee.platformTaxRemitted > 0 && (
                            <p className="text-xs text-green-600">
                              Tax: {formatCurrency(fee.platformTaxRemitted)}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleEditFee(fee.platform)}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Warning if fees affect tax calculation */}
            {totalFees > 0 && (
              <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start">
                  <AlertCircle className="w-4 h-4 text-yellow-600 mr-2 mt-0.5" />
                  <div className="text-xs text-yellow-800">
                    <p className="font-medium">Tax Impact</p>
                    <p className="mt-0.5">
                      Platform fees of {formatCurrency(totalFees)} are included in tax calculations.
                      {totals.platformTax > 0 && (
                        <span> Platforms will remit {formatCurrency(totals.platformTax)} directly.</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="py-4 text-center">
            <AlertCircle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600">No platform fees entered</p>
            <button
              onClick={handleAddFees}
              className="mt-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:opacity-90 cursor-pointer"
            >
              Add Fees
            </button>
          </div>
        )}
      </div>
    </StateWrapper>
  )
}