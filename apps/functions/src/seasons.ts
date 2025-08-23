import { HttpRequest, HttpResponseInit, InvocationContext, app } from '@azure/functions'
import { query, transaction } from './services/database'
import { corsHeaders, handleOptions, AuthenticatedRequest } from './middleware/auth'
import { requireAuthWithValidation } from './middleware/validation'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'

function checkSeasonOverlap(
  season1: { startMonth: number; startDay: number; endMonth: number; endDay: number },
  season2: { startMonth: number; startDay: number; endMonth: number; endDay: number }
): boolean {
  const toNum = (month: number, day: number) => month * 100 + day
  
  const s1Start = toNum(season1.startMonth, season1.startDay)
  const s1End = toNum(season1.endMonth, season1.endDay)
  const s2Start = toNum(season2.startMonth, season2.startDay)
  const s2End = toNum(season2.endMonth, season2.endDay)
  
  if (s1Start <= s1End && s2Start <= s2End) {
    return !(s1End < s2Start || s2End < s1Start)
  }
  
  if (s1Start > s1End || s2Start > s2End) {
    if (s1Start > s1End) {
      if (s2Start > s2End) {
        return true
      } else {
        return (s2Start >= s1Start || s2End >= s1Start || s2Start <= s1End || s2End <= s1End)
      }
    } else {
      return (s1Start >= s2Start || s1End >= s2Start || s1Start <= s2End || s1End <= s2End)
    }
  }
  
  return false
}

const SeasonSchema = z.object({
  name: z.string().min(1).max(255),
  startMonth: z.number().min(1).max(12),
  startDay: z.number().min(1).max(31),
  endMonth: z.number().min(1).max(12),
  endDay: z.number().min(1).max(31)
})

type Season = {
  id: string
  tenantId: string
  name: string
  startMonth: number
  startDay: number
  endMonth: number
  endDay: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

async function handleGetSeasons(
  req: AuthenticatedRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const auth = req.auth!
    
    const result = await query<Season>(
      `SELECT 
        id,
        tenant_id as "tenantId",
        name,
        start_month as "startMonth",
        start_day as "startDay",
        end_month as "endMonth",
        end_day as "endDay",
        is_active as "isActive",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM season_configurations
      WHERE tenant_id = $1
      ORDER BY start_month, start_day ASC`,
      [auth.tenantId]
    )

    if (!result.success) {
      return {
        status: 500,
        jsonBody: { error: 'Failed to fetch seasons' },
        headers: { ...corsHeaders() }
      }
    }

    return {
      status: 200,
      jsonBody: { seasons: result.data },
      headers: { ...corsHeaders }
    }
  } catch (error) {
    context.error('Error fetching seasons:', error)
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
      headers: { ...corsHeaders }
    }
  }
}

async function handleCreateSeason(
  req: AuthenticatedRequest & { body: any },
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const auth = req.auth!
    const body = req.body
    
    const validation = SeasonSchema.safeParse(body)
    if (!validation.success) {
      return {
        status: 400,
        jsonBody: { error: 'Invalid season data', details: validation.error.issues },
        headers: { ...corsHeaders() }
      }
    }

    const { name, startMonth, startDay, endMonth, endDay } = validation.data

    const existingActiveSeasons = await query<Season>(
      `SELECT * FROM season_configurations 
       WHERE tenant_id = $1 AND is_active = true`,
      [auth.tenantId]
    )
    
    if (existingActiveSeasons.success && existingActiveSeasons.data.length > 0) {
      return {
        status: 400,
        jsonBody: { 
          error: `Only one season can be active at a time. Please deactivate the existing season "${existingActiveSeasons.data[0].name}" first.` 
        },
        headers: { ...corsHeaders() }
      }
    }


    const result = await query<Season>(
      `INSERT INTO season_configurations (
        tenant_id, name, start_month, start_day, end_month, end_day
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING 
        id,
        tenant_id as "tenantId",
        name,
        start_month as "startMonth",
        start_day as "startDay",
        end_month as "endMonth",
        end_day as "endDay",
        is_active as "isActive",
        created_at as "createdAt",
        updated_at as "updatedAt"`,
      [auth.tenantId, name, startMonth, startDay, endMonth, endDay]
    )

    if (!result.success) {
      return {
        status: 500,
        jsonBody: { error: 'Failed to create season' },
        headers: { ...corsHeaders() }
      }
    }

    return {
      status: 201,
      jsonBody: { season: result.data[0] },
      headers: { ...corsHeaders }
    }
  } catch (error) {
    context.error('Error creating season:', error)
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
      headers: { ...corsHeaders }
    }
  }
}

