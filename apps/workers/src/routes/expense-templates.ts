import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { createSupabaseClient } from '../services/supabase'
import type { AppEnv } from '../types';

const expenseTemplates = new Hono<AppEnv>()

expenseTemplates.use('/*', authMiddleware)

const expenseCategoryEnum = z.enum([
  'cleaning',
  'management',
  'utilities',
  'maintenance',
  'insurance',
  'other'
])

const bulkTemplateSchema = z.object({
  propertyId: z.string().uuid(),
  templates: z.array(z.object({
    category: expenseCategoryEnum,
    amount: z.number().min(0),
    description: z.string().max(255).optional()
  }))
})

expenseTemplates.get('/', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const tenantId = c.get('tenantId')

  if (!tenantId) {
    return c.json({ error: 'Tenant not found' }, 404)
  }

  const propertyId = c.req.query('property')

  let query = supabase
    .from('expense_templates')
    .select('*')
    .eq('tenant_id', tenantId)

  if (propertyId) {
    query = query.eq('property_id', propertyId)
  }

  const { data, error } = await query.order('category')

  if (error) {
    console.error('Failed to fetch expense templates:', error)
    return c.json({ error: 'Failed to fetch expense templates' }, 500)
  }

  return c.json({ success: true, data })
})

expenseTemplates.post('/bulk', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const tenantId = c.get('tenantId')

  if (!tenantId) {
    return c.json({ error: 'Tenant not found' }, 404)
  }

  const body = await c.req.json()
  const validation = bulkTemplateSchema.safeParse(body)

  if (!validation.success) {
    return c.json({ error: 'Invalid input', details: validation.error.issues }, 400)
  }

  const { propertyId, templates } = validation.data

  const { data: property } = await supabase
    .from('properties')
    .select('id')
    .eq('id', propertyId)
    .eq('tenant_id', tenantId)
    .single()

  if (!property) {
    return c.json({ error: 'Property not found' }, 404)
  }

  const rows = templates.map(t => ({
    category: t.category,
    amount: t.amount,
    description: t.description || null
  }))

  const { error: rpcError } = await supabase.rpc('replace_expense_templates', {
    p_tenant_id: tenantId,
    p_property_id: propertyId,
    p_rows: rows
  })

  if (rpcError) {
    console.error('Failed to save expense templates:', rpcError)
    return c.json({ error: 'Failed to save templates' }, 500)
  }

  // fetch the newly inserted rows
  const { data } = await supabase
    .from('expense_templates')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('property_id', propertyId)
    .order('category')

  return c.json({ success: true, data: data || [] })
})

export { expenseTemplates }
