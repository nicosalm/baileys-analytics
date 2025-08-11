import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { query, DbResult } from './services/database';
import { safeDivide } from '@baileys/utils';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';

type PropertyMetrics = {
  propertyId: string
  propertyName: string
  revenue: number
  bookings: number
  occupancyRate: number
  avgNightlyRate: number
  avgStayLength: number
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

const buildTagFilter = (tagIds: readonly string[]): string =>
  tagIds.length > 0
    ? `AND EXISTS (
        SELECT 1 FROM booking_tags bt
        WHERE bt.booking_id = b.id
        AND bt.tag_id = ANY($4::uuid[])
      )`
    : ''

const buildQueryParams = (params: QueryParams): any[] =>
  params.tagIds.length > 0
    ? [params.tenantId, params.fromDate, params.toDate, params.tagIds]
    : [params.tenantId, params.fromDate, params.toDate]

const fetchPropertyMetrics = async (params: QueryParams): Promise<DbResult<readonly {
  property_id: string
  property_name: string
  total_revenue: string
  booking_count: string
  total_nights: string
  available_nights: string
}[]>> => {
  const tagFilter = buildTagFilter(params.tagIds)
  const queryParams = buildQueryParams(params)

  return query<{
    property_id: string
    property_name: string
    total_revenue: string
    booking_count: string
    total_nights: string
    available_nights: string
  }>(
    `WITH property_first_booking AS (
      -- Get the earliest booking for each property to determine when it became available
      SELECT
        p.id,
        p.name,
        MIN(b.arrival) as first_booking_date
      FROM properties p
      LEFT JOIN bookings b ON p.id = b.property_id
        AND b.tenant_id = p.tenant_id
        AND b.status != 'canceled'
      WHERE p.tenant_id = $1
        AND p.active = true
      GROUP BY p.id, p.name
    ),
    property_availability AS (
      -- Calculate actual available nights per property from first booking or query start
      SELECT
        pfb.id,
        pfb.name,
        CASE
          WHEN pfb.first_booking_date IS NULL OR pfb.first_booking_date > $3::date THEN
            0  -- No availability if no bookings or first booking is after the period
          WHEN pfb.first_booking_date > $2::date THEN
            -- Property became available during the period
            (LEAST($3::date, CURRENT_DATE) - pfb.first_booking_date + 1)
          ELSE
            -- Property was available for the entire period
            (LEAST($3::date, CURRENT_DATE) - $2::date + 1)
        END as available_nights
      FROM property_first_booking pfb
    ),
    property_bookings AS (
      SELECT
        p.id as property_id,
        COUNT(DISTINCT b.id) as booking_count,
        COALESCE(SUM(b.total_amount), 0) as total_revenue,
        COALESCE(SUM(
          -- Calculate nights only within the reporting period
          CASE
            WHEN b.arrival <= $3 AND b.departure >= $2 THEN
              LEAST(b.departure::date, $3::date, CURRENT_DATE) - GREATEST(b.arrival::date, $2::date)
            ELSE 0
          END
        ), 0) as total_nights
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
      COALESCE(pb.total_revenue, 0)::text as total_revenue,
      COALESCE(pb.booking_count, 0)::text as booking_count,
      COALESCE(pb.total_nights, 0)::text as total_nights,
      pa.available_nights::text as available_nights
    FROM property_availability pa
    LEFT JOIN property_bookings pb ON pa.id = pb.property_id
    ORDER BY COALESCE(pb.total_revenue, 0) DESC`,
    queryParams
  )
}

const calculatePropertyMetrics = (row: {
  property_id: string
  property_name: string
  total_revenue: string
  booking_count: string
  total_nights: string
  available_nights: string
}): PropertyMetrics => {
  const revenue = parseFloat(row.total_revenue)
  const bookings = parseInt(row.booking_count)
  const nights = parseInt(row.total_nights)
  const availableNights = parseInt(row.available_nights)

  return {
    propertyId: row.property_id,
    propertyName: row.property_name,
    revenue,
    bookings,
    occupancyRate: safeDivide(nights, availableNights),
    avgNightlyRate: safeDivide(revenue, nights, 0),
    avgStayLength: safeDivide(nights, bookings, 0),
    bookedNights: nights,
    availableNights
  }
}

const transformMetrics = (
  data: readonly {
    property_id: string
    property_name: string
    total_revenue: string
    booking_count: string
    total_nights: string
    available_nights: string
  }[]
): readonly PropertyMetrics[] =>
  data.map(calculatePropertyMetrics)

export async function getPropertyMetrics(
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
  const result = await fetchPropertyMetrics(params)

  if (!result.success) {
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: { error: 'Failed to fetch property metrics' }
    }
  }

  const metrics = transformMetrics(result.data)

  return {
    status: 200,
    headers: corsHeaders(),
    jsonBody: metrics
  }
}

app.http('property-metrics', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: getPropertyMetrics
})
