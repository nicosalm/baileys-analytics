import { useState } from 'react'
import { Modal } from '@/components/Modal'
import { useModal } from '@/contexts/modal'
import { 
  Clock, Download, CheckCircle, 
  AlertCircle, Calendar, TrendingUp,
  User, ExternalLink
} from 'lucide-react'
import { formatCurrency } from '@baileys/utils'

interface ReportHistoryModalProps {
  templateId: string
  templateName: string
}

interface HistoryEntry {
  id: string
  generatedAt: string
  generatedBy: string
  status: 'success' | 'failed' | 'processing'
  fileSize?: string
  recordCount?: number
  deliveryMethod: 'download' | 'email' | 'api'
  recipients?: string[]
  downloadUrl?: string
  errorMessage?: string
  metrics?: {
    revenue?: number
    bookings?: number
    occupancy?: number
  }
}

const mockHistory: HistoryEntry[] = [
  {
    id: '1',
    generatedAt: '2025-01-15T09:00:00Z',
    generatedBy: 'System (Scheduled)',
    status: 'success',
    fileSize: '2.4 MB',
    recordCount: 523,
    deliveryMethod: 'email',
    recipients: ['owner@example.com', 'accountant@example.com'],
    metrics: {
      revenue: 125000,
      bookings: 89,
      occupancy: 0.73
    }
  },
  {
    id: '2',
    generatedAt: '2025-01-10T14:30:00Z',
    generatedBy: 'John Doe',
    status: 'success',
    fileSize: '2.2 MB',
    recordCount: 498,
    deliveryMethod: 'download',
    downloadUrl: '/reports/download/abc123',
    metrics: {
      revenue: 118500,
      bookings: 84,
      occupancy: 0.71
    }
  },
  {
    id: '3',
    generatedAt: '2025-01-01T09:00:00Z',
    generatedBy: 'System (Scheduled)',
    status: 'failed',
    deliveryMethod: 'email',
    recipients: ['owner@example.com'],
    errorMessage: 'Failed to connect to email server'
  },
  {
    id: '4',
    generatedAt: '2024-12-15T09:00:00Z',
    generatedBy: 'System (Scheduled)',
    status: 'success',
    fileSize: '2.6 MB',
    recordCount: 612,
    deliveryMethod: 'email',
    recipients: ['owner@example.com', 'accountant@example.com'],
    metrics: {
      revenue: 145000,
      bookings: 102,
      occupancy: 0.82
    }
  }
]

export const ReportHistoryModal = ({ templateId, templateName }: ReportHistoryModalProps) => {
  const { closeModal, openModal } = useModal()
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null)

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      case 'processing':
        return <Clock className="w-5 h-5 text-yellow-500 animate-spin" />
      default:
        return null
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      success: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      processing: 'bg-yellow-100 text-yellow-800'
    }
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status as keyof typeof styles]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const handleRerun = () => {
    closeModal()
    openModal({
      type: 'report-preview',
      templateId,
      templateName
    })
  }

  return (
    <Modal
      isOpen={true}
      onClose={closeModal}
      title="Report History"
      subtitle={templateName}
      size="xl"
    >
      <div className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Total Runs</div>
            <div className="text-2xl font-bold mt-1">{mockHistory.length}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Success Rate</div>
            <div className="text-2xl font-bold mt-1">
              {Math.round((mockHistory.filter(h => h.status === 'success').length / mockHistory.length) * 100)}%
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Last Run</div>
            <div className="text-lg font-bold mt-1">
              {new Date(mockHistory[0].generatedAt).toLocaleDateString()}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Avg. Size</div>
            <div className="text-2xl font-bold mt-1">2.4 MB</div>
          </div>
        </div>

        {/* History Table */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Generation History</h3>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-gray-700">Date & Time</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-700">Generated By</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-700">Status</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-700">Details</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {mockHistory.map((entry) => (
                  <tr
                    key={entry.id}
                    className={`hover:bg-gray-50 cursor-pointer ${
                      selectedEntry === entry.id ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => setSelectedEntry(entry.id === selectedEntry ? null : entry.id)}
                  >
                    <td className="p-4">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                        <div>
                          <div className="font-medium">
                            {new Date(entry.generatedAt).toLocaleDateString()}
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(entry.generatedAt).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center">
                        <User className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-sm">{entry.generatedBy}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(entry.status)}
                        {getStatusBadge(entry.status)}
                      </div>
                    </td>
                    <td className="p-4">
                      {entry.status === 'success' ? (
                        <div className="text-sm">
                          <div>{entry.fileSize} • {entry.recordCount} records</div>
                          {entry.deliveryMethod === 'email' && (
                            <div className="text-gray-500">
                              Sent to {entry.recipients?.length} recipient(s)
                            </div>
                          )}
                        </div>
                      ) : entry.status === 'failed' ? (
                        <div className="text-sm text-red-600">{entry.errorMessage}</div>
                      ) : (
                        <div className="text-sm text-gray-500">Processing...</div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        {entry.status === 'success' && entry.downloadUrl && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              // Handle download
                            }}
                            className="p-1 text-blue-600 hover:text-blue-700"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRerun()
                          }}
                          className="p-1 text-gray-600 hover:text-gray-700"
                          title="Run Again"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Entry Details */}
        {selectedEntry && (() => {
          const entry = mockHistory.find(h => h.id === selectedEntry)
          if (!entry) return null
          
          return (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold mb-3">Report Details</h4>
              
              {entry.metrics && (
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <div className="text-sm text-gray-600">Revenue</div>
                    <div className="font-semibold">
                      {formatCurrency(entry.metrics.revenue || 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Bookings</div>
                    <div className="font-semibold">{entry.metrics.bookings}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Occupancy</div>
                    <div className="font-semibold">
                      {Math.round((entry.metrics.occupancy || 0) * 100)}%
                    </div>
                  </div>
                </div>
              )}
              
              {entry.recipients && (
                <div>
                  <div className="text-sm text-gray-600 mb-1">Recipients</div>
                  <div className="text-sm">{entry.recipients.join(', ')}</div>
                </div>
              )}
              
              {entry.errorMessage && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                  <div className="text-sm text-red-800">{entry.errorMessage}</div>
                </div>
              )}
            </div>
          )
        })()}

        {/* Trend Chart Placeholder */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <TrendingUp className="w-5 h-5 text-blue-600 mr-2" />
            <span className="text-sm text-blue-800">
              Report performance trends available in analytics dashboard
            </span>
          </div>
        </div>
      </div>
    </Modal>
  )
}