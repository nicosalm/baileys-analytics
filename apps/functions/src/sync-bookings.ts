import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import axios from 'axios';
import { OWNERREZ_API } from '@baileys/constants';
import { query, transaction } from './services/database';
import { syncBookingTags } from './services/tagSync';

type BookingCharge = {
  amount: number;
  description: string;
  type: string;
  is_taxable: boolean;
  tax_id?: number;
  position: number;
};

type OwnerRezBooking = {
  id: number;
  property_id: number;
  guest_id: number;
  arrival: string;
  departure: string;
  adults: number;
  children: number;
  infants: number;
  pets: number;
  status: string;
  total_amount: number;
  charges?: BookingCharge[];
  guest?: {
    id: number;
    first_name: string;
    last_name: string;
  };
  listing_site?: string;
  platform_reservation_number?: string;
  booked_utc: string;
  canceled_utc?: string;
  tags?: Array<{ id: number; name: string; color?: string }>;
};

type SyncState =
  | { status: 'loading' }
  | { status: 'success'; bookingsSynced: number; chargesSynced: number }
  | { status: 'error'; error: string; details?: unknown };

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

async function getPropertyMapping(tenantId: string): Promise<Map<string, string>> {
  const result = await query<{ ownerrez_id: string; id: string }>(
    'SELECT id, ownerrez_id FROM properties WHERE tenant_id = $1',
    [tenantId]
  );

  if (!result.success) {
    throw new Error(`Failed to fetch properties: ${result.error}`);
  }

  const mapping = new Map<string, string>();
  result.data.forEach(row => {
    mapping.set(row.ownerrez_id, row.id);
  });

  return mapping;
}

async function syncBookingWithCharges(booking: OwnerRezBooking, propertyId: string): Promise<{ chargeCount: number }> {
  const transactionResult = await transaction(async (client) => {
    // Insert or update booking
    const bookingResult = await client.query(
      `INSERT INTO bookings (
        tenant_id, property_id, ownerrez_booking_id,
        arrival, departure, adults, children, infants, pets,
        guest_name, guest_email, total_amount, status,
        platform, platform_reservation_number,
        booked_utc, canceled_utc
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (tenant_id, ownerrez_booking_id) DO UPDATE SET
        property_id = EXCLUDED.property_id,
        arrival = EXCLUDED.arrival,
        departure = EXCLUDED.departure,
        adults = EXCLUDED.adults,
        children = EXCLUDED.children,
        infants = EXCLUDED.infants,
        pets = EXCLUDED.pets,
        guest_name = EXCLUDED.guest_name,
        guest_email = EXCLUDED.guest_email,
        total_amount = EXCLUDED.total_amount,
        status = EXCLUDED.status,
        platform = EXCLUDED.platform,
        platform_reservation_number = EXCLUDED.platform_reservation_number,
        booked_utc = EXCLUDED.booked_utc,
        canceled_utc = EXCLUDED.canceled_utc,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id`,
      [
        TENANT_ID,
        propertyId,
        booking.id.toString(),
        booking.arrival,
        booking.departure,
        booking.adults || 0,
        booking.children || 0,
        booking.infants || 0,
        booking.pets || 0,
        booking.guest ? `${booking.guest.first_name} ${booking.guest.last_name}` : null,
        null, // guest email not in the response
        booking.total_amount,
        booking.status,
        booking.listing_site,
        booking.platform_reservation_number,
        booking.booked_utc,
        booking.canceled_utc
      ]
    );

    const bookingId = bookingResult.rows[0].id;

    // Delete existing charges for this booking
    await client.query(
      'DELETE FROM booking_charges WHERE booking_id = $1',
      [bookingId]
    );

    // Insert new charges
    let chargeCount = 0;
    if (booking.charges && booking.charges.length > 0) {
      for (const charge of booking.charges) {
        await client.query(
          `INSERT INTO booking_charges (
            booking_id, type, description, amount,
            is_taxable, tax_id, position
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            bookingId,
            charge.type,
            charge.description,
            charge.amount,
            charge.is_taxable,
            charge.tax_id?.toString(),
            charge.position
          ]
        );
        chargeCount++;
      }
    }

    return { bookingId, chargeCount };
  });

  if (!transactionResult.success) {
    throw new Error(`Failed to sync booking: ${transactionResult.error}`);
  }

  // Sync tags outside of transaction
  if (booking.tags && transactionResult.data.bookingId) {
    await syncBookingTags(transactionResult.data.bookingId, booking.tags, TENANT_ID);
  }

  return { chargeCount: transactionResult.data.chargeCount };
}

export async function syncBookings(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const token = process.env.OWNERREZ_PAT;

  if (!token) {
    return {
      status: 500,
      body: 'OWNERREZ_PAT environment variable not set'
    };
  }

  try {
    // Get property mapping
    const propertyMapping = await getPropertyMapping(TENANT_ID);
    const ownerRezPropertyIds = Array.from(propertyMapping.keys()).join(',');

    // Fetch bookings from the last 90 days by default
    const fromDate = request.query.get('from') ||
      new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const toDate = request.query.get('to') ||
      new Date().toISOString().split('T')[0];

    context.log('Syncing bookings:', { fromDate, toDate, properties: ownerRezPropertyIds });

    const response = await axios.get(`${OWNERREZ_API.BASE_URL}/bookings`, {
      auth: {
        username: 'jerry@***REMOVED***',
        password: token
      },
      headers: {
        'Accept': 'application/json'
      },
      params: {
        property_ids: ownerRezPropertyIds,
        from: fromDate,
        to: toDate,
        include_charges: true,
        include_guest: true,
        include_tags: true,
        limit: 500
      }
    });

    let bookingsSynced = 0;
    let totalChargesSynced = 0;

    for (const booking of response.data.items) {
      const propertyId = propertyMapping.get(booking.property_id.toString());
      if (!propertyId) {
        context.warn(`Property not found for OwnerRez ID: ${booking.property_id}`);
        continue;
      }

      const { chargeCount } = await syncBookingWithCharges(booking, propertyId);
      bookingsSynced++;
      totalChargesSynced += chargeCount;
    }

    const state: SyncState = {
      status: 'success',
      bookingsSynced,
      chargesSynced: totalChargesSynced
    };

    return {
      status: 200,
      jsonBody: state
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    context.error('Sync failed:', error);

    return {
      status: 500,
      jsonBody: {
        status: 'error',
        error: errorMessage
      }
    };
  }
}

app.http('sync-bookings', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: syncBookings
});
