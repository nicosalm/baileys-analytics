import { useState, useEffect } from 'react'
import { useProperties, usePropertyTaxConfigs } from '@/hooks/use-api'
import { useModal } from '@/contexts/modal'
import { useToast } from '@/contexts/toast'
import { format } from 'date-fns'
import { 
  Calculator, 
  Plus, 
  Edit2, 
  Trash2, 
  ChevronDown, 
  ChevronUp,
  MapPin,
  Calendar,
  AlertCircle,
  Check,
  Building2,
  FileText,
  AlertTriangle,
  Info,
  TrendingUp,
  Settings,
  RefreshCw
} from 'lucide-react'
import { LoadingState } from '@/components/LoadingState'
import { StateWrapper } from '@/components/StateWrapper'
import { PlatformFeeCard } from '@/components/tax/PlatformFeeCard'
import { mutate } from 'swr'

interface TaxJurisdiction {
  name: string
  type: 'state' | 'county' | 'city' | 'district' | 'other'
  rate: number
  description?: string
}

interface PropertyTaxConfig {
  id: string
  propertyId: string
  propertyName: string
  configName: string
  jurisdictions: TaxJurisdiction[]
  taxableItems: string[]
  platformSettings: {
    airbnb?: { remitsTax: boolean }
    vrbo?: { remitsTax: boolean }
  }
  effectiveFrom: string
  effectiveTo?: string
  isActive: boolean
  lastUpdated: string
}

type TabType = 'overview' | 'configurations' | 'platform-fees'

