import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { requireAuth, corsHeaders } from './middleware/auth'
import { query } from './services/database'
import { z } from 'zod'
import { validate, ValidationSchemas } from './middleware/validation'
import { randomUUID } from 'crypto'
import { seedDefaultReportTemplates } from './report-templates-seed'
import {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  requireTenant
} from './utils/httpResponses'
import {
  buildQueryParams,
  QueryParams
} from './utils/queryBuilders'
import { calculateNextRun } from './utils/scheduleUtils'

// Validation schemas
const reportConfigSchema = z.object({
  modules: z.array(z.string()).min(1),
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

const scheduleConfigSchema = z.object({
  enabled: z.boolean(),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly']),
  dayOfWeek: z.number().min(0).max(6).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  recipients: z.array(z.string().email()),
  nextRun: z.string().optional()
})

const createReportTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['financial', 'property', 'tax', 'occupancy', 'guest', 'seasonal', 'overview', 'custom']),
  config: reportConfigSchema,
  schedule: scheduleConfigSchema.optional()
})

const updateReportTemplateSchema = createReportTemplateSchema

// Helper functions for common report template operations
function parseReportTemplateFields(row: any): any {
  return {
    ...row,
    config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
    schedule: row.schedule ? (typeof row.schedule === 'string' ? JSON.parse(row.schedule) : row.schedule) : null
  }
}

function transformReportTemplates(rows: any[]): any[] {
  return rows.map(parseReportTemplateFields)
}

function buildReportTemplateQuery(includeId: boolean = false): string {
  const baseQuery = `SELECT * FROM report_templates WHERE tenant_id = $1`
  if (includeId) {
    return `${baseQuery} AND id = $2`
  }
  return `${baseQuery} ORDER BY created_at DESC`
}

async function checkTemplateExists(templateId: string, tenantId: string): Promise<boolean> {
  const result = await query(
    `SELECT id FROM report_templates WHERE id = $1 AND tenant_id = $2`,
    [templateId, tenantId]
  )
  return result.success && result.data.length > 0
}

// Get all report templates
async function getReportTemplates(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = await requireAuth(request)
  if (!authResult.authenticated) {
    return authResult.response
  }
  const { auth } = authResult.request

  const tenantError = requireTenant(auth.tenantId)
  if (tenantError) return tenantError

  try {
    // Seed default templates if this is the first access
    await seedDefaultReportTemplates(auth.tenantId!)
    
    const result = await query(buildReportTemplateQuery(), [auth.tenantId])

    if (!result.success) {
      throw new Error(result.error)
    }

    const templates = transformReportTemplates(result.data)
    return createSuccessResponse(templates)
  } catch (error) {
    context.error('Error fetching report templates:', error)
    return createErrorResponse('Failed to fetch report templates')
  }
}

// Get single report template
async function getReportTemplate(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = await requireAuth(request)
  if (!authResult.authenticated) {
    return authResult.response
  }
  const { auth } = authResult.request

  const tenantError = requireTenant(auth.tenantId)
  if (tenantError) return tenantError

  const templateId = request.params?.id
  if (!templateId) {
    return createErrorResponse('Template ID is required', 400)
  }

  try {
    const result = await query(buildReportTemplateQuery(true), [auth.tenantId, templateId])

    if (!result.success) {
      throw new Error(result.error)
    }

    if (result.data.length === 0) {
      return createNotFoundResponse('Report template not found')
    }

    const template = parseReportTemplateFields(result.data[0])
    return createSuccessResponse(template)
  } catch (error) {
    context.error('Error fetching report template:', error)
    return createErrorResponse('Failed to fetch report template')
  }
}

