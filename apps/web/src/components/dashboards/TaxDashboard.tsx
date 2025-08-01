import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { formatCurrency } from '@baileys/utils'
import { PropertyTaxChart, MonthlyTrendChart, PropertyDistributionChart } from '@/components/TaxCharts'
import { Download, TrendingUp, Home, Calendar } from 'lucide-react'
import { Spinner } from '@/components/Spinner'
import { useDashboard } from '@/contexts/dashboard'
import { useToast } from '@/contexts/toast'
import { TaxReportData } from '@/types/dashboard'

export const TaxDashboard = () => {
  const { filters } = useDashboard()
  const { addToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<TaxReportData | null>(null)

  const loadReport = async () => {
    setLoading(true)

    const result = await api.getTaxReport(
      filters.dateRange.from,
      filters.dateRange.to,
      filters.selectedTags.map(t => t.id)
    )

    if (result.success && result.data.status === 'success') {
      setData(result.data.data)
    } else {
      addToast('error', result.success ? 'Failed to load report' : result.error)
    }

    setLoading(false)
  }

  useEffect(() => {
    loadReport()
  }, [filters.dateRange, filters.selectedTags])

  const handleDownloadCSV = () => {
    const params = new URLSearchParams({
      from: filters.dateRange.from,
      to: filters.dateRange.to
    })
    if (filters.selectedTags.length > 0) {
      params.append('tags', filters.selectedTags.map(t => t.id).join(','))
    }
    window.location.href = `/api/tax-report-csv?${params}`
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Tax Report</h2>
        <button
          onClick={handleDownloadCSV}
          className="px-4 py-2 bg-green-600 text-white rounded flex items-center"
        >
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <TrendingUp className="w-4 h-4 mr-1" />
            Total Tax Collected
          </div>
          <div className="text-3xl font-bold">{formatCurrency(data.summary.totalTax)}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <Home className="w-4 h-4 mr-1" />
            Total Rent
          </div>
          <div className="text-3xl font-bold">{formatCurrency(data.summary.totalRent)}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <Calendar className="w-4 h-4 mr-1" />
            Total Bookings
          </div>
          <div className="text-3xl font-bold">{data.summary.totalBookings}</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4">Monthly Trends</h3>
          <MonthlyTrendChart data={data.byMonth} />
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4">Property Comparison</h3>
          <PropertyTaxChart data={data.byProperty} />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4">Tax Distribution</h3>
          <PropertyDistributionChart data={data.byProperty} />
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4">Effective Tax Rate</h3>
          <div className="h-80 flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl font-bold text-blue-600">
                {(data.summary.totalRent > 0
                  ? (data.summary.totalTax / data.summary.totalRent * 100)
                  : 0
                ).toFixed(2)}%
              </div>
              <div className="text-gray-600 mt-2">Average across all properties</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
