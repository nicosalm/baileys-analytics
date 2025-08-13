import { app, HttpRequest, HttpResponseInit, InvocationContext, Timer } from '@azure/functions'
import * as cron from 'node-cron'
import * as nodemailer from 'nodemailer'
import { query, transaction } from './services/database'
import { requireAuth, corsHeaders } from './middleware/auth'
import { formatCurrency } from '@baileys/utils'
import { formatDateISO, formatDateDisplay, setYear, addMonths, setMonth, getYear, getMonth, getDay, getDate } from './utils/dates'
import { randomUUID } from 'crypto'

interface ScheduledReport {
  id: string
  tenant_id: string
  template_id: string
  name: string
  config: any
  schedule: {
    enabled: boolean
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly'
    dayOfWeek?: number
    dayOfMonth?: number
    time: string
    recipients: string[]
  }
  last_run?: string
  next_run: string
}

// Email configuration - should be in environment variables
const emailTransporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
})

// Convert schedule to cron expression
function getCronExpression(schedule: ScheduledReport['schedule']): string {
  const [hour, minute] = schedule.time.split(':').map(Number)
  
  switch (schedule.frequency) {
    case 'daily':
      return `${minute} ${hour} * * *`
    case 'weekly':
      return `${minute} ${hour} * * ${schedule.dayOfWeek || 1}`
    case 'monthly':
      return `${minute} ${hour} ${schedule.dayOfMonth || 1} * *`
    case 'quarterly':
      // Run on 1st day of Jan, Apr, Jul, Oct
      return `${minute} ${hour} 1 1,4,7,10 *`
    default:
      return `${minute} ${hour} * * *`
  }
}

// Calculate next run time
function getNextRunTime(schedule: ScheduledReport['schedule']): Date {
  const now = new Date()
  const [hour, minute] = schedule.time.split(':').map(Number)
  let next = new Date()
  
  next.setHours(hour, minute, 0, 0)
  
  switch (schedule.frequency) {
    case 'daily':
      if (next <= now) {
        next.setDate(getDate(next) + 1)
      }
      break
      
    case 'weekly':
      const targetDay = schedule.dayOfWeek || 1
      next.setDate(getDate(next) + ((targetDay - getDay(next) + 7) % 7))
      if (next <= now) {
        next.setDate(getDate(next) + 7)
      }
      break
      
    case 'monthly':
      next.setDate(schedule.dayOfMonth || 1)
      if (next <= now) {
        next = addMonths(next, 1)
      }
      break
      
    case 'quarterly':
      const currentMonth = getMonth(now)
      const quarterMonths = [0, 3, 6, 9]
      const nextQuarterMonth = quarterMonths.find(m => m > currentMonth) || 0
      next.setMonth(nextQuarterMonth)
      next.setDate(1)
      if (next <= now) {
        next = setYear(next, getYear(next) + 1)
      }
      break
  }
  
  return next
}

// Generate and email report
async function generateAndEmailReport(report: ScheduledReport, context: InvocationContext) {
  try {
    // Fetch user info
    const userResult = await query<any>(
      'SELECT email, company_name FROM users u JOIN tenants t ON u.tenant_id = t.id WHERE t.id = $1',
      [report.tenant_id]
    )
    
    if (!userResult.success || userResult.data.length === 0) {
      context.error('User not found for scheduled report:', report.id)
      return
    }
    
    const user = userResult.data[0]
    
    // Calculate date range based on frequency
    const dateRange = calculateDateRangeForSchedule(report.schedule.frequency)
    
    // Fetch data for all modules in the report
    const reportData = await fetchReportData(report.config.modules, dateRange, report.tenant_id)
    
    // Generate report summary for email
    const summary = generateEmailSummary(reportData, report.name)
    
    // Send email with summary
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@baileys-analytics.com',
      to: report.schedule.recipients.join(', '),
      subject: `${report.name} - ${formatDateDisplay(new Date())}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">${report.name}</h2>
          <p>Hello ${user.name || 'there'},</p>
          <p>Your scheduled report is ready. Here's a summary:</p>
          
          ${summary}
          
          <div style="margin-top: 30px; padding: 20px; background: #f3f4f6; border-radius: 8px;">
            <p style="margin: 0;">To view the full report with charts and detailed data, please log in to your dashboard:</p>
            <a href="${process.env.APP_URL}/dashboard" style="display: inline-block; margin-top: 10px; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">View Full Report</a>
          </div>
          
          <p style="margin-top: 30px; font-size: 12px; color: #6b7280;">
            This is an automated report from Baileys Analytics. You're receiving this because you have scheduled reports enabled.
            To modify your report settings, visit your dashboard settings.
          </p>
        </div>
      `
    }
    
    await emailTransporter.sendMail(mailOptions)
    
    // Update last run time
    await query(
      `UPDATE scheduled_reports 
       SET last_run = NOW(), 
           next_run = $1 
       WHERE id = $2`,
      [getNextRunTime(report.schedule), report.id]
    )
    
    // Log successful execution
    await query(
      `INSERT INTO report_execution_log (
        id, report_id, status, recipients, summary
      ) VALUES ($1, $2, 'success', $3, $4)`,
      [randomUUID(), report.id, JSON.stringify(report.schedule.recipients), summary]
    )
    
    context.log(`Successfully sent scheduled report: ${report.name}`)
  } catch (error) {
    context.error('Error generating scheduled report:', error)
    
    // Log failed execution
    await query(
      `INSERT INTO report_execution_log (
        id, report_id, status, error
      ) VALUES ($1, $2, 'failed', $3)`,
      [randomUUID(), report.id, error instanceof Error ? error.message : 'Unknown error']
    )
  }
}

