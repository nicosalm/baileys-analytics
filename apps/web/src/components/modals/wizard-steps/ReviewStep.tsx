import { Check, Home, MapPin, Calculator, Globe, Calendar, AlertCircle } from 'lucide-react'
import { format } from '@baileys/utils'

interface ReviewStepProps {
  wizardData: {
    propertyId: string
    propertyName: string
    propertyAddress?: string
    configName: string
    jurisdictions: Array<{
      name: string
      rate: number
      description?: string
    }>
    platformSettings: Record<string, { remitsTax: boolean }>
    effectiveFrom: string
  }
  totalRate: number
  isEditMode?: boolean
}

export const ReviewStep = ({ wizardData, totalRate, isEditMode }: ReviewStepProps) => {
  
  return (
    <div className="space-y-6">
      {/* Success Banner */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="p-2 bg-green-100 rounded-full mr-3">
            <Check className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="font-medium text-green-900">
              {isEditMode ? 'Configuration Updated' : 'Configuration Complete!'}
            </p>
            <p className="text-sm text-green-800 mt-1">
              Review your tax settings below. You can save this configuration or go back to make changes.
            </p>
          </div>
        </div>
      </div>
      
      {/* Property Information */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h3 className="font-medium text-gray-900 mb-3 flex items-center">
          <Home className="w-4 h-4 mr-2" />
          Property
        </h3>
        <div className="space-y-2">
          <p className="text-sm">
            <span className="text-gray-600">Name:</span>{' '}
            <span className="font-medium">{wizardData.propertyName}</span>
          </p>
          {wizardData.propertyAddress && (
            <p className="text-sm flex items-center">
              <MapPin className="w-3 h-3 mr-1 text-gray-400" />
              <span className="text-gray-600">{wizardData.propertyAddress}</span>
            </p>
          )}
          <p className="text-sm">
            <span className="text-gray-600">Config Name:</span>{' '}
            <span className="font-medium">
              {wizardData.configName || `Tax Config - ${wizardData.propertyName}`}
            </span>
          </p>
        </div>
      </div>
      
      {/* Tax Jurisdictions */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h3 className="font-medium text-gray-900 mb-3 flex items-center">
          <Calculator className="w-4 h-4 mr-2" />
          Tax Jurisdictions
        </h3>
        <div className="space-y-2">
          {wizardData.jurisdictions.map((jurisdiction, index) => (
            <div key={index} className="flex justify-between items-center py-2 border-b last:border-0">
              <div>
                <p className="text-sm font-medium">{jurisdiction.name}</p>
                {jurisdiction.description && (
                  <p className="text-xs text-gray-500">{jurisdiction.description}</p>
                )}
              </div>
              <span className="font-medium text-sm">{jurisdiction.rate}%</span>
            </div>
          ))}
          <div className="pt-2 mt-2 border-t">
            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-900">Total Tax Rate</span>
              <span className="text-lg font-bold text-green-600">{totalRate.toFixed(2)}%</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Platform Settings */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h3 className="font-medium text-gray-900 mb-3 flex items-center">
          <Globe className="w-4 h-4 mr-2" />
          Platform Settings
        </h3>
        
        <div className="space-y-2">
          {Object.entries(wizardData.platformSettings).length > 0 ? (
            Object.entries(wizardData.platformSettings).map(([platform, settings]) => {
              // Map platform keys to display names
              const displayNames: Record<string, string> = {
                'airbnb': 'Airbnb',
                'vrbo': 'VRBO',
                'bookingcom': 'Booking.com',
                'direct': 'Direct Bookings',
                'whimstay': 'Whimstay',
                'rentalz': 'Rentalz'
              }
              const displayName = displayNames[platform] || platform
              
              return (
                <div key={platform} className="flex justify-between items-center py-2 border-b last:border-0">
                  <span className="text-sm">{displayName}</span>
                  {settings.remitsTax ? (
                    <span className="text-green-600 font-medium text-sm">Remits taxes</span>
                  ) : (
                    <span className="text-gray-500 text-sm">Does not remit</span>
                  )}
                </div>
              )
            })
          ) : (
            <p className="text-sm text-gray-500">No platform settings configured</p>
          )}
        </div>
      </div>
      
      {/* Effective Date */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h3 className="font-medium text-gray-900 mb-3 flex items-center">
          <Calendar className="w-4 h-4 mr-2" />
          Effective Date
        </h3>
        <p className="text-sm">
          This configuration will be active from:{' '}
          <span className="font-medium">
            {format(new Date(wizardData.effectiveFrom), 'MMMM d, yyyy')}
          </span>
        </p>
      </div>
      
      {/* Final Note */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <strong>Important:</strong> Remember to update your platform fee information monthly 
            for accurate tax calculations. You can do this from the Tax Management panel in Settings.
          </div>
        </div>
      </div>
    </div>
  )
}