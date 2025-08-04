import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { query } from './services/database';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';

type GuestDetail = {
  guest: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    firstVisit: string;
    lastVisit: string;
    totalSpent: number;
    bookingCount: number;
    canceledCount: number;
    avgNightlyRate: number;
    avgStayLength: number;
    totalNights: number;
    favoriteProperty?: {
      id: string;
      name: string;
      bookingCount: number;
    };
  };
  bookings: Array<{
    id: string;
    propertyId: string;
    propertyName: string;
    arrival: string;
    departure: string;
    nights: number;
    totalAmount: number;
    status: string;
    platform?: string;
  }>;
  properties: Array<{
    propertyId: string;
    propertyName: string;
    bookingCount: number;
    totalSpent: number;
    avgNightlyRate: number;
    lastStay: string;
  }>;
  spendingTrend: Array<{
    month: string;
    amount: number;
    bookings: number;
  }>;
  tags: Array<{
    id: string;
    name: string;
    type: string;
    color?: string;
  }>;
  paymentMethods: Array<{
    method: string;
    count: number;
    total: number;
  }>;
}

export async function getGuestDetail(
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
    const guestId = request.params.guestId;
    const [guestName, guestEmail = ''] = guestId.split('|');

    console.log('Guest lookup:', { guestId, guestName, guestEmail });

    // Get guest summary
    const guestResult = await query<{
      guest_name: string;
      guest_email: string;
      first_visit: string;
      last_visit: string;
      total_spent: string;
      booking_count: string;
      canceled_count: string;
      total_nights: string;
    }>(
      `SELECT
        guest_name,
        guest_email,
        MIN(arrival) as first_visit,
        MAX(arrival) as last_visit,
        SUM(CASE WHEN status != 'canceled' THEN total_amount ELSE 0 END) as total_spent,
        COUNT(CASE WHEN status != 'canceled' THEN 1 END) as booking_count,
        COUNT(CASE WHEN status = 'canceled' THEN 1 END) as canceled_count,
        SUM(CASE WHEN status != 'canceled' THEN departure - arrival ELSE 0 END) as total_nights
      FROM bookings
      WHERE tenant_id = $1
        AND guest_name = $2
        AND (
          ($3 = '' AND (guest_email IS NULL OR guest_email = ''))
          OR (guest_email = $3)
        )
      GROUP BY guest_name, guest_email`,
      [auth.tenantId, guestName, guestEmail]
    );

    if (!guestResult.success || guestResult.data.length === 0) {
      return {
        status: 404,
        headers: corsHeaders(),
        jsonBody: { error: 'Guest not found' }
      };
    }

    const guest = guestResult.data[0];

    // Get favorite property
    const favoritePropertyResult = await query<{
      property_id: string;
      property_name: string;
      booking_count: string;
    }>(
      `SELECT
        p.id as property_id,
        p.name as property_name,
        COUNT(*) as booking_count
      FROM bookings b
      JOIN properties p ON b.property_id = p.id
      WHERE b.tenant_id = $1
        AND b.guest_name = $2
        AND (
          ($3 = '' AND (b.guest_email IS NULL OR b.guest_email = ''))
          OR (b.guest_email = $3)
        )
        AND b.status != 'canceled'
      GROUP BY p.id, p.name
      ORDER BY booking_count DESC, MAX(b.arrival) DESC
      LIMIT 1`,
      [auth.tenantId, guestName, guestEmail]
    );

    // Get all bookings
    const bookingsResult = await query<{
      id: string;
      property_id: string;
      property_name: string;
      arrival: string;
      departure: string;
      total_amount: string;
      status: string;
      platform: string;
    }>(
      `SELECT
        b.id,
        b.property_id,
        p.name as property_name,
        b.arrival,
        b.departure,
        b.total_amount,
        b.status,
        b.platform
      FROM bookings b
      JOIN properties p ON b.property_id = p.id
      WHERE b.tenant_id = $1
        AND b.guest_name = $2
        AND (
          ($3 = '' AND (b.guest_email IS NULL OR b.guest_email = ''))
          OR (b.guest_email = $3)
        )
      ORDER BY b.arrival DESC`,
      [auth.tenantId, guestName, guestEmail]
    );

    // Get properties stayed at
    const propertiesResult = await query<{
      property_id: string;
      property_name: string;
      booking_count: string;
      total_spent: string;
      total_nights: string;
      last_stay: string;
    }>(
      `SELECT
        p.id as property_id,
        p.name as property_name,
        COUNT(*) as booking_count,
        SUM(b.total_amount) as total_spent,
        SUM(b.departure - b.arrival) as total_nights,
        MAX(b.arrival) as last_stay
      FROM bookings b
      JOIN properties p ON b.property_id = p.id
      WHERE b.tenant_id = $1
        AND b.guest_name = $2
        AND (
          ($3 = '' AND (b.guest_email IS NULL OR b.guest_email = ''))
          OR (b.guest_email = $3)
        )
        AND b.status != 'canceled'
      GROUP BY p.id, p.name
      ORDER BY booking_count DESC, last_stay DESC`,
      [auth.tenantId, guestName, guestEmail]
    );

    // Get spending trend by month
    const spendingTrendResult = await query<{
      month: string;
      amount: string;
      bookings: string;
    }>(
      `SELECT
        TO_CHAR(arrival, 'YYYY-MM') as month,
        SUM(total_amount) as amount,
        COUNT(*) as bookings
      FROM bookings
      WHERE tenant_id = $1
        AND guest_name = $2
        AND (
          ($3 = '' AND (guest_email IS NULL OR guest_email = ''))
          OR (guest_email = $3)
        )
        AND status != 'canceled'
        AND arrival >= CURRENT_DATE - INTERVAL '2 years'
      GROUP BY TO_CHAR(arrival, 'YYYY-MM')
      ORDER BY month`,
      [auth.tenantId, guestName, guestEmail]
    );

    // Get guest tags
    const tagsResult = await query<{
      tag_id: string;
      tag_name: string;
      tag_type: string;
      tag_color: string;
    }>(
      `SELECT DISTINCT
        t.id as tag_id,
        t.name as tag_name,
        t.type as tag_type,
        t.color as tag_color
      FROM bookings b
      JOIN booking_tags bt ON b.id = bt.booking_id
      JOIN tags t ON bt.tag_id = t.id
      WHERE b.tenant_id = $1
        AND b.guest_name = $2
        AND (
          ($3 = '' AND (b.guest_email IS NULL OR b.guest_email = ''))
          OR (b.guest_email = $3)
        )
      ORDER BY t.type, t.name`,
      [auth.tenantId, guestName, guestEmail]
    );

    // Get payment methods (inferred from tags and platform data)
    const paymentMethodsResult = await query<{
      method: string;
      count: string;
      total: string;
    }>(
      `WITH payment_data AS (
        SELECT
          CASE
            WHEN b.platform ILIKE '%airbnb%' THEN 'Airbnb'
            WHEN b.platform ILIKE '%vrbo%' THEN 'VRBO'
            WHEN b.platform ILIKE '%booking%' THEN 'Booking.com'
            WHEN EXISTS (
              SELECT 1 FROM booking_tags bt
              JOIN tags t ON bt.tag_id = t.id
              WHERE bt.booking_id = b.id
              AND t.type = 'payment'
              AND t.name ILIKE '%credit%'
            ) THEN 'Credit Card'
            WHEN EXISTS (
              SELECT 1 FROM booking_tags bt
              JOIN tags t ON bt.tag_id = t.id
              WHERE bt.booking_id = b.id
              AND t.type = 'payment'
              AND t.name ILIKE '%ach%'
            ) THEN 'ACH/Bank Transfer'
            ELSE 'Other'
          END as method,
          b.total_amount
        FROM bookings b
        WHERE b.tenant_id = $1
          AND b.guest_name = $2
          AND (
            ($3 = '' AND (b.guest_email IS NULL OR b.guest_email = ''))
            OR (b.guest_email = $3)
          )
          AND b.status != 'canceled'
      )
      SELECT
        method,
        COUNT(*)::text as count,
        SUM(total_amount)::text as total
      FROM payment_data
      GROUP BY method
      ORDER BY total DESC`,
      [auth.tenantId, guestName, guestEmail]
    );

    const totalSpent = parseFloat(guest.total_spent);
    const bookingCount = parseInt(guest.booking_count);
    const totalNights = parseInt(guest.total_nights);

    const guestDetail: GuestDetail = {
      guest: {
        id: guestId,
        name: guest.guest_name,
        email: guest.guest_email || undefined,
        firstVisit: guest.first_visit,
        lastVisit: guest.last_visit,
        totalSpent,
        bookingCount,
        canceledCount: parseInt(guest.canceled_count),
        avgNightlyRate: totalNights > 0 ? totalSpent / totalNights : 0,
        avgStayLength: bookingCount > 0 ? totalNights / bookingCount : 0,
        totalNights,
        favoriteProperty: favoritePropertyResult.success && favoritePropertyResult.data.length > 0 ? {
          id: favoritePropertyResult.data[0].property_id,
          name: favoritePropertyResult.data[0].property_name,
          bookingCount: parseInt(favoritePropertyResult.data[0].booking_count)
        } : undefined
      },
      bookings: bookingsResult.success ? bookingsResult.data.map(b => ({
        id: b.id,
        propertyId: b.property_id,
        propertyName: b.property_name,
        arrival: b.arrival,
        departure: b.departure,
        nights: Math.ceil((new Date(b.departure).getTime() - new Date(b.arrival).getTime()) / (1000 * 60 * 60 * 24)),
        totalAmount: parseFloat(b.total_amount),
        status: b.status,
        platform: b.platform || undefined
      })) : [],
      properties: propertiesResult.success ? propertiesResult.data.map(p => ({
        propertyId: p.property_id,
        propertyName: p.property_name,
        bookingCount: parseInt(p.booking_count),
        totalSpent: parseFloat(p.total_spent),
        avgNightlyRate: parseInt(p.total_nights) > 0 ? parseFloat(p.total_spent) / parseInt(p.total_nights) : 0,
        lastStay: p.last_stay
      })) : [],
      spendingTrend: spendingTrendResult.success ? spendingTrendResult.data.map(s => ({
        month: s.month,
        amount: parseFloat(s.amount),
        bookings: parseInt(s.bookings)
      })) : [],
      tags: tagsResult.success ? tagsResult.data.map(t => ({
        id: t.tag_id,
        name: t.tag_name,
        type: t.tag_type,
        color: t.tag_color || undefined
      })) : [],
      paymentMethods: paymentMethodsResult.success ? paymentMethodsResult.data.map(p => ({
        method: p.method,
        count: parseInt(p.count),
        total: parseFloat(p.total)
      })) : []
    };

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: guestDetail
    };
  } catch (error) {
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: {
        error: error instanceof Error ? error.message : 'Failed to fetch guest detail'
      }
    };
  }
}

app.http('guest-detail', {
  methods: ['GET', 'OPTIONS'],
  route: 'guest/{guestId}/detail',
  authLevel: 'anonymous',
  handler: getGuestDetail
});
