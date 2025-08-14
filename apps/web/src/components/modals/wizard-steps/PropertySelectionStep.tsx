import { Home, MapPin, Check, AlertCircle } from 'lucide-react'

interface PropertySelectionStepProps {
  properties: any[]
  selectedPropertyId: string
  onSelect: (propertyId: string) => void
  isEditMode?: boolean
}

export const PropertySelectionStep = ({ 
  properties, 
  selectedPropertyId, 
  onSelect,
  isEditMode 
}: PropertySelectionStepProps) => {
  
  if (isEditMode && selectedPropertyId) {
    const property = properties.find(p => p.id === selectedPropertyId)
    return (
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
            <div className="text-sm text-blue-800">
              You're editing the tax configuration for the property below. The property cannot be changed.
            </div>
          </div>
        </div>
        
        <div className="p-4 bg-gray-50 rounded-lg border-2 border-gray-300">
          <div className="flex items-start">
            <div className="p-2 bg-white rounded-lg mr-3">
              <Home className="w-6 h-6 text-gray-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{property?.name}</p>
              {property?.address && (
                <p className="text-sm text-gray-600 mt-1 flex items-center">
                  <MapPin className="w-3 h-3 mr-1" />
                  {property.address}
                </p>
              )}
            </div>
            <Check className="w-5 h-5 text-green-500" />
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
          <div className="text-sm text-blue-800">
            <strong>Step 1:</strong> Select the property you want to configure tax settings for. 
            Each property can have its own tax configuration based on local requirements.
          </div>
        </div>
      </div>
      
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-700">Your Properties</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {properties.map((property) => {
            const isSelected = selectedPropertyId === property.id
            
            return (
              <button
                key={property.id}
                onClick={() => onSelect(property.id)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  isSelected 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start">
                  <div className={`p-2 rounded-lg mr-3 ${
                    isSelected ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    <Home className={`w-5 h-5 ${
                      isSelected ? 'text-blue-600' : 'text-gray-600'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${
                      isSelected ? 'text-blue-900' : 'text-gray-900'
                    }`}>
                      {property.name}
                    </p>
                    {property.address && (
                      <p className="text-sm text-gray-600 mt-1 flex items-center">
                        <MapPin className="w-3 h-3 mr-1" />
                        {property.address}
                      </p>
                    )}
                  </div>
                  {isSelected && (
                    <div className="p-1 bg-blue-600 rounded-full">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
      
      {!selectedPropertyId && properties.length > 0 && (
        <div className="text-center py-4 text-sm text-gray-500">
          Please select a property to continue
        </div>
      )}
    </div>
  )
}