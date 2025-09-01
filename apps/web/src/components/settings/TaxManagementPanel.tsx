import { useState, useMemo } from 'react'
import { useModal } from '@/contexts/modal'
import { useToast } from '@/contexts/toast'
import { useTaxManagement } from '@/hooks/useTaxManagement'
import { StateWrapper } from '@/components/StateWrapper'
import { 
  Plus, DollarSign, Building2, 
  Calendar, MapPin, Check, Edit2,
  TrendingUp, AlertCircle
} from 'lucide-react'

export const TaxManagementPanel = () => {
  const { openModal } = useModal()
  const { addToast } = useToast()
  const {
    properties,
    configsByProperty,
    statistics,
    deleteConfig,
    toggleConfigActive,
    isLoading
  } = useTaxManagement()
  
  const currentDate = new Date()
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1)
  
  const formattedMonth = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`
  
  const propertyWithConfig = useMemo(() => {
    return properties.map((property: any) => {
      const configs = configsByProperty[property.id] || []
      const activeConfig = configs.find((c: any) => c.isActive)
      const totalRate = activeConfig?.jurisdictions?.reduce((sum: number, j: any) => sum + j.rate, 0) || 0
      
      return {
        ...property,
        hasConfig: configs.length > 0,
        activeConfig,
        totalRate,
        configCount: configs.length
      }
    })
  }, [properties, configsByProperty])
  
  const handleCreateConfig = (propertyId: string, _propertyName: string) => {
    openModal({
      type: 'tax-config-wizard',
      defaultPropertyId: propertyId
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
      addToast('success', 'Tax configuration deleted')
    } else {
      addToast('error', result.error || 'Failed to delete configuration')
    }
  }
  
  const handleManageFees = (propertyId: string, propertyName: string) => {
    openModal({
      type: 'platform-fee-entry',
      propertyId,
      propertyName,
      month: formattedMonth
    })
  }
  
  return (
    <div className="space-y-6">
      
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Tax & Fee Configuration</h2>
            <p className="text-gray-600">
              Manage tax jurisdictions and platform fees for accurate financial reporting
            </p>
          </div>
          <div className="flex gap-3">
            <div className="bg-white rounded-lg px-4 py-3 shadow-sm">
              <div className="text-2xl font-bold text-blue-600">
                {statistics.configuredProperties}
              </div>
              <div className="text-xs text-gray-500 mt-1">Configured</div>
            </div>
            <div className="bg-white rounded-lg px-4 py-3 shadow-sm">
              <div className="text-2xl font-bold text-gray-400">
                {statistics.unconfiguredProperties}
              </div>
              <div className="text-xs text-gray-500 mt-1">Pending</div>
            </div>
          </div>
        </div>
        
        {statistics.averageTaxRate > 0 && (
          <div className="mt-4 flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="text-gray-700">
                Avg Tax Rate: <span className="font-semibold">{statistics.averageTaxRate.toFixed(2)}%</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span className="text-gray-700">
                {statistics.totalJurisdictions} Jurisdictions Tracked
              </span>
            </div>
          </div>
        )}
      </div>
      
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Property Tax & Fees</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Fee Period:</span>
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
            <Calendar className="w-4 h-4 text-gray-400" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="text-sm font-medium text-gray-700 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value={1}>January</option>
              <option value={2}>February</option>
              <option value={3}>March</option>
              <option value={4}>April</option>
              <option value={5}>May</option>
              <option value={6}>June</option>
              <option value={7}>July</option>
              <option value={8}>August</option>
              <option value={9}>September</option>
              <option value={10}>October</option>
              <option value={11}>November</option>
              <option value={12}>December</option>
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="text-sm font-medium text-gray-700 bg-transparent focus:outline-none cursor-pointer"
            >
              {Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      <StateWrapper
        loading={isLoading}
        empty={!properties.length && !isLoading}
        loadingMessage="Loading configurations..."
        emptyMessage="No properties found. Add properties to configure taxes."
        minHeight={400}
      >
        <div className="space-y-3">
          {propertyWithConfig.map((property: any) => (
            <div
              key={property.id}
              className="bg-white rounded-lg border border-gray-200 hover:border-blue-200 transition-all"
            >
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-50 rounded-lg">
                      <Building2 className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{property.name}</h4>
                      <div className="flex items-center gap-4 mt-1">
                        {property.hasConfig ? (
                          <>
                            <span className="text-sm text-green-600 flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              Tax Configured
                            </span>
                            {property.totalRate > 0 && (
                              <span className="text-sm text-gray-500">
                                Total Rate: {property.totalRate.toFixed(2)}%
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-sm text-amber-600 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            No Tax Configuration
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {property.hasConfig ? (
                      <button
                        onClick={() => {
                          const config = configsByProperty[property.id]?.[0];
                          if (config) handleEditConfig(config);
                        }}
                        className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 flex items-center gap-1"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit Tax
                      </button>
                    ) : (
                      <button
                        onClick={() => handleCreateConfig(property.id, property.name)}
                        className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" />
                        Configure Tax
                      </button>
                    )}
                    
                    <button
                      onClick={() => handleManageFees(property.id, property.name)}
                      className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 flex items-center gap-1"
                      title="Track monthly platform service fees"
                    >
                      <DollarSign className="w-4 h-4" />
                      Platform Fees
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </StateWrapper>
      
    </div>
  )
}