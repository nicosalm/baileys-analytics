import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { formatCurrency } from '@baileys/utils'

type TaxReportData = {
  summary: {
    totalTax: number
    totalRent: number
    totalBookings: number
    dateRange: { from: string; to: string }
  }
  byProperty: Array<{
    propertyId: string
    propertyName: string
    totalTax: number
    totalRent: number
    bookingCount: number
    taxRate: number
  }>
  byMonth: Array<{
    month: string
    totalTax: number
    totalRent: number
    bookingCount: number
  }>
}

export const TaxReport = () => {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<TaxReportData | null>(null)
  const [error, setError] = useState('')
  const [dateRange, setDateRange] = useState({
    from: '2024-01-01',
    to: '2024-12-31'
  })

  const loadReport = async () => {
    setLoading(true)
    setError('')

    const result = await api.getTaxReport(dateRange.from, dateRange.to)

    if (result.success && result.data.status === 'success') {
      setData(result.data.data)
    } else {
      setError(result.success ? 'Failed to load report' : result.error)
    }

    setLoading(false)
  }

  useEffect(() => {
    loadReport()
  }, [])

  const handleDownloadCSV = () => {
    const params = new URLSearchParams({
      from: dateRange.from,
      to: dateRange.to
    })
    window.location.href = `/api/tax-report-csv?${params}`
  }

  return (
    <div className="min-h-screen">
      <nav className="p-4 border-b">
        <div className="max-w-6xl mx-auto">
          <Link to="/dashboard" className="text-blue-600">← Back to Dashboard</Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">Tax Report</h1>

        <div className="mb-6 p-4 border rounded">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block mb-1">From</label>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block mb-1">To</label>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={loadReport}
                disabled={loading}
                className="w-full py-2 bg-blue-600 text-white rounded disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Generate Report'}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded">{error}</div>
        )}

        {data && (
          <>
            <div className="mb-6 p-6 bg-gray-50 rounded">
              <h2 className="text-xl font-bold mb-4">Summary</h2>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Total Tax Collected</div>
                  <div className="text-2xl font-bold">{formatCurrency(data.summary.totalTax)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Total Rent</div>
                  <div className="text-2xl font-bold">{formatCurrency(data.summary.totalRent)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Total Bookings</div>
                  <div className="text-2xl font-bold">{data.summary.totalBookings}</div>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-bold mb-4">By Property</h2>
              <div className="overflow-x-auto">
                <table className="w-full border">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="p-2 text-left">Property</th>
                      <th className="p-2 text-right">Tax Collected</th>
                      <th className="p-2 text-right">Rent</th>
                      <th className="p-2 text-right">Tax Rate</th>
                      <th className="p-2 text-right">Bookings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byProperty.map((property) => (
                      <tr key={property.propertyId} className="border-b">
                        <td className="p-2">{property.propertyName}</td>
                        <td className="p-2 text-right">{formatCurrency(property.totalTax)}</td>
                        <td className="p-2 text-right">{formatCurrency(property.totalRent)}</td>
                        <td className="p-2 text-right">{property.taxRate.toFixed(2)}%</td>
                        <td className="p-2 text-right">{property.bookingCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-bold mb-4">By Month</h2>
              <div className="overflow-x-auto">
                <table className="w-full border">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="p-2 text-left">Month</th>
                      <th className="p-2 text-right">Tax Collected</th>
                      <th className="p-2 text-right">Rent</th>
                      <th className="p-2 text-right">Bookings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byMonth.map((month) => (
                      <tr key={month.month} className="border-b">
                        <td className="p-2">{month.month}</td>
                        <td className="p-2 text-right">{formatCurrency(month.totalTax)}</td>
                        <td className="p-2 text-right">{formatCurrency(month.totalRent)}</td>
                        <td className="p-2 text-right">{month.bookingCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <button
              onClick={handleDownloadCSV}
              className="px-6 py-2 bg-green-600 text-white rounded"
            >
              Download CSV
            </button>
          </>
        )}
      </div>
    </div>
  )
}
