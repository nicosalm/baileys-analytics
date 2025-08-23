import { HttpRequest, HttpResponseInit, InvocationContext, app } from '@azure/functions'
import { query, transaction } from './services/database'
import { requireAuth, corsHeaders, handleOptions, AuthenticatedRequest } from './middleware/auth'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'

// Helper function to check if two seasons overlap
function checkSeasonOverlap(
  season1: { startMonth: number; startDay: number; endMonth: number; endDay: number },
  season2: { startMonth: number; startDay: number; endMonth: number; endDay: number }
): boolean {
  // Convert month/day to a comparable number (month * 100 + day)
  const toNum = (month: number, day: number) => month * 100 + day
  
  const s1Start = toNum(season1.startMonth, season1.startDay)
  const s1End = toNum(season1.endMonth, season1.endDay)
  const s2Start = toNum(season2.startMonth, season2.startDay)
  const s2End = toNum(season2.endMonth, season2.endDay)
  
  // Handle seasons that don't cross year boundary
  if (s1Start <= s1End && s2Start <= s2End) {
    return !(s1End < s2Start || s2End < s1Start)
  }
  
  // Handle seasons that cross year boundary
  // If either season crosses the year, there's potential for overlap
  // This is complex, so for now we'll be conservative and check all cases
  if (s1Start > s1End || s2Start > s2End) {
    // Check if any part of season2 falls within season1's range
    if (s1Start > s1End) {
      // Season 1 crosses year (e.g., Nov-Feb)
      if (s2Start > s2End) {
        // Both cross year - they definitely overlap
        return true
      } else {
        // Only season 1 crosses year
        return (s2Start >= s1Start || s2End >= s1Start || s2Start <= s1End || s2End <= s1End)
      }
    } else {
      // Season 2 crosses year
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
        headers: { ...corsHeaders }
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
  req: AuthenticatedRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const auth = req.auth!
    const body = await req.json()
    
    const validation = SeasonSchema.safeParse(body)
    if (!validation.success) {
      return {
        status: 400,
        jsonBody: { error: 'Invalid season data', details: validation.error.issues },
        headers: { ...corsHeaders }
      }
    }

    const { name, startMonth, startDay, endMonth, endDay } = validation.data

    // Check for overlapping seasons
    const existingSeasons = await query<Season>(
      `SELECT * FROM season_configurations 
       WHERE tenant_id = $1 AND is_active = true`,
      [auth.tenantId]
    )
    
    if (existingSeasons.success) {
      for (const existing of existingSeasons.data) {
        if (checkSeasonOverlap(
          { startMonth, startDay, endMonth, endDay },
          { startMonth: existing.startMonth, startDay: existing.startDay, 
            endMonth: existing.endMonth, endDay: existing.endDay }
        )) {
          return {
            status: 400,
            jsonBody: { 
              error: `Season overlaps with existing season "${existing.name}". Seasons cannot overlap as they define exclusive data windows.` 
            },
            headers: { ...corsHeaders }
          }
        }
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
        headers: { ...corsHeaders }
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
  req: AuthenticatedRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const auth = req.auth!
    const seasonId = req.params.id
    const body = await req.json()
    
    const validation = SeasonSchema.safeParse(body)
    if (!validation.success) {
      return {
        status: 400,
        jsonBody: { error: 'Invalid season data', details: validation.error.issues },
        headers: { ...corsHeaders }
      }
    }

    const { name, startMonth, startDay, endMonth, endDay } = validation.data

    // Check for overlapping seasons (excluding current season)
    const existingSeasons = await query<Season>(
      `SELECT * FROM season_configurations 
       WHERE tenant_id = $1 AND is_active = true AND id != $2`,
      [auth.tenantId, seasonId]
    )
    
    if (existingSeasons.success) {
      for (const existing of existingSeasons.data) {
        if (checkSeasonOverlap(
          { startMonth, startDay, endMonth, endDay },
          { startMonth: existing.startMonth, startDay: existing.startDay, 
            endMonth: existing.endMonth, endDay: existing.endDay }
        )) {
          return {
            status: 400,
            jsonBody: { 
              error: `Season overlaps with existing season "${existing.name}". Seasons cannot overlap as they define exclusive data windows.` 
            },
            headers: { ...corsHeaders }
          }
        }
      }
    }

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
        headers: { ...corsHeaders }
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
        headers: { ...corsHeaders }
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
  req: AuthenticatedRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const auth = req.auth!
    const seasonId = req.params.id
    const body: any = await req.json()
    const { isActive } = body

    if (typeof isActive !== 'boolean') {
      return {
        status: 400,
        jsonBody: { error: 'isActive must be a boolean' },
        headers: { ...corsHeaders }
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
        start_date as "startDate",
        end_date as "endDate",
        is_active as "isActive",
        created_at as "createdAt",
        updated_at as "updatedAt"`,
      [seasonId, auth.tenantId, isActive]
    )

    if (!result.success || result.data.length === 0) {
      return {
        status: 404,
        jsonBody: { error: 'Season not found' },
        headers: { ...corsHeaders }
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

  const authResult = await requireAuth(req)
  if (!authResult.authenticated) {
    return authResult.response
  }

  const authReq = authResult.request as AuthenticatedRequest
  const method = req.method.toUpperCase()
  const path = req.params.path || ''

  // Route handling
  if (method === 'GET' && !path) {
    return handleGetSeasons(authReq, context)
  } else if (method === 'POST' && !path) {
    return handleCreateSeason(authReq, context)
  } else if (method === 'PUT' && path) {
    authReq.params.id = path
    return handleUpdateSeason(authReq, context)
  } else if (method === 'DELETE' && path) {
    authReq.params.id = path
    return handleDeleteSeason(authReq, context)
  } else if (method === 'PATCH' && path) {
    authReq.params.id = path
    return handleToggleSeasonActive(authReq, context)
  }

  return {
    status: 404,
    jsonBody: { error: 'Not found' },
    headers: { ...corsHeaders }
  }
}

app.http('seasons', {
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'seasons/{path?}',
  handler: seasons
})