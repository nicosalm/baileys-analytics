import { useState } from 'react'
import {
  Download, Calendar, Clock, FileText,
  Play, CheckCircle,
  Edit2, Trash2, Copy, Table, FileSpreadsheet,
  Plus, History, AlertCircle
} from 'lucide-react'
import { formatDateDisplay, subDays, formatDateISO } from '@baileys/utils'
import { useModal } from '@/contexts/modal'
import { useToast } from '@/contexts/toast'
import { 
  useReportTemplates, 
  createReportTemplate, 
  deleteReportTemplate as deleteTemplate,
  generateReport 
} from '@/hooks/use-api'
import { api } from '@/lib/api'
import type { ReportTemplate } from '@/schemas/reports'
import { LoadingState } from '@/components/LoadingState'
import { ConfirmModal } from '@/components/ConfirmModal'

const dateRangeOptions = [
  { value: 'last7days', label: 'Last 7 Days' },
  { value: 'last30days', label: 'Last 30 Days' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'lastQuarter', label: 'Last Quarter' },
  { value: 'lastYear', label: 'Last Year' },
  { value: 'yearToDate', label: 'Year to Date' },
  { value: 'monthToDate', label: 'Month to Date' },
  { value: 'quarterToDate', label: 'Quarter to Date' },
  { value: 'custom', label: 'Custom Range' }
]

const formatOptions = [
  { value: 'pdf', label: 'PDF', icon: FileText, description: 'Best for printing and sharing' },
  { value: 'excel', label: 'Excel', icon: FileSpreadsheet, description: 'Best for data analysis' },
  { value: 'csv', label: 'CSV', icon: Table, description: 'Simple data export' },
  { value: 'json', label: 'JSON', icon: FileText, description: 'For API integration' }
]

