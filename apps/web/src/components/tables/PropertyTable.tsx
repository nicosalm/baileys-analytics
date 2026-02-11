import { memo, useState, useMemo, useCallback } from 'react'
import { formatCurrency, formatCompactCurrency, formatPercentage } from '@baileys/utils'
import { PropertyMetrics } from '@/types/api'
import { TrendingUp, TrendingDown, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import { useModal } from '@/contexts/modal'

type ComparisonMode = 'none' | 'previous-period' | 'previous-year'
type SortField = 'name' | 'revenue' | 'revpan' | 'bookings' | 'occupancy' | 'trend'
type SortDirection = 'asc' | 'desc'

interface SortIconProps {
  field: SortField
  currentField: SortField
  direction: SortDirection
}

const SortIcon = memo(({ field, currentField, direction }: SortIconProps) => {
  if (currentField !== field) {
    return <ArrowUpDown className="w-3 h-3 text-gray-400" />
  }
  return direction === 'asc'
    ? <ChevronUp className="w-3 h-3 text-blue-600" />
    : <ChevronDown className="w-3 h-3 text-blue-600" />
})

SortIcon.displayName = 'SortIcon'

export interface PropertyTableProps {
  properties: PropertyMetrics[]
  previousProperties?: PropertyMetrics[] | null
  comparisonMode: ComparisonMode
}

const getTrend = (current: number, previous?: number) => {
  if (!previous) return 0
  return ((current - previous) / previous) * 100
}

export const PropertyTable = memo(({ properties, previousProperties, comparisonMode }: PropertyTableProps) => {
  const { openModal } = useModal()
  const [sortField, setSortField] = useState<SortField>('revpan')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const handleSort = useCallback((field: SortField) => {
    setSortField(prevField => {
      if (prevField === field) {
        setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
        return prevField
      }
      setSortDirection('desc')
      return field
    })
  }, [])

  const handlePropertyClick = useCallback((property: PropertyMetrics) => {
    openModal({
      type: 'property',
      propertyId: property.propertyId,
      propertyName: property.propertyName
    })
  }, [openModal])

  const sortedProperties = useMemo(() => {
    const sorted = [...properties].sort((a, b) => {
      let aValue: string | number, bValue: string | number

      switch (sortField) {
        case 'name':
          aValue = a.propertyName.toLowerCase()
          bValue = b.propertyName.toLowerCase()
          break
        case 'revenue':
          aValue = a.revenue
          bValue = b.revenue
          break
        case 'bookings':
          aValue = a.bookings
          bValue = b.bookings
          break
        case 'occupancy':
          aValue = a.occupancyRate
          bValue = b.occupancyRate
          break
        case 'revpan':
          aValue = a.revenue / Math.max(a.availableNights, 1)
          bValue = b.revenue / Math.max(b.availableNights, 1)
          break
        case 'trend':
          const aPrev = previousProperties?.find(p => p.propertyId === a.propertyId)
          const bPrev = previousProperties?.find(p => p.propertyId === b.propertyId)
          aValue = getTrend(a.revenue, aPrev?.revenue)
          bValue = getTrend(b.revenue, bPrev?.revenue)
          break
        default:
          return 0
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    return sorted
  }, [properties, previousProperties, sortField, sortDirection])

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-1">
                  Property Name
                  <SortIcon field="name" currentField={sortField} direction={sortDirection} />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('revenue')}
              >
                <div className="flex items-center gap-1">
                  Revenue
                  <SortIcon field="revenue" currentField={sortField} direction={sortDirection} />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('revpan')}
              >
                <div className="flex items-center gap-1">
                  RevPAN
                  <SortIcon field="revpan" currentField={sortField} direction={sortDirection} />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('bookings')}
              >
                <div className="flex items-center gap-1">
                  Bookings
                  <SortIcon field="bookings" currentField={sortField} direction={sortDirection} />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('occupancy')}
              >
                <div className="flex items-center gap-1">
                  Occupancy
                  <SortIcon field="occupancy" currentField={sortField} direction={sortDirection} />
                </div>
              </th>
              {comparisonMode !== 'none' && (
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('trend')}
                >
                  <div className="flex items-center gap-1">
                    Trend
                    <SortIcon field="trend" currentField={sortField} direction={sortDirection} />
                  </div>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedProperties.map((property) => {
              const previousProperty = previousProperties?.find(p => p.propertyId === property.propertyId)
              const trend = getTrend(property.revenue, previousProperty?.revenue)
              const isPositive = trend > 0

              return (
                <tr
                  key={property.propertyId}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handlePropertyClick(property)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {property.propertyName}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">
                      {formatCurrency(property.revenue)}
                    </div>
                    {comparisonMode !== 'none' && previousProperty && (
                      <div className="text-xs text-gray-500">
                        vs {formatCompactCurrency(previousProperty.revenue)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatCurrency(property.revenue / Math.max(property.availableNights, 1))}
                    </div>
                    {comparisonMode !== 'none' && previousProperty && (
                      <div className="text-xs text-gray-500">
                        vs {formatCompactCurrency(previousProperty.revenue / Math.max(previousProperty.availableNights, 1))}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {property.bookings}
                    </div>
                    {comparisonMode !== 'none' && previousProperty && (
                      <div className="text-xs text-gray-500">
                        vs {previousProperty.bookings}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            property.occupancyRate >= 0.7 ? 'bg-green-500' :
                            property.occupancyRate >= 0.5 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${property.occupancyRate * 100}%` }}
                        />
                      </div>
                      <span className={`text-sm font-medium ${
                        property.occupancyRate >= 0.7 ? 'text-green-600' :
                        property.occupancyRate >= 0.5 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {formatPercentage(property.occupancyRate * 100, 0)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {property.bookedNights}/{property.availableNights} nights
                    </div>
                  </td>
                  {comparisonMode !== 'none' && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      {previousProperty ? (
                        <div className={`flex items-center gap-1 ${isPositive ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                          {isPositive ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : trend < 0 ? (
                            <TrendingDown className="w-4 h-4" />
                          ) : null}
                          <span className="text-sm font-medium">
                            {trend !== 0 ? `${Math.abs(trend).toFixed(0)}%` : '—'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
})

PropertyTable.displayName = 'PropertyTable'
