import { query } from './services/database'
import { randomUUID } from 'crypto'
import { addMonths, getDay, getDate } from './utils/dates'

export async function seedDefaultReportTemplates(tenantId: string): Promise<void> {
  try {
    // Check if tenant already has templates
    const existing = await query(
      'SELECT COUNT(*) as count FROM report_templates WHERE tenant_id = $1',
      [tenantId]
    )
    
    if (!existing.success || existing.data[0].count > 0) {
      return // Templates already exist
    }

    const now = new Date().toISOString()
    
    // Default templates
    const defaultTemplates = [
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
          recipients: [],
          nextRun: calculateNextMonthlyRun(1, '09:00')
        }
      },
      {
        id: randomUUID(),
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
          recipients: [],
          nextRun: calculateNextWeeklyRun(1, '08:00')
        }
      },
      {
        id: randomUUID(),
        name: 'Quarterly Tax Report',
        description: 'Comprehensive tax calculations and obligations',
        type: 'tax',
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
          time: '09:00',
          recipients: []
        }
      },
      {
        id: randomUUID(),
        name: 'Year-End Overview',
        description: 'Annual summary of all properties and financial performance',
        type: 'overview',
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

    // Insert all templates
    for (const template of defaultTemplates) {
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
          now,
          now,
          true // Mark as default templates
        ]
      )
    }
  } catch (error) {
    // Don't throw - this is not critical
  }
}

function calculateNextMonthlyRun(dayOfMonth: number, time: string): string {
  const now = new Date()
  const [hours, minutes] = time.split(':').map(Number)
  
  let nextRun = new Date()
  nextRun.setDate(dayOfMonth)
  nextRun.setHours(hours, minutes, 0, 0)
  
  // If we've passed this day/time this month, move to next month
  if (nextRun <= now) {
    nextRun = addMonths(nextRun, 1)
  }
  
  return nextRun.toISOString()
}

function calculateNextWeeklyRun(dayOfWeek: number, time: string): string {
  const now = new Date()
  const [hours, minutes] = time.split(':').map(Number)
  
  let nextRun = new Date()
  const currentDay = getDay(nextRun)
  const daysUntilTarget = (dayOfWeek - currentDay + 7) % 7
  
  nextRun.setDate(getDate(nextRun) + daysUntilTarget)
  nextRun.setHours(hours, minutes, 0, 0)
  
  // If we've passed this time today, move to next week
  if (nextRun <= now) {
    nextRun.setDate(getDate(nextRun) + 7)
  }
  
  return nextRun.toISOString()
}