// Create report template
async function createReportTemplate(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = await requireAuth(request)
  if (!authResult.authenticated) {
    return authResult.response
  }
  const { auth } = authResult.request

  const tenantError = requireTenant(auth.tenantId)
  if (tenantError) return tenantError

  // Validate request body
  const validationSchemas: ValidationSchemas = {
    body: createReportTemplateSchema
  }

  const validationResult = await validate(validationSchemas)(request)
  if (!validationResult.valid) return validationResult.response

  const data = (validationResult.data as any).validated.body

  try {
    const id = randomUUID()
    const now = new Date().toISOString()

    // Calculate next run time if schedule is enabled
    let nextRun = null
    if (data.schedule?.enabled) {
      nextRun = calculateNextRun(data.schedule)
    }

    const result = await query(
      `INSERT INTO report_templates 
       (id, tenant_id, name, description, type, config, schedule, created_at, last_modified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        id,
        auth.tenantId,
        data.name,
        data.description || null,
        data.type,
        JSON.stringify(data.config),
        data.schedule ? JSON.stringify({ ...data.schedule, nextRun }) : null,
        now,
        now
      ]
    )

    if (!result.success) {
      throw new Error(result.error)
    }

    const template = parseReportTemplateFields(result.data[0])
    return {
      status: 201,
      headers: corsHeaders(),
      jsonBody: template
    }
  } catch (error) {
    context.error('Error creating report template:', error)
    return createErrorResponse('Failed to create report template')
  }
}

// Update report template
async function updateReportTemplate(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = await requireAuth(request)
  if (!authResult.authenticated) {
    return authResult.response
  }
  const { auth } = authResult.request

  const tenantError = requireTenant(auth.tenantId)
  if (tenantError) return tenantError

  const templateId = request.params?.id
  if (!templateId) {
    return createErrorResponse('Template ID is required', 400)
  }

  // Validate request body
  const validationSchemas: ValidationSchemas = {
    body: updateReportTemplateSchema
  }

  const validationResult = await validate(validationSchemas)(request)
  if (!validationResult.valid) return validationResult.response

  const data = (validationResult.data as any).validated.body

  try {
    // Check if template exists and belongs to tenant
    const templateExists = await checkTemplateExists(templateId, auth.tenantId!)
    if (!templateExists) {
      return createNotFoundResponse('Report template not found')
    }

    // Calculate next run time if schedule is enabled
    let nextRun = null
    if (data.schedule?.enabled) {
      nextRun = calculateNextRun(data.schedule)
    }

    const result = await query(
      `UPDATE report_templates 
       SET name = $1, description = $2, type = $3, config = $4, 
           schedule = $5, last_modified = $6
       WHERE id = $7 AND tenant_id = $8
       RETURNING *`,
      [
        data.name,
        data.description || null,
        data.type,
        JSON.stringify(data.config),
        data.schedule ? JSON.stringify({ ...data.schedule, nextRun }) : null,
        new Date().toISOString(),
        templateId,
        auth.tenantId
      ]
    )

    if (!result.success) {
      throw new Error(result.error)
    }

    const template = parseReportTemplateFields(result.data[0])
    return createSuccessResponse(template)
  } catch (error) {
    context.error('Error updating report template:', error)
    return createErrorResponse('Failed to update report template')
  }
}

// Delete report template
async function deleteReportTemplate(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = await requireAuth(request)
  if (!authResult.authenticated) {
    return authResult.response
  }
  const { auth } = authResult.request

  const tenantError = requireTenant(auth.tenantId)
  if (tenantError) return tenantError

  const templateId = request.params?.id
  if (!templateId) {
    return createErrorResponse('Template ID is required', 400)
  }

  try {
    const result = await query(
      `DELETE FROM report_templates 
       WHERE id = $1 AND tenant_id = $2
       RETURNING id`,
      [templateId, auth.tenantId]
    )

    if (!result.success) {
      throw new Error(result.error)
    }

    if (result.data.length === 0) {
      return createNotFoundResponse('Report template not found')
    }

    return createSuccessResponse({ message: 'Report template deleted successfully' })
  } catch (error) {
    context.error('Error deleting report template:', error)
    return createErrorResponse('Failed to delete report template')
  }
}


// Register Azure Functions
app.http('getReportTemplates', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'report-templates',
  handler: getReportTemplates
})

app.http('getReportTemplate', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'report-templates/{id}',
  handler: getReportTemplate
})

app.http('createReportTemplate', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'report-templates',
  handler: createReportTemplate
})

app.http('updateReportTemplate', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'report-templates/{id}',
  handler: updateReportTemplate
})

app.http('deleteReportTemplate', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'report-templates/{id}',
  handler: deleteReportTemplate
})