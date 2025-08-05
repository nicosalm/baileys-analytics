import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { query, DbResult } from './services/database';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';

type OccupancyData = {
  overall: number
  byProperty: readonly PropertyOccupancy[]
  byMonth: readonly MonthlyOccupancy[]
  bookedNights: number
  availableNights: number
}

type PropertyOccupancy = {
  propertyId: string
  propertyName: string
  rate: number
}

type MonthlyOccupancy = {
  month: string
  rate: number
}

type QueryParams = {
  tenantId: string
  fromDate: string
  toDate: string
  tagIds: readonly string[]
}

const parseQueryParams = (request: HttpRequest, tenantId: string): QueryParams => ({
  tenantId,
  fromDate: request.query.get('from') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
  toDate: request.query.get('to') || new Date().toISOString().split('T')[0],
  tagIds: request.query.get('tags')?.split(',').filter(Boolean) || []
})

const calculateDaysInRange = (fromDate: string, toDate: string): number =>
  Math.ceil((new Date(toDate).getTime() - new Date(fromDate).getTime()) / (1000 * 60 * 60 * 24)) + 1

const buildTagFilter = (tagIds: readonly string[]): string =>
  tagIds.length > 0
    ? `AND EXISTS (
        SELECT 1 FROM booking_tags bt
        WHERE bt.booking_id = bookings.id
        AND bt.tag_id = ANY($4::uuid[])
      )`
    : ''

const buildQueryParams = (params: QueryParams): any[] =>
  params.tagIds.length > 0
    ? [params.tenantId, params.fromDate, params.toDate, params.tagIds]
    : [params.tenantId, params.fromDate, params.toDate]

const fetchPropertyCount = async (tenantId: string): Promise<DbResult<number>> => {
  const result = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM properties WHERE tenant_id = $1 AND active = true',
    [tenantId]
  )

  if (!result.success) {
    return result
  }

  return { success: true, data: parseInt(result.data[0]?.count || '0') }
}

const fetchOverallOccupancy = async (params: QueryParams): Promise<DbResult<number>> => {
  const tagFilter = buildTagFilter(params.tagIds)
  const queryParams = buildQueryParams(params)

  const result = await query<{ booked_nights: string }>(
    `SELECT
      COALESCE(SUM(
        CASE
          WHEN arrival <= $3 AND departure >= $2 THEN
            LEAST(departure, $3::date) - GREATEST(arrival, $2::date)
          ELSE 0
        END
      ), 0) as booked_nights
    FROM bookings
    WHERE tenant_id = $1
      AND arrival <= $3
      AND departure >= $2
      AND status != 'canceled'
      ${tagFilter}`,
    queryParams
  )

  if (!result.success) {
    return result
  }

  return { success: true, data: parseInt(result.data[0]?.booked_nights || '0') }
}

const fetchPropertyOccupancy = async (params: QueryParams): Promise<DbResult<readonly {
  property_id: string
  property_name: string
  booked_nights: string
  property_days: string
}[]>> => {
  const tagFilter = buildTagFilter(params.tagIds)
  const queryParams = buildQueryParams(params)

  return query<{
    property_id: string
    property_name: string
    booked_nights: string
    property_days: string
  }>(
    `WITH date_range AS (
      SELECT
        $2::date as start_date,
        $3::date as end_date,
        ($3::date - $2::date + 1) as total_days
    )
    SELECT
      p.id as property_id,
      p.name as property_name,
      COALESCE(SUM(
        CASE
          WHEN b.arrival <= $3 AND b.departure >= $2 THEN
            LEAST(b.departure, $3::date) - GREATEST(b.arrival, $2::date)
          ELSE 0
        END
      ), 0) as booked_nights,
      (SELECT total_days FROM date_range) as property_days
    FROM properties p
    LEFT JOIN bookings b ON p.id = b.property_id
      AND b.tenant_id = $1
      AND b.arrival <= $3
      AND b.departure >= $2
      AND b.status != 'canceled'
      ${tagFilter.replace('bookings.', 'b.')}
    WHERE p.tenant_id = $1 AND p.active = true
    GROUP BY p.id, p.name
    ORDER BY p.name`,
    queryParams
  )
}

