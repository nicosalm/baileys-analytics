import { query } from './database'

export type Season = {
  id: string
  tenantId: string
  name: string
  startMonth: number
  startDay: number
  endMonth: number
  endDay: number
  isActive: boolean
}

export async function getActiveSeasons(tenantId: string): Promise<Season[]> {
  const result = await query<Season>(
    `SELECT 
      id,
      tenant_id as "tenantId",
      name,
      start_month as "startMonth",
      start_day as "startDay",
      end_month as "endMonth",
      end_day as "endDay",
      is_active as "isActive"
    FROM season_configurations
    WHERE tenant_id = $1 AND is_active = true
    ORDER BY start_month, start_day ASC`,
    [tenantId]
  )
  
  return result.success ? result.data : []
}

export function buildSeasonFilter(seasons: Season[], tableAlias?: string): string {
  if (seasons.length === 0) return ''
  
  const table = tableAlias ? `${tableAlias}.` : ''
  
  // Build conditions for repeating seasons based on month/day
  const seasonConditions = seasons.map(season => {
    // Handle seasons that don't cross year boundary
    if (season.startMonth <= season.endMonth) {
      return `(
        (EXTRACT(MONTH FROM ${table}arrival)::int > ${season.startMonth} OR 
         (EXTRACT(MONTH FROM ${table}arrival)::int = ${season.startMonth} AND EXTRACT(DAY FROM ${table}arrival)::int >= ${season.startDay}))
        AND
        (EXTRACT(MONTH FROM ${table}arrival)::int < ${season.endMonth} OR 
         (EXTRACT(MONTH FROM ${table}arrival)::int = ${season.endMonth} AND EXTRACT(DAY FROM ${table}arrival)::int <= ${season.endDay}))
      )`
    } else {
      // Handle seasons that cross year boundary (e.g., Dec to Feb)
      return `(
        (EXTRACT(MONTH FROM ${table}arrival)::int > ${season.startMonth} OR 
         (EXTRACT(MONTH FROM ${table}arrival)::int = ${season.startMonth} AND EXTRACT(DAY FROM ${table}arrival)::int >= ${season.startDay}))
        OR
        (EXTRACT(MONTH FROM ${table}arrival)::int < ${season.endMonth} OR 
         (EXTRACT(MONTH FROM ${table}arrival)::int = ${season.endMonth} AND EXTRACT(DAY FROM ${table}arrival)::int <= ${season.endDay}))
      )`
    }
  }).join(' OR ')
  
  return `AND (${seasonConditions})`
}

export function getSeasonParams(seasons: Season[]): number[] {
  const params: number[] = []
  seasons.forEach(season => {
    params.push(season.startMonth, season.startDay, season.endMonth, season.endDay)
  })
  return params
}

export function buildBlockedTagFilter(tableAlias?: string): string {
  const table = tableAlias ? `${tableAlias}.` : ''
  
  return `AND NOT EXISTS (
    SELECT 1 
    FROM booking_tags bt
    JOIN tags t ON bt.tag_id = t.id
    WHERE bt.booking_id = ${table}id
    AND LOWER(t.name) = 'blocked'
  )`
}

export function buildBookingFilters(seasons: Season[], tableAlias?: string): string {
  const filters: string[] = []
  
  filters.push(buildBlockedTagFilter(tableAlias))
  
  if (seasons.length > 0) {
    filters.push(buildSeasonFilter(seasons, tableAlias))
  }
  
  return filters.join(' ')
}