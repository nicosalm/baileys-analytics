import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth, handleOptions } from './middleware/auth';
import { createSuccessResponse, createErrorResponse, createNotFoundResponse, requireTenant } from './utils/httpResponses';
import { getBookingById, getBookingCharges, getBookingTags, transformBookingToAPI, transformChargesToAPI } from './services/bookingService';

export async function getBookingDetail(
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
    const bookingId = request.params.bookingId;

    // Get booking details
    const bookingResult = await getBookingById(bookingId, auth.tenantId!);

    if (!bookingResult.success || bookingResult.data.length === 0) {
      return createNotFoundResponse('Booking not found');
    }

    const booking = bookingResult.data[0];

    // Get charges and tags in parallel
    const [chargesResult, tagsResult] = await Promise.all([
      getBookingCharges(bookingId),
      getBookingTags(bookingId)
    ]);

    return createSuccessResponse({
      booking: transformBookingToAPI(booking),
      charges: chargesResult.success ? transformChargesToAPI(chargesResult.data) : [],
      tags: tagsResult.success ? tagsResult.data : []
    });
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to fetch booking detail'
    );
  }
}

app.http('booking-detail', {
  methods: ['GET', 'OPTIONS'],
  route: 'booking/{bookingId}/detail',
  authLevel: 'anonymous',
  handler: getBookingDetail
});
