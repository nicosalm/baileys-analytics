import { useState } from 'react'
import { Modal } from '@/components/Modal'
import { useModal } from '@/contexts/modal'
import { useToast } from '@/contexts/toast'
import { useTips } from '@/hooks/use-tips'
import { createReportTemplate, updateReportTemplate } from '@/hooks/use-api'
import { reportTemplateSchema, type ReportTemplate } from '@/schemas/reports'
import { Calendar, Settings, Clock } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface ReportBuilderModalProps {
  template?: ReportTemplate
}

const moduleOptions = [
  { value: 'pl', label: 'Profit & Loss', description: 'Revenue and expenses breakdown' },
  { value: 'revenue', label: 'Revenue Analysis', description: 'Revenue sources and trends' },
  { value: 'tax', label: 'Tax Summary', description: 'Tax obligations and details' },
  { value: 'occupancy', label: 'Occupancy Report', description: 'Booking patterns and availability' },
  { value: 'properties', label: 'Property Performance', description: 'Individual property metrics' },
  { value: 'guests', label: 'Guest Analytics', description: 'Guest demographics and behavior' },
  { value: 'seasonal', label: 'Seasonal Trends', description: 'Seasonal booking patterns' },
  { value: 'channels', label: 'Channel Performance', description: 'Platform and booking channel analysis' }
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


export const ReportBuilderModal = ({ template }: ReportBuilderModalProps) => {
  const { closeModal } = useModal()
  const { addToast } = useToast()
  const { showTips } = useTips()
  
  const isEditMode = !!(template?.id)
  
  const [name, setName] = useState(template?.name || '')
  const [description, setDescription] = useState(template?.description || '')
  const [selectedModules, setSelectedModules] = useState<string[]>(template?.config?.modules || [])
  const [dateRange, setDateRange] = useState<string>(template?.config?.dateRange || 'last30days')
  const [customFrom, setCustomFrom] = useState(template?.config?.customDateRange?.from || '')
  const [customTo, setCustomTo] = useState(template?.config?.customDateRange?.to || '')
  const format = 'pdf'
  const [includeCharts, setIncludeCharts] = useState(template?.config?.includeCharts ?? true)
  const [includeRawData, setIncludeRawData] = useState(template?.config?.includeRawData ?? false)
  const [includeSummary, setIncludeSummary] = useState(template?.config?.includeSummary ?? true)
  const [compareWithPrevious, setCompareWithPrevious] = useState(template?.config?.compareWithPrevious ?? false)
  
  const [scheduleEnabled, setScheduleEnabled] = useState(template?.schedule?.enabled || false)
  const [frequency, setFrequency] = useState(template?.schedule?.frequency || 'monthly')
  const [scheduleTime, setScheduleTime] = useState(template?.schedule?.time || '09:00')
  
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    try {
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
      subtitle="Set up what you want to see in your reports"
      size="xl"
    >
      <Tabs defaultValue="config" className="space-y-6">
        <TabsList variant="line">
          <TabsTrigger value="config">
            <Settings className="w-4 h-4" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="schedule">
            <Calendar className="w-4 h-4" />
            Schedule
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-6">
          {/* Basic Info */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
            <div className="space-y-4">
              <div>
                <Label className="mb-1">
                  Report Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Monthly Financial Summary"
                />
              </div>
              <div>
                <Label className="mb-1">Description (optional)</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
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
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dateRangeOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {dateRange === 'custom' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="mb-1">From</Label>
                    <Input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="mb-1">To</Label>
                    <Input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Options */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Report Options</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <Checkbox checked={includeCharts} onCheckedChange={(v) => setIncludeCharts(v === true)} />
                <span>Include charts and visualizations</span>
              </label>
              <label className="flex items-center gap-3">
                <Checkbox checked={includeRawData} onCheckedChange={(v) => setIncludeRawData(v === true)} />
                <span>Include raw data tables</span>
              </label>
              <label className="flex items-center gap-3">
                <Checkbox checked={includeSummary} onCheckedChange={(v) => setIncludeSummary(v === true)} />
                <span>Include executive summary</span>
              </label>
              <label className="flex items-center gap-3">
                <Checkbox checked={compareWithPrevious} onCheckedChange={(v) => setCompareWithPrevious(v === true)} />
                <span>Compare with previous period</span>
              </label>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-6">
          {/* Enable Schedule */}
          <div className={showTips ? "bg-blue-50 border border-blue-200 rounded-lg p-4" : "p-4"}>
            <label className="flex items-center gap-3">
              <Checkbox checked={scheduleEnabled} onCheckedChange={(v) => setScheduleEnabled(v === true)} />
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
                <Label className="mb-2">Frequency</Label>
                <Select value={frequency} onValueChange={(v) => setFrequency(v as any)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Time */}
              <div>
                <Label className="mb-2">Time</Label>
                <Input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                />
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
        </TabsContent>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-6 border-t">
          <Button variant="ghost" onClick={closeModal} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || selectedModules.length === 0}
            loading={isSaving}
            loadingText={isSaving ? 'Saving...' : undefined}
          >
            {isEditMode ? 'Update Template' : 'Create Template'}
          </Button>
        </div>
      </Tabs>
    </Modal>
  )
}