const fetchMonthlyOccupancy = async (params: QueryParams): Promise<DbResult<readonly {
  month: string
  booked_nights: string
  days_in_month: string
}[]>> => {
  const tagFilter = buildTagFilter(params.tagIds)
  const queryParams = buildQueryParams(params)

  return query<{
    month: string
    booked_nights: string
    days_in_month: string
  }>(
    `WITH months AS (
      SELECT DISTINCT
        TO_CHAR(date_series.date, 'YYYY-MM') as month,
        COUNT(*) OVER (PARTITION BY TO_CHAR(date_series.date, 'YYYY-MM')) as days_in_month
      FROM generate_series($2::date, $3::date, '1 day'::interval) as date_series(date)
    ),
    monthly_bookings AS (
      SELECT
        TO_CHAR(calendar_date, 'YYYY-MM') as month,
        COUNT(DISTINCT b.id || '-' || calendar_date) as booked_property_nights
      FROM generate_series($2::date, $3::date, '1 day'::interval) as calendar_date
      JOIN bookings b ON b.tenant_id = $1
        AND b.status != 'canceled'
        AND calendar_date >= b.arrival
        AND calendar_date < b.departure
        ${tagFilter.replace('bookings.', 'b.')}
      GROUP BY TO_CHAR(calendar_date, 'YYYY-MM')
    )
    SELECT
      m.month,
      COALESCE(mb.booked_property_nights, 0)::text as booked_nights,
      (m.days_in_month * (SELECT COUNT(*) FROM properties WHERE tenant_id = $1 AND active = true))::text as days_in_month
    FROM months m
    LEFT JOIN monthly_bookings mb ON m.month = mb.month
    GROUP BY m.month, m.days_in_month, mb.booked_property_nights
    ORDER BY m.month`,
    queryParams
  )
}

const transformPropertyOccupancy = (
  data: readonly {
    property_id: string
    property_name: string
    booked_nights: string
    property_days: string
  }[]
): readonly PropertyOccupancy[] =>
  data.map(row => ({
    propertyId: row.property_id,
    propertyName: row.property_name,
    rate: parseInt(row.property_days) > 0
      ? parseInt(row.booked_nights) / parseInt(row.property_days)
      : 0
  }))

const transformMonthlyOccupancy = (
  data: readonly {
    month: string
    booked_nights: string
    days_in_month: string
  }[]
): readonly MonthlyOccupancy[] =>
  data.map(row => ({
    month: row.month,
    rate: parseInt(row.days_in_month) > 0
      ? parseInt(row.booked_nights) / parseInt(row.days_in_month)
      : 0
  }))

const fetchOccupancyData = async (params: QueryParams): Promise<DbResult<OccupancyData>> => {
  const daysInRange = calculateDaysInRange(params.fromDate, params.toDate)

  const [propertyCountResult, overallResult, byPropertyResult, byMonthResult] = await Promise.all([
    fetchPropertyCount(params.tenantId),
    fetchOverallOccupancy(params),
    fetchPropertyOccupancy(params),
    fetchMonthlyOccupancy(params)
  ])

  if (!propertyCountResult.success) {
    return { success: false, error: 'Failed to get property count' }
  }

  if (!overallResult.success) {
    return { success: false, error: 'Failed to get overall occupancy' }
  }

  const totalAvailableNights = daysInRange * propertyCountResult.data
  const bookedNights = overallResult.data
  const overallOccupancy = totalAvailableNights > 0 ? bookedNights / totalAvailableNights : 0

  return {
    success: true,
    data: {
      overall: overallOccupancy,
      byProperty: transformPropertyOccupancy(byPropertyResult.success ? byPropertyResult.data : []),
      byMonth: transformMonthlyOccupancy(byMonthResult.success ? byMonthResult.data : []),
      bookedNights,
      availableNights: totalAvailableNights
    }
  }
}

export async function getOccupancy(
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

  if (!auth.tenantId) {
    return {
      status: 403,
      headers: corsHeaders(),
      jsonBody: {
        error: 'OwnerRez connection required',
        code: 'NO_OWNERREZ_CONNECTION'
      }
    }
  }

  const params = parseQueryParams(request, auth.tenantId)
  const result = await fetchOccupancyData(params)

  if (!result.success) {
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: { error: result.error }
    }
  }

  return {
    status: 200,
    headers: corsHeaders(),
    jsonBody: result.data
  }
}

app.http('occupancy', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: getOccupancy
})
