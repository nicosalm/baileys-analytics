import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { query } from './services/database'
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth'

export async function propertyTaxConfigs(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') {
    return handleOptions()
  }

  const authCheck = await requireAuth(request)
  if (!authCheck.authenticated) {
    return authCheck.response
  }

  const { auth } = authCheck.request

  if (request.method === 'GET') {
    const configsResult = await query(
      `SELECT ptc.*, p.name as property_name, p.address as property_address
       FROM property_tax_configs ptc
       JOIN properties p ON p.id = ptc.property_id
       WHERE ptc.tenant_id = $1
       ORDER BY p.name, ptc.created_at DESC`,
      [auth.tenantId]
    )

  if (!configsResult.success) {
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: { status: 'error', error: configsResult.error }
    }
  }

    const configs = configsResult.data.map(config => ({
      id: config.id,
      propertyId: config.property_id,
      propertyName: config.property_name,
      propertyAddress: config.property_address,
      configName: config.config_name,
      jurisdictions: typeof config.jurisdictions === 'string' ? JSON.parse(config.jurisdictions) : config.jurisdictions,
      platformSettings: typeof config.platform_settings === 'string' ? JSON.parse(config.platform_settings) : config.platform_settings,
      effectiveFrom: config.effective_from,
      effectiveTo: config.effective_to,
      isActive: config.is_active,
      createdAt: config.created_at,
      updatedAt: config.updated_at
    }))

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: { status: 'success', data: configs }
    }
  }

  if (request.method === 'PUT') {
    const configId = request.params?.id
    
    if (!configId) {
      return {
        status: 400,
        headers: corsHeaders(),
        jsonBody: { status: 'error', error: 'Config ID is required for updates' }
      }
    }
    
    let body: any
    try {
      body = await request.json()
    } catch {
      return {
        status: 400,
        headers: corsHeaders(),
        jsonBody: { status: 'error', error: 'Invalid JSON body' }
      }
    }

    const {
      configName,
      jurisdictions,
      platformSettings,
      effectiveFrom,
      isActive
    } = body

    const result = await query(
      `UPDATE property_tax_configs 
       SET config_name = $2, jurisdictions = $3,
           platform_settings = $4, effective_from = $5, is_active = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $7
       RETURNING *`,
      [
        configId,
        configName,
        JSON.stringify(jurisdictions),
        JSON.stringify(platformSettings || {}),
        effectiveFrom,
        isActive !== undefined ? isActive : true,
        auth.tenantId
      ]
    )

    if (!result.success || result.data.length === 0) {
      return {
        status: 404,
        headers: corsHeaders(),
        jsonBody: { status: 'error', error: 'Configuration not found or update failed' }
      }
    }

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: { 
        status: 'success', 
        data: result.data[0]
      }
    }
  }

  if (request.method === 'POST') {
    let body: any
    try {
      body = await request.json()
    } catch {
      return {
        status: 400,
        headers: corsHeaders(),
        jsonBody: { status: 'error', error: 'Invalid JSON body' }
      }
    }

    const {
      propertyId,
      configName,
      jurisdictions,
      platformSettings,
      effectiveFrom
    } = body


    if (!propertyId || !configName || !jurisdictions || !effectiveFrom) {
      return {
        status: 400,
        headers: corsHeaders(),
        jsonBody: { 
          status: 'error', 
          error: 'Required fields: propertyId, configName, jurisdictions, effectiveFrom'
        }
      }
    }

    const existingConfig = await query(
      `SELECT id FROM property_tax_configs 
       WHERE property_id = $1 AND config_name = $2 AND tenant_id = $3`,
      [propertyId, configName, auth.tenantId]
    )
    
    if (existingConfig.success && existingConfig.data.length > 0) {
      const result = await query(
        `UPDATE property_tax_configs 
         SET jurisdictions = $1,
             platform_settings = $2,
             effective_from = $3,
             is_active = true,
             updated_at = CURRENT_TIMESTAMP
         WHERE property_id = $4 AND config_name = $5 AND tenant_id = $6
         RETURNING *`,
        [
          JSON.stringify(jurisdictions),
          JSON.stringify(platformSettings || {}),
          effectiveFrom,
          propertyId,
          configName,
          auth.tenantId
        ]
      )
      
      if (!result.success) {
        return {
          status: 500,
          headers: corsHeaders(),
          jsonBody: { status: 'error', error: result.error || 'Failed to update configuration' }
        }
      }
      return {
        status: 200,
        headers: corsHeaders(),
        jsonBody: { 
          status: 'success', 
          data: result.data[0],
          updated: true
        }
      }
    }
    await query(
      `UPDATE property_tax_configs 
       SET is_active = false, effective_to = CURRENT_DATE
       WHERE property_id = $1 AND tenant_id = $2 AND is_active = true`,
      [propertyId, auth.tenantId]
    )

    const result = await query(
      `INSERT INTO property_tax_configs (
        property_id, tenant_id, config_name,
        jurisdictions, platform_settings,
        is_active, effective_from
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        propertyId,
        auth.tenantId,
        configName,
        JSON.stringify(jurisdictions),
        JSON.stringify(platformSettings || {}),
        true,
        effectiveFrom
      ]
    )

    if (!result.success) {
      return {
        status: 500,
        headers: corsHeaders(),
        jsonBody: { status: 'error', error: result.error || 'Failed to save configuration' }
      }
    }

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: { 
        status: 'success', 
        data: {
          id: result.data[0].id,
          propertyId,
          configName,
          jurisdictions,
          platformSettings,
          isActive: true,
          effectiveFrom,
          createdAt: result.data[0].created_at
        }
      }
    }
  }

  if (request.method === 'DELETE') {
    const configId = request.params?.id
    
    if (!configId) {
      return {
        status: 400,
        headers: corsHeaders(),
        jsonBody: { status: 'error', error: 'Config ID is required' }
      }
    }
    
    const result = await query(
      `DELETE FROM property_tax_configs 
       WHERE id = $1 AND tenant_id = $2
       RETURNING id`,
      [configId, auth.tenantId]
    )
    
    if (!result.success) {
      return {
        status: 500,
        headers: corsHeaders(),
        jsonBody: { status: 'error', error: 'Failed to delete configuration' }
      }
    }
    
    if (result.data.length === 0) {
      return {
        status: 404,
        headers: corsHeaders(),
        jsonBody: { status: 'error', error: 'Configuration not found' }
      }
    }
    
    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: { status: 'success', message: 'Configuration deleted' }
    }
  }
  
  return {
    status: 405,
    headers: corsHeaders(),
    jsonBody: { status: 'error', error: 'Method not allowed' }
  }
}

// Handle routes without ID
app.http('property-tax-configs', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: propertyTaxConfigs
})

// Handle routes with ID (for PUT/DELETE)
app.http('property-tax-configs-id', {
  methods: ['PUT', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'property-tax-configs/{id}',
  handler: propertyTaxConfigs
})
