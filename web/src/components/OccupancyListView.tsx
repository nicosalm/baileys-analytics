import { useMemo, useState, useCallback, useEffect } from 'react'
import { ChevronDown, ChevronRight, AlertTriangle, TrendingDown, Calendar, Info } from 'lucide-react'
import { formatCurrency, formatDateDisplay } from '@baileys/utils'
import { MS_PER_DAY } from '@baileys/constants'
import { useBookingsForRange, type BookingRow } from '@/hooks/use-api'
import { useModal } from '@/contexts/modal'
import { StateWrapper } from '@/components/StateWrapper'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/Pagination'

interface OccupancyListViewProps {
  properties: { propertyId: string; propertyName: string }[]
}

type LookAhead = 30 | 60 | 90

type ListEntry =
  | {
      type: 'booking'
      id: string
      propertyId: string
      propertyName: string
      guestName: string
      arrival: string
      departure: string
      nights: number
      amount: number
    }
  | {
      type: 'gap'
      propertyId: string
      propertyName: string
      gapStart: string
      gapEnd: string
      nights: number
      severity: 'critical' | 'warning' | 'info'
      estimatedLoss: number
    }

const INACTIVE_STATUSES = ['cancelled', 'canceled', 'declined', 'rejected']
const TRUNCATION_LIMIT = 1000
const PAGE_SIZE = 15
const GAP_SEVERITY_STYLES = {
  critical: 'bg-danger-subtle border-l-danger text-danger-fg',
  warning: 'bg-warning-subtle border-l-warning text-warning-fg',
  info: 'bg-info-subtle border-l-info text-info-fg',
} as const

function toDateString(d: Date) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / MS_PER_DAY)
}

function getGapSeverity(nights: number): 'critical' | 'warning' | 'info' {
  if (nights >= 7) return 'critical'
  if (nights >= 3) return 'warning'
  return 'info'
}