export const TaxManagementPanel = () => {
  const { data: propertiesData, isLoading: propertiesLoading } = useProperties()
  const { data: configsData, isLoading: configsLoading } = usePropertyTaxConfigs()
  const { openModal } = useModal()
  const { addToast } = useToast()
  
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [selectedProperty, setSelectedProperty] = useState<string>(() => 
    localStorage.getItem('taxManagement.selectedProperty') || ''
  )
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [expandedConfigs, setExpandedConfigs] = useState<Set<string>>(new Set())
  const [deletingConfig, setDeletingConfig] = useState<string | null>(null)
  
  const isLoading = propertiesLoading || configsLoading
  
  const properties = Array.isArray(propertiesData) ? propertiesData : []
  const configs = Array.isArray(configsData) ? configsData : []
  
  useEffect(() => {
    if (selectedProperty) {
      localStorage.setItem('taxManagement.selectedProperty', selectedProperty)
    }
  }, [selectedProperty])
  const configsByProperty = configs.reduce((acc: Record<string, PropertyTaxConfig[]>, config: any) => {
    const propertyId = config.propertyId
    if (!acc[propertyId]) acc[propertyId] = []
    const property = Array.isArray(properties) ? properties.find((p: any) => p.id === propertyId) : null
    acc[propertyId].push({
      id: config.id,
      propertyId: config.propertyId,
      propertyName: property?.name || 'Unknown Property',
      configName: config.configName || config.config_name,
      jurisdictions: config.jurisdictions || [],
      taxableItems: config.taxableItems || config.taxable_items || [],
      platformSettings: config.platformSettings || config.platform_settings || {},
      effectiveFrom: config.effectiveFrom || config.effective_from,
      effectiveTo: config.effectiveTo || config.effective_to,
      isActive: config.isActive !== undefined ? config.isActive : config.is_active,
      lastUpdated: config.updatedAt || config.updated_at || config.createdAt || config.created_at
    })
    return acc
  }, {}) || {}
  
  const toggleExpanded = (configId: string) => {
    const newExpanded = new Set(expandedConfigs)
    if (newExpanded.has(configId)) newExpanded.delete(configId)
    else newExpanded.add(configId)
    setExpandedConfigs(newExpanded)
  }
  
  const handleEdit = (config: PropertyTaxConfig) => {
    openModal({
      type: 'tax-config-wizard',
      defaultPropertyId: config.propertyId,
      existingConfig: config
    })
  }
  
  const handleDelete = async (configId: string) => {
    if (!confirm('Are you sure you want to delete this tax configuration? This action cannot be undone.')) {
      return
    }
    
    setDeletingConfig(configId)
    try {
      const { api } = await import('@/lib/api')
      const result = await api.deletePropertyTaxConfig(configId)
      
      if (result.success) {
        addToast('success', 'Tax configuration deleted')
        mutate('/property-tax-configs')
      } else {
        addToast('error', result.error || 'Failed to delete configuration')
      }
    } catch (error) {
      addToast('error', 'Failed to delete configuration')
    } finally {
      setDeletingConfig(null)
    }
  }
  
  const handleSetActive = async (configId: string, propertyId: string) => {
    try {
      const { api } = await import('@/lib/api')
      const otherConfigs = configs.filter((c: any) => c.propertyId === propertyId && c.id !== configId)
      for (const config of otherConfigs) {
        if (config.isActive) await api.updatePropertyTaxConfig(config.id, { ...config, isActive: false })
      }
      const configToActivate = configs.find((c: any) => c.id === configId)
      if (configToActivate) {
        const result = await api.updatePropertyTaxConfig(configId, { ...configToActivate, isActive: true })
        if (result.success) {
          addToast('success', 'Configuration set as active')
          mutate('/property-tax-configs')
          mutate('/property-tax-status')
        } else {
          addToast('error', 'Failed to activate configuration')
        }
      }
    } catch (error) {
      addToast('error', 'Failed to set active configuration')
    }
  }
  
  const handleAddConfig = (propertyId?: string) => {
    openModal({
      type: 'tax-config-wizard',
      defaultPropertyId: propertyId
    })
  }
  
  const calculateTotalRate = (jurisdictions: TaxJurisdiction[]) => {
    return jurisdictions.reduce((sum, j) => sum + j.rate, 0)
  }
  
  const getPropertyStatus = (propertyId: string) => {
    const propertyConfigs = configsByProperty[propertyId] || []
    const activeConfig = propertyConfigs.find((c: PropertyTaxConfig) => c.isActive)
    if (!activeConfig) return { status: 'missing', label: 'Not Configured', color: 'red', icon: 'alert', description: 'Tax configuration required' }
    const totalRate = calculateTotalRate(activeConfig.jurisdictions)
    if (totalRate === 0) return { status: 'incomplete', label: 'Incomplete Setup', color: 'yellow', icon: 'warning', description: 'Add tax rates to complete' }
    const hasPlatformFees = false
    if (!hasPlatformFees) return { status: 'active-partial', label: `${totalRate.toFixed(2)}% Active`, color: 'blue', icon: 'info', description: 'Add platform fees for accuracy' }
    return { status: 'active', label: `${totalRate.toFixed(2)}% Active`, color: 'green', icon: 'check', description: 'Fully configured' }
  }
  
  const totalProperties = properties.length
  const configuredProperties = properties.filter((p: any) => configsByProperty[p.id]?.some((c: PropertyTaxConfig) => c.isActive)).length
  const missingConfigs = totalProperties - configuredProperties
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Tax Management</h2>
          <p className="text-sm text-gray-600 mt-1">
            Configure tax rates, manage platform fees, and track remittance requirements
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              mutate('/property-tax-configs')
              mutate('/property-tax-status')
              addToast('info', 'Refreshing tax data...')
            }}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-sm hover:bg-gray-300 flex items-center"
            title="Refresh data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleAddConfig()}
            className="px-4 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Configuration
          </button>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="border-b">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-2 border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('configurations')}
            className={`pb-2 border-b-2 transition-colors ${
              activeTab === 'configurations'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Tax Configurations
          </button>
          <button
            onClick={() => setActiveTab('platform-fees')}
            className={`pb-2 border-b-2 transition-colors ${
              activeTab === 'platform-fees'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Platform Fees
          </button>
        </nav>
      </div>
      
      {/* Tab Content */}
      <StateWrapper
        loading={isLoading}
        error={null}
        empty={properties.length === 0 && !isLoading}
        emptyMessage="No properties found"
        emptyIcon={<Building2 className="w-8 h-8 text-gray-400" />}
        minHeight={400}
      >
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm text-gray-600">Total Properties</p>
                    <p className="text-2xl font-bold text-gray-900">{totalProperties}</p>
                  </div>
                  <Building2 className="w-8 h-8 text-gray-400" />
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: '100%' }} />
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm text-gray-600">Fully Configured</p>
                    <p className="text-2xl font-bold text-green-600">{configuredProperties}</p>
                  </div>
                  <Check className="w-8 h-8 text-green-400" />
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full transition-all duration-500" 
                       style={{ width: `${totalProperties > 0 ? (configuredProperties / totalProperties * 100) : 0}%` }} />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {totalProperties > 0 ? Math.round(configuredProperties / totalProperties * 100) : 0}% complete
                </p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm text-gray-600">Action Required</p>
                    <p className="text-2xl font-bold text-yellow-600">{missingConfigs}</p>
                  </div>
                  <AlertCircle className="w-8 h-8 text-yellow-400" />
                </div>
                {missingConfigs > 0 ? (
                  <button
                    onClick={() => {
                      const firstMissing = properties.find((p: any) => 
                        !configsByProperty[p.id]?.some((c: PropertyTaxConfig) => c.isActive)
                      )
                      if (firstMissing) handleAddConfig(firstMissing.id)
                    }}
                    className="w-full px-3 py-1.5 bg-yellow-600 text-white text-sm rounded-sm hover:bg-yellow-700 transition-colors flex items-center justify-center"
                  >
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Start Configuration
                  </button>
                ) : (
                  <div className="flex items-center justify-center text-green-600">
                    <Check className="w-4 h-4 mr-1" />
                    <span className="text-sm">All configured!</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b">
                <h3 className="font-semibold text-gray-900">Property Tax Status</h3>
              </div>
              <div className="p-4">
                <div className="space-y-3">
                  {properties.map((property: any) => {
                    const status = getPropertyStatus(property.id)
                    return (
                      <div key={property.id} className="flex justify-between items-center py-2">
                        <div>
                          <p className="font-medium text-gray-900">{property.name}</p>
                          {property.address && (
                            <p className="text-sm text-gray-500 flex items-center mt-0.5">
                              <MapPin className="w-3 h-3 mr-1" />
                              {property.address}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="flex flex-col items-end">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium
                              ${status.color === 'green' ? 'bg-green-100 text-green-800 border border-green-200' : ''}
                              ${status.color === 'blue' ? 'bg-blue-100 text-blue-800 border border-blue-200' : ''}
                              ${status.color === 'yellow' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' : ''}
                              ${status.color === 'red' ? 'bg-red-100 text-red-800 border border-red-200' : ''}
                            `}>
                              {status.icon === 'check' && <Check className="w-3 h-3 mr-1" />}
                              {status.icon === 'info' && <Info className="w-3 h-3 mr-1" />}
                              {status.icon === 'warning' && <AlertTriangle className="w-3 h-3 mr-1" />}
                              {status.icon === 'alert' && <AlertCircle className="w-3 h-3 mr-1" />}
                              {status.label}
                            </span>
                            <span className="text-xs text-gray-500 mt-0.5">{status.description}</span>
                          </div>
                          {(status.status === 'missing' || status.status === 'incomplete') && (
                            <button
                              onClick={() => handleAddConfig(property.id)}
                              className="px-3 py-1 bg-blue-600 text-white text-xs rounded-sm hover:bg-blue-700 transition-colors flex items-center"
                            >
                              <Settings className="w-3 h-3 mr-1" />
                              Configure
                            </button>
                          )}
                          {status.status === 'active-partial' && (
                            <button
                              onClick={() => {
                                setActiveTab('platform-fees')
                                setSelectedProperty(property.id)
                              }}
                              className="px-3 py-1 bg-yellow-600 text-white text-xs rounded-sm hover:bg-yellow-700 transition-colors flex items-center"
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Add Fees
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'configurations' && (
          <div className="space-y-4">
            {properties.map((property: any) => {
              const propertyConfigs = configsByProperty[property.id] || []
              const hasActiveConfig = propertyConfigs.some((c: PropertyTaxConfig) => c.isActive)
              
              return (
                <div key={property.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900">{property.name}</h3>
                        {property.address && (
                          <span className="text-sm text-gray-500 flex items-center mt-1">
                            <MapPin className="w-3 h-3 mr-1" />
                            {property.address}
                          </span>
                        )}
                      </div>
                      {!hasActiveConfig && (
                        <button
                          onClick={() => handleAddConfig(property.id)}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded-sm hover:bg-blue-700"
                        >
                          Configure Tax
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {propertyConfigs.length > 0 ? (
                    <div className="p-4 space-y-3">
                      {propertyConfigs.map((config: PropertyTaxConfig) => {
                        const isExpanded = expandedConfigs.has(config.id)
                        const totalRate = calculateTotalRate(config.jurisdictions)
                        
                        return (
                          <div key={config.id} className="border border-gray-200 rounded-lg">
                            <div className={`p-3 ${config.isActive ? 'bg-green-50 border-l-4 border-green-500' : 'bg-gray-50'}`}>
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-center">
                                    <button
                                      onClick={() => toggleExpanded(config.id)}
                                      className="p-1 hover:bg-gray-200 rounded mr-2"
                                    >
                                      {isExpanded ? (
                                        <ChevronUp className="w-4 h-4" />
                                      ) : (
                                        <ChevronDown className="w-4 h-4" />
                                      )}
                                    </button>
                                    <div>
                                      <h4 className="font-medium text-gray-900">
                                        {config.configName}
                                        {config.isActive && (
                                          <span className="ml-2 px-2 py-0.5 bg-green-600 text-white text-xs rounded-full font-semibold">
                                            ACTIVE
                                          </span>
                                        )}
                                      </h4>
                                      <div className="flex items-center text-sm text-gray-600 mt-0.5">
                                        <Calculator className="w-3 h-3 mr-1" />
                                        {totalRate.toFixed(2)}% total rate
                                        {config.effectiveFrom && (
                                          <>
                                            <span className="mx-2">•</span>
                                            <Calendar className="w-3 h-3 mr-1" />
                                            Effective {(() => {
                                              const date = new Date(config.effectiveFrom)
                                              return isNaN(date.getTime()) ? 'Unknown' : format(date, 'MMM d, yyyy')
                                            })()}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  {!config.isActive && (
                                    <button
                                      onClick={() => handleSetActive(config.id, config.propertyId)}
                                      className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                                      title="Set as active configuration"
                                    >
                                      Set Active
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleEdit(config)}
                                    className="p-1 text-gray-600 hover:bg-gray-200 rounded"
                                    title="Edit configuration"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(config.id)}
                                    disabled={deletingConfig === config.id || config.isActive}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                                    title={config.isActive ? "Cannot delete active configuration" : "Delete configuration"}
                                  >
                                    {deletingConfig === config.id ? (
                                      <LoadingState size="sm" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                            
                            {isExpanded && (
                              <div className="p-4 space-y-4">
                                <div>
                                  <h5 className="text-sm font-medium text-gray-700 mb-2">Tax Jurisdictions</h5>
                                  <div className="space-y-1">
                                    {(config.jurisdictions || []).map((jurisdiction: TaxJurisdiction, idx: number) => (
                                      <div key={`jurisdiction-${config.id}-${idx}`} className="flex justify-between items-center py-1">
                                        <div>
                                          <span className="text-sm text-gray-900">{jurisdiction.name}</span>
                                          <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                                            {jurisdiction.type}
                                          </span>
                                          {jurisdiction.description && (
                                            <span className="ml-2 text-xs text-gray-500">
                                              {jurisdiction.description}
                                            </span>
                                          )}
                                        </div>
                                        <span className="font-medium text-sm">{jurisdiction.rate}%</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                
                                <div>
                                  <h5 className="text-sm font-medium text-gray-700 mb-2">Taxable Items</h5>
                                  <div className="flex flex-wrap gap-2">
                                    {(config.taxableItems || []).map((item: string, idx: number) => (
                                      <span key={`taxable-${config.id}-${idx}`} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                                        {item.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                
                                <div>
                                  <h5 className="text-sm font-medium text-gray-700 mb-2">Platform Tax Remittance</h5>
                                  <div className="grid grid-cols-2 gap-2">
                                    {Object.entries(config.platformSettings || {}).map(([platform, settings]: [string, any]) => (
                                      <div key={`platform-${config.id}-${platform}`} className="flex items-center text-sm">
                                        <span className="capitalize">{platform}:</span>
                                        <span className={`ml-2 ${settings.remitsTax ? 'text-green-600' : 'text-gray-500'}`}>
                                          {settings.remitsTax ? 'Remits taxes' : 'Does not remit'}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                
                                {config.lastUpdated && (
                                  <div className="text-xs text-gray-500 pt-2 border-t">
                                    Last updated: {(() => {
                                      const date = new Date(config.lastUpdated)
                                      return isNaN(date.getTime()) ? 'Unknown' : format(date, 'MMM d, yyyy h:mm a')
                                    })()}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-gray-500">
                      No tax configurations for this property
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        
        {activeTab === 'platform-fees' && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Property
                  </label>
                  <select
                    value={selectedProperty}
                    onChange={(e) => setSelectedProperty(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Choose a property...</option>
                    {properties.map((property: any) => (
                      <option key={property.id} value={property.id}>
                        {property.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Month
                  </label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      if (!selectedProperty) {
                        addToast('error', 'Please select a property first')
                        return
                      }
                      openModal({
                        type: 'platform-fee-entry',
                        propertyId: selectedProperty,
                        propertyName: properties.find((p: any) => p.id === selectedProperty)?.name || '',
                        month: selectedMonth
                      })
                    }}
                    disabled={!selectedProperty}
                    className="px-4 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed flex items-center transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Platform Fees
                  </button>
                </div>
              </div>
            </div>
            
            {selectedProperty ? (
              <PlatformFeeCard
                propertyId={selectedProperty}
                propertyName={properties.find((p: any) => p.id === selectedProperty)?.name || ''}
                month={selectedMonth}
              />
            ) : (
              <div className="p-8 text-center text-gray-500">
                Please select a property to configure platform fees
              </div>
            )}
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <FileText className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <strong>Platform Fee Tracking:</strong>
                  <ul className="mt-2 space-y-1 list-disc list-inside">
                    <li>Enter platform fees monthly as you receive statements</li>
                    <li>Track which platforms remit taxes on their fees</li>
                    <li>Platform fees are taxable in most jurisdictions</li>
                    <li>Keep records for tax filing and audit purposes</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </StateWrapper>
    </div>
  )
}