import { query } from './services/database'
import { randomUUID } from 'crypto'
import { 
  calculateNextMonthlyRun, 
  calculateNextWeeklyRun 
} from './utils/scheduleUtils'
import {
  createErrorResponse
} from './utils/httpResponses'

async function hasExistingTemplates(tenantId: string): Promise<boolean> {
  const result = await query(
    'SELECT COUNT(*) as count FROM report_templates WHERE tenant_id = $1',
    [tenantId]
  )
  return result.success && result.data[0].count > 0
}

async function insertDefaultTemplate(
  template: any, 
  tenantId: string, 
  timestamp: string
): Promise<void> {
  await query(
    `INSERT INTO report_templates 
     (id, tenant_id, name, description, type, config, schedule, created_at, last_modified, is_default)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      template.id,
      tenantId,
      template.name,
      template.description,
      template.type,
      JSON.stringify(template.config),
      template.schedule ? JSON.stringify(template.schedule) : null,
      timestamp,
      timestamp,
      true
    ]
  )
}

function createDefaultTemplates(): any[] {
  return [
    {
      id: randomUUID(),
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
        nextRun: calculateNextMonthlyRun(1, '09:00')
      }
    },
    {
      id: randomUUID(),
      name: 'Weekly Property Performance',
      description: 'Property metrics, occupancy rates, and revenue by property',
      type: 'operational',
      config: {
        modules: ['properties', 'occupancy'],
        dateRange: 'last7days',
        filters: {},
        format: 'pdf',
        includeCharts: true,
        includeRawData: true,
        includeSummary: false
      },
      schedule: {
        enabled: true,
        frequency: 'weekly',
        dayOfWeek: 1,
        time: '08:00',
        nextRun: calculateNextWeeklyRun(1, '08:00')
      }
    },
    {
      id: randomUUID(),
      name: 'Quarterly Tax Report',
      description: 'Comprehensive tax calculations and obligations',
      type: 'financial',
      config: {
        modules: ['tax'],
        dateRange: 'lastQuarter',
        filters: {},
        format: 'pdf',
        includeCharts: true,
        includeRawData: true,
        includeSummary: true
      },
      schedule: {
        enabled: false,
        frequency: 'quarterly',
        dayOfMonth: 1,
        time: '09:00'
      }
    },
    {
      id: randomUUID(),
      name: 'Year-End Overview',
      description: 'Annual summary of all properties and financial performance',
      type: 'analytics',
      config: {
        modules: ['pl', 'revenue', 'properties', 'occupancy', 'guests', 'seasonal'],
        dateRange: 'lastYear',
        filters: {},
        format: 'pdf',
        includeCharts: true,
        includeRawData: false,
        includeSummary: true,
        compareWithPrevious: true
      },
      schedule: null
    }
  ]
}

export async function seedDefaultReportTemplates(tenantId: string): Promise<void> {
  try {
    if (await hasExistingTemplates(tenantId)) {
      return
    }

    const now = new Date().toISOString()
    const defaultTemplates = createDefaultTemplates()

    for (const template of defaultTemplates) {
      await insertDefaultTemplate(template, tenantId, now)
    }
  } catch (error) {
    console.warn('Failed to seed default report templates:', error)
  }
}

