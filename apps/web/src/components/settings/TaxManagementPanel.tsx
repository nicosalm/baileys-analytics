import { useState } from 'react'
import { useModal } from '@/contexts/modal'
import { useToast } from '@/contexts/toast'
import { useTaxManagement } from '@/hooks/useTaxManagement'
import { TaxOverviewTab } from '@/components/tax/TaxOverviewTab'
import { TaxConfigurationsTab } from '@/components/tax/TaxConfigurationsTab'
import { PlatformFeeCard } from '@/components/tax/PlatformFeeCard'
import { StateWrapper } from '@/components/StateWrapper'
import { format } from '@baileys/utils'

type TabType = 'overview' | 'configurations' | 'platform-fees'

const TAB_CONFIG = [
  { id: 'overview' as TabType, label: 'Overview' },
  { id: 'configurations' as TabType, label: 'Configurations' },
  { id: 'platform-fees' as TabType, label: 'Platform Fees' }
]

export const TaxManagementPanel = () => {
  const { openModal } = useModal()
  const { addToast } = useToast()
  const {
    properties,
    configsByProperty,
    statistics,
    selectedProperty,
    setSelectedProperty,
    deleteConfig,
    toggleConfigActive,
    isLoading
  } = useTaxManagement()
  
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  
  const handleCreateConfig = (propertyId?: string) => {
    openModal({
      type: 'tax-config-wizard',
      defaultPropertyId: propertyId || selectedProperty || undefined
    })
  }
  
  const handleEditConfig = (config: any) => {
    openModal({
      type: 'tax-config-wizard',
      defaultPropertyId: config.propertyId,
      existingConfig: config
    })
  }
  
  const handleDeleteConfig = async (configId: string) => {
    const result = await deleteConfig(configId)
    if (result.success) {
      addToast('success', 'Tax configuration deleted successfully')
    } else {
      addToast('error', result.error || 'Failed to delete configuration')
    }
  }
  
  const handleToggleActive = async (configId: string, isActive: boolean) => {
    const result = await toggleConfigActive(configId, isActive)
    if (result.success) {
      addToast('success', `Configuration ${isActive ? 'activated' : 'deactivated'}`)
    } else {
      addToast('error', result.error || 'Failed to update configuration')
    }
  }
  
  const handleConfigureProperty = (propertyId: string) => {
    setSelectedProperty(propertyId)
    setActiveTab('configurations')
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Tax Management</h2>
          <p className="text-gray-600 mt-1">
            Configure tax rates, jurisdictions, and platform settings for your properties
          </p>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex border-b border-gray-200">
          {TAB_CONFIG.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        <div className="p-6">
          <StateWrapper
            loading={isLoading}
            empty={!properties.length && !isLoading}
            loadingMessage="Loading tax configurations..."
            emptyMessage="No properties found. Add properties to configure taxes."
            minHeight={400}
          >
            {activeTab === 'overview' && (
              <TaxOverviewTab
                statistics={statistics}
                configsByProperty={configsByProperty}
                properties={properties}
                onConfigureProperty={handleConfigureProperty}
              />
            )}
            
            {activeTab === 'configurations' && (
              <TaxConfigurationsTab
                configsByProperty={configsByProperty}
                properties={properties}
                selectedProperty={selectedProperty}
                onSelectProperty={setSelectedProperty}
                onEditConfig={handleEditConfig}
                onDeleteConfig={handleDeleteConfig}
                onToggleActive={handleToggleActive}
                onCreateConfig={handleCreateConfig}
              />
            )}
            
            {activeTab === 'platform-fees' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">Platform Fee Management</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Track and manage platform-specific fees for accurate financial reporting
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                {selectedProperty ? (
                  <PlatformFeeCard
                    propertyId={selectedProperty}
                    propertyName={properties.find(p => p.id === selectedProperty)?.name || ''}
                    month={selectedMonth}
                  />
                ) : (
                  <div className="grid gap-4">
                    {properties.map((property: any) => (
                      <PlatformFeeCard
                        key={property.id}
                        propertyId={property.id}
                        propertyName={property.name}
                        month={selectedMonth}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </StateWrapper>
        </div>
      </div>
    </div>
  )
}