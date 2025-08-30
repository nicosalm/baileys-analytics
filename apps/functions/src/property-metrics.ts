import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { query, DbResult } from './services/database';
import { safeDivide } from '@baileys/utils';
import { formatDateISO, getYear } from './utils/dates';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';
import { getActiveSeasons, buildBookingFilters } from './services/seasonService';
import { createSuccessResponse, createErrorResponse, requireTenant } from './utils/httpResponses';
import { buildTagFilter } from './utils/queryBuilders';
import { parseNumericField, parseIntField, transformPropertyRow } from './utils/dataTransformers';

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
  comparisonFrom?: string
  comparisonTo?: string
}

const parseQueryParams = (request: HttpRequest, tenantId: string): QueryParams => ({
  tenantId,
  fromDate: request.query.get('from') || formatDateISO(new Date(getYear(new Date()), 0, 1)),
  toDate: request.query.get('to') || formatDateISO(new Date()),
  tagIds: request.query.get('tags')?.split(',').filter(Boolean) || [],
  comparisonFrom: request.query.get('comparisonFrom') || undefined,
  comparisonTo: request.query.get('comparisonTo') || undefined
})

const buildCustomTagFilter = (tagIds: readonly string[]): string =>
  tagIds.length > 0 ? buildTagFilter(4) : ''

const buildQueryParams = (params: Omit<QueryParams, 'comparisonFrom' | 'comparisonTo'>, fromDate?: string, toDate?: string): any[] => {
  const from = fromDate || params.fromDate
  const to = toDate || params.toDate
  return params.tagIds.length > 0
    ? [params.tenantId, from, to, params.tagIds]
    : [params.tenantId, from, to]
}

export const fetchPropertyMetrics = async (params: Omit<QueryParams, 'comparisonFrom' | 'comparisonTo'>, fromDate?: string, toDate?: string): Promise<DbResult<readonly {
  property_id: string
  property_name: string
  total_revenue: string
  booking_count: string
  total_nights: string
  available_nights: string
}[]>> => {
  const seasons = await getActiveSeasons(params.tenantId)
  const bookingFilters = buildBookingFilters(seasons, 'b')
  
  const tagFilter = buildCustomTagFilter(params.tagIds)
  const queryParams = buildQueryParams(params, fromDate, toDate)

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
        ${bookingFilters}
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
        AND b.arrival >= $2
        AND b.arrival <= $3
        AND b.status != 'canceled'
        ${tagFilter}
        ${bookingFilters}
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

export const calculatePropertyMetrics = (row: {
  property_id: string
  property_name: string
  total_revenue: string
  booking_count: string
  total_nights: string
  available_nights: string
}): PropertyMetrics => {
  const revenue = parseNumericField(row.total_revenue)
  const bookings = parseIntField(row.booking_count)
  const nights = parseIntField(row.total_nights)
  const availableNights = parseIntField(row.available_nights)

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

export const transformMetrics = (
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

  const tenantError = requireTenant(auth.tenantId);
  if (tenantError) {
    return tenantError;
  }
  
  // Type assertion after validation
  const tenantId = auth.tenantId!

  const params = parseQueryParams(request, tenantId)
  
  // Fetch current period metrics
  const currentResult = await fetchPropertyMetrics(params)
  if (!currentResult.success) {
    return createErrorResponse('Failed to fetch property metrics');
  }
  const currentMetrics = transformMetrics(currentResult.data)

  // If comparison dates are provided, fetch previous period metrics
  if (params.comparisonFrom && params.comparisonTo) {
    const previousResult = await fetchPropertyMetrics(params, params.comparisonFrom, params.comparisonTo)
    
    if (!previousResult.success) {
      // If comparison fails, still return current data
      return createSuccessResponse(currentMetrics);
    }
    
    const previousMetrics = transformMetrics(previousResult.data)
    
    // Return both current and previous data
    return createSuccessResponse({
      current: currentMetrics,
      previous: previousMetrics
    });
  }

  // No comparison requested, return current metrics only
  return createSuccessResponse(currentMetrics);
}

app.http('property-metrics', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: getPropertyMetrics
})
