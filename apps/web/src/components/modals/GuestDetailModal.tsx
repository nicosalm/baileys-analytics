import { useState } from 'react'
import { useGuestDetail } from '@/hooks/use-api'
import { formatCurrency, formatDateDisplay, format, parseDate } from '@baileys/utils'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { User, Calendar, DollarSign, TrendingUp, Home, Mail, Star, Info, Award } from 'lucide-react'
import { StateWrapper } from '@/components/StateWrapper'
import { StatusBadge } from '@/components/StatusBadge'
import { Modal } from '@/components/Modal'
import { useModal } from '@/contexts/modal'
import { useTips } from '@/hooks/use-tips'
import { METRIC_COLORS } from '@/lib/theme'

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
  const { closeModal, openModal } = useModal()
  const { showTips } = useTips()
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings'>('overview')
  
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

  // Calculate simple metrics
  const totalSpent = guest?.totalSpent || bookingHistory.reduce((sum: number, b: any) => sum + b.totalAmount, 0)
  const avgStayLength = guest?.avgStayLength || (bookingHistory.length > 0 
    ? bookingHistory.reduce((sum: number, b: any) => sum + b.nights, 0) / bookingHistory.length
    : 0)

  const chartData = spendingTrend.map((item: any) => ({
    month: format(parseDate(`${item.month}-01`), 'MMM yyyy'),
    amount: item.amount,
    bookings: item.bookings
  }))

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
                Click any property to see its details.
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
                {guest?.firstVisit && <span>First visit: {formatDateDisplay(new Date(guest.firstVisit))}</span>}
                {guest?.lastVisit && <span>Last visit: {formatDateDisplay(new Date(guest.lastVisit))}</span>}
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
        <div className="border-b">
          <nav className="flex space-x-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-2 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Spending Pattern
            </button>
            <button
              onClick={() => setActiveTab('bookings')}
              className={`pb-2 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'bookings'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Booking History ({bookingHistory.length})
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && chartData.length > 0 && (
          <div className="bg-white p-6 rounded-lg border">
            <h3 className="text-lg font-bold mb-4">Spending Over Time</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                  <Tooltip 
                    formatter={(value: any, name: string) => {
                      if (name === 'amount') return formatCurrency(value)
                      return value
                    }}
                    labelFormatter={(label) => `Month: ${label}`}
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                  />
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

        {activeTab === 'bookings' && (
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
                  </tr>
                </thead>
                <tbody>
                  {bookingHistory.map((booking: any) => (
                    <tr
                      key={booking.id}
                      className="border-t hover:bg-gray-50 cursor-pointer"
                      onClick={() => openModal({ 
                        type: 'property', 
                        propertyId: booking.propertyId, 
                        propertyName: booking.propertyName 
                      })}
                    >
                      <td className="p-4">
                        <div className="font-medium text-blue-600 hover:underline">{booking.propertyName}</div>
                        <div className="text-sm text-gray-500">{booking.nights} nights</div>
                      </td>
                      <td className="p-4 text-sm">
                        {formatDateDisplay(new Date(booking.arrival))}
                      </td>
                      <td className="p-4 text-sm">
                        {formatDateDisplay(new Date(booking.departure))}
                      </td>
                      <td className="p-4 text-sm font-medium">
                        {formatCurrency(booking.totalAmount)}
                      </td>
                      <td className="p-4">
                        <StatusBadge status={booking.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </div>
      </StateWrapper>
    </Modal>
  )
}