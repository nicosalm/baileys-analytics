import { useState, useEffect } from 'react'
import { Modal } from '@/components/Modal'
import { useToast } from '@/contexts/toast'
import { api } from '@/lib/api'
import { formatCurrency, format } from '@baileys/utils'
import {
  Building2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Download,
  Edit3
} from 'lucide-react'
import { DCTZGuestFeeEntry } from './DCTZGuestFeeEntry'
import { DCTZ_RATE } from './constants'

interface DCTZReportModalProps {
  onClose: () => void
}

interface Property {
  id: string
  name: string
}

interface DCTZReportData {
  property: { id: string; name: string }
  period: { month: number; year: number; monthName: string }
  lodgingEstablishment: {
    line1_availableNights: number
    line2_rentedNights: number
  }
  taxCalculation: {
    line3_grossLodgingSales: number
    line4_exemptions: number
    line5_marketplaceSales: number
    line5a_airbnbTax: number
    line5b_vrboTax: number
    line5c_expediaTax: number
    line5d_bookingComTax: number
    line5e_evolveTax: number
  }
  summary: {
    netTaxableSales: number
    taxRate: number
    totalTaxDue: number
    totalPaidOnBehalf: number
    totalAmountDue: number
    ownerTaxDue: number
  }
  breakdown: {
    ownerRevenue: number
    guestServiceFees: number
    guestFeesByPlatform: Record<string, number>
    platformSalesBySource: Record<string, number>
  }
}

const generateMonthOptions = () => {
  const options: { value: string; label: string }[] = []
  const now = new Date()

  for (let i = -12; i <= 0; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const value = format(date, 'yyyy-MM')
    const label = format(date, 'MMMM yyyy')
    options.push({ value, label })
  }

  return options.reverse()
}

