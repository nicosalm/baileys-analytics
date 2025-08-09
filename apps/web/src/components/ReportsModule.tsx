import { useState } from 'react'
import {
  Download, Calendar, Clock, FileText,
  Play, TrendingUp,
  DollarSign, Home, Users, BarChart3, CheckCircle,
  Edit2, Trash2, Copy, PieChart, Table, FileSpreadsheet,
  AlertCircle, Settings, CreditCard
} from 'lucide-react'
import { useToast } from '@/contexts/toast'
import { useDashboard } from '@/contexts/dashboard'
import { api } from '@/lib/api'

// Types
interface ReportTemplate {
  id: string
  name: string
  description?: string
  type: ReportType
  config: ReportConfig
  schedule?: ScheduleConfig
  createdAt: string
  lastRun?: string
  lastModified: string
  lastExportUrl?: string
}

interface ReportConfig {
  modules: string[]
  dateRange: 'custom' | 'last7days' | 'last30days' | 'lastMonth' | 'lastQuarter' | 'lastYear' | 'yearToDate'
  customDateRange?: { from: string; to: string }
  filters: {
    tags?: string[]
    properties?: string[]
    guestSegments?: string[]
  }
  format: 'pdf' | 'excel' | 'csv' | 'json'
  includeCharts: boolean
  includeRawData: boolean
  includeSummary: boolean
  groupBy?: 'property' | 'month' | 'quarter' | 'year'
  compareWithPrevious?: boolean
}

interface ScheduleConfig {
  enabled: boolean
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly'
  dayOfWeek?: number // 0-6 for weekly
  dayOfMonth?: number // 1-31 for monthly
  time: string // HH:MM
  recipients: string[]
  nextRun?: string
}

type ReportType = 'financial' | 'property' | 'tax' | 'occupancy' | 'guest' | 'seasonal' | 'overview' | 'custom'

// Sample templates (would come from API)
const defaultTemplates: ReportTemplate[] = [
  {
    id: '1',
    name: 'Monthly Financial Summary',
    description: 'Complete P&L, revenue analysis, and tax summary',
    type: 'financial',
    config: {
      modules: ['pl', 'revenue', 'tax'],
      dateRange: 'lastMonth',
      filters: {},
      format: 'pdf',
      includeCharts: true,
      includeRawData: false,
      includeSummary: true
    },
    schedule: {
      enabled: true,
      frequency: 'monthly',
      dayOfMonth: 1,
      time: '09:00',
      recipients: ['owner@example.com'],
      nextRun: '2025-02-01T09:00:00'
    },
    createdAt: '2024-01-15',
    lastRun: '2025-01-01',
    lastModified: '2024-12-20'
  },
  {
    id: '2',
    name: 'Weekly Property Performance',
    description: 'Property metrics, occupancy rates, and revenue by property',
    type: 'property',
    config: {
      modules: ['properties', 'occupancy'],
      dateRange: 'last7days',
      filters: {},
      format: 'excel',
      includeCharts: true,
      includeRawData: true,
      includeSummary: false
    },
    schedule: {
      enabled: true,
      frequency: 'weekly',
      dayOfWeek: 1,
      time: '08:00',
      recipients: ['manager@example.com'],
      nextRun: '2025-01-13T08:00:00'
    },
    createdAt: '2024-02-01',
    lastRun: '2025-01-06',
    lastModified: '2024-02-01'
  }
]