// Calculate date range based on schedule frequency
function calculateDateRangeForSchedule(frequency: string): { from: string; to: string } {
  const today = new Date()
  let from = new Date()
  let to = new Date()
  
  switch (frequency) {
    case 'daily':
      from.setDate(getDate(today) - 1)
      to.setDate(getDate(today) - 1)
      break
    case 'weekly':
      from.setDate(getDate(today) - 7)
      to.setDate(getDate(today) - 1)
      break
    case 'monthly':
      from = addMonths(from, -1)
      from.setDate(1)
      to.setDate(0) // Last day of previous month
      break
    case 'quarterly':
      from = addMonths(from, -3)
      from.setDate(1)
      to = setMonth(to, getMonth(today))
      to.setDate(0)
      break
    default:
      from.setDate(getDate(today) - 30)
  }
  
  return {
    from: formatDateISO(from),
    to: formatDateISO(to)
  }
}

// Fetch report data (simplified version)
async function fetchReportData(modules: string[], dateRange: any, tenantId: string): Promise<any> {
  const data: any = {
    dateRange,
    modules: {}
  }
  
  // This is a simplified version - in production, you'd call the actual data fetching functions
  for (const module of modules) {
    switch (module) {
      case 'revenue':
      case 'pl':
        const revenueResult = await query<any>(
          `SELECT 
            SUM(total_amount) as revenue,
            COUNT(*) as bookings
           FROM bookings 
           WHERE tenant_id = $1 
             AND arrival >= $2::date 
             AND arrival <= $3::date`,
          [tenantId, dateRange.from, dateRange.to]
        )
        if (revenueResult.success && revenueResult.data.length > 0) {
          data.modules[module] = revenueResult.data[0]
        }
        break
        
      case 'occupancy':
        // Calculate occupancy from bookings
        const occupancyResult = await query<any>(
          `SELECT 
            COUNT(DISTINCT property_id) as properties,
            COUNT(*) as total_bookings
           FROM bookings 
           WHERE tenant_id = $1 
             AND arrival >= $2::date 
             AND departure <= $3::date`,
          [tenantId, dateRange.from, dateRange.to]
        )
        if (occupancyResult.success && occupancyResult.data.length > 0) {
          data.modules[module] = occupancyResult.data[0]
        }
        break
        
      case 'guests':
        const guestsResult = await query<any>(
          `SELECT 
            COUNT(DISTINCT guest_email) as totalGuests,
            AVG(total_amount) as avgSpend
           FROM bookings 
           WHERE tenant_id = $1 
             AND arrival >= $2::date 
             AND arrival <= $3::date`,
          [tenantId, dateRange.from, dateRange.to]
        )
        if (guestsResult.success && guestsResult.data.length > 0) {
          data.modules[module] = { metrics: guestsResult.data[0] }
        }
        break
    }
  }
  
  return data
}

// Generate email summary HTML
function generateEmailSummary(data: any, reportName: string): string {
  let html = '<div style="margin: 20px 0;">'
  
  // Key metrics section
  html += '<h3 style="color: #374151;">Key Metrics</h3>'
  html += '<table style="width: 100%; border-collapse: collapse;">'
  
  if (data.modules.revenue) {
    const revenue = data.modules.revenue
    html += `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px 0;">Total Revenue</td>
        <td style="padding: 10px 0; text-align: right; font-weight: bold;">
          ${formatCurrency(revenue.revenue || 0)}
        </td>
      </tr>
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px 0;">Total Bookings</td>
        <td style="padding: 10px 0; text-align: right; font-weight: bold;">
          ${revenue.bookings || 0}
        </td>
      </tr>
    `
  }
  
  if (data.modules.occupancy) {
    const occupancy = data.modules.occupancy
    html += `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px 0;">Average Occupancy</td>
        <td style="padding: 10px 0; text-align: right; font-weight: bold;">
          ${((occupancy.overall || 0) * 100).toFixed(1)}%
        </td>
      </tr>
    `
  }
  
  if (data.modules.guests?.metrics) {
    const guests = data.modules.guests.metrics
    html += `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px 0;">Total Guests</td>
        <td style="padding: 10px 0; text-align: right; font-weight: bold;">
          ${guests.totalGuests || 0}
        </td>
      </tr>
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px 0;">Average Guest Spend</td>
        <td style="padding: 10px 0; text-align: right; font-weight: bold;">
          ${formatCurrency(guests.avgSpend || 0)}
        </td>
      </tr>
    `
  }
  
  html += '</table>'
  html += '</div>'
  
  return html
}

