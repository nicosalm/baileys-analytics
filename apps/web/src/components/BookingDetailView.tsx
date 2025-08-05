import { useState, useEffect, useMemo } from 'react'
import { api } from '@/lib/api'
import { formatCurrency, calculateNightsBetween } from '@baileys/utils'
import { Calendar, User, DollarSign, Tag as TagIcon, AlertCircle } from 'lucide-react'
import { Spinner } from '@/components/Spinner'
import { VirtualTable } from '@/components/VirtualTable'
import { StatusBadge } from '@/components/StatusBadge'
import { Tag } from '@/components/Tag'

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

export const BookingDetailView = ({ bookingId }: { bookingId: string }) => {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<BookingDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadBookingDetail = async () => {
      setLoading(true)
      setError(null)

      try {
        const result = await api.request<BookingDetail>(`/booking/${bookingId}/detail`)

        if (result.success) {
          setData(result.data)
        } else {
          setError(result.error || 'Failed to load booking details')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      } finally {
        setLoading(false)
      }
    }

    loadBookingDetail()
  }, [bookingId])

  const chargeColumns = useMemo(() => [
    {
      key: 'description',
      header: 'Description',
      width: 300,
      render: (charge: BookingDetail['charges'][0]) => (
        <div className="font-medium">{charge.description}</div>
      )
    },
    {
      key: 'type',
      header: 'Type',
      width: 120,
      render: (charge: BookingDetail['charges'][0]) => (
        <span
          className={`px-2 py-1 text-xs rounded ${
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
      )
    },
    {
      key: 'isTaxable',
      header: 'Taxable',
      width: 100,
      render: (charge: BookingDetail['charges'][0]) => (
        charge.isTaxable ? (
          <span className="text-xs text-gray-600">Yes</span>
        ) : (
          <span className="text-xs text-gray-400">No</span>
        )
      )
    },
    {
      key: 'amount',
      header: 'Amount',
      width: 150,
      render: (charge: BookingDetail['charges'][0]) => (
        <span className="font-medium">{formatCurrency(charge.amount)}</span>
      )
    }
  ], [])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Booking</h3>
        <p className="text-gray-600 text-center max-w-md">{error}</p>
        <p className="text-sm text-gray-500 mt-2">Booking ID: {bookingId}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
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

  const subtotal = data.charges
    .filter(c => c.type === 'rent')
    .reduce((sum, c) => sum + c.amount, 0)

  const taxes = data.charges
    .filter(c => c.type === 'tax')
    .reduce((sum, c) => sum + c.amount, 0)

  const fees = data.charges
    .filter(c => c.type === 'fee')
    .reduce((sum, c) => sum + c.amount, 0)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Booking Details</h2>
        <p className="text-gray-600">Booking ID: {data.booking.ownerrezBookingId}</p>
        <div className="mt-2">
          <StatusBadge status={data.booking.status} />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4 flex items-center">
            <User className="w-5 h-5 mr-2" />
            Guest Information
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Name</span>
              <span className="font-medium">{data.booking.guestName}</span>
            </div>
            {data.booking.guestEmail && (
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Email</span>
                <span className="font-medium">{data.booking.guestEmail}</span>
              </div>
            )}
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Party Size</span>
              <span className="font-medium">
                {data.booking.adults} adults
                {data.booking.children > 0 && `, ${data.booking.children} children`}
              </span>
            </div>
            {data.booking.platform && (
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Platform</span>
                <span className="font-medium">{data.booking.platform}</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4 flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Stay Details
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Property</span>
              <span className="font-medium">{data.booking.propertyName}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Check In</span>
              <span className="font-medium">
                {new Date(data.booking.arrival).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Check Out</span>
              <span className="font-medium">
                {new Date(data.booking.departure).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Nights</span>
              <span className="font-medium">{nights}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Booked</span>
              <span className="font-medium">
                {new Date(data.booking.bookedDate).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-bold mb-4 flex items-center">
          <DollarSign className="w-5 h-5 mr-2" />
          Charges Breakdown
        </h3>

        {data.charges.length <= 20 ? (
          <div className="space-y-2">
            {data.charges.map(charge => (
              <div key={charge.id} className="flex justify-between py-2 border-b">
                <div className="flex-1">
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

            <div className="pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Fees</span>
                <span>{formatCurrency(fees)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Taxes</span>
                <span>{formatCurrency(taxes)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t text-lg font-bold">
                <span>Total</span>
                <span>{formatCurrency(data.booking.totalAmount)}</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            <VirtualTable
              data={data.charges}
              columns={chargeColumns}
              height={400}
              rowHeight={48}
              getRowId={(charge) => charge.id}
              enableSearch={true}
              searchKeys={['description', 'type']}
              emptyMessage="No charges found"
              enablePagination={data.charges.length > 50}
              pageSize={20}
            />

            <div className="mt-4 p-4 bg-gray-50 rounded space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal (Rent)</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Fees</span>
                <span className="font-medium">{formatCurrency(fees)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Taxes</span>
                <span className="font-medium">{formatCurrency(taxes)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t text-lg font-bold">
                <span>Total</span>
                <span className="text-green-600">{formatCurrency(data.booking.totalAmount)}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {data.tags.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4 flex items-center">
            <TagIcon className="w-5 h-5 mr-2" />
            Tags
          </h3>
          <div className="space-y-3">
            {Object.entries(tagsByType).map(([type, tags]) => (
              <div key={type}>
                <h4 className="text-sm font-medium text-gray-600 mb-2 capitalize">{type} Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <Tag key={tag.id} tag={tag} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
