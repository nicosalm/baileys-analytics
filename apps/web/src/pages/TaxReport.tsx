import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { formatCurrency } from '@baileys/utils'
import { PropertyTaxChart, MonthlyTrendChart, PropertyDistributionChart } from '@/components/TaxCharts'
import { Download, TrendingUp, Home, Calendar } from 'lucide-react'
import { Spinner } from '@/components/Spinner'

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

        {loading && (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded">{error}</div>
        )}

        {data && !loading && (
          <>
            <div className="mb-6 p-6 bg-gray-50 rounded">
              <h2 className="text-xl font-bold mb-4">Summary</h2>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded border">
                  <div className="flex items-center text-sm text-gray-600 mb-1">
                    <TrendingUp className="w-4 h-4 mr-1" />
                    Total Tax Collected
                  </div>
                  <div className="text-2xl font-bold">{formatCurrency(data.summary.totalTax)}</div>
                </div>
                <div className="bg-white p-4 rounded border">
                  <div className="flex items-center text-sm text-gray-600 mb-1">
                    <Home className="w-4 h-4 mr-1" />
                    Total Rent
                  </div>
                  <div className="text-2xl font-bold">{formatCurrency(data.summary.totalRent)}</div>
                </div>
                <div className="bg-white p-4 rounded border">
                  <div className="flex items-center text-sm text-gray-600 mb-1">
                    <Calendar className="w-4 h-4 mr-1" />
                    Total Bookings
                  </div>
                  <div className="text-2xl font-bold">{data.summary.totalBookings}</div>
                </div>
              </div>
            </div>

            <div className="mb-6 grid md:grid-cols-2 gap-6">
              <div className="bg-white p-4 rounded border">
                <h3 className="text-lg font-bold mb-4">Monthly Trends</h3>
                <MonthlyTrendChart data={data.byMonth} />
              </div>
              <div className="bg-white p-4 rounded border">
                <h3 className="text-lg font-bold mb-4">Property Comparison</h3>
                <PropertyTaxChart data={data.byProperty} />
              </div>
            </div>

            <div className="mb-6 grid md:grid-cols-2 gap-6">
              <div className="bg-white p-4 rounded border">
                <h3 className="text-lg font-bold mb-4">Tax Distribution by Property</h3>
                <PropertyDistributionChart data={data.byProperty} />
              </div>
              <div className="bg-white p-4 rounded border">
                <h3 className="text-lg font-bold mb-4">Average Tax Rate</h3>
                <div className="h-80 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-5xl font-bold text-blue-600">
                      {(data.summary.totalRent > 0
                        ? (data.summary.totalTax / data.summary.totalRent * 100)
                        : 0
                      ).toFixed(2)}%
                    </div>
                    <div className="text-gray-600 mt-2">Effective Tax Rate</div>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleDownloadCSV}
              className="px-6 py-2 bg-green-600 text-white rounded flex items-center"
            >
              <Download className="w-4 h-4 mr-2" />
              Download CSV
            </button>
          </>
        )}
      </div>
    </div>
  )
}