// Module options for report builder with enhanced categories
const moduleOptions = [
  // Financial modules
  { id: 'pl', label: 'P&L Statement', icon: TrendingUp, category: 'financial', description: 'Profit & Loss with detailed breakdowns' },
  { id: 'revenue', label: 'Revenue Analysis', icon: DollarSign, category: 'financial', description: 'Revenue by source, property, and platform' },
  { id: 'tax', label: 'Tax Report', icon: FileText, category: 'financial', description: 'Comprehensive tax calculations and summaries' },
  { id: 'cashflow', label: 'Cash Flow', icon: TrendingUp, category: 'financial', description: 'Cash inflows and outflows analysis' },
  { id: 'expenses', label: 'Expense Tracking', icon: CreditCard, category: 'financial', description: 'Detailed expense breakdown by category' },
  
  // Property modules
  { id: 'properties', label: 'Property Metrics', icon: Home, category: 'property', description: 'Performance metrics for each property' },
  { id: 'occupancy', label: 'Occupancy Analysis', icon: Calendar, category: 'property', description: 'Occupancy rates and patterns' },
  { id: 'property_comparison', label: 'Property Comparison', icon: BarChart3, category: 'property', description: 'Compare performance across properties' },
  { id: 'maintenance', label: 'Maintenance Schedule', icon: Settings, category: 'property', description: 'Upcoming maintenance and costs' },
  
  // Guest modules
  { id: 'guests', label: 'Guest Analytics', icon: Users, category: 'guest', description: 'Guest demographics and behavior' },
  { id: 'guest_segments', label: 'Guest Segmentation', icon: PieChart, category: 'guest', description: 'VIP, repeat, and new guest analysis' },
  { id: 'reviews', label: 'Review Summary', icon: AlertCircle, category: 'guest', description: 'Guest reviews and ratings analysis' },
  
  // Market modules
  { id: 'seasonal', label: 'Seasonal Trends', icon: BarChart3, category: 'market', description: 'Seasonal patterns and pricing' },
  { id: 'market_analysis', label: 'Market Analysis', icon: TrendingUp, category: 'market', description: 'Market comparison and positioning' },
  { id: 'forecast', label: 'Revenue Forecast', icon: TrendingUp, category: 'market', description: 'Predictive revenue modeling' },
  
  // Operations modules
  { id: 'bookings', label: 'Booking Analytics', icon: Calendar, category: 'operations', description: 'Booking patterns and lead times' },
  { id: 'channels', label: 'Channel Performance', icon: FileSpreadsheet, category: 'operations', description: 'OTA and direct booking analysis' },
  { id: 'overview', label: 'Executive Summary', icon: FileText, category: 'operations', description: 'High-level business overview' }
]

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

// Components
const TemplateCard = ({
  template,
  onRun,
  onEdit,
  onDelete,
  onDuplicate
}: {
  template: ReportTemplate
  onRun: () => void
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
}) => {
  const isScheduled = template.schedule?.enabled
  const nextRun = template.schedule?.nextRun
    ? new Date(template.schedule.nextRun).toLocaleString()
    : null

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6">
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
            Last run: {new Date(template.lastRun).toLocaleDateString()}
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
            onClick={onEdit}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
            title="Edit template"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={onDuplicate}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
            title="Duplicate template"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
            title="Delete template"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={onRun}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          <Play className="w-4 h-4 mr-2" />
          Run Now
        </button>
      </div>
    </div>
  )
}