export const OccupancyListView = ({ properties }: OccupancyListViewProps) => {
  const [lookAhead, setLookAhead] = useState<LookAhead>(60)

  const dateRange = useMemo(() => {
    const today = new Date()
    const future = new Date(today.getTime() + lookAhead * MS_PER_DAY)
    return { from: toDateString(today), to: toDateString(future) }
  }, [lookAhead])

  const { data: bookings, isLoading, error } = useBookingsForRange(dateRange.from, dateRange.to)
  const { openModal } = useModal()
  const [groupBy, setGroupBy] = useState<'property' | 'time'>('property')
  const [sortBy, setSortBy] = useState<'name' | 'occupancy'>('occupancy')
  const [expandedProperties, setExpandedProperties] = useState<Set<string>>(new Set())
  const [propertyPage, setPropertyPage] = useState(1)
  const [timePage, setTimePage] = useState(1)

  // reset collapsed state and pages when data source changes
  useEffect(() => {
    setExpandedProperties(new Set())
    setPropertyPage(1)
    setTimePage(1)
  }, [properties, lookAhead])

  // reset property page when sort changes (reorders groups)
  useEffect(() => {
    setPropertyPage(1)
  }, [sortBy])

  const isTruncated = bookings?.length === TRUNCATION_LIMIT

  const allExpanded = properties.length > 0 && expandedProperties.size === properties.length

  const toggleProperty = useCallback((propertyId: string) => {
    setExpandedProperties((prev) => {
      const next = new Set(prev)
      if (next.has(propertyId)) next.delete(propertyId)
      else next.add(propertyId)
      return next
    })
  }, [])

  const expandAll = useCallback(() => {
    setExpandedProperties(new Set(properties.map((p) => p.propertyId)))
  }, [properties])

  const collapseAll = useCallback(() => {
    setExpandedProperties(new Set())
  }, [])

  // Group bookings by property, compute gaps, include zero-booking properties
  const propertyGroups = useMemo(() => {
    if (properties.length === 0) return []

    const propertyIdSet = new Set(properties.map((p) => p.propertyId))

    // Filter to active bookings belonging to filtered properties
    const activeBookings = (bookings || []).filter(
      (b) => propertyIdSet.has(b.property_id) && !INACTIVE_STATUSES.includes((b.status || '').toLowerCase()),
    )

    // Group by property
    const byProperty = new Map<string, BookingRow[]>()
    for (const b of activeBookings) {
      if (!byProperty.has(b.property_id)) byProperty.set(b.property_id, [])
      byProperty.get(b.property_id)!.push(b)
    }

    // Build groups for ALL properties (including those with zero bookings)
    return properties
      .map(({ propertyId, propertyName }) => {
        const propBookings = byProperty.get(propertyId) || []
        const sorted = propBookings.slice().sort((a, b) => new Date(a.arrival).getTime() - new Date(b.arrival).getTime())

        const entries: ListEntry[] = []
        const rangeStart = dateRange.from
        const rangeEnd = dateRange.to
        const name = propertyName || `Property ${propertyId.slice(0, 8)}`

        // Compute average nightly rate from existing bookings
        const totalRevenue = sorted.reduce((sum, b) => sum + (b.total_amount || 0), 0)
        const totalBookedNights = sorted.reduce((sum, b) => sum + daysBetween(b.arrival, b.departure), 0)
        const avgNightlyRate = totalBookedNights > 0 ? totalRevenue / totalBookedNights : 0

        if (sorted.length === 0) {
          // Entire range is a gap
          const gapNights = daysBetween(rangeStart, rangeEnd)
          if (gapNights > 0) {
            entries.push({
              type: 'gap',
              propertyId,
              propertyName: name,
              gapStart: rangeStart,
              gapEnd: rangeEnd,
              nights: gapNights,
              severity: getGapSeverity(gapNights),
              estimatedLoss: avgNightlyRate * gapNights,
            })
          }
        } else {
          // Gap before first booking
          if (sorted[0].arrival > rangeStart) {
            const gapNights = daysBetween(rangeStart, sorted[0].arrival)
            if (gapNights > 0) {
              entries.push({
                type: 'gap',
                propertyId,
                propertyName: name,
                gapStart: rangeStart,
                gapEnd: sorted[0].arrival,
                nights: gapNights,
                severity: getGapSeverity(gapNights),
                estimatedLoss: avgNightlyRate * gapNights,
              })
            }
          }

          for (let i = 0; i < sorted.length; i++) {
            const b = sorted[i]
            const nights = daysBetween(b.arrival, b.departure)
            entries.push({
              type: 'booking',
              id: b.id,
              propertyId,
              propertyName: name,
              guestName: b.guest_name || 'Unknown Guest',
              arrival: b.arrival,
              departure: b.departure,
              nights,
              amount: b.total_amount || 0,
            })

            // Gap between this and next booking
            if (i < sorted.length - 1) {
              const gapNights = daysBetween(b.departure, sorted[i + 1].arrival)
              if (gapNights > 0) {
                entries.push({
                  type: 'gap',
                  propertyId,
                  propertyName: name,
                  gapStart: b.departure,
                  gapEnd: sorted[i + 1].arrival,
                  nights: gapNights,
                  severity: getGapSeverity(gapNights),
                  estimatedLoss: avgNightlyRate * gapNights,
                })
              }
            }
          }

          // Gap after last booking
          if (sorted[sorted.length - 1].departure < rangeEnd) {
            const gapNights = daysBetween(sorted[sorted.length - 1].departure, rangeEnd)
            if (gapNights > 0) {
              entries.push({
                type: 'gap',
                propertyId,
                propertyName: name,
                gapStart: sorted[sorted.length - 1].departure,
                gapEnd: rangeEnd,
                nights: gapNights,
                severity: getGapSeverity(gapNights),
                estimatedLoss: avgNightlyRate * gapNights,
              })
            }
          }
        }

        const totalNightsInRange = daysBetween(rangeStart, rangeEnd)
        const bookedNights = sorted.reduce((sum, b) => {
          const start = b.arrival < rangeStart ? rangeStart : b.arrival
          const end = b.departure > rangeEnd ? rangeEnd : b.departure
          return sum + Math.max(0, daysBetween(start, end))
        }, 0)
        const occupancyRate = totalNightsInRange > 0 ? bookedNights / totalNightsInRange : 0
        const gapCount = entries.filter((e) => e.type === 'gap').length

        return {
          propertyId,
          name,
          entries,
          bookedNights,
          totalNights: totalNightsInRange,
          occupancyRate,
          bookingCount: sorted.length,
          gapCount,
          avgNightlyRate,
        }
      })
      .sort((a, b) => (sortBy === 'occupancy' ? a.occupancyRate - b.occupancyRate : a.name.localeCompare(b.name)))
  }, [bookings, dateRange.from, dateRange.to, properties, sortBy])

  // Flat chronological view
  const chronologicalEntries = useMemo(() => {
    return propertyGroups
      .flatMap((g) => g.entries)
      .sort((a, b) => {
        const dateA = a.type === 'booking' ? a.arrival : a.gapStart
        const dateB = b.type === 'booking' ? b.arrival : b.gapStart
        return new Date(dateA).getTime() - new Date(dateB).getTime()
      })
  }, [propertyGroups])

  const handleBookingClick = useCallback(
    (bookingId: string, guestName: string) => {
      openModal({ type: 'booking', bookingId, guestName })
    },
    [openModal],
  )

  if (isLoading || (!bookings && !error)) {
    return (
      <StateWrapper loading={true} loadingMessage="Loading bookings..." minHeight={300} className="py-12">
        <div />
      </StateWrapper>
    )
  }

  if (error) {
    return (
      <StateWrapper error={error} errorMessage="Failed to load bookings" minHeight={300} className="py-12">
        <div />
      </StateWrapper>
    )
  }

  if (properties.length === 0) {
    return (
      <StateWrapper
        empty={true}
        emptyMessage="No properties found"
        emptySubMessage="Properties will appear once bookings are synced"
        minHeight={300}
        className="py-12"
      >
        <div />
      </StateWrapper>
    )
  }

  return (
    <div className="space-y-3">
      {/* Truncation warning */}
      {isTruncated && (
        <div className="flex items-center gap-2 px-3 py-2 bg-warning-subtle border border-warning/30 rounded-lg text-sm text-warning-fg">
          <Info className="w-4 h-4 shrink-0" />
          Showing first {TRUNCATION_LIMIT.toLocaleString()} bookings. Try a shorter look-ahead for complete results.
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {/* Group toggle */}
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={groupBy === 'property'}
              onClick={() => setGroupBy('property')}
              className={groupBy === 'property' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}
            >
              By Property
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={groupBy === 'time'}
              onClick={() => setGroupBy('time')}
              className={groupBy === 'time' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}
            >
              By Time
            </Button>
          </div>
          {/* Look-ahead selector */}
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
            {([30, 60, 90] as LookAhead[]).map((days) => (
              <Button
                key={days}
                variant="ghost"
                size="sm"
                aria-pressed={lookAhead === days}
                onClick={() => setLookAhead(days)}
                className={lookAhead === days ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}
              >
                {days}d
              </Button>
            ))}
          </div>
        </div>
        {groupBy === 'property' && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
              <Button
                variant="ghost"
                size="sm"
                aria-pressed={sortBy === 'name'}
                onClick={() => setSortBy('name')}
                className={sortBy === 'name' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}
              >
                Name
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-pressed={sortBy === 'occupancy'}
                onClick={() => setSortBy('occupancy')}
                className={
                  sortBy === 'occupancy' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }
              >
                Occupancy
              </Button>
            </div>
            <div className="w-px h-5 bg-border" aria-hidden />
            <Button
              variant="ghost"
              size="sm"
              onClick={allExpanded ? collapseAll : expandAll}
              className="text-muted-foreground hover:text-foreground"
            >
              {allExpanded ? 'Collapse all' : 'Expand all'}
            </Button>
          </div>
        )}
      </div>

      {/* By Property view */}
      {groupBy === 'property' && (
        <div className="space-y-2">
          {propertyGroups.slice((propertyPage - 1) * PAGE_SIZE, propertyPage * PAGE_SIZE).map((group) => {
            const isExpanded = expandedProperties.has(group.propertyId)
            const occupancyPct = Math.round(group.occupancyRate * 100)

            return (
              <div key={group.propertyId} className="border border-border rounded-lg overflow-hidden">
                {/* Property header */}
                <button
                  type="button"
                  onClick={() => toggleProperty(group.propertyId)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="font-medium text-sm text-foreground">{group.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>
                      {group.bookingCount} {group.bookingCount === 1 ? 'booking' : 'bookings'}
                    </span>
                    <span>
                      {group.bookedNights} / {group.totalNights} nights
                    </span>
                    {group.gapCount > 0 && (
                      <span className="text-warning">
                        {group.gapCount} {group.gapCount === 1 ? 'gap' : 'gaps'}
                      </span>
                    )}
                    <span className={`font-semibold ${'text-foreground'}`}>{occupancyPct}%</span>
                    {group.avgNightlyRate > 0 && (
                      <span className="text-muted-foreground/70">~{formatCurrency(group.avgNightlyRate)}/night</span>
                    )}
                  </div>
                </button>

                {/* Entries */}
                {isExpanded && (
                  <div className="divide-y divide-border">
                    {group.entries.map((entry, idx) =>
                      entry.type === 'booking' ? (
                        <BookingListRow key={`b-${entry.id}`} entry={entry} onClick={handleBookingClick} />
                      ) : (
                        <GapRow key={`g-${idx}`} entry={entry} />
                      ),
                    )}
                  </div>
                )}
              </div>
            )
          })}
          <Pagination
            currentPage={propertyPage}
            totalPages={Math.ceil(propertyGroups.length / PAGE_SIZE)}
            totalItems={propertyGroups.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPropertyPage}
          />
        </div>
      )}

      {/* By Time view */}
      {groupBy === 'time' && (
        <div>
          <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
            {chronologicalEntries
              .slice((timePage - 1) * PAGE_SIZE, timePage * PAGE_SIZE)
              .map((entry, idx) =>
                entry.type === 'booking' ? (
                  <BookingListRow key={`b-${entry.id}`} entry={entry} onClick={handleBookingClick} showProperty />
                ) : (
                  <GapRow key={`g-${idx}`} entry={entry} showProperty />
                ),
              )}
          </div>
          <Pagination
            currentPage={timePage}
            totalPages={Math.ceil(chronologicalEntries.length / PAGE_SIZE)}
            totalItems={chronologicalEntries.length}
            pageSize={PAGE_SIZE}
            onPageChange={setTimePage}
          />
        </div>
      )}
    </div>
  )
}

function BookingListRow({
  entry,
  onClick,
  showProperty,
}: {
  entry: Extract<ListEntry, { type: 'booking' }>
  onClick: (id: string, name: string) => void
  showProperty?: boolean
}) {
  return (
    <div
      className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={() => onClick(entry.id, entry.guestName)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {showProperty && <span className="text-xs text-muted-foreground/70 shrink-0">{entry.propertyName}</span>}
          <span className="text-sm font-medium text-foreground truncate">{entry.guestName}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {formatDateDisplay(entry.arrival)} &rarr; {formatDateDisplay(entry.departure)}
          <span className="ml-2">
            {entry.nights} {entry.nights === 1 ? 'night' : 'nights'}
          </span>
        </div>
      </div>
      <div className="text-sm font-medium text-foreground shrink-0 ml-4">{entry.amount > 0 ? formatCurrency(entry.amount) : ''}</div>
    </div>
  )
}

function GapRow({ entry, showProperty }: { entry: Extract<ListEntry, { type: 'gap' }>; showProperty?: boolean }) {
  const Icon = entry.severity === 'critical' ? AlertTriangle : entry.severity === 'warning' ? TrendingDown : Calendar

  return (
    <div className={`flex items-center justify-between px-4 py-2 border-l-4 ${GAP_SEVERITY_STYLES[entry.severity]}`}>
      <div className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <div>
          <div className="flex items-center gap-2">
            {showProperty && <span className="text-xs opacity-70">{entry.propertyName}</span>}
            <span className="text-sm font-medium">
              Gap: {entry.nights} {entry.nights === 1 ? 'night' : 'nights'}
            </span>
          </div>
          <div className="text-xs opacity-70">
            {formatDateDisplay(entry.gapStart)} &rarr; {formatDateDisplay(entry.gapEnd)}
          </div>
        </div>
      </div>
      {entry.estimatedLoss > 0 && (
        <div className="text-xs font-medium opacity-70 shrink-0 ml-2">~{formatCurrency(entry.estimatedLoss)} lost</div>
      )}
    </div>
  )
}