// Template Card Component
const TemplateCard = ({ template }: { template: ReportTemplate }) => {
  const { openModal } = useModal()
  const { addToast } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  const handleRun = async () => {
    try {
      await generateReport(template.id)
      openModal({
        type: 'report-preview',
        templateId: template.id,
        templateName: template.name
      })
    } catch (error) {
      addToast('error', 'Failed to generate report')
    }
  }
  
  const handleEdit = () => {
    openModal({
      type: 'report-builder',
      template
    })
  }
  
  const handleHistory = () => {
    openModal({
      type: 'report-history',
      templateId: template.id,
      templateName: template.name
    })
  }
  
  const handleDelete = () => {
    setShowDeleteConfirm(true)
  }

  const handleConfirmDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteTemplate(template.id)
      addToast('success', 'Report template deleted')
    } catch (error) {
      addToast('error', 'Failed to delete template')
    } finally {
      setIsDeleting(false)
    }
  }
  
  const handleDuplicate = async () => {
    try {
      const duplicatedTemplate = {
        name: `${template.name} (Copy)`,
        description: template.description,
        type: template.type,
        config: template.config,
        schedule: template.schedule ? { ...template.schedule, enabled: false } : undefined
      }
      
      await createReportTemplate(duplicatedTemplate)
      addToast('success', 'Report template duplicated')
    } catch (error) {
      addToast('error', 'Failed to duplicate template')
    }
  }

  const isScheduled = template.schedule?.enabled
  const nextRun = template.schedule?.nextRun
    ? new Date(template.schedule.nextRun).toLocaleString()
    : null

  return (
    <div className="bg-white rounded-lg shadow-sm hover:shadow-lg transition-shadow p-6">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold">{template.name}</h3>
          {template.description && (
            <p className="text-sm text-gray-600 mt-1">{template.description}</p>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {isScheduled && (
            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              Scheduled
            </span>
          )}
          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full flex items-center">
            {(() => {
              const formatOption = formatOptions.find(f => f.value === template.config.format)
              const Icon = formatOption?.icon
              return Icon ? <Icon className="w-3 h-3 mr-1" /> : null
            })()}
            {template.config.format.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center text-sm text-gray-500">
          <FileText className="w-4 h-4 mr-2" />
          {template.config.modules.length} modules • {dateRangeOptions.find(d => d.value === template.config.dateRange)?.label}
        </div>

        {template.lastRun && (
          <div className="flex items-center text-sm text-gray-500">
            <CheckCircle className="w-4 h-4 mr-2" />
            Last run: {formatDateDisplay(new Date(template.lastRun))}
          </div>
        )}

        {nextRun && (
          <div className="flex items-center text-sm text-blue-600">
            <Calendar className="w-4 h-4 mr-2" />
            Next run: {nextRun}
          </div>
        )}
      </div>

      <div className="flex justify-between items-center pt-4 border-t">
        <div className="flex space-x-2">
          <button
            onClick={handleEdit}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-sm"
            title="Edit template"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleDuplicate}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-sm"
            title="Duplicate template"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={handleHistory}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-sm"
            title="View history"
          >
            <History className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-sm disabled:opacity-50"
            title="Delete template"
          >
            {isDeleting ? <LoadingState /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
        <button
          onClick={handleRun}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 transition-colors"
        >
          <Play className="w-4 h-4 mr-2" />
          Run Now
        </button>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Report Template"
        message={`Are you sure you want to delete "${template.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  )
}

// Main Component
export default function ReportsModule() {
  const { addToast } = useToast()
  const { openModal } = useModal()
  const { data: templates, error, isLoading } = useReportTemplates()
  const [filterType, setFilterType] = useState<'all' | 'scheduled' | 'manual'>('all')

  const handleCreateNew = () => {
    openModal({
      type: 'report-builder',
      template: undefined
    })
  }

  const filteredTemplates = templates?.filter(t => {
    if (filterType === 'scheduled') return t.schedule?.enabled
    if (filterType === 'manual') return !t.schedule?.enabled
    return true
  }) || []

  // Quick export function for current view
  const handleQuickExport = async () => {
    try {
      const today = new Date()
      const thirtyDaysAgo = subDays(today, 30)
      
      const response = await api.request('/reports/quick-export', {
        method: 'POST',
        body: JSON.stringify({
          dateRange: {
            from: formatDateISO(thirtyDaysAgo),
            to: formatDateISO(today)
          },
          tags: [],
          format: 'excel'
        })
      })

      if (response.success) {
        window.open(`/api/reports/download/${(response.data as any).reportId}`, '_blank')
        addToast('success', 'Export generated successfully')
      }
    } catch (error) {
      addToast('error', 'Failed to generate export')
    }
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-gray-600">Failed to load report templates</p>
        <p className="text-sm text-gray-500 mt-2">{error.message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Reports</h2>
          <p className="text-gray-600 text-sm mt-1">
            Create, schedule, and manage your reports
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleQuickExport}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <Download className="w-4 h-4 mr-2" />
            Quick Export
          </button>
          <button
            onClick={handleCreateNew}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Report
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="border-b">
        <nav className="flex space-x-6">
          <button
            onClick={() => setFilterType('all')}
            className={`pb-2 border-b-2 transition-colors ${
              filterType === 'all'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            All Templates
          </button>
          <button
            onClick={() => setFilterType('scheduled')}
            className={`pb-2 border-b-2 transition-colors ${
              filterType === 'scheduled'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center">
              <Clock className="w-4 h-4 mr-2" />
              Scheduled
            </div>
          </button>
          <button
            onClick={() => setFilterType('manual')}
            className={`pb-2 border-b-2 transition-colors ${
              filterType === 'manual'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Manual
          </button>
        </nav>
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingState />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
            />
          ))}
          
          {filteredTemplates.length === 0 && (
            <div className="col-span-full text-center py-12 bg-gray-50 rounded-lg">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">
                {filterType === 'scheduled' 
                  ? 'No scheduled reports' 
                  : filterType === 'manual'
                  ? 'No manual reports'
                  : 'No report templates'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Create a report template to get started
              </p>
              <button
                onClick={handleCreateNew}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Create Report Template
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}