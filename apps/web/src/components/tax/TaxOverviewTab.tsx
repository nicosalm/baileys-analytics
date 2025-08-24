import React from 'react'
import { MetricCard } from '@/components/MetricCard'
import { SimpleTable } from '@/components/tables'
import { 
  Building2, Calculator, AlertCircle, CheckCircle,
  TrendingUp, MapPin
} from 'lucide-react'
import { formatPercentage } from '@/utils/formatters'
import { TaxStatistics, PropertyTaxConfig, TaxJurisdiction } from '@/hooks/useTaxManagement'

interface TaxOverviewTabProps {
  statistics: TaxStatistics
  configsByProperty: Record<string, PropertyTaxConfig[]>
  properties: any[]
  onConfigureProperty: (propertyId: string) => void
}

export const TaxOverviewTab: React.FC<TaxOverviewTabProps> = ({
  statistics,
  configsByProperty,
  properties,
  onConfigureProperty
}) => {
  const unconfiguredProperties = properties.filter(p => !configsByProperty[p.id])
  
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-4">
        <MetricCard
          icon={Building2}
          label="Total Properties"
          value={statistics.totalProperties}
          format="number"
          color="blue"
        />
        <MetricCard
          icon={CheckCircle}
          label="Configured"
          value={statistics.configuredProperties}
          format="number"
          color="green"
          subValue={`${formatPercentage((statistics.configuredProperties / statistics.totalProperties) * 100, 0)} complete`}
        />
        <MetricCard
          icon={AlertCircle}
          label="Needs Setup"
          value={statistics.unconfiguredProperties}
          format="number"
          color={statistics.unconfiguredProperties > 0 ? 'yellow' : 'green'}
        />
        <MetricCard
          icon={Calculator}
          label="Avg Tax Rate"
          value={formatPercentage(statistics.averageTaxRate, 2)}
          format="custom"
          color="blue"
          subValue={`${statistics.totalJurisdictions} jurisdictions`}
        />
      </div>
      
      {unconfiguredProperties.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
            <div>
              <h4 className="font-semibold text-yellow-900">
                {unconfiguredProperties.length} Properties Need Tax Configuration
              </h4>
              <p className="text-sm text-yellow-800 mt-1">
                Configure tax settings to ensure accurate tax collection and reporting.
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="text-lg font-semibold mb-3">Configuration Status</h3>
          <SimpleTable
            data={properties.map(p => ({
              id: p.id,
              name: p.name,
              status: configsByProperty[p.id] ? 'configured' : 'pending',
              configCount: configsByProperty[p.id]?.length || 0
            }))}
            columns={[
              { key: 'name', header: 'Property' },
              {
                key: 'status',
                header: 'Status',
                render: (row: any) => (
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    row.status === 'configured' 
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {row.status === 'configured' ? 'Configured' : 'Needs Setup'}
                  </span>
                )
              },
              {
                key: 'configCount',
                header: 'Configs',
                render: (row: any) => row.configCount > 0 ? row.configCount : '—'
              }
            ]}
            onRowClick={(row) => onConfigureProperty(row.id)}
          />
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="text-lg font-semibold mb-3">Tax Jurisdictions</h3>
          <div className="space-y-3">
            {Object.entries(
              Object.values(configsByProperty).flat().flatMap((c: PropertyTaxConfig) => c.jurisdictions)
                .reduce((acc: Record<string, number>, j: TaxJurisdiction) => {
                  acc[j.type] = (acc[j.type] || 0) + 1
                  return acc
                }, {})
            ).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <div className="flex items-center">
                  <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="capitalize text-sm font-medium">{type}</span>
                </div>
                <span className="text-sm text-gray-600">{(count as number)} jurisdiction{count !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {statistics.averageTaxRate > 15 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <TrendingUp className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
            <div className="text-sm text-blue-800">
              <strong>Tax Rate Analysis:</strong> Your average tax rate is {formatPercentage(statistics.averageTaxRate, 2)}. 
              Consider reviewing jurisdictions with rates above 20% to ensure accuracy.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}