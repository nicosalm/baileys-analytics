import { useState, useEffect, useMemo } from 'react'
import { useProperties, usePropertyTaxConfigs, usePropertyTaxStatus } from './use-api'
import { mutate } from 'swr'

export interface TaxJurisdiction {
  name: string
  type: 'state' | 'county' | 'city' | 'district' | 'other'
  rate: number
  description?: string
}

export interface PropertyTaxConfig {
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

export interface TaxStatistics {
  totalProperties: number
  configuredProperties: number
  unconfiguredProperties: number
  averageTaxRate: number
  totalJurisdictions: number
}

export function useTaxManagement() {
  const { data: propertiesData, isLoading: propertiesLoading } = useProperties()
  const { data: configsData, isLoading: configsLoading } = usePropertyTaxConfigs()
  const { data: taxStatusData } = usePropertyTaxStatus()
  
  const [selectedProperty, setSelectedProperty] = useState<string>(() => 
    localStorage.getItem('taxManagement.selectedProperty') || ''
  )
  
  useEffect(() => {
    if (selectedProperty) {
      localStorage.setItem('taxManagement.selectedProperty', selectedProperty)
    }
  }, [selectedProperty])
  
  const properties = useMemo(() => 
    Array.isArray(propertiesData) ? propertiesData : [],
    [propertiesData]
  )
  
  const configs = useMemo(() => 
    Array.isArray(configsData) ? configsData : [],
    [configsData]
  )
  
  const configsByProperty = useMemo(() => {
    return configs.reduce((acc: Record<string, PropertyTaxConfig[]>, config: any) => {
      const propertyId = config.propertyId
      if (!acc[propertyId]) acc[propertyId] = []
      const property = properties.find((p: any) => p.id === propertyId)
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
    }, {})
  }, [configs, properties])
  
  const statistics = useMemo<TaxStatistics>(() => {
    const configuredPropertyIds = new Set(Object.keys(configsByProperty))
    const allJurisdictions = configs.flatMap((c: any) => c.jurisdictions || [])
    const totalRate = allJurisdictions.reduce((sum: number, j: any) => sum + (j.rate || 0), 0)
    
    return {
      totalProperties: properties.length,
      configuredProperties: configuredPropertyIds.size,
      unconfiguredProperties: properties.length - configuredPropertyIds.size,
      averageTaxRate: allJurisdictions.length > 0 ? totalRate / allJurisdictions.length : 0,
      totalJurisdictions: new Set(allJurisdictions.map((j: any) => j.name)).size
    }
  }, [properties, configs, configsByProperty])
  
  const deleteConfig = async (configId: string) => {
    const response = await fetch(`/api/tax-configs/${configId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    })
    
    if (response.ok) {
      await mutate('/property-tax-configs')
      await mutate('/property-tax-status')
      return { success: true }
    }
    
    return { success: false, error: 'Failed to delete configuration' }
  }
  
  const toggleConfigActive = async (configId: string, isActive: boolean) => {
    const response = await fetch(`/api/tax-configs/${configId}/toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive })
    })
    
    if (response.ok) {
      await mutate('/property-tax-configs')
      return { success: true }
    }
    
    return { success: false, error: 'Failed to update configuration' }
  }
  
  return {
    properties,
    configs,
    configsByProperty,
    statistics,
    taxStatusData,
    selectedProperty,
    setSelectedProperty,
    deleteConfig,
    toggleConfigActive,
    isLoading: propertiesLoading || configsLoading
  }
}