async function handleUpdateSeason(
  req: AuthenticatedRequest & { body: any },
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const auth = req.auth!
    const seasonId = req.params.id
    const body = req.body
    
    const validation = SeasonSchema.safeParse(body)
    if (!validation.success) {
      return {
        status: 400,
        jsonBody: { error: 'Invalid season data', details: validation.error.issues },
        headers: { ...corsHeaders() }
      }
    }

    const { name, startMonth, startDay, endMonth, endDay } = validation.data


    const result = await query<Season>(
      `UPDATE season_configurations
      SET name = $3, start_month = $4, start_day = $5, end_month = $6, end_day = $7, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND tenant_id = $2
      RETURNING 
        id,
        tenant_id as "tenantId",
        name,
        start_month as "startMonth",
        start_day as "startDay",
        end_month as "endMonth",
        end_day as "endDay",
        is_active as "isActive",
        created_at as "createdAt",
        updated_at as "updatedAt"`,
      [seasonId, auth.tenantId, name, startMonth, startDay, endMonth, endDay]
    )

    if (!result.success || result.data.length === 0) {
      return {
        status: 404,
        jsonBody: { error: 'Season not found' },
        headers: { ...corsHeaders() }
      }
    }

    return {
      status: 200,
      jsonBody: { season: result.data[0] },
      headers: { ...corsHeaders }
    }
  } catch (error) {
    context.error('Error updating season:', error)
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
      headers: { ...corsHeaders }
    }
  }
}

async function handleDeleteSeason(
  req: AuthenticatedRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const auth = req.auth!
    const seasonId = req.params.id

    const result = await query(
      `DELETE FROM season_configurations
      WHERE id = $1 AND tenant_id = $2
      RETURNING id`,
      [seasonId, auth.tenantId]
    )

    if (!result.success || result.data.length === 0) {
      return {
        status: 404,
        jsonBody: { error: 'Season not found' },
        headers: { ...corsHeaders() }
      }
    }

    return {
      status: 200,
      jsonBody: { message: 'Season deleted successfully' },
      headers: { ...corsHeaders }
    }
  } catch (error) {
    context.error('Error deleting season:', error)
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
      headers: { ...corsHeaders }
    }
  }
}

async function handleToggleSeasonActive(
  req: AuthenticatedRequest & { body: any },
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const auth = req.auth!
    const seasonId = req.params?.id
    
    if (!seasonId) {
      context.error('Season ID not provided in params:', req.params)
      return {
        status: 400,
        jsonBody: { error: 'Season ID is required' },
        headers: { ...corsHeaders() }
      }
    }
    
    const { isActive } = req.body || {}

    if (typeof isActive !== 'boolean') {
      return {
        status: 400,
        jsonBody: { error: 'isActive must be a boolean' },
        headers: { ...corsHeaders() }
      }
    }

    if (isActive) {
      const deactivateResult = await query(
        `UPDATE season_configurations
         SET is_active = false
         WHERE tenant_id = $1 AND id != $2`,
        [auth.tenantId, seasonId]
      )
      
      if (!deactivateResult.success) {
        return {
          status: 500,
          jsonBody: { error: 'Failed to deactivate other seasons' },
          headers: { ...corsHeaders() }
        }
      }
    }

    const result = await query<Season>(
      `UPDATE season_configurations
      SET is_active = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND tenant_id = $2
      RETURNING 
        id,
        tenant_id as "tenantId",
        name,
        start_month as "startMonth",
        start_day as "startDay",
        end_month as "endMonth",
        end_day as "endDay",
        is_active as "isActive",
        created_at as "createdAt",
        updated_at as "updatedAt"`,
      [seasonId, auth.tenantId, isActive]
    )

    if (!result.success || result.data.length === 0) {
      return {
        status: 404,
        jsonBody: { error: 'Season not found' },
        headers: { ...corsHeaders() }
      }
    }

    return {
      status: 200,
      jsonBody: { season: result.data[0] },
      headers: { ...corsHeaders }
    }
  } catch (error) {
    context.error('Error toggling season active state:', error)
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
      headers: { ...corsHeaders }
    }
  }
}

export async function seasons(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (req.method === 'OPTIONS') {
    return handleOptions()
  }

  let body: any = null
  if (req.method === 'PATCH' || req.method === 'POST' || req.method === 'PUT') {
    try {
      body = await req.json()
    } catch (e) {
      body = {}
    }
  }

  const authCheck = await requireAuthWithValidation(req)
  if (!authCheck.authenticated || !authCheck.valid) {
    return authCheck.response
  }

  const authReq = authCheck.request as AuthenticatedRequest
  const method = req.method.toUpperCase()
  const id = req.params.id || ''

  context.log('Seasons endpoint - Method:', method, 'ID:', id, 'Params:', req.params)

  const requestWithId = {
    ...authReq,
    params: { id },
    body
  } as AuthenticatedRequest & { body: any }

  if (method === 'GET' && !id) {
    return handleGetSeasons(authReq, context)
  } else if (method === 'POST' && !id) {
    return handleCreateSeason({ ...authReq, body } as any, context)
  } else if (method === 'PUT' && id) {
    return handleUpdateSeason({ ...requestWithId, body } as any, context)
  } else if (method === 'DELETE' && id) {
    return handleDeleteSeason(requestWithId, context)
  } else if (method === 'PATCH' && id) {
    return handleToggleSeasonActive(requestWithId as any, context)
  }

  context.error('No route matched - Method:', method, 'ID:', id)
  return {
    status: 404,
    jsonBody: { error: 'Not found' },
    headers: { ...corsHeaders }
  }
}

app.http('seasons', {
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'seasons/{id?}',
  handler: seasons
})