import { app, Timer, InvocationContext } from '@azure/functions';
import axios from 'axios';
import { OWNERREZ_API } from '@baileys/constants';
import { query, transaction, DbResult } from './services/database';
import { syncPropertyTags, syncBookingTags } from './services/tagSync';

type PropertySyncState =
  | { status: 'idle' }
  | { status: 'syncing' }
  | { status: 'success'; synced: number }
  | { status: 'error'; error: string };

type BookingSyncState =
  | { status: 'idle' }
  | { status: 'syncing' }
  | { status: 'success'; synced: number; charges: number }
  | { status: 'error'; error: string };

type SyncState = {
  properties: PropertySyncState;
  bookings: BookingSyncState;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
};

type OwnerRezProperty = {
  id: number;
  name: string;
  active: boolean;
  address?: {
    street1?: string;
    city?: string;
    state?: string;
    postal_code?: string;
  };
  bedrooms: number;
  bathrooms: number;
  max_guests: number;
  latitude?: number;
  longitude?: number;
  thumbnail_url?: string;
  public_url?: string;
  tags?: Array<{ id: number; name: string; color?: string }>;
};

type PropertyMapping = Map<string, string>;

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

const fetchProperties = async (token: string): Promise<DbResult<OwnerRezProperty[]>> => {
  try {
    const response = await axios.get(`${OWNERREZ_API.BASE_URL}/properties`, {
      auth: {
        username: 'jerry@***REMOVED***',
        password: token
      },
      headers: { 'Accept': 'application/json' },
      params: { active: true, include_tags: true }
    });
    return { success: true, data: response.data.items };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch properties'
    };
  }
};

const upsertProperty = async (property: OwnerRezProperty): Promise<DbResult<void>> => {
  const result = await query<{ id: string }>(
    `INSERT INTO properties (
      tenant_id, ownerrez_id, name, address, city, state, postal_code,
      bedrooms, bathrooms, max_guests, latitude, longitude,
      thumbnail_url, public_url, active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    ON CONFLICT (tenant_id, ownerrez_id) DO UPDATE SET
      name = EXCLUDED.name,
      active = EXCLUDED.active,
      updated_at = CURRENT_TIMESTAMP
    RETURNING id`,
    [
      TENANT_ID,
      property.id.toString(),
      property.name,
      property.address?.street1 || '',
      property.address?.city || '',
      property.address?.state || '',
      property.address?.postal_code || '',
      property.bedrooms,
      property.bathrooms,
      property.max_guests,
      property.latitude,
      property.longitude,
      property.thumbnail_url,
      property.public_url,
      property.active
    ]
  );

  if (!result.success) {
    return { success: false, error: result.error };
  }

  // Sync tags if present
  if (property.tags && result.data.length > 0) {
    const propertyId = result.data[0].id;
    await syncPropertyTags(propertyId, property.tags, TENANT_ID);
  }

  return { success: true, data: undefined };
};

const syncProperties = async (token: string): Promise<PropertySyncState> => {
  const fetchResult = await fetchProperties(token);

  if (!fetchResult.success) {
    return { status: 'error', error: fetchResult.error };
  }

  const results = await Promise.all(
    fetchResult.data.map(upsertProperty)
  );

  const synced = results.filter(r => r.success).length;
  const errors = results.filter(r => !r.success);

  if (errors.length > 0) {
    return {
      status: 'error',
      error: `Synced ${synced} properties, but ${errors.length} failed`
    };
  }

  return { status: 'success', synced };
};

const getPropertyMapping = async (): Promise<DbResult<PropertyMapping>> => {
  const result = await query<{ ownerrez_id: string; id: string }>(
    'SELECT id, ownerrez_id FROM properties WHERE tenant_id = $1',
    [TENANT_ID]
  );

  if (!result.success) {
    return result;
  }

  const mapping = new Map(
    result.data.map(p => [p.ownerrez_id, p.id])
  );

  return { success: true, data: mapping };
};

