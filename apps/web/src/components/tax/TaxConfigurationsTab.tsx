import React, { useState } from 'react'
import { PropertyTaxConfig } from '@/hooks/useTaxManagement'
import { 
  Plus, Edit2, Trash2, ChevronDown, ChevronUp,
  Calendar, MapPin, AlertCircle, Check, Settings
} from 'lucide-react'
import { formatPercentage } from '@/utils/formatters'

interface TaxConfigurationsTabProps {
  configsByProperty: Record<string, PropertyTaxConfig[]>
  properties: any[]
  selectedProperty: string
  onSelectProperty: (propertyId: string) => void
  onEditConfig: (config: PropertyTaxConfig) => void
  onDeleteConfig: (configId: string) => void
  onToggleActive: (configId: string, isActive: boolean) => void
  onCreateConfig: (propertyId?: string) => void
}

export const TaxConfigurationsTab: React.FC<TaxConfigurationsTabProps> = ({
  configsByProperty,
  properties,
  selectedProperty,
  onSelectProperty,
  onEditConfig,
  onDeleteConfig,
  onToggleActive,
  onCreateConfig
}) => {
  const [expandedConfigs, setExpandedConfigs] = useState<Set<string>>(new Set())
  const [deletingConfig, setDeletingConfig] = useState<string | null>(null)
  
  const toggleExpanded = (configId: string) => {
    setExpandedConfigs(prev => {
      const next = new Set(prev)
      if (next.has(configId)) {
        next.delete(configId)
      } else {
        next.add(configId)
      }
      return next
    })
  }
  
  const handleDelete = async (configId: string) => {
    setDeletingConfig(configId)
    await onDeleteConfig(configId)
    setDeletingConfig(null)
  }
  
  const selectedConfigs = selectedProperty ? configsByProperty[selectedProperty] || [] : []
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Property:</label>
          <select
            value={selectedProperty}
            onChange={(e) => onSelectProperty(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Properties</option>
            {properties.map((property: any) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        </div>
        
        <button
          onClick={() => onCreateConfig(selectedProperty)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Configuration
        </button>
      </div>
      
      {selectedProperty && selectedConfigs.length === 0 && (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <Settings className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Tax Configurations
          </h3>
          <p className="text-gray-600 mb-4">
            This property doesn't have any tax configurations yet.
          </p>
          <button
            onClick={() => onCreateConfig(selectedProperty)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create First Configuration
          </button>
        </div>
      )}
      
      {selectedConfigs.map((config) => {
        const isExpanded = expandedConfigs.has(config.id)
        const totalRate = config.jurisdictions.reduce((sum, j) => sum + j.rate, 0)
        
        return (
          <div key={config.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">{config.configName}</h3>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      config.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {config.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                    <span className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      From {new Date(config.effectiveFrom).toLocaleDateString()}
                    </span>
                    <span className="flex items-center">
                      <MapPin className="w-4 h-4 mr-1" />
                      {config.jurisdictions.length} jurisdiction{config.jurisdictions.length !== 1 ? 's' : ''}
                    </span>
                    <span className="font-medium">
                      Total Rate: {formatPercentage(totalRate, 2)}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onToggleActive(config.id, !config.isActive)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    title={config.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {config.isActive ? <AlertCircle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => onEditConfig(config)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(config.id)}
                    disabled={deletingConfig === config.id}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => toggleExpanded(config.id)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Jurisdictions</h4>
                      <div className="space-y-2">
                        {config.jurisdictions.map((j, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span className="capitalize">{j.type}: {j.name}</span>
                            <span className="font-medium">{formatPercentage(j.rate, 2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Platform Settings</h4>
                      <div className="space-y-2 text-sm">
                        {config.platformSettings.airbnb && (
                          <div className="flex items-center justify-between">
                            <span>Airbnb</span>
                            <span className={config.platformSettings.airbnb.remitsTax ? 'text-green-600' : 'text-gray-600'}>
                              {config.platformSettings.airbnb.remitsTax ? 'Remits Tax' : 'Owner Remits'}
                            </span>
                          </div>
                        )}
                        {config.platformSettings.vrbo && (
                          <div className="flex items-center justify-between">
                            <span>VRBO</span>
                            <span className={config.platformSettings.vrbo.remitsTax ? 'text-green-600' : 'text-gray-600'}>
                              {config.platformSettings.vrbo.remitsTax ? 'Remits Tax' : 'Owner Remits'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {config.taxableItems.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Taxable Items</h4>
                      <div className="flex flex-wrap gap-2">
                        {config.taxableItems.map((item, idx) => (
                          <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}