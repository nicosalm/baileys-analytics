import { usePropertyTaxStatus } from '@/hooks/use-api'
import { useNavigate } from 'react-router-dom'
import {
  Calculator,
  AlertCircle,
  Check,
  Plus
} from 'lucide-react'
import { Button } from '@/components/ui/button'

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
      <div className="bg-card rounded-lg shadow-sm border p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
          <div className="h-8 bg-muted rounded w-1/2"></div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="bg-card rounded-lg shadow-sm border">
      <div className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center">
            <Calculator className="w-5 h-5 text-muted-foreground mr-2" />
            <h3 className="font-semibold text-foreground">Tax Configuration</h3>
          </div>
          <Button
            variant="link"
            size="sm"
            onClick={() => navigate('/settings?tab=platform-fees')}
            className="p-0 h-auto"
          >
            Manage →
          </Button>
        </div>
        
        {/* Progress Bar */}
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-muted-foreground">Setup Progress</span>
            <span className={`text-sm font-medium
              ${statusColor === 'green' ? 'text-success' : ''}
              ${statusColor === 'blue' ? 'text-info' : ''}
              ${statusColor === 'yellow' ? 'text-warning' : ''}
              ${statusColor === 'red' ? 'text-danger' : ''}
            `}>
              {completionPercentage}%
            </span>
          </div>
          <div className="w-full bg-border rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500
                ${statusColor === 'green' ? 'bg-success' : ''}
                ${statusColor === 'blue' ? 'bg-info' : ''}
                ${statusColor === 'yellow' ? 'bg-warning' : ''}
                ${statusColor === 'red' ? 'bg-danger' : ''}
              `}
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-muted/40 rounded-sm p-2">
            <p className="text-xs text-muted-foreground">Properties</p>
            <p className="text-lg font-semibold text-foreground">
              {configuredProperties}/{totalProperties}
            </p>
          </div>
          <div className="bg-muted/40 rounded-sm p-2">
            <p className="text-xs text-muted-foreground">Needs Action</p>
            <p className="text-lg font-semibold text-warning">
              {missingConfigs.length + missingFees.length + partialFees.length}
            </p>
          </div>
        </div>
        
        {/* Action Buttons */}
        {missingFees.length > 0 || partialFees.length > 0 ? (
          <Button
            onClick={() => navigate('/settings?tab=platform-fees')}
            className="w-full bg-warning hover:bg-warning/90"
          >
            <Plus className="w-4 h-4" />
            {missingFees.length > 0 ? 'Add Platform Fees' : 'Complete Fee Data'}
          </Button>
        ) : (
          <div className="flex items-center justify-center py-2 text-success bg-success-subtle rounded-sm">
            <Check className="w-4 h-4 mr-1" />
            <span className="text-sm font-medium">All Configured!</span>
          </div>
        )}
        
        
        {/* Platform Fees Reminder */}
        {(missingFees.length > 0 || partialFees.length > 0) && missingConfigs.length === 0 && (
          <div className="mt-3 p-2 bg-warning-subtle border border-warning/30 rounded-sm">
            <div className="flex items-start">
              <AlertCircle className="w-4 h-4 text-warning mr-2 mt-0.5" />
              <div className="text-xs text-warning-fg">
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