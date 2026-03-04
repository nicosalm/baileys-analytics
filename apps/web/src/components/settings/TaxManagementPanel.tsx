import { useState } from 'react'
import { useModal } from '@/contexts/modal'
import { useProperties, usePlatformFees } from '@/hooks/use-api'
import { StateWrapper } from '@/components/StateWrapper'
import { format } from '@baileys/utils'
import {
  DollarSign, Building2,
  Calendar, CheckCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

function generateMonthOptions() {
  const options: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = -24; i <= 2; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
    options.push({ value: format(date, 'yyyy-MM'), label: format(date, 'MMMM yyyy') })
  }
  return options.reverse()
}

interface PropertyFeeRowProps {
  property: any
  month: string
  onManageFees: (propertyId: string, propertyName: string) => void
}

const PropertyFeeRow = ({ property, month, onManageFees }: PropertyFeeRowProps) => {
  const { data: platformFees } = usePlatformFees(property.id, month)
  const fees = Array.isArray(platformFees) ? platformFees : []
  const hasData = fees.length > 0

  return (
    <div
      key={property.id}
      className={`bg-card rounded-lg shadow-sm border transition-colors ${
        hasData
          ? 'border-success/30 hover:bg-muted/30'
          : 'border-border hover:bg-muted/30'
      }`}
    >
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-muted-foreground" />
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium text-foreground">{property.name}</h4>
                {hasData && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success-subtle text-success-fg">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Configured
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => onManageFees(property.id, property.name)}
              className={hasData ? 'bg-success hover:bg-success/90' : ''}
              size="sm"
              title="Track monthly platform service fees"
            >
              <DollarSign className="w-4 h-4" />
              {hasData ? 'Update' : 'Manage'} Platform Fees
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export const TaxManagementPanel = () => {
  const { openModal } = useModal()
  const { data: properties, isLoading } = useProperties()

  const currentDate = new Date()
  const [selectedPeriod, setSelectedPeriod] = useState(
    `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
  )

  const formattedMonth = selectedPeriod
  
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
      
      <div className="bg-card rounded-lg shadow-sm border p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Platform Fee Management</h2>
            <p className="text-muted-foreground text-sm">
              Track platform service fees for accurate financial reporting
            </p>
          </div>
          <div className="bg-muted/40 rounded-lg px-4 py-3">
            <div className="text-2xl font-bold text-info">
              {properties?.length || 0}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Properties</div>
          </div>
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Properties</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Fee Period:</span>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-44 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {generateMonthOptions().map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      <StateWrapper
        loading={isLoading}
        empty={!properties?.length && !isLoading}
        loadingMessage="Loading properties..."
        emptyMessage="No properties found. Sync your properties from OwnerRez first."
        minHeight={400}
      >
        <div className="space-y-3">
          {(properties || []).map((property: any) => (
            <PropertyFeeRow
              key={property.id}
              property={property}
              month={formattedMonth}
              onManageFees={handleManageFees}
            />
          ))}
        </div>
      </StateWrapper>
      
    </div>
  )
}