// Timer trigger for checking and running scheduled reports
export async function scheduledReportRunner(
  myTimer: Timer,
  context: InvocationContext
): Promise<void> {
  context.log('Scheduled report runner triggered')
  
  try {
    // Get all active scheduled reports that need to run
    const reportsResult = await query<any>(
      `SELECT * FROM scheduled_reports 
       WHERE enabled = true 
         AND (next_run IS NULL OR next_run <= NOW())`,
      []
    )
    
    if (!reportsResult.success) {
      context.error('Failed to fetch scheduled reports:', reportsResult.error)
      return
    }
    
    context.log(`Found ${reportsResult.data.length} reports to process`)
    
    for (const report of reportsResult.data) {
      // Parse the stored JSON config if it's a string
      if (typeof report.config === 'string') {
        report.config = JSON.parse(report.config)
      }
      if (typeof report.schedule === 'string') {
        report.schedule = JSON.parse(report.schedule)
      }
      
      if (report.schedule.enabled) {
        await generateAndEmailReport(report, context)
      }
    }
  } catch (error) {
    context.error('Error in scheduled report runner:', error)
  }
}

// API endpoint to manage scheduled reports
export async function manageScheduledReports(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.authenticated) {
      return authResult.response
    }
    const { auth } = authResult.request
    
    const method = request.method.toUpperCase()
    
    switch (method) {
      case 'GET':
        // List scheduled reports
        const reportsResult = await query<any>(
          `SELECT * FROM scheduled_reports WHERE tenant_id = $1`,
          [auth.tenantId || '']
        )
        
        if (!reportsResult.success) {
          throw new Error('Failed to fetch reports: ' + reportsResult.error)
        }
        
        return {
          status: 200,
          body: JSON.stringify({
            success: true,
            data: reportsResult.data.map(r => ({
              ...r,
              config: typeof r.config === 'string' ? JSON.parse(r.config) : r.config,
              schedule: typeof r.schedule === 'string' ? JSON.parse(r.schedule) : r.schedule
            }))
          })
        }
        
      case 'POST':
        // Create or update scheduled report
        const body = await request.json() as any
        const { templateId, name, config, schedule } = body
        
        if (!templateId || !name || !config || !schedule) {
          return {
            status: 400,
            body: JSON.stringify({ error: 'Missing required fields' })
          }
        }
        
        const nextRun = schedule.enabled ? getNextRunTime(schedule) : null
        const reportId = body.id || randomUUID()
        
        const upsertResult = await query(
          `INSERT INTO scheduled_reports (
            id, tenant_id, template_id, name, config, schedule, 
            enabled, next_run
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO UPDATE SET
            template_id = EXCLUDED.template_id,
            name = EXCLUDED.name,
            config = EXCLUDED.config,
            schedule = EXCLUDED.schedule,
            enabled = EXCLUDED.enabled,
            next_run = EXCLUDED.next_run,
            updated_at = NOW()
          RETURNING id`,
          [
            reportId,
            auth.tenantId || '',
            templateId,
            name,
            config,
            schedule,
            schedule.enabled,
            nextRun
          ]
        )
        
        if (!upsertResult.success) {
          throw new Error('Failed to save report: ' + upsertResult.error)
        }
        
        return {
          status: 200,
          body: JSON.stringify({ success: true, data: { id: reportId } })
        }
        
      case 'DELETE':
        // Delete scheduled report
        const deleteReportId = request.params.reportId
        
        const deleteResult = await query(
          `DELETE FROM scheduled_reports WHERE id = $1 AND tenant_id = $2`,
          [deleteReportId, auth.tenantId || '']
        )
        
        if (!deleteResult.success) {
          throw new Error('Failed to delete report: ' + deleteResult.error)
        }
        
        return {
          status: 200,
          body: JSON.stringify({ success: true })
        }
        
      default:
        return {
          status: 405,
          body: JSON.stringify({ error: 'Method not allowed' })
        }
    }
  } catch (error) {
    context.error('Error managing scheduled reports:', error)
    return {
      status: 500,
      body: JSON.stringify({ 
        error: 'Failed to manage scheduled reports',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

// Register timer trigger - runs every hour to check for scheduled reports
app.timer('scheduled-report-runner', {
  schedule: '0 * * * *', // Every hour
  handler: scheduledReportRunner
})

// Register HTTP endpoint for managing scheduled reports
app.http('manage-scheduled-reports', {
  methods: ['GET', 'POST', 'DELETE'],
  authLevel: 'anonymous',
  route: 'reports/scheduled/{reportId?}',
  handler: manageScheduledReports
})