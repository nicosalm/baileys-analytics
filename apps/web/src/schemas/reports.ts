import { z } from 'zod'

// Report configuration schemas
export const reportConfigSchema = z.object({
  modules: z.array(z.string()).min(1, { message: 'At least one module is required' }),
  dateRange: z.enum(['custom', 'last7days', 'last30days', 'lastMonth', 'lastQuarter', 'lastYear', 'yearToDate']),
  customDateRange: z.object({
    from: z.string(),
    to: z.string()
  }).optional(),
  filters: z.object({
    tags: z.array(z.string()).optional(),
    properties: z.array(z.string()).optional(),
    guestSegments: z.array(z.string()).optional()
  }),
  format: z.enum(['pdf', 'excel', 'csv', 'json']),
  includeCharts: z.boolean(),
  includeRawData: z.boolean(),
  includeSummary: z.boolean(),
  groupBy: z.enum(['property', 'month', 'quarter', 'year']).optional(),
  compareWithPrevious: z.boolean().optional()
})

export const scheduleConfigSchema = z.object({
  enabled: z.boolean(),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly']),
  dayOfWeek: z.number().min(0).max(6).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format'),
  recipients: z.array(z.string().email()),
  nextRun: z.string().optional()
})

export const reportTemplateSchema = z.object({
  id: z.string(),
  name: z.string().min(1, { message: 'Name is required' }),
  description: z.string().optional(),
  type: z.enum(['financial', 'property', 'tax', 'occupancy', 'guest', 'seasonal', 'overview', 'custom']),
  config: reportConfigSchema,
  schedule: scheduleConfigSchema.optional(),
  createdAt: z.string(),
  lastRun: z.string().optional(),
  lastModified: z.string(),
  lastExportUrl: z.string().optional()
})

export const createReportTemplateSchema = reportTemplateSchema.omit({ 
  id: true,
  createdAt: true,
  lastRun: true,
  lastModified: true,
  lastExportUrl: true
})
export const updateReportTemplateSchema = reportTemplateSchema

export type ReportConfig = z.infer<typeof reportConfigSchema>
export type ScheduleConfig = z.infer<typeof scheduleConfigSchema>
export type ReportTemplate = z.infer<typeof reportTemplateSchema>
export type CreateReportTemplate = z.infer<typeof createReportTemplateSchema>
export type UpdateReportTemplate = z.infer<typeof updateReportTemplateSchema>