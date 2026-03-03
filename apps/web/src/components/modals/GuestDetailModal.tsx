import { useMemo, useState } from 'react'
import { useGuestDetail } from '@/hooks/use-api'
import { formatCurrency, formatDateDisplay, format, parseDate } from '@baileys/utils'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { User, Calendar, DollarSign, TrendingUp, Home, Mail, Star, Info, Award, ExternalLink, ChevronRight, ChevronDown } from 'lucide-react'
import { StateWrapper } from '@/components/StateWrapper'
import { StatusBadge } from '@/components/StatusBadge'
import { Modal } from '@/components/Modal'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useModal } from '@/contexts/modal'
import { useTips } from '@/hooks/use-tips'
import { METRIC_COLORS } from '@/lib/theme'

const GuestSpendingTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const data = payload[0].payload

  return (
    <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
      <p className="font-semibold text-sm mb-2">{label}</p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: METRIC_COLORS.revenue }} />
            <span className="text-gray-600">Spent:</span>
          </div>
          <span className="font-medium">{formatCurrency(data.amount)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Bookings:</span>
          <span className="font-medium">{data.bookings}</span>
        </div>
        {data.bookings > 0 && (
          <div className="pt-1 mt-1 border-t border-gray-200">
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Avg per booking:</span>
              <span className="font-medium">{formatCurrency(data.amount / data.bookings)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const BookingHistoryTable = ({ bookingHistory }: { bookingHistory: any[] }) => {
  const [expandedBooking, setExpandedBooking] = useState<string | null>(null)

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="max-h-96 overflow-y-auto">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="text-left p-4 text-sm font-medium text-gray-700">Property</th>
              <th className="text-left p-4 text-sm font-medium text-gray-700">Check In</th>
              <th className="text-left p-4 text-sm font-medium text-gray-700">Check Out</th>
              <th className="text-left p-4 text-sm font-medium text-gray-700">Amount</th>
              <th className="text-left p-4 text-sm font-medium text-gray-700">Status</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody>
            {bookingHistory.map((booking: any) => {
              const hasCharges = booking.charges && booking.charges.length > 0
              const isExpanded = expandedBooking === booking.id

              return (
                <>
                  <tr
                    key={booking.id}
                    className={`border-t ${hasCharges ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                    onClick={() => hasCharges && setExpandedBooking(isExpanded ? null : booking.id)}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        {hasCharges && (
                          isExpanded
                            ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            : <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        )}
                        <div>
                          <div className="font-medium text-gray-900">{booking.propertyName}</div>
                          <div className="text-sm text-gray-500">{booking.nights} nights</div>
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
                    </td>
                    <td className="p-4">
                      <StatusBadge status={booking.status} />
                    </td>
                    <td className="p-4">
                      {booking.ownerrezBookingId && (
                        <a
                          href={`https://app.ownerrez.com/bookings/${booking.ownerrezBookingId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                          title="Open in OwnerRez"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </td>
                  </tr>
                  {isExpanded && hasCharges && (
                    <tr key={`${booking.id}-charges`} className="bg-gray-50">
                      <td colSpan={6} className="px-8 py-3">
                        <div className="text-xs font-medium text-gray-500 mb-2">Charge Breakdown</div>
                        <div className="space-y-1">
                          {booking.charges.map((charge: any, i: number) => (
                            <div key={charge.id || i} className="flex justify-between text-sm">
                              <span className="text-gray-600 flex items-center gap-1.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  charge.type === 'tax' ? 'bg-red-400' :
                                  charge.type === 'fee' ? 'bg-amber-400' :
                                  charge.type === 'discount' ? 'bg-green-400' :
                                  'bg-gray-400'
                                }`} />
                                {charge.description || charge.type}
                              </span>
                              <span className={`font-medium ${charge.type === 'discount' ? 'text-green-600' : ''}`}>
                                {charge.type === 'discount' ? '-' : ''}{formatCurrency(Math.abs(charge.amount))}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
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
          <p className="text-gray-600">Something went wrong. Please try again.</p>
        </div>
      </Modal>
    )
  }

  const guest = data?.guest
  const bookingHistory = data?.bookings || []
  const spendingTrend = data?.spendingTrend || []

  // memoized metrics
  const totalSpent = useMemo(() =>
    guest?.totalSpent || bookingHistory.reduce((sum: number, b: any) => sum + b.totalAmount, 0)
  , [guest?.totalSpent, bookingHistory])

  const avgStayLength = useMemo(() =>
    guest?.avgStayLength || (bookingHistory.length > 0
      ? bookingHistory.reduce((sum: number, b: any) => sum + b.nights, 0) / bookingHistory.length
      : 0)
  , [guest?.avgStayLength, bookingHistory])

  const chartData = useMemo(() =>
    spendingTrend.map((item: any) => ({
      month: format(parseDate(`${item.month}-01`), 'MMM yyyy'),
      amount: item.amount,
      bookings: item.bookings
    }))
  , [spendingTrend])

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
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
              <div className="text-sm text-blue-800">
                <strong>Guest Profile:</strong> View this guest's complete booking history and spending patterns.
              </div>
            </div>
          </div>
        )}

        {/* Guest Info Card */}
        <div className="bg-gray-50 rounded-lg p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center mb-2">
                <User className="w-5 h-5 mr-2 text-gray-600" />
                <h3 className="text-lg font-bold">{guest?.name || guestName}</h3>
              </div>
              {guest?.email && (
                <div className="flex items-center text-sm text-gray-600 mb-2">
                  <Mail className="w-4 h-4 mr-1" />
                  <a href={`mailto:${guest.email}`} className="text-blue-600 hover:underline">
                    {guest.email}
                  </a>
                </div>
              )}
              {guest?.phone && (
                <div className="flex items-center text-sm text-gray-600 mb-2">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {guest.phone}
                </div>
              )}
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                {guest?.firstVisit && <span>First visit: {formatDateDisplay(guest.firstVisit)}</span>}
                {guest?.lastVisit && <span>Last visit: {formatDateDisplay(guest.lastVisit)}</span>}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              {/* Performance Badges */}
              {performanceData?.isTopSpender && (
                <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                  <DollarSign className="w-4 h-4 mr-1" />
                  Top Spender
                </span>
              )}
              {performanceData?.isFrequent && !performanceData?.isTopSpender && (
                <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                  <Star className="w-4 h-4 mr-1" />
                  Frequent Guest
                </span>
              )}
              {performanceData?.isNew && !performanceData?.isTopSpender && !performanceData?.isFrequent && (
                <span className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
                  <Award className="w-4 h-4 mr-1" />
                  New Guest
                </span>
              )}
              {guest?.isRepeat && !performanceData?.isNew && (
                <span className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-800 text-sm rounded-full">
                  <Star className="w-4 h-4 mr-1" />
                  Returning Guest
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center text-sm text-gray-600 mb-1">
              <Calendar className="w-4 h-4 mr-1" />
              Total Stays
            </div>
            <div className="text-2xl font-bold">{bookingHistory.length}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center text-sm text-gray-600 mb-1">
              <DollarSign className="w-4 h-4 mr-1" />
              Total Spent
            </div>
            <div className="text-2xl font-bold">{formatCurrency(totalSpent)}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center text-sm text-gray-600 mb-1">
              <Home className="w-4 h-4 mr-1" />
              Average Stay
            </div>
            <div className="text-2xl font-bold">{avgStayLength.toFixed(1)} nights</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center text-sm text-gray-600 mb-1">
              <TrendingUp className="w-4 h-4 mr-1" />
              Average Per Stay
            </div>
            <div className="text-2xl font-bold">
              {formatCurrency(bookingHistory.length > 0 ? totalSpent / bookingHistory.length : 0)}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview">
          <TabsList variant="line">
            <TabsTrigger value="overview">Spending Pattern</TabsTrigger>
            <TabsTrigger value="bookings">Booking History ({bookingHistory.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            {chartData.length > 0 && (
              <div className="bg-white p-6 rounded-lg border">
                <h3 className="text-lg font-bold mb-4">Spending Over Time</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
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

          <TabsContent value="bookings">
            <BookingHistoryTable bookingHistory={bookingHistory} />
          </TabsContent>
        </Tabs>
        </div>
      </StateWrapper>
    </Modal>
  )
}