import { memo, useState, useMemo, useCallback, useEffect } from 'react'
import { formatCurrency, formatCompactCurrency, formatPercentage } from '@baileys/utils'
import { PropertyMetrics } from '@/types/api'
import { TrendingUp, TrendingDown, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import { useModal } from '@/contexts/modal'
import { Pagination } from '@/components/Pagination'

const PAGE_SIZE = 15

type ComparisonMode = 'none' | 'previous-period' | 'previous-year'
type SortField = 'name' | 'revenue' | 'revpan' | 'bookings' | 'occupancy' | 'trend' | 'margin'
type SortDirection = 'asc' | 'desc'

interface SortIconProps {
  field: SortField
  currentField: SortField
  direction: SortDirection
}

const SortIcon = memo(({ field, currentField, direction }: SortIconProps) => {
  if (currentField !== field) {
    return <ArrowUpDown className="w-3 h-3 text-muted-foreground/70" />
  }
  return direction === 'asc'
    ? <ChevronUp className="w-3 h-3 text-primary" />
    : <ChevronDown className="w-3 h-3 text-primary" />
})

SortIcon.displayName = 'SortIcon'

interface PropertyProfitability {
  propertyId: string
  grossRevenue: number
  netRevenue: number
}

export interface PropertyTableProps {
  properties: PropertyMetrics[]
  previousProperties?: PropertyMetrics[] | null
  comparisonMode: ComparisonMode
  profitability?: PropertyProfitability[]
}

const getTrend = (current: number, previous?: number) => {
  if (!previous) return 0
  return ((current - previous) / previous) * 100
}

export const PropertyTable = memo(({ properties, previousProperties, comparisonMode, profitability }: PropertyTableProps) => {
  const { openModal } = useModal()
  const [sortField, setSortField] = useState<SortField>('revpan')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [currentPage, setCurrentPage] = useState(1)

  // reset page when data or sort changes
  useEffect(() => { setCurrentPage(1) }, [properties, sortField, sortDirection])

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

  const profitabilityMap = useMemo(() =>
    new Map(profitability?.map(p => [p.propertyId, p]) ?? []),
    [profitability]
  )

  const previousMap = useMemo(() =>
    new Map(previousProperties?.map(p => [p.propertyId, p]) ?? []),
    [previousProperties]
  )

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
        case 'margin': {
          const aProf = profitabilityMap.get(a.propertyId)
          const bProf = profitabilityMap.get(b.propertyId)
          aValue = aProf && aProf.grossRevenue > 0 ? (aProf.netRevenue / aProf.grossRevenue) * 100 : 0
          bValue = bProf && bProf.grossRevenue > 0 ? (bProf.netRevenue / bProf.grossRevenue) * 100 : 0
          break
        }
        case 'trend': {
          const aPrev = previousMap.get(a.propertyId)
          const bPrev = previousMap.get(b.propertyId)
          aValue = getTrend(a.revenue, aPrev?.revenue)
          bValue = getTrend(b.revenue, bPrev?.revenue)
          break
        }
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
  }, [properties, profitabilityMap, previousMap, sortField, sortDirection])

  const totalPages = Math.ceil(sortedProperties.length / PAGE_SIZE)
  const paginatedProperties = sortedProperties.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-1">
                  Property Name
                  <SortIcon field="name" currentField={sortField} direction={sortDirection} />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted"
                onClick={() => handleSort('revenue')}
              >
                <div className="flex items-center gap-1">
                  Revenue
                  <SortIcon field="revenue" currentField={sortField} direction={sortDirection} />
                </div>
              </th>
              {profitability && profitability.length > 0 && (
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted"
                  onClick={() => handleSort('margin')}
                >
                  <div className="flex items-center gap-1">
                    Margin
                    <SortIcon field="margin" currentField={sortField} direction={sortDirection} />
                  </div>
                </th>
              )}
              <th
                className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted"
                onClick={() => handleSort('revpan')}
              >
                <div className="flex items-center gap-1">
                  RevPAN
                  <SortIcon field="revpan" currentField={sortField} direction={sortDirection} />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted"
                onClick={() => handleSort('bookings')}
              >
                <div className="flex items-center gap-1">
                  Bookings
                  <SortIcon field="bookings" currentField={sortField} direction={sortDirection} />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted"
                onClick={() => handleSort('occupancy')}
              >
                <div className="flex items-center gap-1">
                  Occupancy
                  <SortIcon field="occupancy" currentField={sortField} direction={sortDirection} />
                </div>
              </th>
              {comparisonMode !== 'none' && (
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted"
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
          <tbody className="bg-card divide-y divide-border">
            {paginatedProperties.map((property) => {
              const previousProperty = previousMap.get(property.propertyId)
              const trend = getTrend(property.revenue, previousProperty?.revenue)
              const isPositive = trend > 0

              return (
                <tr
                  key={property.propertyId}
                  className="hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => handlePropertyClick(property)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-foreground flex items-center gap-2">
                      {property.propertyName}
                      {property.propertyCode && (
                        <span className="text-[10px] font-mono font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                          {property.propertyCode}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-foreground">
                      {formatCurrency(property.revenue)}
                    </div>
                    {comparisonMode !== 'none' && previousProperty && (
                      <div className="text-xs text-muted-foreground">
                        vs {formatCompactCurrency(previousProperty.revenue)}
                      </div>
                    )}
                  </td>
                  {profitability && profitability.length > 0 && (() => {
                    const prof = profitabilityMap.get(property.propertyId)
                    const margin = prof && prof.grossRevenue > 0 ? (prof.netRevenue / prof.grossRevenue) * 100 : 0
                    return (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm font-medium ${margin >= 50 ? 'text-success' : margin >= 30 ? 'text-warning' : 'text-danger'}`}>
                          {formatPercentage(margin, 1)}
                        </div>
                        {prof && (
                          <div className="text-xs text-muted-foreground">
                            {formatCompactCurrency(prof.netRevenue)} net
                          </div>
                        )}
                      </td>
                    )
                  })()}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-foreground">
                      {formatCurrency(property.revenue / Math.max(property.availableNights, 1))}
                    </div>
                    {comparisonMode !== 'none' && previousProperty && (
                      <div className="text-xs text-muted-foreground">
                        vs {formatCompactCurrency(previousProperty.revenue / Math.max(previousProperty.availableNights, 1))}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-foreground">
                      {property.bookings}
                    </div>
                    {comparisonMode !== 'none' && previousProperty && (
                      <div className="text-xs text-muted-foreground">
                        vs {previousProperty.bookings}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-muted rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            property.occupancyRate >= 0.7 ? 'bg-success' :
                            property.occupancyRate >= 0.5 ? 'bg-warning' :
                            'bg-danger'
                          }`}
                          style={{ width: `${property.occupancyRate * 100}%` }}
                        />
                      </div>
                      <span className={`text-sm font-medium ${
                        property.occupancyRate >= 0.7 ? 'text-success' :
                        property.occupancyRate >= 0.5 ? 'text-warning' :
                        'text-danger'
                      }`}>
                        {formatPercentage(property.occupancyRate * 100, 1)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {property.bookedNights}/{property.availableNights} nights
                    </div>
                  </td>
                  {comparisonMode !== 'none' && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      {previousProperty ? (
                        <div className={`flex items-center gap-1 ${isPositive ? 'text-success' : trend < 0 ? 'text-danger' : 'text-muted-foreground'}`}>
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
                        <span className="text-sm text-muted-foreground/70">—</span>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="px-6 pb-4">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={sortedProperties.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  )
})

PropertyTable.displayName = 'PropertyTable'
