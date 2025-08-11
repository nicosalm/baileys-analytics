import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { query, DbResult } from './services/database';
import { safeDivide, calculateOccupancyRate, calculateNightsBetween } from '@baileys/utils';
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
  bookedNights: number
  availableNights: number
}

type MonthlyOccupancy = {
  month: string
  rate: number
  bookedNights: number
  availableNights: number
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

const buildTagFilter = (tagIds: readonly string[], tableAlias: string = 'b'): string =>
  tagIds.length > 0
    ? `AND EXISTS (
        SELECT 1 FROM booking_tags bt
        WHERE bt.booking_id = ${tableAlias}.id
        AND bt.tag_id = ANY($4::uuid[])
      )`
    : ''

const buildQueryParams = (params: QueryParams): any[] =>
  params.tagIds.length > 0
    ? [params.tenantId, params.fromDate, params.toDate, params.tagIds]
    : [params.tenantId, params.fromDate, params.toDate]

const fetchOverallOccupancy = async (params: QueryParams): Promise<DbResult<{
  booked_nights: number
  available_nights: number
}>> => {
  const tagFilter = buildTagFilter(params.tagIds, 'b')
  const queryParams = buildQueryParams(params)

  const result = await query<{
    booked_nights: string
    available_nights: string
  }>(
    `WITH date_range AS (
      SELECT
        $2::date as start_date,
        LEAST($3::date, CURRENT_DATE) as end_date
    ),
    -- BEST APPROACH: Use first booking as availability start
    -- This is conservative, automatic, and works for any customer
    property_availability_window AS (
      SELECT
        p.id as property_id,
        p.name as property_name,
        -- Use earliest of: first booking OR query start date
        -- This handles both historical properties and new ones with no bookings
        COALESCE(
          MIN(b.arrival),
          dr.start_date
        ) as available_from,
        dr.end_date as available_to
      FROM properties p
      CROSS JOIN date_range dr
      LEFT JOIN bookings b ON p.id = b.property_id
        AND b.tenant_id = p.tenant_id
        AND b.status != 'canceled'
      WHERE p.tenant_id = $1
        AND p.active = true
      GROUP BY p.id, p.name, dr.start_date, dr.end_date
    ),
    property_nights AS (
      SELECT
        paw.property_id,
        -- Calculate nights only within the property's availability window
        CASE
          WHEN paw.available_from > paw.available_to THEN 0
          ELSE (paw.available_to - GREATEST(paw.available_from, $2::date) + 1)
        END as available_nights
      FROM property_availability_window paw
    ),
    booked_nights AS (
      SELECT
        COALESCE(SUM(
          CASE
            WHEN b.arrival <= $3 AND b.departure >= $2 THEN
              LEAST(b.departure, $3::date, CURRENT_DATE) - GREATEST(b.arrival, $2::date)
            ELSE 0
          END
        ), 0) as total_booked
      FROM bookings b
      JOIN properties p ON b.property_id = p.id
      WHERE b.tenant_id = $1
        AND b.arrival <= $3
        AND b.departure >= $2
        AND b.status != 'canceled'
        AND p.active = true
        ${tagFilter}
    )
    SELECT
      bn.total_booked::text as booked_nights,
      COALESCE(SUM(pn.available_nights), 0)::text as available_nights
    FROM property_nights pn
    CROSS JOIN booked_nights bn
    GROUP BY bn.total_booked`,
    queryParams
  )

  if (!result.success || result.data.length === 0) {
    return { success: false, error: 'Failed to calculate occupancy' }
  }

  return {
    success: true,
    data: {
      booked_nights: parseInt(result.data[0].booked_nights),
      available_nights: parseInt(result.data[0].available_nights)
    }
  }
}

const fetchPropertyOccupancy = async (params: QueryParams): Promise<DbResult<readonly {
  property_id: string
  property_name: string
  booked_nights: string
  available_nights: string
  availability_start: string | null
}[]>> => {
  const tagFilter = buildTagFilter(params.tagIds, 'b')
  const queryParams = buildQueryParams(params)

  return query<{
    property_id: string
    property_name: string
    booked_nights: string
    available_nights: string
    availability_start: string | null
  }>(
    `WITH property_availability_window AS (
      SELECT
        p.id,
        p.name,
        COALESCE(
          MIN(b.arrival),
          $2::date
        ) as available_from,
        LEAST($3::date, CURRENT_DATE) as available_to
      FROM properties p
      LEFT JOIN bookings b ON p.id = b.property_id
        AND b.tenant_id = p.tenant_id
        AND b.status != 'canceled'
      WHERE p.tenant_id = $1
        AND p.active = true
      GROUP BY p.id, p.name
    ),
    property_availability AS (
      SELECT
        paw.id,
        paw.name,
        paw.available_from,
        CASE
          WHEN paw.available_from > paw.available_to THEN 0
          ELSE (paw.available_to - GREATEST(paw.available_from, $2::date) + 1)
        END as available_nights
      FROM property_availability_window paw
    ),
    property_bookings AS (
      SELECT
        p.id,
        COALESCE(SUM(
          CASE
            WHEN b.arrival <= $3 AND b.departure >= $2 THEN
              LEAST(b.departure, $3::date, CURRENT_DATE) - GREATEST(b.arrival, $2::date)
            ELSE 0
          END
        ), 0) as booked_nights
      FROM properties p
      LEFT JOIN bookings b ON p.id = b.property_id
        AND b.tenant_id = $1
        AND b.arrival <= $3
        AND b.departure >= $2
        AND b.status != 'canceled'
        ${tagFilter}
      WHERE p.tenant_id = $1 AND p.active = true
      GROUP BY p.id
    )
    SELECT
      pa.id as property_id,
      pa.name as property_name,
      COALESCE(pb.booked_nights, 0)::text as booked_nights,
      pa.available_nights::text as available_nights,
      pa.available_from::text as availability_start
    FROM property_availability pa
    LEFT JOIN property_bookings pb ON pa.id = pb.id
    ORDER BY pa.name`,
    queryParams
  )
}

const fetchMonthlyOccupancy = async (params: QueryParams): Promise<DbResult<readonly {
  month: string
  booked_nights: string
  available_nights: string
}[]>> => {
  const tagFilter = buildTagFilter(params.tagIds, 'b')
  const queryParams = buildQueryParams(params)

  return query<{
    month: string
    booked_nights: string
    available_nights: string
  }>(
    `WITH property_availability_window AS (
      SELECT
        p.id as property_id,
        COALESCE(
          MIN(b.arrival),
          $2::date
        ) as available_from
      FROM properties p
      LEFT JOIN bookings b ON p.id = b.property_id
        AND b.tenant_id = p.tenant_id
        AND b.status != 'canceled'
      WHERE p.tenant_id = $1
        AND p.active = true
      GROUP BY p.id
    ),
    monthly_availability AS (
      SELECT
        TO_CHAR(date_series, 'YYYY-MM') as month,
        COUNT(DISTINCT paw.property_id || '-' || date_series::date) as available_property_nights
      FROM property_availability_window paw
      CROSS JOIN generate_series(
        GREATEST($2::date, paw.available_from),
        LEAST($3::date, CURRENT_DATE),
        '1 day'::interval
      ) AS date_series
      -- Only include months that are within the requested date range AND not in the future
      WHERE date_series::date <= LEAST($3::date, CURRENT_DATE)
        AND date_series::date >= $2::date
      GROUP BY TO_CHAR(date_series, 'YYYY-MM')
    ),
    monthly_bookings AS (
      SELECT
        TO_CHAR(calendar_date, 'YYYY-MM') as month,
        COUNT(DISTINCT b.id || '-' || calendar_date) as booked_property_nights
      FROM generate_series(
        $2::date,
        LEAST($3::date, CURRENT_DATE),
        '1 day'::interval
      ) as calendar_date
      JOIN bookings b ON b.tenant_id = $1
        AND b.status != 'canceled'
        AND calendar_date >= b.arrival
        AND calendar_date < b.departure
        ${tagFilter}
      JOIN properties p ON b.property_id = p.id
        AND p.active = true
      WHERE calendar_date <= CURRENT_DATE  -- Ensure we don't count future dates
      GROUP BY TO_CHAR(calendar_date, 'YYYY-MM')
    )
    SELECT
      ma.month,
      COALESCE(mb.booked_property_nights, 0)::text as booked_nights,
      ma.available_property_nights::text as available_nights
    FROM monthly_availability ma
    LEFT JOIN monthly_bookings mb ON ma.month = mb.month
    -- Only return months within the actual date range
    WHERE ma.month >= TO_CHAR($2::date, 'YYYY-MM')
      AND ma.month <= TO_CHAR(LEAST($3::date, CURRENT_DATE), 'YYYY-MM')
    ORDER BY ma.month`,
    queryParams
  )
}

const transformPropertyOccupancy = (
  data: readonly {
    property_id: string
    property_name: string
    booked_nights: string
    available_nights: string
    availability_start: string | null
  }[]
): readonly PropertyOccupancy[] =>
  data.map(row => {
    const bookedNights = parseInt(row.booked_nights)
    const availableNights = parseInt(row.available_nights)

    return {
      propertyId: row.property_id,
      propertyName: row.property_name,
      rate: calculateOccupancyRate(bookedNights, availableNights),
      bookedNights,
      availableNights
    }
  })

const transformMonthlyOccupancy = (
  data: readonly {
    month: string
    booked_nights: string
    available_nights: string
  }[]
): readonly MonthlyOccupancy[] =>
  data.map(row => {
    const bookedNights = parseInt(row.booked_nights)
    const availableNights = parseInt(row.available_nights)

    return {
      month: row.month,
      rate: calculateOccupancyRate(bookedNights, availableNights),
      bookedNights,
      availableNights
    }
  })

const fetchOccupancyData = async (params: QueryParams): Promise<DbResult<OccupancyData>> => {
  const [overallResult, byPropertyResult, byMonthResult] = await Promise.all([
    fetchOverallOccupancy(params),
    fetchPropertyOccupancy(params),
    fetchMonthlyOccupancy(params)
  ])

  if (!overallResult.success) {
    return { success: false, error: 'Failed to get overall occupancy' }
  }

  const { booked_nights, available_nights } = overallResult.data
  const overallOccupancy = calculateOccupancyRate(booked_nights, available_nights)

  return {
    success: true,
    data: {
      overall: overallOccupancy,
      byProperty: transformPropertyOccupancy(byPropertyResult.success ? byPropertyResult.data : []),
      byMonth: transformMonthlyOccupancy(byMonthResult.success ? byMonthResult.data : []),
      bookedNights: booked_nights,
      availableNights: available_nights
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
