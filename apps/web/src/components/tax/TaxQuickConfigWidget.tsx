import { useState } from 'react'
import { usePropertyTaxStatus } from '@/hooks/use-api'
import { useModal } from '@/contexts/modal'
import { useNavigate } from 'react-router-dom'
import { 
  Calculator, 
  ChevronRight, 
  Settings, 
  AlertCircle,
  Check,
  Plus
} from 'lucide-react'

export const TaxQuickConfigWidget = () => {
  const { data: taxStatusData, isLoading } = usePropertyTaxStatus()
  const { openModal } = useModal()
  const navigate = useNavigate()
  const [isExpanded, setIsExpanded] = useState(false)
  
  const taxStatus = Array.isArray(taxStatusData) ? taxStatusData : []
  
  const totalProperties = taxStatus.length
  const configuredProperties = taxStatus.filter((p: any) => p.hasConfig).length
  const missingConfigs = taxStatus.filter((p: any) => !p.hasConfig)
  const missingFees = taxStatus.filter((p: any) => p.missingMonths?.length > 0)
  
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
            onClick={() => navigate('/settings?tab=tax')}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Manage
            <ChevronRight className="w-3 h-3 inline ml-0.5" />
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
              {missingConfigs.length}
            </p>
          </div>
        </div>
        
        {/* Action Buttons */}
        {missingConfigs.length > 0 ? (
          <button
            onClick={() => {
              const firstMissing = missingConfigs[0]
              openModal({
                type: 'tax-config-wizard',
                defaultPropertyId: firstMissing.propertyId
              })
            }}
            className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded-sm hover:bg-blue-700 transition-colors flex items-center justify-center"
          >
            <Settings className="w-4 h-4 mr-2" />
            Configure {missingConfigs[0].propertyName.substring(0, 20)}
            {missingConfigs[0].propertyName.length > 20 && '...'}
          </button>
        ) : missingFees.length > 0 ? (
          <button
            onClick={() => navigate('/settings?tab=tax')}
            className="w-full px-3 py-2 bg-yellow-600 text-white text-sm rounded-sm hover:bg-yellow-700 transition-colors flex items-center justify-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Platform Fees
          </button>
        ) : (
          <div className="flex items-center justify-center py-2 text-green-600 bg-green-50 rounded-sm">
            <Check className="w-4 h-4 mr-1" />
            <span className="text-sm font-medium">All Configured!</span>
          </div>
        )}
        
        {/* Expandable Property List */}
        {missingConfigs.length > 1 && (
          <>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full text-center text-xs text-gray-500 hover:text-gray-700 mt-2"
            >
              {isExpanded ? 'Hide' : 'Show'} {missingConfigs.length - 1} more properties needing configuration
            </button>
            
            {isExpanded && (
              <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                {missingConfigs.slice(1).map((property: any) => (
                  <button
                    key={property.propertyId}
                    onClick={() => openModal({
                      type: 'tax-config-wizard',
                      defaultPropertyId: property.propertyId
                    })}
                    className="w-full text-left px-2 py-1 text-xs bg-gray-50 hover:bg-gray-100 rounded-sm transition-colors flex items-center justify-between"
                  >
                    <span className="truncate">{property.propertyName}</span>
                    <ChevronRight className="w-3 h-3 text-gray-400" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        
        {/* Platform Fees Reminder */}
        {missingFees.length > 0 && missingConfigs.length === 0 && (
          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-sm">
            <div className="flex items-start">
              <AlertCircle className="w-4 h-4 text-yellow-600 mr-2 mt-0.5" />
              <div className="text-xs text-yellow-800">
                <p className="font-medium">Platform fees missing</p>
                <p className="mt-0.5">
                  {missingFees.length} {missingFees.length === 1 ? 'property needs' : 'properties need'} fee data
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}