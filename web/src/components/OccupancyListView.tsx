import { useMemo, useState, useCallback, useEffect } from 'react'
import { ChevronDown, ChevronRight, ChevronUp, Info } from 'lucide-react'
import { formatCurrency, formatDateDisplay } from '@baileys/utils'
import { MS_PER_DAY } from '@baileys/constants'
import { useBookingsForRange, type BookingRow } from '@/hooks/use-api'
import { useModal } from '@/contexts/modal'
import { StateWrapper } from '@/components/StateWrapper'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/Pagination'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

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
      estimatedLoss: number
    }

const INACTIVE_STATUSES = ['cancelled', 'canceled', 'declined', 'rejected']
type SortKey = 'name' | 'bookings' | 'nights' | 'gaps' | 'rate' | 'occupancy'

interface PropertyGroupSummary {
  bookingCount: number
  bookedNights: number
  gapCount: number
  avgNightlyRate: number
  occupancyRate: number
}

const SORT_VALUE: Record<Exclude<SortKey, 'name'>, (g: PropertyGroupSummary) => number> = {
  bookings: (g) => g.bookingCount,
  nights: (g) => g.bookedNights,
  gaps: (g) => g.gapCount,
  rate: (g) => g.avgNightlyRate,
  occupancy: (g) => g.occupancyRate,
}

const COLUMNS: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
  { key: 'name', label: 'Property', align: 'left' },
  { key: 'bookings', label: 'Bookings', align: 'right' },
  { key: 'nights', label: 'Nights', align: 'right' },
  { key: 'gaps', label: 'Gaps', align: 'right' },
  { key: 'rate', label: 'Avg rate', align: 'right' },
  { key: 'occupancy', label: 'Occupancy', align: 'right' },
]

// property, bookings, nights, gaps, avg rate, occupancy
const GRID = 'grid grid-cols-[minmax(0,1fr)_4.5rem_6rem_3.5rem_5.5rem_8.5rem] items-center gap-x-4'

const TRUNCATION_LIMIT = 1000
const PAGE_SIZE = 15

