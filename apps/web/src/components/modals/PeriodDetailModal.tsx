import { useMemo, useCallback } from 'react'
import { usePeriodDetail } from '@/hooks/use-api'
import { formatCurrency, formatPercentage, formatDateDisplay } from '@baileys/utils'
import { Calendar, DollarSign, Home, TrendingUp, Info, ExternalLink } from 'lucide-react'
import { format, parseISO, addDays, startOfMonth, endOfMonth } from 'date-fns'
import { StateWrapper } from '@/components/StateWrapper'
import { Modal } from '@/components/Modal'
import { useModal } from '@/contexts/modal'
import { useDashboard } from '@/contexts/dashboard'
import { useTips } from '@/hooks/use-tips'

interface PeriodProperty {
  propertyId: string
  propertyName: string
  bookings: number
  occupancyRate: number
  revenue: number
}

interface PeriodBooking {
  id: string
  guestId?: string
  guestName: string
  propertyId: string
  propertyName: string
  arrival: string
  departure: string
  totalAmount: number
  ownerrezBookingId?: string
}

interface PeriodDetailModalProps {
  month: string
  year: string
  day?: string
  originalDate?: string
  granularity?: 'daily' | 'weekly' | 'monthly'
}

export const PeriodDetailModal = ({ month, year, day, granularity }: PeriodDetailModalProps) => {
  const { closeModal, openModal } = useModal()
  const { showTips } = useTips()
  const { filters } = useDashboard()

  // memoized date calculations — clamp to dashboard date range so modal matches chart
  const { displayName, dateRangeStart, dateRangeEnd } = useMemo(() => {
    const clampStart = (d: string) => d < filters.dateRange.from ? filters.dateRange.from : d
    const clampEnd = (d: string) => d > filters.dateRange.to ? filters.dateRange.to : d

    if (granularity === 'daily' && day) {
      const dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      const date = parseISO(dateStr)
      return {
        displayName: format(date, 'EEEE, MMMM d, yyyy'),
        dateRangeStart: dateStr,
        dateRangeEnd: dateStr
      }
    } else if (granularity === 'weekly' && day) {
      const dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      const date = parseISO(dateStr)
      return {
        displayName: `Week of ${format(date, 'MMM d, yyyy')}`,
        dateRangeStart: clampStart(dateStr),
        dateRangeEnd: clampEnd(format(addDays(date, 6), 'yyyy-MM-dd'))
      }
    } else {
      const monthDate = new Date(parseInt(year), parseInt(month) - 1)
      const monthStart = format(startOfMonth(monthDate), 'yyyy-MM-dd')
      const monthEnd = format(endOfMonth(monthDate), 'yyyy-MM-dd')
      return {
        displayName: format(monthDate, 'MMMM yyyy'),
        dateRangeStart: clampStart(monthStart),
        dateRangeEnd: clampEnd(monthEnd)
      }
    }
  }, [granularity, day, year, month, filters.dateRange.from, filters.dateRange.to])

  // memoized property click handler
  const handlePropertyClick = useCallback((propertyId: string, propertyName: string) => {
    openModal({ type: 'property', propertyId, propertyName, from: dateRangeStart, to: dateRangeEnd })
  }, [openModal, dateRangeStart, dateRangeEnd])

  // memoized guest click handler
  const handleGuestClick = useCallback((guestId: string, guestName: string) => {
    openModal({ type: 'guest', guestId, guestName })
  }, [openModal])
  
  const { data, isLoading, error } = usePeriodDetail(
    dateRangeStart,
    dateRangeEnd,
    filters.selectedTags.map(t => t.id)
  )

  const subtitle = isLoading ? "Loading details..." :
                   error ? "Unable to load details" :
                   `Detailed breakdown for ${displayName}`

  return (
    <Modal
      isOpen={true}
      onClose={closeModal}
      title={displayName}
      subtitle={subtitle}
      size="lg"
    >
      <StateWrapper
        loading={isLoading}
        error={error}
        empty={!data && !isLoading && !error}
        loadingMessage="Loading period details..."
        errorMessage="Failed to load period details"
        emptyMessage="No data available for this period"
        minHeight={400}
      >
        <div className="space-y-6">
        {/* Info Banner */}
        {showTips && (
          <div className="bg-info-subtle border border-info/30 rounded-lg p-4">
            <div className="flex items-start">
              <Info className="w-5 h-5 text-info mr-2 mt-0.5" />
              <div className="text-sm text-info-fg">
                <strong>{granularity === 'daily' ? 'Daily' : granularity === 'weekly' ? 'Weekly' : 'Monthly'} Summary:</strong> Performance across all properties for {displayName}. Click any property or guest for details.
              </div>
            </div>
          </div>
        )}

        {/* Key Metrics */}
        {data?.metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card p-4 rounded-lg border">
              <div className="flex items-center text-sm text-muted-foreground mb-1">
                <DollarSign className="w-4 h-4 mr-1" />
                Total Revenue
              </div>
              <div className="text-2xl font-bold">{formatCurrency(data?.metrics?.revenue || 0)}</div>
            </div>
            <div className="bg-card p-4 rounded-lg border">
              <div className="flex items-center text-sm text-muted-foreground mb-1">
                <Calendar className="w-4 h-4 mr-1" />
                Total Bookings
              </div>
              <div className="text-2xl font-bold">{data?.metrics?.bookings || 0}</div>
            </div>
            <div className="bg-card p-4 rounded-lg border">
              <div className="flex items-center text-sm text-muted-foreground mb-1">
                <Home className="w-4 h-4 mr-1" />
                Occupancy Rate
              </div>
              <div className="text-2xl font-bold">{formatPercentage((data?.metrics?.occupancyRate || 0) * 100, 1)}</div>
            </div>
            <div className="bg-card p-4 rounded-lg border">
              <div className="flex items-center text-sm text-muted-foreground mb-1">
                <TrendingUp className="w-4 h-4 mr-1" />
                Average Rate
              </div>
              <div className="text-2xl font-bold">{formatCurrency(data?.metrics?.avgNightlyRate || 0)}</div>
            </div>
          </div>
        )}

        {/* Financial Summary */}
        {data?.costs && (data.costs.platformFees > 0 || data.costs.taxes > 0 || data.costs.operatingExpenses > 0) && (
          <div className="bg-card rounded-lg border p-4">
            <h3 className="font-semibold mb-3">Financial Summary</h3>
            <div className="space-y-2">
              {data.costs.platformFees > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Platform Fees (est.)</span>
                  <span className="font-medium text-warning">-{formatCurrency(data.costs.platformFees)}</span>
                </div>
              )}
              {data.costs.taxes > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Taxes</span>
                  <span className="font-medium text-info">-{formatCurrency(data.costs.taxes)}</span>
                </div>
              )}
              {data.costs.operatingExpenses > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Operating Expenses</span>
                  <span className="font-medium text-danger">-{formatCurrency(data.costs.operatingExpenses)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t font-semibold">
                <span>Net Revenue</span>
                <span className={data.costs.netRevenue >= 0 ? 'text-success' : 'text-danger'}>
                  {formatCurrency(data.costs.netRevenue)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Top Properties */}
        <div className="bg-card rounded-lg border">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Top Properties This {granularity === 'daily' ? 'Day' : granularity === 'weekly' ? 'Week' : 'Month'}</h3>
          </div>
          <div className="divide-y">
            {data?.topProperties?.slice(0, 5).map((property: PeriodProperty) => (
              <div
                key={property.propertyId}
                className="p-4 hover:bg-muted/40 cursor-pointer flex justify-between items-center"
                onClick={() => handlePropertyClick(property.propertyId, property.propertyName)}
              >
                <div>
                  <div className="font-medium">{property.propertyName}</div>
                  <div className="text-sm text-muted-foreground">
                    {property.bookings} bookings • {formatPercentage(property.occupancyRate * 100, 1)} occupancy
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-success">{formatCurrency(property.revenue)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bookings List */}
        <div className="bg-card rounded-lg border">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Active Bookings on {displayName}</h3>
          </div>
          <div className="max-h-96 overflow-y-auto pr-2">
            <table className="w-full">
              <thead className="bg-muted/40 sticky top-0">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-foreground">Guest</th>
                  <th className="text-left p-4 text-sm font-medium text-foreground">Property</th>
                  <th className="text-left p-4 text-sm font-medium text-foreground">Dates</th>
                  <th className="text-left p-4 text-sm font-medium text-foreground">Amount</th>
                  <th className="text-left p-4 text-sm font-medium text-foreground w-10"></th>
                </tr>
              </thead>
              <tbody>
                {data?.bookings?.map((booking: PeriodBooking) => (
                  <tr key={booking.id} className="border-t hover:bg-muted/40">
                    <td
                      className="p-4 cursor-pointer"
                      onClick={() => booking.guestId && handleGuestClick(booking.guestId, booking.guestName)}
                    >
                      <div className="font-medium text-primary hover:underline">
                        {booking.guestName}
                      </div>
                    </td>
                    <td
                      className="p-4 cursor-pointer"
                      onClick={() => handlePropertyClick(booking.propertyId, booking.propertyName)}
                    >
                      <div className="text-primary hover:underline">
                        {booking.propertyName}
                      </div>
                    </td>
                    <td className="p-4 text-sm">
                      {formatDateDisplay(booking.arrival)} - {formatDateDisplay(booking.departure)}
                    </td>
                    <td className="p-4 font-medium">
                      {formatCurrency(booking.totalAmount)}
                    </td>
                    <td className="p-4">
                      {booking.ownerrezBookingId && (
                        <a
                          href={`https://app.ownerrez.com/bookings/${booking.ownerrezBookingId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary transition-colors"
                          title="Open in OwnerRez"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      </StateWrapper>
    </Modal>
  )
}