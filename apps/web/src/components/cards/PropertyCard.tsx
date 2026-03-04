import { memo, useCallback } from 'react'
import { formatCompactCurrency, formatPercentage } from '@baileys/utils'
import { PropertyMetrics } from '@/types/api'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { useModal } from '@/contexts/modal'
import { getOccupancyColor } from '@/lib/theme'

type ComparisonMode = 'none' | 'previous-period' | 'previous-year'

const getGrowthIndicator = (
  current: number,
  previous: number | undefined,
  comparisonMode: ComparisonMode
) => {
  if (comparisonMode === 'none' || !previous) return null
  const growth = ((current - previous) / previous) * 100
  const isPositive = growth > 0
  return (
    <span className={`text-xs flex items-center gap-1 ${isPositive ? 'text-success' : 'text-danger'}`}>
      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {Math.abs(growth).toFixed(0)}%
    </span>
  )
}

export interface PropertyCardProps {
  property: PropertyMetrics
  previousProperty?: PropertyMetrics
  comparisonMode: ComparisonMode
}

export const PropertyCard = memo(({ property, previousProperty, comparisonMode }: PropertyCardProps) => {
  const { openModal } = useModal()

  const handleClick = useCallback(() => {
    openModal({
      type: 'property',
      propertyId: property.propertyId,
      propertyName: property.propertyName
    })
  }, [openModal, property.propertyId, property.propertyName])

  return (
    <div
      className="bg-card p-4 rounded-lg shadow-sm border border-border cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={handleClick}
    >
      <h3 className="text-base font-bold mb-3 truncate" title={property.propertyName}>{property.propertyName}</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-sm text-muted-foreground">Revenue</div>
          <div className="flex items-center gap-2">
            <div className="text-lg font-semibold">{formatCompactCurrency(property.revenue)}</div>
            {getGrowthIndicator(property.revenue, previousProperty?.revenue, comparisonMode)}
          </div>
          {comparisonMode !== 'none' && previousProperty && (
            <div className="text-xs text-muted-foreground">
              vs {formatCompactCurrency(previousProperty.revenue)}
            </div>
          )}
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Bookings</div>
          <div className="flex items-center gap-2">
            <div className="text-lg font-semibold">{property.bookings}</div>
            {getGrowthIndicator(property.bookings, previousProperty?.bookings, comparisonMode)}
          </div>
          {comparisonMode !== 'none' && previousProperty && (
            <div className="text-xs text-muted-foreground">
              vs {previousProperty.bookings}
            </div>
          )}
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Occupancy</div>
          <div className="flex items-center gap-2">
            <div className={`text-lg font-semibold ${getOccupancyColor(property.occupancyRate * 100)}`}>
              {formatPercentage(property.occupancyRate * 100, 1)}
            </div>
            {getGrowthIndicator(property.occupancyRate, previousProperty?.occupancyRate, comparisonMode)}
          </div>
          <div className="text-xs text-muted-foreground">
            {property.bookedNights} of {property.availableNights} nights
          </div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Nightly Rate</div>
          <div className="flex items-center gap-2">
            <div className="text-lg font-semibold">{formatCompactCurrency(property.avgNightlyRate)}</div>
            {getGrowthIndicator(property.avgNightlyRate, previousProperty?.avgNightlyRate, comparisonMode)}
          </div>
          <div className="text-xs text-muted-foreground">Average</div>
        </div>
      </div>
    </div>
  )
})

PropertyCard.displayName = 'PropertyCard'