const ReportBuilder = ({
  template,
  onSave,
  onCancel
}: {
  template?: ReportTemplate
  onSave: (config: Partial<ReportTemplate>) => void
  onCancel: () => void
}) => {
  const [name, setName] = useState(template?.name || '')
  const [description, setDescription] = useState(template?.description || '')
  const [selectedModules, setSelectedModules] = useState<string[]>(template?.config.modules || [])
  const [dateRange, setDateRange] = useState(template?.config.dateRange || 'last30days')
  const [customFrom, setCustomFrom] = useState(template?.config.customDateRange?.from || '')
  const [customTo, setCustomTo] = useState(template?.config.customDateRange?.to || '')
  const [format, setFormat] = useState(template?.config.format || 'pdf')
  const [includeCharts, setIncludeCharts] = useState(template?.config.includeCharts ?? true)
  const [includeRawData, setIncludeRawData] = useState(template?.config.includeRawData ?? false)
  const [includeSummary, setIncludeSummary] = useState(template?.config.includeSummary ?? true)
  const [groupBy, setGroupBy] = useState(template?.config.groupBy || 'property')
  const [compareWithPrevious, setCompareWithPrevious] = useState(template?.config.compareWithPrevious ?? false)

  // Schedule settings
  const [scheduleEnabled, setScheduleEnabled] = useState(template?.schedule?.enabled || false)
  const [frequency, setFrequency] = useState(template?.schedule?.frequency || 'monthly')
  const [scheduleTime, setScheduleTime] = useState(template?.schedule?.time || '09:00')
  const [recipients, setRecipients] = useState(template?.schedule?.recipients?.join(', ') || '')

  const handleSave = () => {
    const config: Partial<ReportTemplate> = {
      name,
      description,
      type: 'custom',
      config: {
        modules: selectedModules,
        dateRange,
        customDateRange: dateRange === 'custom' ? { from: customFrom, to: customTo } : undefined,
        filters: {},
        format,
        includeCharts,
        includeRawData,
        includeSummary,
        groupBy: groupBy as any,
        compareWithPrevious
      }
    }

    if (scheduleEnabled) {
      config.schedule = {
        enabled: true,
        frequency,
        time: scheduleTime,
        recipients: recipients.split(',').map(e => e.trim()).filter(Boolean)
      }
    }

    onSave(config)
  }

  const toggleModule = (moduleId: string) => {
    setSelectedModules(prev =>
      prev.includes(moduleId)
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId]
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-bold mb-6">
        {template ? 'Edit Report Template' : 'Create New Report'}
      </h2>

      <div className="space-y-6">
        {/* Basic Info */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Report Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., Monthly Financial Summary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description (Optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            rows={2}
            placeholder="Brief description of what this report contains"
          />
        </div>

        {/* Module Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Modules
          </label>
          {/* Group modules by category */}
          {['financial', 'property', 'guest', 'market', 'operations'].map(category => {
            const categoryModules = moduleOptions.filter(m => m.category === category)
            if (categoryModules.length === 0) return null
            
            return (
              <div key={category} className="mb-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  {category}
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {categoryModules.map(module => (
                    <button
                      key={module.id}
                      onClick={() => toggleModule(module.id)}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        selectedModules.includes(module.id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      title={module.description}
                    >
                      <module.icon className={`w-5 h-5 mb-1 ${
                        selectedModules.includes(module.id) ? 'text-blue-600' : 'text-gray-600'
                      }`} />
                      <div className={`text-xs font-medium ${
                        selectedModules.includes(module.id) ? 'text-blue-700' : 'text-gray-700'
                      }`}>
                        {module.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Date Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date Range
          </label>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as ReportConfig['dateRange'])}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            {dateRangeOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {dateRange === 'custom' && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}
        </div>

        {/* Format Options */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Export Format
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {formatOptions.map(option => (
              <button
                key={option.value}
                onClick={() => setFormat(option.value as any)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  format === option.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <option.icon className={`w-5 h-5 mx-auto mb-1 ${
                  format === option.value ? 'text-blue-600' : 'text-gray-600'
                }`} />
                <div className={`text-xs font-medium ${
                  format === option.value ? 'text-blue-700' : 'text-gray-700'
                }`}>
                  {option.label}
                </div>
                <div className="text-xs text-gray-500 mt-1">{option.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Report Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Include in Report
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={includeSummary}
                  onChange={(e) => setIncludeSummary(e.target.checked)}
                  className="mr-2 text-blue-600"
                />
                <span className="text-sm">Executive Summary</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={includeCharts}
                  onChange={(e) => setIncludeCharts(e.target.checked)}
                  className="mr-2 text-blue-600"
                  disabled={format === 'csv' || format === 'json'}
                />
                <span className="text-sm">Charts & Visualizations</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={includeRawData}
                  onChange={(e) => setIncludeRawData(e.target.checked)}
                  className="mr-2 text-blue-600"
                />
                <span className="text-sm">Detailed Data Tables</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={compareWithPrevious}
                  onChange={(e) => setCompareWithPrevious(e.target.checked)}
                  className="mr-2 text-blue-600"
                />
                <span className="text-sm">Period-over-Period Comparison</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Data Grouping
            </label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="property">By Property</option>
              <option value="month">By Month</option>
              <option value="quarter">By Quarter</option>
              <option value="year">By Year</option>
            </select>
          </div>
        </div>

        {/* Schedule Settings */}
        <div className="border-t pt-6">
          <label className="flex items-center mb-4">
            <input
              type="checkbox"
              checked={scheduleEnabled}
              onChange={(e) => setScheduleEnabled(e.target.checked)}
              className="mr-2"
            />
            <span className="font-medium">Schedule this report</span>
          </label>

          {scheduleEnabled && (
            <div className="space-y-4 pl-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Frequency
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Time
                  </label>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Recipients (comma-separated)
                </label>
                <input
                  type="text"
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="email1@example.com, email2@example.com"
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-6 border-t">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name || selectedModules.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {template ? 'Update Template' : 'Create Template'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Main Component
export default function ReportsModule() {
  const { addToast } = useToast()
  const { filters } = useDashboard()
  const [templates, setTemplates] = useState<ReportTemplate[]>(defaultTemplates)
  const [showBuilder, setShowBuilder] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ReportTemplate | undefined>()
  const [, setRunningReport] = useState<string | null>(null)

  const handleRunReport = async (template: ReportTemplate) => {
    setRunningReport(template.id)

    try {
      // Calculate actual date range based on template config
      const dateRange = calculateDateRange(template.config.dateRange, template.config.customDateRange)

      // Collect data for selected modules
      const reportData = await collectReportData(template.config.modules, dateRange, template.config.filters)

      // Generate the report based on format
      const exportUrl = await generateReport(reportData, template.config)

      if (exportUrl) {
        // For browser-generated exports (CSV, JSON), trigger download
        if (template.config.format === 'csv' || template.config.format === 'json') {
          const a = document.createElement('a')
          a.href = exportUrl
          a.download = `${template.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.${template.config.format}`
          a.click()
          URL.revokeObjectURL(exportUrl)
        } else {
          // For server-generated exports (PDF, Excel), use API
          const response = await api.request('/reports/generate', {
            method: 'POST',
            body: JSON.stringify({
              templateId: template.id,
              data: reportData,
              config: {
                ...template.config,
                dateRange: dateRange
              }
            })
          })

          if (response.success) {
            window.open(`/api/reports/download/${(response.data as any).reportId}`, '_blank')
          }
        }

        addToast('success', `Report "${template.name}" generated successfully`)

        // Update last run time
        setTemplates(prev => prev.map(t =>
          t.id === template.id
            ? { ...t, lastRun: new Date().toISOString(), lastExportUrl: exportUrl }
            : t
        ))
      } else {
        addToast('error', 'Failed to generate report')
      }
    } catch (error) {
      console.error('Report generation error:', error)
      addToast('error', 'An error occurred while generating the report')
    } finally {
      setRunningReport(null)
    }
  }

  const handleSaveTemplate = async (config: Partial<ReportTemplate>) => {
    try {
      if (editingTemplate) {
        // Update existing template
        const updated = {
          ...editingTemplate,
          ...config,
          lastModified: new Date().toISOString()
        }
        setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? updated : t))
        addToast('success', 'Report template updated')
      } else {
        // Create new template
        const newTemplate: ReportTemplate = {
          id: Date.now().toString(),
          name: config.name!,
          description: config.description,
          type: config.type || 'custom',
          config: config.config!,
          schedule: config.schedule,
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString()
        }
        setTemplates(prev => [...prev, newTemplate])
        addToast('success', 'Report template created')
      }

      setShowBuilder(false)
      setEditingTemplate(undefined)
    } catch (error) {
      addToast('error', 'Failed to save template')
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (confirm('Are you sure you want to delete this report template?')) {
      setTemplates(prev => prev.filter(t => t.id !== templateId))
      addToast('success', 'Report template deleted')
    }
  }

  const handleDuplicateTemplate = (template: ReportTemplate) => {
    const duplicate = {
      ...template,
      id: Date.now().toString(),
      name: `${template.name} (Copy)`,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      lastRun: undefined,
      schedule: template.schedule ? { ...template.schedule, enabled: false } : undefined
    }
    setTemplates(prev => [...prev, duplicate])
    addToast('success', 'Report template duplicated')
  }

  const calculateDateRange = (
    rangeType: string,
    customRange?: { from: string; to: string }
  ): { from: string; to: string } => {
    const today = new Date()
    const from = new Date()
    const to = new Date()

    switch (rangeType) {
      case 'last7days':
        from.setDate(today.getDate() - 7)
        break
      case 'last30days':
        from.setDate(today.getDate() - 30)
        break
      case 'lastMonth':
        from.setMonth(today.getMonth() - 1)
        from.setDate(1)
        to.setDate(0)
        break
      case 'lastQuarter':
        const quarter = Math.floor((today.getMonth() / 3))
        from.setMonth(quarter * 3 - 3)
        from.setDate(1)
        to.setMonth(quarter * 3)
        to.setDate(0)
        break
      case 'lastYear':
        from.setFullYear(today.getFullYear() - 1)
        from.setMonth(0)
        from.setDate(1)
        to.setFullYear(today.getFullYear() - 1)
        to.setMonth(11)
        to.setDate(31)
        break
      case 'yearToDate':
        from.setMonth(0)
        from.setDate(1)
        break
      case 'monthToDate':
        from.setDate(1)
        break
      case 'quarterToDate':
        const currentQuarter = Math.floor((today.getMonth() / 3))
        from.setMonth(currentQuarter * 3)
        from.setDate(1)
        break
      case 'custom':
        return customRange!
      default:
        from.setDate(today.getDate() - 30)
    }

    return {
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0]
    }
  }

  // Collect data from various dashboard modules
  const collectReportData = async (modules: string[], dateRange: { from: string; to: string }, filters: any) => {
    const data: any = {
      metadata: {
        generatedAt: new Date().toISOString(),
        dateRange,
        modules,
        filters
      },
      modules: {}
    }

    // Fetch data for each selected module
    for (const module of modules) {
      try {
        switch (module) {
          case 'pl':
          case 'revenue':
          case 'tax':
          case 'cashflow':
          case 'expenses':
            const financialData = await api.getFinancial(dateRange.from, dateRange.to, filters.tags)
            data.modules[module] = financialData.success ? financialData.data : null
            break

          case 'properties':
          case 'property_comparison':
            const propertyData = await api.getPropertyMetrics(dateRange.from, dateRange.to, filters.tags)
            data.modules[module] = propertyData.success ? propertyData.data : null
            break

          case 'occupancy':
            const occupancyData = await api.getOccupancy(dateRange.from, dateRange.to, filters.tags)
            data.modules[module] = occupancyData.success ? occupancyData.data : null
            break

          case 'guests':
          case 'guest_segments':
            const guestData = await api.getGuests(dateRange.from, dateRange.to, filters.tags)
            data.modules[module] = guestData.success ? guestData.data : null
            break

          case 'seasonal':
            const seasonalData = await api.request(`/seasonal-analysis?year=${new Date(dateRange.from).getFullYear()}`)
            data.modules[module] = seasonalData.success ? seasonalData.data : null
            break

          case 'overview':
            const overviewData = await api.request(`/overview?from=${dateRange.from}&to=${dateRange.to}`)
            data.modules[module] = overviewData.success ? overviewData.data : null
            break

          default:
            console.warn(`Unknown module: ${module}`)
        }
      } catch (error) {
        console.error(`Error fetching data for module ${module}:`, error)
        data.modules[module] = { error: `Failed to load ${module} data` }
      }
    }

    return data
  }

  // Generate report in the requested format
  const generateReport = async (data: any, config: ReportConfig) => {
    switch (config.format) {
      case 'csv':
        return generateCSV(data)
      case 'json':
        return generateJSON(data)
      case 'pdf':
      case 'excel':
        // These formats require server-side generation
        return 'server-generated'
      default:
        return null
    }
  }

  // Generate CSV export
  const generateCSV = (data: any) => {
    const rows: string[][] = []
    
    // Add header
    rows.push(['Report Generated', new Date().toISOString()])
    rows.push(['Date Range', `${data.metadata.dateRange.from} to ${data.metadata.dateRange.to}`])
    rows.push([])

    // Process each module's data
    Object.entries(data.modules).forEach(([module, moduleData]: [string, any]) => {
      if (!moduleData || moduleData.error) return

      rows.push([moduleOptions.find(m => m.id === module)?.label || module])
      rows.push([])

      // Convert module data to CSV rows
      if (Array.isArray(moduleData)) {
        if (moduleData.length > 0) {
          const headers = Object.keys(moduleData[0])
          rows.push(headers)
          moduleData.forEach(item => {
            rows.push(headers.map(h => {
              const value = item[h]
              return typeof value === 'object' ? JSON.stringify(value) : String(value)
            }))
          })
        }
      } else if (typeof moduleData === 'object') {
        Object.entries(moduleData).forEach(([key, value]) => {
          if (typeof value !== 'object') {
            rows.push([key, String(value)])
          }
        })
      }
      rows.push([])
    })

    // Convert to CSV string
    const csv = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    return URL.createObjectURL(blob)
  }

  // Generate JSON export
  const generateJSON = (data: any) => {
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    return URL.createObjectURL(blob)
  }

  // Quick export function for current view
  const handleQuickExport = async () => {
    try {
      const response = await api.request('/reports/quick-export', {
        method: 'POST',
        body: JSON.stringify({
          dateRange: {
            from: filters.dateRange.from,
            to: filters.dateRange.to
          },
          tags: filters.selectedTags.map(t => t.id),
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Reports</h2>
          <p className="text-gray-600 mt-1">Create, schedule, and manage your reports</p>
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
            onClick={() => {
              setEditingTemplate(undefined)
              setShowBuilder(true)
            }}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <FileText className="w-4 h-4 mr-2" />
            New Report
          </button>
        </div>
      </div>

      {/* Builder/Editor */}
      {showBuilder && (
        <ReportBuilder
          template={editingTemplate}
          onSave={handleSaveTemplate}
          onCancel={() => {
            setShowBuilder(false)
            setEditingTemplate(undefined)
          }}
        />
      )}

      {/* Templates Grid */}
      {!showBuilder && (
        <>
          {/* Scheduled Reports Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Clock className="w-5 h-5 mr-2" />
              Scheduled Reports
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.filter(t => t.schedule?.enabled).map(template => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onRun={() => handleRunReport(template)}
                  onEdit={() => {
                    setEditingTemplate(template)
                    setShowBuilder(true)
                  }}
                  onDelete={() => handleDeleteTemplate(template.id)}
                  onDuplicate={() => handleDuplicateTemplate(template)}
                />
              ))}
              {templates.filter(t => t.schedule?.enabled).length === 0 && (
                <div className="col-span-full text-center py-8 bg-gray-50 rounded-lg">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">No scheduled reports</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Create a report template and enable scheduling to automate your reports
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* All Templates Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              Report Templates
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.filter(t => !t.schedule?.enabled).map(template => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onRun={() => handleRunReport(template)}
                  onEdit={() => {
                    setEditingTemplate(template)
                    setShowBuilder(true)
                  }}
                  onDelete={() => handleDeleteTemplate(template.id)}
                  onDuplicate={() => handleDuplicateTemplate(template)}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
