import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { query } from './services/database'
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth'
import { taxRuleFormDataSchema } from '@baileys/shared-types'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'

type TaxRuleFormData = z.infer<typeof taxRuleFormDataSchema>

// Helper to parse JSON fields from database
const parseDbTaxRule = (rule: any) => ({
  ...rule,
  method: typeof rule.method === 'string' ? JSON.parse(rule.method) : rule.method,
  appliesTo: typeof rule.applies_to === 'string' ? JSON.parse(rule.applies_to) : rule.applies_to
})

// GET /api/tax-rules
async function getTaxRules(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authCheck = await requireAuth(request)
  if (!authCheck.authenticated) {
    return authCheck.response
  }

  const { auth } = authCheck.request

  const result = await query(
    `SELECT * FROM tax_rules
     WHERE tenant_id = $1
     ORDER BY priority DESC, created_at DESC`,
    [auth.tenantId]
  )

  if (!result.success) {
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: { status: 'error', error: result.error }
    }
  }

  // parse JSON fields
  const rules = result.data.map(parseDbTaxRule)

  return {
    status: 200,
    headers: corsHeaders(),
    jsonBody: { status: 'success', data: rules }
  }
}

// POST /api/tax-rules
async function createTaxRule(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authCheck = await requireAuth(request)
  if (!authCheck.authenticated) {
    return authCheck.response
  }

  const { auth } = authCheck.request
  
  const bodyData = await request.json()
  const parseResult = taxRuleFormDataSchema.safeParse(bodyData)
  
  if (!parseResult.success) {
    return {
      status: 400,
      headers: corsHeaders(),
      jsonBody: { 
        status: 'error', 
        error: 'Validation error',
        details: parseResult.error.issues.map((e: any) => ({
          path: e.path.join('.'),
          message: e.message
        }))
      }
    }
  }
  
  const body = parseResult.data

  const id = uuidv4()
  const now = new Date().toISOString()

  const result = await query(
    `INSERT INTO tax_rules (
      id, tenant_id, name, description, method, applies_to,
      jurisdiction, effective_from, effective_to, priority,
      is_active, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *`,
    [
      id, auth.tenantId, body.name, body.description || null,
      JSON.stringify(body.method), JSON.stringify(body.appliesTo),
      body.jurisdiction || null, body.effectiveFrom, body.effectiveTo || null,
      body.priority, body.isActive, now, now
    ]
  )

  if (!result.success) {
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: { status: 'error', error: result.error }
    }
  }

  const createdRule = result.data[0]
  const formattedRule = parseDbTaxRule(createdRule)

  return {
    status: 201,
    headers: corsHeaders(),
    jsonBody: { status: 'success', data: formattedRule }
  }
}

// PUT /api/tax-rules/:id
async function updateTaxRule(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authCheck = await requireAuth(request)
  if (!authCheck.authenticated) {
    return authCheck.response
  }

  const { auth } = authCheck.request
  const ruleId = request.params.id
  
  const bodyData = await request.json()
  const parseResult = taxRuleFormDataSchema.safeParse(bodyData)
  
  if (!parseResult.success) {
    return {
      status: 400,
      headers: corsHeaders(),
      jsonBody: { 
        status: 'error', 
        error: 'Validation error',
        details: parseResult.error.issues.map((e: any) => ({
          path: e.path.join('.'),
          message: e.message
        }))
      }
    }
  }
  
  const body = parseResult.data

  const result = await query(
    `UPDATE tax_rules SET
      name = $3, description = $4, method = $5, applies_to = $6,
      jurisdiction = $7, effective_from = $8, effective_to = $9,
      priority = $10, is_active = $11, updated_at = $12
    WHERE id = $1 AND tenant_id = $2
    RETURNING *`,
    [
      ruleId, auth.tenantId, body.name, body.description || null,
      JSON.stringify(body.method), JSON.stringify(body.appliesTo),
      body.jurisdiction || null, body.effectiveFrom, body.effectiveTo || null,
      body.priority, body.isActive, new Date().toISOString()
    ]
  )

  if (!result.success || result.data.length === 0) {
    return {
      status: 404,
      headers: corsHeaders(),
      jsonBody: { status: 'error', error: 'Tax rule not found' }
    }
  }

  const updatedRule = result.data[0]
  const formattedRule = parseDbTaxRule(updatedRule)

  return {
    status: 200,
    headers: corsHeaders(),
    jsonBody: { status: 'success', data: formattedRule }
  }
}

// DELETE /api/tax-rules/:id
async function deleteTaxRule(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authCheck = await requireAuth(request)
  if (!authCheck.authenticated) {
    return authCheck.response
  }

  const { auth } = authCheck.request
  const ruleId = request.params.id

  const result = await query(
    `DELETE FROM tax_rules WHERE id = $1 AND tenant_id = $2`,
    [ruleId, auth.tenantId]
  )

  if (!result.success) {
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: { status: 'error', error: result.error }
    }
  }

  return {
    status: 200,
    headers: corsHeaders(),
    jsonBody: { status: 'success' }
  }
}

export async function taxRulesHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') {
    return handleOptions()
  }

  const ruleId = request.params.id

  if (ruleId) {
    // handle /api/tax-rules/:id routes
    switch (request.method) {
      case 'PUT':
        return updateTaxRule(request, context)
      case 'DELETE':
        return deleteTaxRule(request, context)
      default:
        return {
          status: 405,
          headers: corsHeaders(),
          jsonBody: { error: 'Method not allowed' }
        }
    }
  } else {
    // handle /api/tax-rules routes
    switch (request.method) {
      case 'GET':
        return getTaxRules(request, context)
      case 'POST':
        return createTaxRule(request, context)
      default:
        return {
          status: 405,
          headers: corsHeaders(),
          jsonBody: { error: 'Method not allowed' }
        }
    }
  }
}

app.http('tax-rules', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: taxRulesHandler
})

app.http('tax-rules-id', {
  methods: ['PUT', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'tax-rules/{id}',
  handler: taxRulesHandler
})
