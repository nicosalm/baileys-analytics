import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth, handleOptions } from './middleware/auth';
import { formatDateISO } from './utils/dates';
import { getActiveSeasons, buildBookingFilters } from './services/seasonService';
import { createSuccessResponse, createErrorResponse, requireTenant } from './utils/httpResponses';
import { parseNumericField, parseIntField } from './utils/dataTransformers';
import { getBookingSummary, getPropertyBookingSummary, getBookingsInDateRange, transformSummaryToAPI, transformPropertySummaryToAPI, transformBookingToAPI } from './services/bookingService';

export async function getMonthDetail(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') {
    return handleOptions();
  }

  const authCheck = await requireAuth(request);
  if (!authCheck.authenticated) {
    return authCheck.response;
  }

  const { auth } = authCheck.request;

  const tenantError = requireTenant(auth.tenantId);
  if (tenantError) {
    return tenantError;
  }

  try {
    const year = request.query.get('year');
    const month = request.query.get('month');

    if (!year || !month) {
      return createErrorResponse('Year and month are required', 400);
    }

    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const endDate = formatDateISO(new Date(parseInt(year), parseInt(month), 0));
    
    // Get active seasons for filtering
    const seasons = await getActiveSeasons(auth.tenantId!);
    const bookingFilters = buildBookingFilters(seasons, 'b');

    // Get all data in parallel
    const [summaryResult, byPropertyResult, bookingsResult] = await Promise.all([
      getBookingSummary(auth.tenantId!, startDate, endDate, bookingFilters || ''),
      getPropertyBookingSummary(auth.tenantId!, startDate, endDate, bookingFilters || ''),
      getBookingsInDateRange(auth.tenantId!, startDate, endDate, bookingFilters || '')
    ]);

    if (!summaryResult.success) {
      throw new Error('Failed to fetch summary');
    }

    const summary = summaryResult.data[0];

    const summaryData = transformSummaryToAPI(summary);
    const propertiesData = byPropertyResult.success ? transformPropertySummaryToAPI(byPropertyResult.data) : [];
    const bookingsData = bookingsResult.success ? bookingsResult.data.map(transformBookingToAPI) : [];

    return createSuccessResponse({
      metrics: {
        revenue: summaryData.totalRevenue,
        bookings: summaryData.totalBookings,
        occupancyRate: 0, // Would need calculation based on property count
        avgNightlyRate: summaryData.avgNightlyRate
      },
      summary: summaryData,
      topProperties: propertiesData.map(p => ({
        ...p,
        occupancyRate: 0 // Would need calculation
      })),
      byProperty: propertiesData,
      bookings: bookingsData
    });
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to fetch month detail'
    );
  }
}

app.http('month-detail', {
  methods: ['GET', 'OPTIONS'],
  route: 'month-detail',
  authLevel: 'anonymous',
  handler: getMonthDetail
});