const fetchRecentBookings = async (
  token: string,
  propertyIds: string[]
): Promise<DbResult<any[]>> => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const response = await axios.get(`${OWNERREZ_API.BASE_URL}/bookings`, {
      auth: {
        username: 'jerry@***REMOVED***',
        password: token
      },
      headers: { 'Accept': 'application/json' },
      params: {
        property_ids: propertyIds.join(','),
        since_utc: since,
        include_charges: true,
        include_guest: true,
        include_tags: true,
        limit: 200
      }
    });
    return { success: true, data: response.data.items };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch bookings'
    };
  }
};

const upsertBookingWithCharges = async (
  booking: any,
  propertyId: string
): Promise<DbResult<number>> => {
  return transaction(async (client) => {
    const bookingResult = await client.query(
      `INSERT INTO bookings (
        tenant_id, property_id, ownerrez_booking_id,
        arrival, departure, adults, children, infants, pets,
        guest_name, total_amount, status, platform,
        booked_utc, canceled_utc
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (tenant_id, ownerrez_booking_id) DO UPDATE SET
        status = EXCLUDED.status,
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
        booking.total_amount,
        booking.status,
        booking.listing_site,
        booking.booked_utc,
        booking.canceled_utc
      ]
    );

    const bookingId = bookingResult.rows[0].id;

    await client.query('DELETE FROM booking_charges WHERE booking_id = $1', [bookingId]);

    let chargeCount = 0;
    if (booking.charges) {
      for (const charge of booking.charges) {
        await client.query(
          `INSERT INTO booking_charges (
            booking_id, type, description, amount, is_taxable, position
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [bookingId, charge.type, charge.description, charge.amount, charge.is_taxable, charge.position]
        );
        chargeCount++;
      }
    }

    // Sync tags outside of the return
    if (booking.tags) {
      await syncBookingTags(bookingId, booking.tags, TENANT_ID);
    }

    return chargeCount;
  });
};

const syncBookings = async (token: string): Promise<BookingSyncState> => {
  const mappingResult = await getPropertyMapping();

  if (!mappingResult.success) {
    return { status: 'error', error: 'Failed to get property mapping' };
  }

  const propertyIds = Array.from(mappingResult.data.keys());
  const bookingsResult = await fetchRecentBookings(token, propertyIds);

  if (!bookingsResult.success) {
    return { status: 'error', error: bookingsResult.error };
  }

  const bookingsToSync = bookingsResult.data
    .filter(b => mappingResult.data.has(b.property_id.toString()))
    .map(b => ({
      booking: b,
      propertyId: mappingResult.data.get(b.property_id.toString())!
    }));

  const results = await Promise.all(
    bookingsToSync.map(({ booking, propertyId }) =>
      upsertBookingWithCharges(booking, propertyId)
    )
  );

  const successful = results.filter(r => r.success);
  const totalCharges = successful.reduce(
    (sum, r) => sum + (r.success ? r.data : 0),
    0
  );

  return {
    status: 'success',
    synced: successful.length,
    charges: totalCharges
  };
};

export const performSync = async (token: string): Promise<SyncState> => {
  const startedAt = new Date();

  const state: SyncState = {
    properties: { status: 'syncing' },
    bookings: { status: 'syncing' },
    startedAt
  };

  state.properties = await syncProperties(token);
  state.bookings = await syncBookings(token);

  state.completedAt = new Date();
  state.duration = state.completedAt.getTime() - startedAt.getTime();

  return state;
};

export async function autoSync(myTimer: Timer, context: InvocationContext): Promise<void> {
  context.log('Auto-sync started at:', new Date().toISOString());

  const token = process.env.OWNERREZ_PAT;
  if (!token) {
    context.error('OWNERREZ_PAT not configured');
    return;
  }

  const result = await performSync(token);

  context.log('Auto-sync completed:', {
    properties: result.properties,
    bookings: result.bookings,
    duration: `${result.duration}ms`
  });
}

// run every 12 hours
app.timer('auto-sync', {
  schedule: '0 0 */12 * * *',
  handler: autoSync
});
