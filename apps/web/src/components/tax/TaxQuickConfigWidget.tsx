import { usePropertyTaxStatus } from '@/hooks/use-api'
import { useNavigate } from 'react-router-dom'
import {
  Calculator,
  AlertCircle,
  Check,
  Plus
} from 'lucide-react'

export const TaxQuickConfigWidget = () => {
  const { data: taxStatusData, isLoading } = usePropertyTaxStatus()
  const navigate = useNavigate()
  
  const taxStatus = Array.isArray(taxStatusData) ? taxStatusData : []
  
  const totalProperties = taxStatus.length
  const configuredProperties = taxStatus.filter((p: any) => p.hasConfig).length
  const missingConfigs = taxStatus.filter((p: any) => !p.hasConfig)
  const missingFees = taxStatus.filter((p: any) => p.feeStatus === 'none')
  const partialFees = taxStatus.filter((p: any) => p.feeStatus === 'partial')
  
  const completionPercentage = totalProperties > 0 
    ? Math.round((configuredProperties / totalProperties) * 100)
    : 0
  
  const getStatusColor = () => {
    if (completionPercentage === 100) return 'green'
    if (completionPercentage >= 75) return 'blue'
    if (completionPercentage >= 50) return 'yellow'
    return 'red'
  }
  
  const statusColor = getStatusColor()
  
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center">
            <Calculator className="w-5 h-5 text-gray-600 mr-2" />
            <h3 className="font-semibold text-gray-900">Tax Configuration</h3>
          </div>
          <button
            onClick={() => navigate('/settings?tab=platform-fees')}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Manage →
          </button>
        </div>
        
        {/* Progress Bar */}
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-gray-600">Setup Progress</span>
            <span className={`text-sm font-medium
              ${statusColor === 'green' ? 'text-green-600' : ''}
              ${statusColor === 'blue' ? 'text-blue-600' : ''}
              ${statusColor === 'yellow' ? 'text-yellow-600' : ''}
              ${statusColor === 'red' ? 'text-red-600' : ''}
            `}>
              {completionPercentage}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-500
                ${statusColor === 'green' ? 'bg-green-500' : ''}
                ${statusColor === 'blue' ? 'bg-blue-500' : ''}
                ${statusColor === 'yellow' ? 'bg-yellow-500' : ''}
                ${statusColor === 'red' ? 'bg-red-500' : ''}
              `}
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-gray-50 rounded-sm p-2">
            <p className="text-xs text-gray-600">Properties</p>
            <p className="text-lg font-semibold text-gray-900">
              {configuredProperties}/{totalProperties}
            </p>
          </div>
          <div className="bg-gray-50 rounded-sm p-2">
            <p className="text-xs text-gray-600">Needs Action</p>
            <p className="text-lg font-semibold text-yellow-600">
              {missingConfigs.length + missingFees.length + partialFees.length}
            </p>
          </div>
        </div>
        
        {/* Action Buttons */}
        {missingFees.length > 0 || partialFees.length > 0 ? (
          <button
            onClick={() => navigate('/settings?tab=platform-fees')}
            className="w-full px-3 py-2 bg-yellow-600 text-white text-sm rounded-sm hover:bg-yellow-700 transition-colors flex items-center justify-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            {missingFees.length > 0 ? 'Add Platform Fees' : 'Complete Fee Data'}
          </button>
        ) : (
          <div className="flex items-center justify-center py-2 text-green-600 bg-green-50 rounded-sm">
            <Check className="w-4 h-4 mr-1" />
            <span className="text-sm font-medium">All Configured!</span>
          </div>
        )}
        
        
        {/* Platform Fees Reminder */}
        {(missingFees.length > 0 || partialFees.length > 0) && missingConfigs.length === 0 && (
          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-sm">
            <div className="flex items-start">
              <AlertCircle className="w-4 h-4 text-yellow-600 mr-2 mt-0.5" />
              <div className="text-xs text-yellow-800">
                {missingFees.length > 0 && (
                  <>
                    <p className="font-medium">Platform fees missing</p>
                    <p className="mt-0.5">
                      {missingFees.length} {missingFees.length === 1 ? 'property needs' : 'properties need'} fee data
                    </p>
                  </>
                )}
                {partialFees.length > 0 && (
                  <>
                    <p className="font-medium">{missingFees.length > 0 ? 'Also: ' : ''}Incomplete fee data</p>
                    <p className="mt-0.5">
                      {partialFees.length} {partialFees.length === 1 ? 'property has' : 'properties have'} missing months
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}