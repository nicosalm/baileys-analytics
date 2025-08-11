import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { query } from './services/database';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';

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

  if (!auth.tenantId) {
    return {
      status: 403,
      headers: corsHeaders(),
      jsonBody: {
        error: 'OwnerRez connection required',
        code: 'NO_OWNERREZ_CONNECTION'
      }
    };
  }

  try {
    const bookingId = request.params.bookingId;

    // Get booking details
    const bookingResult = await query<{
      id: string;
      ownerrez_booking_id: string;
      property_id: string;
      property_name: string;
      guest_name: string;
      guest_email?: string;
      arrival: string;
      departure: string;
      adults: number;
      children: number;
      total_amount: string;
      status: string;
      platform?: string;
      booked_utc: string;
    }>(
      `SELECT
        b.id,
        b.ownerrez_booking_id,
        b.property_id,
        p.name as property_name,
        b.guest_name,
        b.guest_email,
        b.arrival,
        b.departure,
        b.adults,
        b.children,
        b.total_amount,
        b.status,
        b.platform,
        b.booked_utc
      FROM bookings b
      JOIN properties p ON b.property_id = p.id
      WHERE b.id = $1 AND b.tenant_id = $2`,
      [bookingId, auth.tenantId]
    );

    if (!bookingResult.success || bookingResult.data.length === 0) {
      return {
        status: 404,
        headers: corsHeaders(),
        jsonBody: { error: 'Booking not found' }
      };
    }

    const booking = bookingResult.data[0];

    // Get charges
    const chargesResult = await query<{
      id: string;
      type: string;
      description: string;
      amount: string;
      is_taxable: boolean;
    }>(
      `SELECT id, type, description, amount, is_taxable
       FROM booking_charges
       WHERE booking_id = $1
       ORDER BY position`,
      [bookingId]
    );

    // Get tags
    const tagsResult = await query<{
      id: string;
      name: string;
      type: string;
    }>(
      `SELECT t.id, t.name, t.type
       FROM tags t
       JOIN booking_tags bt ON t.id = bt.tag_id
       WHERE bt.booking_id = $1`,
      [bookingId]
    );

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: {
        booking: {
          id: booking.id,
          ownerrezBookingId: booking.ownerrez_booking_id,
          propertyId: booking.property_id,
          propertyName: booking.property_name,
          guestId: `${booking.guest_name}|${booking.guest_email || ''}`,
          guestName: booking.guest_name,
          guestEmail: booking.guest_email,
          arrival: booking.arrival,
          departure: booking.departure,
          adults: booking.adults,
          children: booking.children,
          totalAmount: parseFloat(booking.total_amount),
          status: booking.status,
          platform: booking.platform,
          bookedDate: booking.booked_utc
        },
        charges: chargesResult.success ? chargesResult.data.map(c => ({
          id: c.id,
          type: c.type,
          description: c.description,
          amount: parseFloat(c.amount),
          isTaxable: c.is_taxable
        })) : [],
        tags: tagsResult.success ? tagsResult.data : []
      }
    };
  } catch (error) {
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: {
        error: error instanceof Error ? error.message : 'Failed to fetch booking detail'
      }
    };
  }
}

app.http('booking-detail', {
  methods: ['GET', 'OPTIONS'],
  route: 'booking/{bookingId}/detail',
  authLevel: 'anonymous',
  handler: getBookingDetail
});
