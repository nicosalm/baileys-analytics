import { useState, useEffect } from 'react'
import { Modal } from '@/components/Modal'
import { useModal } from '@/contexts/modal'
import { useToast } from '@/contexts/toast'
import { Spinner } from '@/components/Spinner'
import { 
  Download, Mail, FileText, Eye, 
  CheckCircle, Info
} from 'lucide-react'
import { formatCurrency, formatPercentage } from '@baileys/utils'

interface ReportPreviewModalProps {
  templateId: string
  templateName: string
}

export const ReportPreviewModal = ({ templateName }: ReportPreviewModalProps) => {
  const { closeModal } = useModal()
  const { addToast } = useToast()
  const [isGenerating, setIsGenerating] = useState(true)
  const [previewData, setPreviewData] = useState<any>(null)
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'excel' | 'csv'>('pdf')
  const [emailTo, setEmailTo] = useState('')
  const [showEmailForm, setShowEmailForm] = useState(false)

  useEffect(() => {
    // Simulate report generation
    const timer = setTimeout(() => {
      setPreviewData({
        summary: {
          totalRevenue: 125000,
          totalBookings: 89,
          avgOccupancy: 0.73,
          topProperty: 'Sunset Villa'
        },
        sections: [
          { name: 'Financial Summary', status: 'complete', records: 156 },
          { name: 'Property Performance', status: 'complete', records: 12 },
          { name: 'Occupancy Analysis', status: 'complete', records: 365 },
          { name: 'Tax Calculations', status: 'complete', records: 48 }
        ],
        generatedAt: new Date().toISOString(),
        fileSize: '2.4 MB'
      })
      setIsGenerating(false)
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  const handleDownload = () => {
    // Here you would trigger the actual download
    addToast('success', `Downloading ${templateName} as ${selectedFormat.toUpperCase()}`)
    closeModal()
  }

  const handleEmail = () => {
    if (!emailTo.trim()) {
      addToast('error', 'Please enter an email address')
      return
    }
    
    // Here you would send the email
    addToast('success', `Report sent to ${emailTo}`)
    closeModal()
  }

  return (
    <Modal
      isOpen={true}
      onClose={closeModal}
      title="Report Preview"
      subtitle={templateName}
      size="lg"
    >
      <div className="space-y-6">
        {isGenerating ? (
          <div className="py-12">
            <div className="flex flex-col items-center">
              <Spinner size="lg" />
              <p className="mt-4 text-gray-600">Generating report...</p>
              <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
            </div>
          </div>
        ) : (
          <>
            {/* Success Banner */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start">
                <CheckCircle className="w-5 h-5 text-green-600 mr-2 mt-0.5" />
                <div>
                  <div className="font-medium text-green-800">Report Generated Successfully</div>
                  <div className="text-sm text-green-700 mt-1">
                    Generated at {new Date(previewData.generatedAt).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Summary Stats */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Report Summary</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600">Total Revenue</div>
                  <div className="text-2xl font-bold mt-1">
                    {formatCurrency(previewData.summary.totalRevenue)}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600">Total Bookings</div>
                  <div className="text-2xl font-bold mt-1">
                    {previewData.summary.totalBookings}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600">Average Occupancy</div>
                  <div className="text-2xl font-bold mt-1">
                    {formatPercentage(previewData.summary.avgOccupancy * 100, 0)}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600">Top Property</div>
                  <div className="text-lg font-bold mt-1">
                    {previewData.summary.topProperty}
                  </div>
                </div>
              </div>
            </div>

            {/* Sections */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Report Sections</h3>
              <div className="space-y-2">
                {previewData.sections.map((section: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                    <div className="flex items-center">
                      <FileText className="w-5 h-5 text-gray-400 mr-3" />
                      <div>
                        <div className="font-medium">{section.name}</div>
                        <div className="text-sm text-gray-500">{section.records} records</div>
                      </div>
                    </div>
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>
                ))}
              </div>
            </div>

            {/* File Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center">
                <Info className="w-5 h-5 text-blue-600 mr-2" />
                <div className="text-sm text-blue-800">
                  Report size: {previewData.fileSize} • Ready for download
                </div>
              </div>
            </div>

            {/* Export Options */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Export Options</h3>
              
              {!showEmailForm ? (
                <div className="space-y-4">
                  {/* Format Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Format
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['pdf', 'excel', 'csv'] as const).map(format => (
                        <button
                          key={format}
                          onClick={() => setSelectedFormat(format)}
                          className={`p-3 border rounded-lg transition-colors ${
                            selectedFormat === format
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {format.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-3">
                    <button
                      onClick={handleDownload}
                      className="flex-1 flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download {selectedFormat.toUpperCase()}
                    </button>
                    <button
                      onClick={() => setShowEmailForm(true)}
                      className="flex-1 flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Email Report
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={emailTo}
                      onChange={(e) => setEmailTo(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="recipient@example.com"
                    />
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={handleEmail}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Send Email
                    </button>
                    <button
                      onClick={() => setShowEmailForm(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* View Full Report Button */}
            <div className="pt-4 border-t">
              <button
                onClick={() => {
                  // Here you would open the full report in a new tab
                  addToast('info', 'Opening full report preview...')
                }}
                className="w-full flex items-center justify-center px-4 py-2 text-blue-600 hover:text-blue-700"
              >
                <Eye className="w-4 h-4 mr-2" />
                View Full Report
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}