export const DCTZReportModal = ({ onClose }: DCTZReportModalProps) => {
  const { addToast } = useToast()
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedProperty, setSelectedProperty] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingProperties, setIsLoadingProperties] = useState(true)
  const [report, setReport] = useState<DCTZReportData | null>(null)
  const [feeStatus, setFeeStatus] = useState<{ hasGuestFees: boolean } | null>(null)
  const [showFeeEntry, setShowFeeEntry] = useState(false)

  useEffect(() => {
    loadProperties()
  }, [])

  useEffect(() => {
    if (selectedProperty && selectedMonth) {
      checkFeeStatus()
    }
  }, [selectedProperty, selectedMonth])

  const loadProperties = async () => {
    try {
      const result = await api.request('/dctz/properties')
      console.log('DCTZ properties response:', result)
      if (result.success && (result as any).data?.properties) {
        const props = (result as any).data.properties
        console.log('DCTZ properties loaded:', props)
        setProperties(props)
        if (props.length > 0) {
          console.log('Setting selected property to:', props[0].id)
          setSelectedProperty(props[0].id)
        }
      }
    } catch (err) {
      console.error('Failed to load DCTZ properties:', err)
      addToast('error', 'Failed to load properties')
    } finally {
      setIsLoadingProperties(false)
    }
  }

  const checkFeeStatus = async () => {
    const [year, month] = selectedMonth.split('-')
    try {
      const result = await api.request(
        `/dctz/fee-status?propertyId=${selectedProperty}&year=${year}&month=${month}`
      )
      if (result.success) {
        setFeeStatus((result as any).data)
      }
    } catch {
      // silent fail
    }
  }

  const generateReport = async () => {
    if (!selectedProperty) {
      addToast('error', 'Please select a property')
      return
    }

    setIsLoading(true)
    setReport(null)

    const [year, month] = selectedMonth.split('-')

    try {
      const result = await api.request('/dctz/generate', {
        method: 'POST',
        body: JSON.stringify({
          propertyId: selectedProperty,
          year: parseInt(year),
          month: parseInt(month)
        })
      })

      if (result.success && (result as any).data?.report) {
        setReport((result as any).data.report)
      } else {
        addToast('error', (result as any).error || 'Failed to generate report')
      }
    } catch {
      addToast('error', 'Failed to generate report')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFeeEntrySaved = () => {
    setShowFeeEntry(false)
    checkFeeStatus()
    // re-generate report if we already had one
    if (report) {
      generateReport()
    }
  }

  const downloadReport = () => {
    if (!report) return

    const totalTax = report.taxCalculation.line3_grossLodgingSales * DCTZ_RATE

    const lines = [
      'DOOR COUNTY TOURISM ZONE - Monthly Room Tax Report',
      '═'.repeat(60),
      `Property: ${report.property.name}`,
      `Period: ${report.period.monthName} ${report.period.year}`,
      '',
      'LODGING ESTABLISHMENT',
      '─'.repeat(60),
      `  1. Total available rental unit nights: ${report.lodgingEstablishment.line1_availableNights}`,
      `  2. Number rented unit nights: ${report.lodgingEstablishment.line2_rentedNights}`,
      '',
      'TAX CALCULATION (for DCTZ form)',
      '─'.repeat(60),
      `  3. Gross Lodging Sales: ${formatCurrency(report.taxCalculation.line3_grossLodgingSales)}`,
      `     (Your Revenue: ${formatCurrency(report.breakdown.ownerRevenue)} + Guest Fees: ${formatCurrency(report.breakdown.guestServiceFees)})`,
      '',
      `  4. Exemptions: ${formatCurrency(report.taxCalculation.line4_exemptions)}`,
      '',
      `  5. Sales where tax was collected on your behalf:`,
      `     (Guest service fees only): ${formatCurrency(report.taxCalculation.line5_marketplaceSales)}`,
      '',
      `     5a. Airbnb tax (on guest fee): ${formatCurrency(report.taxCalculation.line5a_airbnbTax)}`,
      `     5b. VRBO tax (on guest fee): ${formatCurrency(report.taxCalculation.line5b_vrboTax)}`,
      `     5c. Expedia tax (on guest fee): ${formatCurrency(report.taxCalculation.line5c_expediaTax)}`,
      `     5d. Booking.com tax: ${formatCurrency(report.taxCalculation.line5d_bookingComTax)}`,
      `     5e. Evolve tax (on guest fee): ${formatCurrency(report.taxCalculation.line5e_evolveTax)}`,
      '',
      '═'.repeat(60),
      'YOUR TAX BREAKDOWN',
      '─'.repeat(60),
      `  Your Revenue: ${formatCurrency(report.breakdown.ownerRevenue)}`,
      `  Your Tax (8%): ${formatCurrency(report.summary.ownerTaxDue)}`,
      '',
      `  Platform Guest Fees: ${formatCurrency(report.breakdown.guestServiceFees)}`,
      `  Platform Tax Paid (8%): ${formatCurrency(report.summary.totalPaidOnBehalf)}`,
      '',
      `  Total Taxable (Line 3): ${formatCurrency(report.taxCalculation.line3_grossLodgingSales)}`,
      `  Total Tax (8%): ${formatCurrency(totalTax)}`,
      '',
      '═'.repeat(60),
      `  YOU OWE DCTZ: ${formatCurrency(report.summary.totalAmountDue)}`,
      '═'.repeat(60),
    ]

    const content = lines.join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `DCTZ_Report_${report.property.name.replace(/\s+/g, '_')}_${report.period.year}_${String(report.period.month).padStart(2, '0')}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    addToast('success', 'Report downloaded')
  }

  if (showFeeEntry && selectedProperty) {
    const property = properties.find(p => p.id === selectedProperty)
    return (
      <DCTZGuestFeeEntry
        propertyId={selectedProperty}
        propertyName={property?.name || 'Property'}
        month={selectedMonth}
        onClose={() => setShowFeeEntry(false)}
        onSaved={handleFeeEntrySaved}
      />
    )
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Door County Tourism Zone Report"
      subtitle="Generate DCTZ-format tax report"
      size="lg"
    >
      <div className="space-y-6">
        {/* property and month selection */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Building2 className="w-4 h-4 inline mr-1" />
              Property
            </label>
            {isLoadingProperties ? (
              <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
            ) : (
              <select
                value={selectedProperty}
                onChange={(e) => {
                  setSelectedProperty(e.target.value)
                  setReport(null)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Select property</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value)
                setReport(null)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {generateMonthOptions().map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* guest fee status */}
        {selectedProperty && feeStatus && (
          <div
            className={`flex items-center justify-between p-3 rounded-lg ${
              feeStatus.hasGuestFees
                ? 'bg-green-50 border border-green-200'
                : 'bg-amber-50 border border-amber-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feeStatus.hasGuestFees ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-700">
                    Guest service fees entered for this period
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span className="text-sm text-amber-700">
                    No guest service fees entered - report will be incomplete
                  </span>
                </>
              )}
            </div>
            <button
              onClick={() => setShowFeeEntry(true)}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-white/50 rounded transition-colors cursor-pointer"
            >
              <Edit3 className="w-3 h-3" />
              {feeStatus.hasGuestFees ? 'Edit' : 'Add'} Fees
            </button>
          </div>
        )}

        {/* generate button */}
        <button
          onClick={generateReport}
          disabled={!selectedProperty || isLoading}
          className="w-full py-2.5 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          {isLoading ? 'Generating...' : 'Generate Report'}
        </button>

        {/* report display */}
        {report && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-teal-50 px-4 py-3 border-b border-teal-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-teal-900">
                    {report.property.name}
                  </h3>
                  <p className="text-sm text-teal-700">
                    {report.period.monthName} {report.period.year}
                  </p>
                </div>
                <button
                  onClick={downloadReport}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4 text-sm">
              {/* lodging establishment section */}
              <div>
                <h4 className="font-medium text-gray-700 mb-2">
                  LODGING ESTABLISHMENT
                </h4>
                <div className="grid grid-cols-2 gap-2 text-gray-600">
                  <div>1. Available nights:</div>
                  <div className="text-right font-medium">
                    {report.lodgingEstablishment.line1_availableNights}
                  </div>
                  <div>2. Rented nights:</div>
                  <div className="text-right font-medium">
                    {report.lodgingEstablishment.line2_rentedNights}
                  </div>
                </div>
              </div>

              <hr className="border-gray-200" />

              {/* tax calculation section */}
              <div>
                <h4 className="font-medium text-gray-700 mb-2">
                  TAX CALCULATION
                </h4>
                <div className="space-y-2 text-gray-600">
                  <div className="flex justify-between">
                    <div>3. Gross Lodging Sales:</div>
                    <div className="font-medium">
                      {formatCurrency(report.taxCalculation.line3_grossLodgingSales)}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 ml-4">
                    Owner: {formatCurrency(report.breakdown.ownerRevenue)} + Guest Fees:{' '}
                    {formatCurrency(report.breakdown.guestServiceFees)}
                  </div>
                  <div className="flex justify-between">
                    <div>4. Exemptions:</div>
                    <div className="font-medium">
                      {formatCurrency(report.taxCalculation.line4_exemptions)}
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <div>5. Marketplace Sales:</div>
                    <div className="font-medium">
                      {formatCurrency(report.taxCalculation.line5_marketplaceSales)}
                    </div>
                  </div>

                  {/* platform breakdown */}
                  <div className="ml-4 space-y-1 text-xs">
                    {report.taxCalculation.line5a_airbnbTax > 0 && (
                      <div className="flex justify-between">
                        <span>5a. Airbnb tax:</span>
                        <span>{formatCurrency(report.taxCalculation.line5a_airbnbTax)}</span>
                      </div>
                    )}
                    {report.taxCalculation.line5b_vrboTax > 0 && (
                      <div className="flex justify-between">
                        <span>5b. VRBO tax:</span>
                        <span>{formatCurrency(report.taxCalculation.line5b_vrboTax)}</span>
                      </div>
                    )}
                    {report.taxCalculation.line5c_expediaTax > 0 && (
                      <div className="flex justify-between">
                        <span>5c. Expedia tax:</span>
                        <span>{formatCurrency(report.taxCalculation.line5c_expediaTax)}</span>
                      </div>
                    )}
                    {report.taxCalculation.line5d_bookingComTax > 0 && (
                      <div className="flex justify-between">
                        <span>5d. Booking.com tax:</span>
                        <span>{formatCurrency(report.taxCalculation.line5d_bookingComTax)}</span>
                      </div>
                    )}
                    {report.taxCalculation.line5e_evolveTax > 0 && (
                      <div className="flex justify-between">
                        <span>5e. Evolve tax:</span>
                        <span>{formatCurrency(report.taxCalculation.line5e_evolveTax)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <hr className="border-gray-200" />

              {/* summary - jerry's formula */}
              <div className="bg-gray-50 -mx-4 -mb-4 p-4 space-y-2">
                <div className="flex justify-between text-gray-600">
                  <span>Your revenue:</span>
                  <span className="font-medium">
                    {formatCurrency(report.breakdown.ownerRevenue)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Your tax (8% DCTZ):</span>
                  <span className="font-medium">
                    {formatCurrency(report.summary.ownerTaxDue)}
                  </span>
                </div>
                <hr className="border-gray-300" />
                <div className="flex justify-between text-gray-600">
                  <span>Platform guest fees:</span>
                  <span className="font-medium">
                    {formatCurrency(report.breakdown.guestServiceFees)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Platform tax paid (8%):</span>
                  <span className="font-medium text-green-600">
                    {formatCurrency(report.summary.totalPaidOnBehalf)}
                  </span>
                </div>
                <hr className="border-gray-300" />
                <div className="flex justify-between text-gray-500 text-xs">
                  <span>Total taxable (for DCTZ reporting):</span>
                  <span>{formatCurrency(report.taxCalculation.line3_grossLodgingSales)}</span>
                </div>
                <div className="flex justify-between text-gray-500 text-xs">
                  <span>Total tax (8%):</span>
                  <span>{formatCurrency(report.taxCalculation.line3_grossLodgingSales * DCTZ_RATE)}</span>
                </div>
                <hr className="border-gray-300" />
                <div className="flex justify-between text-lg font-semibold">
                  <span>You Owe DCTZ:</span>
                  <span className="text-teal-700">
                    {formatCurrency(report.summary.totalAmountDue)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* info about data sources */}
        <details className="text-xs text-gray-500">
          <summary className="cursor-pointer hover:text-gray-700">
            About this report
          </summary>
          <div className="mt-2 space-y-2 text-gray-600">
            <p>
              <strong>How it works:</strong> DCTZ requires reporting total taxable = your
              revenue + platform guest fees. But Airbnb does NOT remit Door County room tax
              on your revenue - only on their own guest service fee.
            </p>
            <p>
              <strong>You pay:</strong> 8% on your revenue (what you collected from bookings)
            </p>
            <p>
              <strong>Airbnb/VRBO pay:</strong> 8% on their guest service fee (their income,
              their tax liability)
            </p>
            <p>
              <strong>Guest service fees</strong> must be entered manually as they are not
              available through the OwnerRez API. Find them in Airbnb → Menu → Reservations →
              Details → "Guest service fee".
            </p>
          </div>
        </details>
      </div>
    </Modal>
  )
}
