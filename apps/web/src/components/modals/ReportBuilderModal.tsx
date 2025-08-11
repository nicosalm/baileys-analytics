import { useState } from 'react'
import { Modal } from '@/components/Modal'
import { useModal } from '@/contexts/modal'
import { useToast } from '@/contexts/toast'
import { createReportTemplate, updateReportTemplate } from '@/hooks/use-api'
import { reportTemplateSchema, type ReportTemplate } from '@/schemas/reports'
import { Calendar, Settings, Clock } from 'lucide-react'

interface ReportBuilderModalProps {
  template?: ReportTemplate
}

const moduleOptions = [
  { value: 'pl', label: 'Profit & Loss', description: 'Revenue, expenses, and net income' },
  { value: 'revenue', label: 'Revenue Analysis', description: 'Detailed revenue breakdown' },
  { value: 'tax', label: 'Tax Summary', description: 'Tax calculations and obligations' },
  { value: 'occupancy', label: 'Occupancy Report', description: 'Occupancy rates and trends' },
  { value: 'properties', label: 'Property Performance', description: 'Individual property metrics' },
  { value: 'guests', label: 'Guest Analytics', description: 'Guest demographics and patterns' },
  { value: 'seasonal', label: 'Seasonal Trends', description: 'Year-over-year comparisons' }
]

const dateRangeOptions = [
  { value: 'last7days', label: 'Last 7 Days' },
  { value: 'last30days', label: 'Last 30 Days' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'lastQuarter', label: 'Last Quarter' },
  { value: 'lastYear', label: 'Last Year' },
  { value: 'yearToDate', label: 'Year to Date' },
  { value: 'custom', label: 'Custom Range' }
]

const formatOptions = [
  { value: 'pdf', label: 'PDF', description: 'Best for sharing and printing' },
  { value: 'excel', label: 'Excel', description: 'Best for data analysis' },
  { value: 'csv', label: 'CSV', description: 'Best for data import' },
  { value: 'json', label: 'JSON', description: 'Best for API integration' }
]

