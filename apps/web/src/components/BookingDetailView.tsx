import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { formatCurrency, calculateNightsBetween } from '@baileys/utils'
import { Calendar, User, DollarSign, Tag } from 'lucide-react'
import { Spinner } from '@/components/Spinner'

type BookingDetail = {
  booking: {
    id: string
    ownerrezBookingId: string
    propertyName: string
    guestName: string
    guestEmail?: string
    arrival: string
    departure: string
    adults: number
    children: number
    totalAmount: number
    status: string
    platform?: string
    bookedDate: string
  }
  charges: Array<{
    id: string
    type: string
    description: string
    amount: number
    isTaxable: boolean
  }>
  tags: Array<{
    id: string
    name: string
    type: string
    color?: string
  }>
}

const getTagColor = (tag: { type: string; color?: string }) => {
  // Normalize to return same shape regardless of whether tag.color exists
  if (tag.color) {
    return {
      bg: '',
      text: '',
      border: '',
      backgroundColor: `${tag.color}20`, // Add transparency
      color: tag.color,
      borderColor: tag.color
    }
  }

  const typeColors = {
    payment: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
    guest: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
    booking: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
    property: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
    custom: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' }
  }

  const defaultColors = typeColors[tag.type as keyof typeof typeColors] || typeColors.custom

  return {
    ...defaultColors,
    backgroundColor: '',
    color: '',
    borderColor: ''
  }
}

export const BookingDetailView = ({ bookingId }: { bookingId: string }) => {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<BookingDetail | null>(null)

  useEffect(() => {
    const loadBookingDetail = async () => {
      setLoading(true)

      const result = await api.request<BookingDetail>(`/booking/${bookingId}/detail`)

      if (result.success) {
        setData(result.data)
      }

      setLoading(false)
    }

    loadBookingDetail()
  }, [bookingId])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!data) return null

    const nights = calculateNightsBetween(data.booking.arrival, data.booking.departure)

  const tagsByType = data.tags.reduce((acc, tag) => {
    if (!acc[tag.type]) acc[tag.type] = []
    acc[tag.type].push(tag)
    return acc
  }, {} as Record<string, typeof data.tags>)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Booking Details</h2>
        <p className="text-gray-600">Booking ID: {data.booking.ownerrezBookingId}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4 flex items-center">
            <User className="w-5 h-5 mr-2" />
            Guest Information
          </h3>
          <div className="space-y-2">
            <div>
              <span className="text-gray-600">Name:</span> {data.booking.guestName}
            </div>
            {data.booking.guestEmail && (
              <div>
                <span className="text-gray-600">Email:</span> {data.booking.guestEmail}
              </div>
            )}
            <div>
              <span className="text-gray-600">Party Size:</span> {data.booking.adults} adults
              {data.booking.children > 0 && `, ${data.booking.children} children`}
            </div>
            <div>
              <span className="text-gray-600">Status:</span>
              <span
                className={`ml-2 px-2 py-1 text-xs rounded ${
                  data.booking.status === 'confirmed'
                    ? 'bg-green-100 text-green-800'
                    : data.booking.status === 'cancelled'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {data.booking.status}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4 flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Stay Details
          </h3>
          <div className="space-y-2">
            <div>
              <span className="text-gray-600">Property:</span> {data.booking.propertyName}
            </div>
            <div>
              <span className="text-gray-600">Check In:</span>{' '}
              {new Date(data.booking.arrival).toLocaleDateString()}
            </div>
            <div>
              <span className="text-gray-600">Check Out:</span>{' '}
              {new Date(data.booking.departure).toLocaleDateString()}
            </div>
            <div>
              <span className="text-gray-600">Nights:</span> {nights}
            </div>
            {data.booking.platform && (
              <div>
                <span className="text-gray-600">Platform:</span> {data.booking.platform}
              </div>
            )}
            <div>
              <span className="text-gray-600">Booked:</span>{' '}
              {new Date(data.booking.bookedDate).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-bold mb-4 flex items-center">
          <DollarSign className="w-5 h-5 mr-2" />
          Charges Breakdown
        </h3>
        <div className="space-y-2">
          {data.charges.map(charge => (
            <div key={charge.id} className="flex justify-between py-2 border-b">
              <div>
                <span className="font-medium">{charge.description}</span>
                <span
                  className={`ml-2 text-xs px-2 py-1 rounded ${
                    charge.type === 'rent'
                      ? 'bg-blue-100 text-blue-800'
                      : charge.type === 'tax'
                      ? 'bg-red-100 text-red-800'
                      : charge.type === 'fee'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {charge.type}
                </span>
                {charge.isTaxable && (
                  <span className="ml-2 text-xs text-gray-500">taxable</span>
                )}
              </div>
              <span className="font-medium">{formatCurrency(charge.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-4 text-lg font-bold">
            <span>Total</span>
            <span>{formatCurrency(data.booking.totalAmount)}</span>
          </div>
        </div>
      </div>

      {data.tags.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4 flex items-center">
            <Tag className="w-5 h-5 mr-2" />
            Tags
          </h3>
          <div className="space-y-3">
            {Object.entries(tagsByType).map(([type, tags]) => (
              <div key={type}>
                <h4 className="text-sm font-medium text-gray-600 mb-2 capitalize">{type} Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => {
                    const colors = getTagColor(tag)
                    return tag.color ? (
                      <span
                        key={tag.id}
                        className="px-3 py-1 rounded-full text-sm border"
                        style={{
                          backgroundColor: colors.backgroundColor,
                          color: colors.color,
                          borderColor: colors.borderColor
                        }}
                      >
                        {tag.name}
                      </span>
                    ) : (
                      <span
                        key={tag.id}
                        className={`px-3 py-1 rounded-full text-sm border ${colors.bg} ${colors.text} ${colors.border}`}
                      >
                        {tag.name}
                      </span>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

