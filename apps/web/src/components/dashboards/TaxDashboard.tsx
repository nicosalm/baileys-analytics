import { useState, useEffect, useMemo, useCallback } from 'react'
import { api } from '@/lib/api'
import { formatCurrency, formatPercentage, formatCompactCurrency, isValidDateRange } from '@baileys/utils'
import { PropertyTaxChart, MonthlyTrendChart, PropertyDistributionChart } from '@/components/TaxCharts'
import { VirtualTable } from '@/components/VirtualTable'
import { Download, TrendingUp, Home, Calendar, FileText } from 'lucide-react'
import { Spinner } from '@/components/Spinner'
import { useDashboard } from '@/contexts/dashboard'
import { useToast } from '@/contexts/toast'
import { TaxReportData } from '@/types/dashboard'
import { useDrillDown } from '@/contexts/drillDown'

export const TaxDashboard = () => {
  const { filters } = useDashboard()
  const { addToast } = useToast()
  const { dispatch } = useDrillDown()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<TaxReportData | null>(null)
  const [viewMode, setViewMode] = useState<'charts' | 'table'>('charts')
  const [selectedProperties, setSelectedProperties] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<string>('totalTax')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const loadReport = async () => {
    if (!isValidDateRange(filters.dateRange.from, filters.dateRange.to)) {
      addToast('error', 'Invalid date range selected')
      return
    }

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

  const sortedProperties = useMemo(() => {
    if (!data) return []

    return [...data.byProperty].sort((a, b) => {
      const aVal = a[sortBy as keyof typeof a]
      const bVal = b[sortBy as keyof typeof b]

      if (aVal === undefined && bVal === undefined) return 0
      if (aVal === undefined) return 1
      if (bVal === undefined) return -1

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
      }
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
    })
  }, [data, sortBy, sortOrder])

  const handleSort = useCallback((column: string) => {
    if (column === sortBy) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }, [sortBy])

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

  const handleExport = useCallback(() => {
    const exportData = selectedProperties.size > 0
      ? sortedProperties.filter(p => selectedProperties.has(p.propertyId))
      : sortedProperties

    const headers = ['Property', 'Total Tax', 'Total Rent', 'Bookings', 'Tax Rate']
    const rows = exportData.map(p => [
      p.propertyName,
      p.totalTax,
      p.totalRent,
      p.bookingCount,
      formatPercentage(p.taxRate * 100, 2)
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tax-report-${filters.dateRange.from}-to-${filters.dateRange.to}.csv`
    a.click()
    URL.revokeObjectURL(url)

    addToast('success', `Exported ${exportData.length} properties`)
  }, [selectedProperties, sortedProperties, filters.dateRange, addToast])

  const propertyColumns = useMemo(() => [
    {
      key: 'propertyName',
      header: 'Property',
      sortable: true,
      width: 250,
      render: (property: typeof sortedProperties[0]) => (
        <div className="font-medium">{property.propertyName}</div>
      )
    },
    {
      key: 'totalRent',
      header: 'Total Rent',
      sortable: true,
      width: 150,
      render: (property: typeof sortedProperties[0]) => (
        <span className="font-medium">{formatCurrency(property.totalRent)}</span>
      )
    },
    {
      key: 'totalTax',
      header: 'Total Tax',
      sortable: true,
      width: 150,
      render: (property: typeof sortedProperties[0]) => (
        <span className="font-medium text-green-600">
          {formatCurrency(property.totalTax)}
        </span>
      )
    },
    {
      key: 'taxRate',
      header: 'Tax Rate',
      sortable: true,
      width: 100,
      render: (property: typeof sortedProperties[0]) => (
        <span className={`font-medium ${
          property.taxRate > 0.0015 ? 'text-red-600' :
          property.taxRate > 0.0010 ? 'text-yellow-600' :
          'text-green-600'
        }`}>
          {formatPercentage(property.taxRate * 100, 2)}
        </span>
      )
    },
    {
      key: 'bookingCount',
      header: 'Bookings',
      sortable: true,
      width: 100,
      render: (property: typeof sortedProperties[0]) => (
        <span className="font-medium">{property.bookingCount}</span>
      )
    }
  ], [])

  const monthlyColumns = useMemo(() => {
    if (!data) return []

    return [
      {
        key: 'month',
        header: 'Month',
        sortable: true,
        width: 150,
        render: (month: TaxReportData['byMonth'][0]) => {
          const [year, monthNum] = month.month.split('-')
          const monthName = new Date(`${year}-${monthNum}-01`).toLocaleDateString('en-US', {
            month: 'short',
            year: 'numeric'
          })
          return <div className="font-medium">{monthName}</div>
        }
      },
      {
        key: 'totalRent',
        header: 'Total Rent',
        sortable: true,
        width: 150,
        render: (month: TaxReportData['byMonth'][0]) => (
          <span className="font-medium">{formatCurrency(month.totalRent)}</span>
        )
      },
      {
        key: 'totalTax',
        header: 'Total Tax',
        sortable: true,
        width: 150,
        render: (month: TaxReportData['byMonth'][0]) => (
          <span className="font-medium text-green-600">
            {formatCurrency(month.totalTax)}
          </span>
        )
      },
      {
        key: 'bookingCount',
        header: 'Bookings',
        sortable: true,
        width: 100,
        render: (month: TaxReportData['byMonth'][0]) => (
          <span className="font-medium">{month.bookingCount}</span>
        )
      },
      {
        key: 'effectiveRate',
        header: 'Effective Rate',
        sortable: true,
        width: 120,
        render: (month: TaxReportData['byMonth'][0]) => (
          <span className={`font-medium ${
            (month.totalTax / month.totalRent) > 0.0015 ? 'text-red-600' :
            (month.totalTax / month.totalRent) > 0.0010 ? 'text-yellow-600' :
            'text-green-600'
          }`}>
            {formatPercentage((month.totalTax / month.totalRent) * 100, 2)}
          </span>
        )
      }
    ]
  }, [data])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!data) return null

  const effectiveTaxRate = data.summary.totalRent > 0
    ? (data.summary.totalTax / data.summary.totalRent) * 100
    : 0

  const handlePropertyClick = (property: typeof sortedProperties[0]) => {
    dispatch({
      type: 'DRILL_TO_PROPERTY',
      propertyId: property.propertyId,
      propertyName: property.propertyName
    })
  }

  const handleMonthClick = (monthData: TaxReportData['byMonth'][0]) => {
    const [year, monthNum] = monthData.month.split('-')
    dispatch({
      type: 'DRILL_TO_MONTH',
      month: monthNum,
      year
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Tax Report</h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode(viewMode === 'charts' ? 'table' : 'charts')}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 flex items-center"
          >
            <FileText className="w-4 h-4 mr-2" />
            {viewMode === 'charts' ? 'Table View' : 'Chart View'}
          </button>
          <button
            onClick={handleDownloadCSV}
            className="px-4 py-2 bg-green-600 text-white rounded flex items-center hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Full Report
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <TrendingUp className="w-4 h-4 mr-1" />
            Total Tax Collected
          </div>
          <div className="text-3xl font-bold">{formatCompactCurrency(data.summary.totalTax)}</div>
          <div className="text-sm text-gray-500 mt-1">
            {formatPercentage(effectiveTaxRate, 2)} effective rate
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <Home className="w-4 h-4 mr-1" />
            Total Rent
          </div>
          <div className="text-3xl font-bold">{formatCompactCurrency(data.summary.totalRent)}</div>
          <div className="text-sm text-gray-500 mt-1">
            across {data.byProperty.length} properties
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <Calendar className="w-4 h-4 mr-1" />
            Total Bookings
          </div>
          <div className="text-3xl font-bold">{data.summary.totalBookings.toLocaleString()}</div>
          <div className="text-sm text-gray-500 mt-1">
            {Math.round(data.summary.totalBookings / data.byMonth.length)}/month avg
          </div>
        </div>
      </div>

      {viewMode === 'charts' ? (
        <>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-bold mb-4">Monthly Trends</h3>
              <MonthlyTrendChart
                data={data.byMonth}
                onMonthClick={(monthString) => {
                  const [year, monthNum] = monthString.split('-')
                  dispatch({
                    type: 'DRILL_TO_MONTH',
                    month: monthNum,
                    year
                  })
                }}
              />
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-bold mb-4">Property Comparison</h3>
              <PropertyTaxChart
                data={data.byProperty}
                onPropertyClick={handlePropertyClick}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-bold mb-4">Tax Distribution</h3>
              <PropertyDistributionChart
                data={data.byProperty}
                onPropertyClick={handlePropertyClick}
              />
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-bold mb-4">Effective Tax Rate</h3>
              <div className="h-80 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl font-bold text-blue-600">
                    {formatPercentage(effectiveTaxRate, 2)}
                  </div>
                  <div className="text-gray-600 mt-2">Average across all properties</div>
                  <div className="mt-4 space-y-2">
                    <div className="text-sm">
                      <span className="text-gray-600">Highest:</span>{' '}
                      <span className="font-medium">
                        {formatPercentage(Math.max(...data.byProperty.map(p => p.taxRate)) * 100, 2)}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-600">Lowest:</span>{' '}
                      <span className="font-medium">
                        {formatPercentage(Math.min(...data.byProperty.map(p => p.taxRate)) * 100, 2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h3 className="text-lg font-bold">Properties Tax Summary</h3>
            </div>
            <VirtualTable
              data={sortedProperties}
              columns={propertyColumns}
              height={400}
              loading={loading}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              onRowClick={handlePropertyClick}
              getRowId={(property) => property.propertyId}
              enablePagination={sortedProperties.length > 20}
              pageSize={20}
              enableSearch={true}
              searchKeys={['propertyName']}
              enableExport={true}
              onExport={handleExport}
              selectable={true}
              selectedRows={selectedProperties}
              onSelectionChange={setSelectedProperties}
              emptyMessage="No properties found"
              showRowNumbers={true}
            />
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h3 className="text-lg font-bold">Monthly Tax Summary</h3>
            </div>
            <VirtualTable
              data={data.byMonth}
              columns={monthlyColumns}
              height={400}
              onRowClick={handleMonthClick}
              getRowId={(month) => month.month}
              enablePagination={data.byMonth.length > 12}
              pageSize={12}
              enableSearch={false}
              emptyMessage="No monthly data found"
              showRowNumbers={false}
            />
          </div>
        </div>
      )}
    </div>
  )
}