export const ReportBuilderModal = ({ template }: ReportBuilderModalProps) => {
  const { closeModal } = useModal()
  const { addToast } = useToast()
  
  const isEditMode = !!(template?.id)
  
  const [activeTab, setActiveTab] = useState<'config' | 'schedule'>('config')
  const [name, setName] = useState(template?.name || '')
  const [description, setDescription] = useState(template?.description || '')
  const [selectedModules, setSelectedModules] = useState<string[]>(template?.config?.modules || [])
  const [dateRange, setDateRange] = useState<string>(template?.config?.dateRange || 'last30days')
  const [customFrom, setCustomFrom] = useState(template?.config?.customDateRange?.from || '')
  const [customTo, setCustomTo] = useState(template?.config?.customDateRange?.to || '')
  const [format, setFormat] = useState(template?.config?.format || 'pdf')
  const [includeCharts, setIncludeCharts] = useState(template?.config?.includeCharts ?? true)
  const [includeRawData, setIncludeRawData] = useState(template?.config?.includeRawData ?? false)
  const [includeSummary, setIncludeSummary] = useState(template?.config?.includeSummary ?? true)
  const [compareWithPrevious, setCompareWithPrevious] = useState(template?.config?.compareWithPrevious ?? false)
  
  // Schedule settings
  const [scheduleEnabled, setScheduleEnabled] = useState(template?.schedule?.enabled || false)
  const [frequency, setFrequency] = useState(template?.schedule?.frequency || 'monthly')
  const [scheduleTime, setScheduleTime] = useState(template?.schedule?.time || '09:00')
  const [recipients, setRecipients] = useState(template?.schedule?.recipients?.join(', ') || '')
  
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    try {
      // Build the template data
      const templateData = {
        name,
        description: description || undefined,
        type: 'custom' as const,
        config: {
          modules: selectedModules,
          dateRange: dateRange as any,
          customDateRange: dateRange === 'custom' ? { from: customFrom, to: customTo } : undefined,
          filters: {
            tags: [],
            properties: []
          },
          format: format as any,
          includeCharts,
          includeRawData,
          includeSummary,
          compareWithPrevious
        },
        schedule: scheduleEnabled ? {
          enabled: scheduleEnabled,
          frequency: frequency as any,
          time: scheduleTime,
          recipients: recipients.split(',').map(r => r.trim()).filter(Boolean),
          dayOfWeek: frequency === 'weekly' ? 1 : undefined,
          dayOfMonth: frequency === 'monthly' ? 1 : undefined
        } : undefined,
        createdAt: template?.createdAt || new Date().toISOString(),
        lastModified: new Date().toISOString(),
        lastRun: template?.lastRun
      }

      // Validate with Zod
      const validationResult = isEditMode 
        ? reportTemplateSchema.safeParse({ ...templateData, id: template.id })
        : reportTemplateSchema.omit({ id: true }).safeParse(templateData)

      if (!validationResult.success) {
        const errors = validationResult.error.flatten()
        const firstError = Object.values(errors.fieldErrors)[0]?.[0] || 
                          errors.formErrors[0] || 
                          'Invalid template data'
        addToast('error', firstError)
        return
      }

      setIsSaving(true)

      if (isEditMode && template?.id) {
        await updateReportTemplate(template.id, { ...templateData, id: template.id } as ReportTemplate)
        addToast('success', 'Report template updated')
      } else {
        await createReportTemplate(templateData)
        addToast('success', 'Report template created')
      }
      
      closeModal()
    } catch (error) {
      console.error('Failed to save template:', error)
      addToast('error', error instanceof Error ? error.message : 'Failed to save template')
    } finally {
      setIsSaving(false)
    }
  }

  const toggleModule = (module: string) => {
    setSelectedModules(prev =>
      prev.includes(module)
        ? prev.filter(m => m !== module)
        : [...prev, module]
    )
  }

  return (
    <Modal
      isOpen={true}
      onClose={closeModal}
      title={isEditMode ? 'Edit Report Template' : 'Create Report Template'}
      subtitle="Configure your report settings and schedule"
      size="xl"
    >
      <div className="space-y-6">
        {/* Tabs */}
        <div className="border-b">
          <nav className="flex space-x-6">
            <button
              onClick={() => setActiveTab('config')}
              className={`pb-2 border-b-2 transition-colors ${
                activeTab === 'config'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center">
                <Settings className="w-4 h-4 mr-2" />
                Configuration
              </div>
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`pb-2 border-b-2 transition-colors ${
                activeTab === 'schedule'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-2" />
                Schedule
              </div>
            </button>
          </nav>
        </div>

        {activeTab === 'config' && (
          <div className="space-y-6">
            {/* Basic Info */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Report Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Monthly Financial Summary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={2}
                    placeholder="Brief description of what this report contains"
                  />
                </div>
              </div>
            </div>

            {/* Modules */}
            <div>
              <h3 className="text-lg font-semibold mb-4">
                Report Modules <span className="text-red-500">*</span>
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {moduleOptions.map(module => (
                  <div
                    key={module.value}
                    onClick={() => toggleModule(module.value)}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedModules.includes(module.value)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium">{module.label}</div>
                    <div className="text-xs text-gray-500 mt-1">{module.description}</div>
                  </div>
                ))}
              </div>
              {selectedModules.length === 0 && (
                <p className="text-sm text-red-500 mt-2">Please select at least one module</p>
              )}
            </div>

            {/* Date Range */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Date Range</h3>
              <div className="space-y-4">
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {dateRangeOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                
                {dateRange === 'custom' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        From
                      </label>
                      <input
                        type="date"
                        value={customFrom}
                        onChange={(e) => setCustomFrom(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        To
                      </label>
                      <input
                        type="date"
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Output Format */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Output Format</h3>
              <div className="grid grid-cols-2 gap-3">
                {formatOptions.map(option => (
                  <div
                    key={option.value}
                    onClick={() => setFormat(option.value as any)}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      format === option.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium">{option.label}</div>
                    <div className="text-xs text-gray-500 mt-1">{option.description}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Options */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Report Options</h3>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={includeCharts}
                    onChange={(e) => setIncludeCharts(e.target.checked)}
                    className="mr-3 rounded"
                  />
                  <span>Include charts and visualizations</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={includeRawData}
                    onChange={(e) => setIncludeRawData(e.target.checked)}
                    className="mr-3 rounded"
                  />
                  <span>Include raw data tables</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={includeSummary}
                    onChange={(e) => setIncludeSummary(e.target.checked)}
                    className="mr-3 rounded"
                  />
                  <span>Include executive summary</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={compareWithPrevious}
                    onChange={(e) => setCompareWithPrevious(e.target.checked)}
                    className="mr-3 rounded"
                  />
                  <span>Compare with previous period</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="space-y-6">
            {/* Enable Schedule */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={scheduleEnabled}
                  onChange={(e) => setScheduleEnabled(e.target.checked)}
                  className="mr-3 rounded"
                />
                <div>
                  <div className="font-medium">Enable Automated Schedule</div>
                  <div className="text-sm text-gray-600">Automatically generate and send this report</div>
                </div>
              </label>
            </div>

            {scheduleEnabled && (
              <>
                {/* Frequency */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Frequency
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                </div>

                {/* Time */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Time
                  </label>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Recipients */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Recipients
                  </label>
                  <textarea
                    value={recipients}
                    onChange={(e) => setRecipients(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="Enter email addresses separated by commas"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Separate multiple email addresses with commas
                  </p>
                </div>

                {/* Next Run Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <Clock className="w-4 h-4 mr-2" />
                    Next run will be scheduled after saving
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-6 border-t">
          <button
            onClick={closeModal}
            className="px-4 py-2 text-gray-700 hover:text-gray-900"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !name.trim() || selectedModules.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : (isEditMode ? 'Update Template' : 'Create Template')}
          </button>
        </div>
      </div>
    </Modal>
  )
}