function toDateString(d: Date) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / MS_PER_DAY)
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
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'occupancy', dir: 'asc' })
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
  }, [sort])

  const handleSort = (key: SortKey) =>
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' },
    )

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
      .sort((a, b) => {
        const diff = sort.key === 'name' ? a.name.localeCompare(b.name) : SORT_VALUE[sort.key](a) - SORT_VALUE[sort.key](b)
        return sort.dir === 'asc' ? diff : -diff
      })
  }, [bookings, dateRange.from, dateRange.to, properties, sort])

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
      <StateWrapper loading={true} loadingMessage="Loading bookings..." minHeight={300} className="py-12 border-t border-border">
        <div />
      </StateWrapper>
    )
  }

  if (error) {
    return (
      <StateWrapper error={error} errorMessage="Failed to load bookings" minHeight={300} className="py-12 border-t border-border">
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

  const groupSlice = propertyGroups.slice((propertyPage - 1) * PAGE_SIZE, propertyPage * PAGE_SIZE)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3 sm:px-6">
        <SegmentedControl
          label="Group bookings"
          value={groupBy}
          onChange={setGroupBy}
          options={[
            { value: 'property', label: 'By property' },
            { value: 'time', label: 'By date' },
          ]}
        />
        <div className="flex items-center gap-2">
          {groupBy === 'property' && (
            <Button variant="ghost" size="sm" onClick={allExpanded ? collapseAll : expandAll} className="text-muted-foreground">
              {allExpanded ? 'Collapse all' : 'Expand all'}
            </Button>
          )}
          <SegmentedControl
            label="Days ahead"
            value={lookAhead}
            onChange={setLookAhead}
            options={([30, 60, 90] as LookAhead[]).map((days) => ({
              value: days,
              label: (
                <>
                  <span className="hidden sm:inline">Next </span>
                  {days} days
                </>
              ),
            }))}
          />
        </div>
      </div>

      {isTruncated && (
        <p className="flex items-center gap-2 border-t border-border px-4 py-2 text-xs text-muted-foreground sm:px-6">
          <Info className="size-3.5 shrink-0" />
          Showing the first {TRUNCATION_LIMIT.toLocaleString()} bookings. Choose a shorter range for complete results.
        </p>
      )}

      {groupBy === 'property' ? (
        <div className="overflow-x-auto border-t border-border">
          <div className="min-w-[44rem]">
            <div className={cn(GRID, 'border-b border-border px-4 py-2.5 sm:px-6')}>
              {COLUMNS.map(({ key, label, align }) => {
                const active = sort.key === key
                const Arrow = sort.dir === 'asc' ? ChevronUp : ChevronDown
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSort(key)}
                    aria-pressed={active}
                    title={`Sort by ${label.toLowerCase()}`}
                    className={cn(
                      'flex items-center gap-1 text-xs font-medium whitespace-nowrap cursor-pointer select-none transition-colors',
                      align === 'right' && 'justify-end',
                      key === 'name' && 'pl-6',
                      active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {label}
                    {active && <Arrow className="size-3" aria-hidden />}
                  </button>
                )
              })}
            </div>

            {groupSlice.map((group) => {
              const isExpanded = expandedProperties.has(group.propertyId)
              const occupancyPct = group.occupancyRate * 100
              return (
                <div key={group.propertyId} className="border-b border-border/60 last:border-0">
                  <button
                    type="button"
                    onClick={() => toggleProperty(group.propertyId)}
                    aria-expanded={isExpanded}
                    className={cn(GRID, 'w-full px-4 py-2.5 text-left text-sm cursor-pointer transition-colors hover:bg-muted/40 sm:px-6')}
                  >
                    <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                      <ChevronRight
                        className={cn('size-4 shrink-0 text-muted-foreground transition-transform', isExpanded && 'rotate-90')}
                        aria-hidden
                      />
                      <span className="truncate">{group.name}</span>
                    </span>
                    <span className="text-right tabular-nums">{group.bookingCount}</span>
                    <span className="text-right tabular-nums">
                      {group.bookedNights}
                      <span className="text-muted-foreground"> / {group.totalNights}</span>
                    </span>
                    <span className="text-right tabular-nums">{group.gapCount}</span>
                    <span className="text-right tabular-nums">{group.avgNightlyRate > 0 ? formatCurrency(group.avgNightlyRate) : '—'}</span>
                    <span className="flex items-center justify-end gap-2">
                      <span className="h-1.5 w-12 rounded-full bg-muted" aria-hidden>
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(occupancyPct, 100)}%` }} />
                      </span>
                      <span className="w-10 text-right font-medium tabular-nums">{Math.round(occupancyPct)}%</span>
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border/60 bg-muted/20 divide-y divide-border/60">
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
          </div>
        </div>
      ) : (
        <div className="border-t border-border divide-y divide-border/60">
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
      )}

      {groupBy === 'property' ? (
        <Pagination
          currentPage={propertyPage}
          totalPages={Math.ceil(propertyGroups.length / PAGE_SIZE)}
          totalItems={propertyGroups.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPropertyPage}
        />
      ) : (
        <Pagination
          currentPage={timePage}
          totalPages={Math.ceil(chronologicalEntries.length / PAGE_SIZE)}
          totalItems={chronologicalEntries.length}
          pageSize={PAGE_SIZE}
          onPageChange={setTimePage}
        />
      )}
    </div>
  )
}

const entryRow = 'flex items-center justify-between gap-4 py-2.5 pr-4 pl-10 sm:pr-6 sm:pl-12'

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
    <button
      type="button"
      className={cn(entryRow, 'w-full text-left cursor-pointer transition-colors hover:bg-muted/50', showProperty && 'pl-4 sm:pl-6')}
      onClick={() => onClick(entry.id, entry.guestName)}
    >
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          {showProperty && <span className="shrink-0 text-xs text-muted-foreground">{entry.propertyName}</span>}
          <span className="truncate text-sm font-medium text-foreground">{entry.guestName}</span>
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {formatDateDisplay(entry.arrival)} to {formatDateDisplay(entry.departure)}, {entry.nights}{' '}
          {entry.nights === 1 ? 'night' : 'nights'}
        </span>
      </span>
      {entry.amount > 0 && (
        <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">{formatCurrency(entry.amount)}</span>
      )}
    </button>
  )
}

function GapRow({ entry, showProperty }: { entry: Extract<ListEntry, { type: 'gap' }>; showProperty?: boolean }) {
  return (
    <div className={cn(entryRow, showProperty && 'pl-4 sm:pl-6')}>
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          {showProperty && <span className="shrink-0 text-xs text-muted-foreground">{entry.propertyName}</span>}
          <Badge variant="neutral">Open</Badge>
          <span className="text-sm text-muted-foreground">
            {entry.nights} {entry.nights === 1 ? 'night' : 'nights'}
          </span>
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {formatDateDisplay(entry.gapStart)} to {formatDateDisplay(entry.gapEnd)}
        </span>
      </span>
      {entry.estimatedLoss > 0 && (
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">about {formatCurrency(entry.estimatedLoss)} at avg rate</span>
      )}
    </div>
  )
}
