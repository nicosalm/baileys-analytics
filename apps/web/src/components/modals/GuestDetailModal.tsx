import { useMemo, useState, Fragment } from 'react'
import { useGuestDetail } from '@/hooks/use-api'
import { formatCurrency, formatDateDisplay, format, parseDate } from '@baileys/utils'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Label } from 'recharts'
import { User, Calendar, DollarSign, TrendingUp, Home, Mail, Star, Info, Award, ExternalLink, ChevronDown, Sparkles, Tags } from 'lucide-react'
import { CollapsibleTags } from '@/components/CollapsibleTags'
import { StateWrapper } from '@/components/StateWrapper'
import { StatusBadge } from '@/components/StatusBadge'
import { Modal } from '@/components/Modal'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useModal } from '@/contexts/modal'
import { useTips } from '@/hooks/use-tips'
import { METRIC_COLORS, CHART_INFRA, resolveToken } from '@/lib/theme'
import type { TooltipContentProps } from 'recharts'

interface BookingCharge {
  type: string
  amount: number
  description?: string
}

interface FeeAnalysis {
  rent: number
  surcharges: number
  taxes: number
  ccFees: number
  platformFees: number
  directSavings: number
}

const GuestSpendingTooltip = ({ active, payload, label }: Partial<TooltipContentProps<number, string>>) => {
  if (!active || !payload?.length) return null
  const data = payload![0].payload as { amount: number; bookings: number }

  return (
    <div className="bg-card p-3 rounded-lg shadow-lg border border-border">
      <p className="font-semibold text-sm mb-2">{label}</p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: METRIC_COLORS.revenue }} />
            <span className="text-muted-foreground">Spent:</span>
          </div>
          <span className="font-medium">{formatCurrency(data.amount)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Bookings:</span>
          <span className="font-medium">{data.bookings}</span>
        </div>
        {data.bookings > 0 && (
          <div className="pt-1 mt-1 border-t border-border">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Avg per booking:</span>
              <span className="font-medium">{formatCurrency(data.amount / data.bookings)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function categorizeCharges(charges: BookingCharge[]) {
  const isSurcharge = (c: BookingCharge) => c.type === 'surcharge' || c.type === 'surcharge_other'
  const rent = charges.filter(c => c.type === 'rent')
  const ccFees = charges.filter(c => isSurcharge(c) && c.description?.toLowerCase().includes('credit card'))
  const surcharges = charges.filter(c => isSurcharge(c) && !c.description?.toLowerCase().includes('credit card'))
  const taxes = charges.filter(c => c.type === 'tax')
  const discounts = charges.filter(c => c.type === 'discount')
  return { rent, surcharges, taxes, ccFees, discounts }
}

function sumCharges(charges: BookingCharge[]) {
  return charges.reduce((s, c) => s + (c.amount || 0), 0)
}

type GuestDetailBooking = NonNullable<ReturnType<typeof useGuestDetail>['data']>['bookings'][number]

const BookingFeeBreakdown = ({ booking }: { booking: GuestDetailBooking }) => {
  const charges: BookingCharge[] = booking.charges || []
  const { rent, surcharges, taxes, ccFees, discounts } = categorizeCharges(charges)
  const guestFee = booking.guestListingSiteFee || 0
  const hostFee = booking.hostServiceFee || 0
  const ccFeeTotal = sumCharges(ccFees)
  const platformFees = guestFee + hostFee
  const directSavings = platformFees + ccFeeTotal
  const totalGuestPaid = (booking.totalAmount || 0) + guestFee

  return (
    <div className="space-y-3">
      {/* host-side charges */}
      <div className="space-y-1">
        {rent.map((c, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-muted-foreground">Rent</span>
            <span className="font-medium">{formatCurrency(c.amount)}</span>
          </div>
        ))}
        {surcharges.map((c, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{c.description || 'Surcharge'}</span>
            <span className="font-medium">{formatCurrency(c.amount)}</span>
          </div>
        ))}
        {discounts.map((c, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{c.description || 'Discount'}</span>
            <span className="font-medium text-success">-{formatCurrency(Math.abs(c.amount))}</span>
          </div>
        ))}
        {taxes.map((c, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{c.description || 'Tax'}</span>
            <span className="font-medium">{formatCurrency(c.amount)}</span>
          </div>
        ))}
        {ccFees.map((c, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{c.description || 'Credit card fee'}</span>
            <span className="font-medium">{formatCurrency(c.amount)}</span>
          </div>
        ))}
      </div>

      {/* booking total */}
      <div className="flex justify-between text-sm font-semibold border-t pt-2">
        <span>Booking total</span>
        <span>{formatCurrency(booking.totalAmount)}</span>
      </div>

      {/* guest-facing fee (only for platforms that charge guests on top, e.g. Vrbo) */}
      {guestFee > 0 && (
        <>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{booking.platform} guest fee <span className="text-xs">(est.)</span></span>
            <span className="font-medium text-warning">{formatCurrency(guestFee)}</span>
          </div>
          <div className="flex justify-between text-sm font-semibold border-t pt-2">
            <span>Guest paid (total)</span>
            <span>{formatCurrency(totalGuestPaid)}</span>
          </div>
        </>
      )}

      {/* direct booking savings callout */}
      {directSavings > 0 && (
        <div className="bg-success-subtle border border-success/30 rounded-md px-3 py-2 flex items-start gap-2 mt-1">
          <Sparkles className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
          <div className="text-xs text-success-fg">
            <span className="font-semibold">Direct booking saves {formatCurrency(directSavings)}</span>
            {platformFees > 0 && ccFeeTotal > 0
              ? `: ${formatCurrency(platformFees)} in platform fees and ${formatCurrency(ccFeeTotal)} in credit card fees.`
              : platformFees > 0
              ? ` by eliminating ${booking.platform} platform fees.`
              : ` by eliminating credit card fees via Zelle.`}
          </div>
        </div>
      )}
    </div>
  )
}

const BookingHistoryTable = ({ bookingHistory }: { bookingHistory: GuestDetailBooking[] }) => {
  const [expandedBooking, setExpandedBooking] = useState<string | null>(null)

  return (
    <div className="bg-card rounded-lg border overflow-hidden">
      <div className="max-h-[500px] overflow-y-auto pr-2">
        <table className="w-full">
          <thead className="bg-muted sticky top-0">
            <tr>
              <th className="text-left p-4 text-sm font-medium text-foreground">Property</th>
              <th className="text-left p-4 text-sm font-medium text-foreground">Check In</th>
              <th className="text-left p-4 text-sm font-medium text-foreground">Check Out</th>
              <th className="text-left p-4 text-sm font-medium text-foreground">Amount</th>
              <th className="text-left p-4 text-sm font-medium text-foreground">Status</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody>
            {bookingHistory.map((booking, idx) => {
              const hasCharges = booking.charges && booking.charges.length > 0
              const bookingKey = booking.id ?? `booking-${idx}`
              const isExpanded = expandedBooking === booking.id

              return (
                <Fragment key={bookingKey}>
                  <tr
                    key={bookingKey}
                    className={`border-t ${hasCharges ? 'cursor-pointer hover:bg-muted/40' : ''}`}
                    onClick={() => hasCharges && setExpandedBooking(isExpanded ? null : booking.id ?? null)}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        {hasCharges && (
                          <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`} />
                        )}
                        <div>
                          <div className="font-medium text-foreground">{booking.propertyName}</div>
                          <div className="text-sm text-muted-foreground">{booking.nights} nights · {booking.platform}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm">
                      {formatDateDisplay(booking.arrival)}
                    </td>
                    <td className="p-4 text-sm">
                      {formatDateDisplay(booking.departure)}
                    </td>
                    <td className="p-4 text-sm font-medium">
                      {formatCurrency(booking.totalAmount)}
                      {(booking.guestListingSiteFee ?? 0) > 0 && (
                        <div className="text-xs text-muted-foreground font-normal">
                          +{formatCurrency(booking.guestListingSiteFee!)} guest fee (est.)
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <StatusBadge status={booking.status || 'unknown'} />
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
                  {isExpanded && hasCharges && (
                    <tr className="bg-muted/40">
                      <td colSpan={6} className="px-8 py-4">
                        <BookingFeeBreakdown booking={booking} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const FeeTooltip = ({ active, payload }: Partial<TooltipContentProps<number, string>>) => {
  if (!active || !payload?.length) return null
  const data = payload[0]
  return (
    <div className="bg-card p-3 rounded-lg shadow-lg border border-border">
      <p className="font-semibold text-sm mb-1">{data.name}</p>
      <p className="text-xs">
        <span className="text-muted-foreground">Amount: </span>
        <span className="font-medium">{formatCurrency(data.value)}</span>
      </p>
    </div>
  )
}

const FEE_PIE_COLORS = {
  rent: '#6366f1',
  surcharges: '#8b5cf6',
  taxes: '#f59e0b',
  ccFees: '#ef4444',
  platformFees: '#f97316',
}

const FeeAnalysisTab = ({ feeAnalysis, guestName }: { feeAnalysis: FeeAnalysis, guestName: string }) => {
  const { rent, surcharges, taxes, ccFees, platformFees, directSavings } = feeAnalysis
  const total = rent + surcharges + taxes + ccFees + platformFees
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const pieData = [
    { name: 'Rent', value: rent, color: FEE_PIE_COLORS.rent },
    { name: 'Surcharges', value: surcharges, color: FEE_PIE_COLORS.surcharges },
    { name: 'Taxes', value: taxes, color: FEE_PIE_COLORS.taxes },
    { name: 'Credit card fee', value: ccFees, color: FEE_PIE_COLORS.ccFees },
    { name: 'Platform fees', value: platformFees, color: FEE_PIE_COLORS.platformFees },
  ].filter(d => d.value > 0)

  if (total === 0) {
    return (
      <div className="bg-card p-6 rounded-lg border text-center text-muted-foreground">
        No charge breakdown available for this guest.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-card p-6 rounded-lg border">
        <h3 className="text-lg font-bold mb-1">Where {guestName}'s money went</h3>
        <p className="text-sm text-muted-foreground mb-4">Across all stays</p>
        <div className="flex gap-8 items-center">
          <div className="h-56 flex-shrink-0" style={{ width: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={88}
                  dataKey="value"
                  stroke={resolveToken('--card')}
                  strokeWidth={2}
                  animationBegin={0}
                  animationDuration={500}
                  animationEasing="ease-out"
                  onMouseEnter={(_: unknown, index: number) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  {pieData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.color}
                      opacity={activeIndex === null || activeIndex === i ? 1 : 0.3}
                      style={{ transition: 'opacity 0.2s ease' }}
                    />
                  ))}
                  <Label
                    content={({ viewBox }) => {
                      const { cx, cy } = viewBox as { cx: number; cy: number }
                      return (
                        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan x={cx} y={cy - 7} className="fill-foreground text-base font-bold">
                            {formatCurrency(total)}
                          </tspan>
                          <tspan x={cx} y={cy + 11} className="fill-muted-foreground text-[10px]">
                            Spent
                          </tspan>
                        </text>
                      )
                    }}
                  />
                </Pie>
                <Tooltip content={<FeeTooltip />} isAnimationActive={false} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-2">
            {pieData.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground">{item.name}</span>
                </div>
                <div className="text-right">
                  <span className="font-medium">{formatCurrency(item.value)}</span>
                  <span className="text-muted-foreground text-xs ml-1">({((item.value / total) * 100).toFixed(0)}%)</span>
                </div>
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between text-sm font-semibold">
              <span>Total (incl. platform fees)</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>
      </div>

      {directSavings > 0 && (
        <div className="bg-success-subtle border border-success/30 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <Sparkles className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-success-fg">
                Direct booking opportunity: {formatCurrency(directSavings)} in savings
              </p>
              <p className="text-sm text-success-fg/80 mt-1">
                {guestName} paid {formatCurrency(platformFees + ccFees)} in avoidable fees across all stays —
                {platformFees > 0 && ` ${formatCurrency(platformFees)} in platform fees`}
                {platformFees > 0 && ccFees > 0 && ' and'}
                {ccFees > 0 && ` ${formatCurrency(ccFees)} in credit card processing`}.
                Booking direct eliminates both.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface GuestDetailModalProps {
  guestId: string
  guestName: string
  performanceData?: {
    isTopSpender?: boolean
    isFrequent?: boolean
    isNew?: boolean
  }
}

export const GuestDetailModal = ({ guestId, guestName, performanceData }: GuestDetailModalProps) => {
  const { closeModal } = useModal()
  const { showTips } = useTips()
  
  const { data, isLoading, error } = useGuestDetail(guestId)

  const subtitle = isLoading ? "Loading guest information..." :
                   error ? "Unable to load guest details" :
                   `Viewing guest profile`
  
  if (!isLoading && !error && !data) {
    return (
      <Modal
        isOpen={true}
        onClose={closeModal}
        title={guestName}
        subtitle="Unable to load guest details"
        size="lg"
      >
        <div className="text-center py-12">
          <p className="text-muted-foreground">Something went wrong. Please try again.</p>
        </div>
      </Modal>
    )
  }

  const guest = data?.guest
  const bookingHistory = data?.bookings || []
  const spendingTrend = data?.spendingTrend || []

  // memoized metrics
  const totalSpent = useMemo(() =>
    guest?.totalSpent || bookingHistory.reduce((sum, b) => sum + b.totalAmount, 0)
  , [guest?.totalSpent, bookingHistory])

  const avgStayLength = useMemo(() =>
    guest?.avgStayLength || (bookingHistory.length > 0
      ? bookingHistory.reduce((sum, b) => sum + (b.nights || 0), 0) / bookingHistory.length
      : 0)
  , [guest?.avgStayLength, bookingHistory])

  const chartData = useMemo(() =>
    spendingTrend.map((item) => ({
      month: format(parseDate(`${item.month}-01`), 'MMM yyyy'),
      amount: item.amount,
      bookings: item.bookings
    }))
  , [spendingTrend])

  // aggregate fee breakdown across all bookings
  const feeAnalysis = useMemo(() => {
    let rent = 0, surcharges = 0, taxes = 0, ccFees = 0, guestFees = 0, hostFees = 0
    for (const b of bookingHistory) {
      const cats = categorizeCharges(b.charges || [])
      rent += sumCharges(cats.rent)
      surcharges += sumCharges(cats.surcharges)
      taxes += sumCharges(cats.taxes)
      ccFees += sumCharges(cats.ccFees)
      guestFees += b.guestListingSiteFee || 0
      hostFees += b.hostServiceFee || 0
    }
    const platformFees = guestFees + hostFees
    const directSavings = platformFees + ccFees
    return { rent, surcharges, taxes, ccFees, platformFees, directSavings }
  }, [bookingHistory])

  return (
    <Modal
      isOpen={true}
      onClose={closeModal}
      title={guestName}
      subtitle={subtitle}
      size="lg"
    >
      <StateWrapper
        loading={isLoading}
        error={error}
        empty={!data && !isLoading && !error}
        loadingMessage="Loading guest information..."
        errorMessage="Failed to load guest details"
        emptyMessage="No guest data available"
        minHeight={400}
      >
        <div className="space-y-6">
        {/* Info Banner */}
        {showTips && (
          <div className="bg-info-subtle border border-info/30 rounded-lg p-4">
            <div className="flex items-start">
              <Info className="w-5 h-5 text-info mr-2 mt-0.5" />
              <div className="text-sm text-info-fg">
                <strong>Guest Profile:</strong> Full booking history and spending for this guest.
              </div>
            </div>
          </div>
        )}

        {/* Guest Info Card */}
        <div className="bg-muted/40 rounded-lg p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center mb-2">
                <User className="w-5 h-5 mr-2 text-muted-foreground" />
                <h3 className="text-lg font-bold">{guest?.name || guestName}</h3>
              </div>
              {guest?.email && (
                <div className="flex items-center text-sm text-muted-foreground mb-2">
                  <Mail className="w-4 h-4 mr-1" />
                  <a href={`mailto:${guest.email}`} className="text-primary hover:underline">
                    {guest.email}
                  </a>
                </div>
              )}
              {guest?.phone && (
                <div className="flex items-center text-sm text-muted-foreground mb-2">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {guest.phone}
                </div>
              )}
              {guest?.tags && guest.tags.length > 0 && (
                <div className="flex items-center gap-1.5 mb-2">
                  <Tags className="w-4 h-4 text-muted-foreground" />
                  <CollapsibleTags tags={guest.tags} maxVisible={5} size="sm" />
                </div>
              )}
              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                {guest?.firstVisit && <span>First visit: {formatDateDisplay(guest.firstVisit)}</span>}
                {guest?.lastVisit && <span>Last visit: {formatDateDisplay(guest.lastVisit)}</span>}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              {/* Performance Badges */}
              {performanceData?.isTopSpender && (
                <span className="inline-flex items-center px-3 py-1 bg-success-subtle text-success-fg text-sm rounded-full">
                  <DollarSign className="w-4 h-4 mr-1" />
                  Top Spender
                </span>
              )}
              {performanceData?.isFrequent && !performanceData?.isTopSpender && (
                <span className="inline-flex items-center px-3 py-1 bg-info-subtle text-info-fg text-sm rounded-full">
                  <Star className="w-4 h-4 mr-1" />
                  Frequent Guest
                </span>
              )}
              {performanceData?.isNew && !performanceData?.isTopSpender && !performanceData?.isFrequent && (
                <span className="inline-flex items-center px-3 py-1 bg-purple-subtle text-purple-fg text-sm rounded-full">
                  <Award className="w-4 h-4 mr-1" />
                  New Guest
                </span>
              )}
              {guest?.isRepeat && !performanceData?.isNew && (
                <span className="inline-flex items-center px-3 py-1 bg-muted text-muted-foreground text-sm rounded-full">
                  <Star className="w-4 h-4 mr-1" />
                  Returning Guest
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-card p-4 rounded-lg border">
            <div className="flex items-center text-sm text-muted-foreground mb-1">
              <Calendar className="w-4 h-4 mr-1" />
              Total Stays
            </div>
            <div className="text-2xl font-bold">{bookingHistory.length}</div>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <div className="flex items-center text-sm text-muted-foreground mb-1">
              <DollarSign className="w-4 h-4 mr-1" />
              Total Spent
            </div>
            <div className="text-2xl font-bold">{formatCurrency(totalSpent)}</div>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <div className="flex items-center text-sm text-muted-foreground mb-1">
              <Home className="w-4 h-4 mr-1" />
              Average Stay
            </div>
            <div className="text-2xl font-bold">{avgStayLength.toFixed(1)} nights</div>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <div className="flex items-center text-sm text-muted-foreground mb-1">
              <TrendingUp className="w-4 h-4 mr-1" />
              Average Per Stay
            </div>
            <div className="text-2xl font-bold">
              {formatCurrency(bookingHistory.length > 0 ? totalSpent / bookingHistory.length : 0)}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="bookings">
          <TabsList variant="line">
            <TabsTrigger value="bookings">Booking History ({bookingHistory.length})</TabsTrigger>
            <TabsTrigger value="overview">Spending Pattern</TabsTrigger>
            <TabsTrigger value="fees">Fee Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="bookings">
            <BookingHistoryTable bookingHistory={bookingHistory} />
          </TabsContent>

          <TabsContent value="overview">
            {chartData.length > 0 && (
              <div className="bg-card p-6 rounded-lg border">
                <h3 className="text-lg font-bold mb-4">Spending Over Time</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_INFRA.grid} />
                      <XAxis dataKey="month" stroke={CHART_INFRA.axis} tick={{ fill: CHART_INFRA.axis }} />
                      <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} stroke={CHART_INFRA.axis} tick={{ fill: CHART_INFRA.axis }} />
                      <Tooltip content={<GuestSpendingTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="amount"
                        stroke={METRIC_COLORS.revenue}
                        strokeWidth={2}
                        dot={{ fill: METRIC_COLORS.revenue, r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="fees">
            <FeeAnalysisTab feeAnalysis={feeAnalysis} guestName={guest?.name || guestName} />
          </TabsContent>
        </Tabs>
        </div>
      </StateWrapper>
    </Modal>
  )
}