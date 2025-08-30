import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { requireAuth, handleOptions } from './middleware/auth'
import { createSuccessResponse, createErrorResponse, requireTenant } from './utils/httpResponses'
import { cache, CACHE_TTL } from './services/cache'
import { getActiveSeasons, buildBookingFilters } from './services/seasonService'
import { query } from './services/database'

// Import logic from existing endpoints
import { getCurrentPeriodMetrics, getChartsData, getAlerts, getRecentActivity } from './overview'
import { getPLData, getRevenueData, getCashflowData, getTaxData } from './financial'
import { getOccupancyData } from './services/occupancyService'
import { fetchPropertyMetrics, transformMetrics } from './property-metrics'
import { fetchGuestData } from './guest-list'

export async function getDashboardBatch(
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
  const tenantError = requireTenant(auth.tenantId)
  if (tenantError) {
    return tenantError
  }

  const tenantId = auth.tenantId!
  
  const view = request.query.get('view') || 'overview'
  const from = request.query.get('from') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
  const to = request.query.get('to') || new Date().toISOString().split('T')[0]
  const tags = request.query.get('tags')?.split(',').filter(Boolean) || []
  const comparisonFrom = request.query.get('comparisonFrom')
  const comparisonTo = request.query.get('comparisonTo')
  
  const cacheKey = cache.generateKey('dashboard', tenantId, view, from, to, tags, comparisonFrom, comparisonTo)
  
  const cached = cache.get(cacheKey)
  if (cached) {
    context.log('Returning cached dashboard data')
    return createSuccessResponse({
      ...cached,
      _cached: true,
      _cachedAt: new Date().toISOString()
    })
  }
  
  try {
    let data: any = {}
    
    switch(view) {
      case 'overview':
        const [metrics, charts, alerts, recentActivity] = await Promise.all([
          getCurrentPeriodMetrics(tenantId, from, to, tags, auth.userId),
          getChartsData(tenantId, from, to, tags),
          getAlerts(tenantId, from, to),
          getRecentActivity(tenantId)
        ])
        

        let comparison = null
        if (comparisonFrom && comparisonTo) {
          comparison = await getCurrentPeriodMetrics(tenantId, comparisonFrom, comparisonTo, tags, auth.userId)
        }
        
        data = {
          metrics: formatOverviewMetrics(metrics, comparison),
          charts,
          alerts,
          recentActivity,
          view: 'overview'
        }
        break
        
      case 'financial':

        const [plResult, revenueResult, cashflowResult, taxResult] = await Promise.all([
          getPLData(tenantId, from, to, tags),
          getRevenueData(tenantId, from, to, tags),
          getCashflowData(tenantId, from, to, tags),
          getTaxData(tenantId, from, to, tags)
        ])
        
        if (!plResult.success || !revenueResult.success || !cashflowResult.success || !taxResult.success) {
          throw new Error('Failed to fetch financial data')
        }
        

        let previousPL = null
        let previousRevenue = null
        let previousCashflow = null
        let previousTax = null
        
        if (comparisonFrom && comparisonTo) {
          const [prevPLResult, prevRevenueResult, prevCashflowResult, prevTaxResult] = await Promise.all([
            getPLData(tenantId, comparisonFrom, comparisonTo, tags),
            getRevenueData(tenantId, comparisonFrom, comparisonTo, tags),
            getCashflowData(tenantId, comparisonFrom, comparisonTo, tags),
            getTaxData(tenantId, comparisonFrom, comparisonTo, tags)
          ])
          
          if (prevPLResult.success) previousPL = prevPLResult.data
          if (prevRevenueResult.success) previousRevenue = prevRevenueResult.data
          if (prevCashflowResult.success) previousCashflow = prevCashflowResult.data
          if (prevTaxResult.success) previousTax = prevTaxResult.data
        }
        
        data = {
          pl: { ...plResult.data, previousPeriod: previousPL },
          revenue: { ...revenueResult.data, previousPeriod: previousRevenue },
          cashflow: { ...cashflowResult.data, previousPeriod: previousCashflow },
          tax: { ...taxResult.data, previousPeriod: previousTax },
          view: 'financial'
        }
        break
        
      case 'properties':

        const propertyParams = {
          tenantId,
          fromDate: from,
          toDate: to,
          tagIds: tags
        }
        

        const propertyResult = await fetchPropertyMetrics(propertyParams)
        
        if (!propertyResult.success) {
          throw new Error('Failed to fetch property metrics')
        }
        

        const currentMetrics = transformMetrics(propertyResult.data)
        

        if (comparisonFrom && comparisonTo) {
          const previousResult = await fetchPropertyMetrics(
            propertyParams,
            comparisonFrom,
            comparisonTo
          )
          
          if (previousResult.success) {
            const previousMetrics = transformMetrics(previousResult.data)
            data = {
              current: currentMetrics,
              previous: previousMetrics,
              view: 'properties'
            }
          } else {

            data = {
              properties: currentMetrics,
              view: 'properties'
            }
          }
        } else {

          data = {
            properties: currentMetrics,
            view: 'properties'
          }
        }
        break
        
      case 'occupancy':

        const seasons = await getActiveSeasons(tenantId)
        const bookingFilters = buildBookingFilters(seasons, 'b')
        const occupancyParams = {
          tenantId,
          fromDate: from,
          toDate: to,
          tagIds: tags
        }
        const occupancyResult = await getOccupancyData(occupancyParams, bookingFilters)
        
        if (!occupancyResult.success) {
          throw new Error('Failed to fetch occupancy data')
        }
        

        if (comparisonFrom && comparisonTo) {
          const previousOccupancyParams = {
            tenantId,
            fromDate: comparisonFrom,
            toDate: comparisonTo,
            tagIds: tags
          }
          const previousOccupancyResult = await getOccupancyData(previousOccupancyParams, bookingFilters)
          
          if (previousOccupancyResult.success) {
            data = {
              current: occupancyResult.data,
              previous: previousOccupancyResult.data,
              view: 'occupancy'
            }
          } else {

            data = {
              ...occupancyResult.data,
              view: 'occupancy'
            }
          }
        } else {

          data = {
            ...occupancyResult.data,
            view: 'occupancy'
          }
        }
        break
        
      case 'guests':

        const guestResult = await fetchGuestData(
          tenantId,
          from,
          to,
          tags,
          comparisonFrom || undefined,
          comparisonTo || undefined
        )
        

        let previousGuestData = null
        if (comparisonFrom && comparisonTo) {
          previousGuestData = await fetchGuestData(
            tenantId,
            comparisonFrom,
            comparisonTo,
            tags
          )
        }
        
        data = {
          current: guestResult,
          previous: previousGuestData,
          view: 'guests'
        }
        break
        
      default:
        return createErrorResponse(`Unknown view: ${view}`, 400)
    }
    

    const ttl = view === 'overview' ? CACHE_TTL.SHORT : CACHE_TTL.MEDIUM
    cache.set(cacheKey, data, ttl)
    
    return createSuccessResponse({
      ...data,
      _cached: false,
      _timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    context.error(`Dashboard batch error for ${view}:`, error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to fetch dashboard data'
    )
  }
}

// Helper function to format overview metrics (matches existing overview.ts logic)
interface OverviewMetricsInput {
  revenue: number
  netRevenue: number
  avgBookingValue: number
  bookings: number
  upcomingBookings: number
  avgNights: number
  cancellationRate: number
  occupancyRate: number
  avgPropertyOccupancy: number
  totalGuests: number
  newGuests: number
  repeatGuestRate: number
  totalProperties: number
}

function formatOverviewMetrics(current: OverviewMetricsInput, previous: OverviewMetricsInput | null = null) {
  const metrics = {
    revenue: {
      current: current.revenue,
      net: current.netRevenue,
      avgBookingValue: current.avgBookingValue,
      previous: previous ? previous.revenue : undefined,
      growth: previous && previous.revenue ? ((current.revenue - previous.revenue) / previous.revenue) * 100 : undefined
    },
    bookings: {
      current: current.bookings,
      upcoming: current.upcomingBookings,
      avgNights: current.avgNights,
      cancellationRate: current.cancellationRate,
      previous: previous ? previous.bookings : undefined
    },
    occupancy: {
      current: current.occupancyRate,
      avgPropertyOccupancy: current.avgPropertyOccupancy,
      previous: previous ? previous.occupancyRate : undefined,
      growth: previous && previous.occupancyRate ? ((current.occupancyRate - previous.occupancyRate) / previous.occupancyRate) * 100 : undefined
    },
    guests: {
      total: current.totalGuests,
      previous: previous ? previous.totalGuests : undefined,
      growth: previous && previous.totalGuests ? ((current.totalGuests - previous.totalGuests) / previous.totalGuests) * 100 : undefined,
      newThisMonth: current.newGuests,
      repeatRate: current.repeatGuestRate
    },
    properties: {
      total: current.totalProperties,
      avgOccupancy: current.avgPropertyOccupancy
    }
  }
  
  return metrics
}

app.http('dashboard-batch', {
  methods: ['GET', 'OPTIONS'],
  route: 'dashboard-batch',
  authLevel: 'anonymous',
  handler: getDashboardBatch
})