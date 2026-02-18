import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { OWNERREZ_API } from '../constants';
import { authMiddleware } from '../middleware/auth';

const validation = new Hono<{ Bindings: Env; Variables: { user: any; tenantId: string } }>();

interface ValidationResult {
  source: string;
  totalBookings: number;
  totalRevenue: number;
  totalTax: number;
  avgNightlyRate: number;
  totalNights: number;
  bookings: Array<{
    id: string;
    propertyName?: string;
    arrival: string;
    departure: string;
    totalAmount: number;
    taxes: number;
    guest: string;
    status: string;
  }>;
}

interface ComparisonResult {
  ownerrez: ValidationResult;
  database: ValidationResult;
  discrepancies: {
    revenueDiff: number;
    bookingCountDiff: number;
    taxDiff: number;
    missingBookings: string[];
    extraBookings: string[];
    amountMismatches: Array<{
      bookingId: string;
      ownerrezAmount: number;
      dbAmount: number;
      difference: number;
    }>;
  };
}

async function getOwnerRezData(
  token: string,
  propertyIds: string[],
  fromDate: string,
  toDate: string
): Promise<ValidationResult> {
  const authConfig = {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  };

  const allBookings: any[] = [];
  const batchSize = 50;

  for (let i = 0; i < propertyIds.length; i += batchSize) {
    const batch = propertyIds.slice(i, i + batchSize);
    const params = new URLSearchParams({
      property_ids: batch.join(','),
      from: fromDate,
      to: toDate,
      include_charges: 'true',
      include_guest: 'true',
      limit: '500'
    });

    const response = await fetch(`${OWNERREZ_API.BASE_URL}/bookings?${params}`, authConfig as any);
    if (!response.ok) {
      throw new Error(`OwnerRez API error: ${response.status}`);
    }
    const data = await response.json();
    allBookings.push(...((data as any).items || []));
  }

  const actualBookings = allBookings.filter(booking =>
    !booking.is_block && booking.type !== 'block'
  );

  let totalRevenue = 0;
  let totalTax = 0;
  let totalNights = 0;
  const bookings: ValidationResult['bookings'] = [];

  for (const booking of actualBookings) {
    if (booking.status === 'canceled') continue;

    const taxes = booking.charges?.filter((c: any) => c.type === 'tax')
      .reduce((sum: number, c: any) => sum + c.amount, 0) || 0;

    const bookingAmount = booking.total_amount || 0;
    totalRevenue += bookingAmount;
    totalTax += taxes;

    const arrival = new Date(booking.arrival);
    const departure = new Date(booking.departure);
    const nights = Math.floor((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24));
    totalNights += nights;

    bookings.push({
      id: booking.id.toString(),
      arrival: booking.arrival,
      departure: booking.departure,
      totalAmount: bookingAmount,
      taxes,
      guest: booking.guest ? `${booking.guest.first_name} ${booking.guest.last_name}` : 'Unknown',
      status: booking.status
    });
  }

  return {
    source: 'OwnerRez API',
    totalBookings: bookings.length,
    totalRevenue,
    totalTax,
    avgNightlyRate: totalNights > 0 ? totalRevenue / totalNights : 0,
    totalNights,
    bookings
  };
}

async function getDatabaseData(
  supabase: any,
  tenantId: string,
  fromDate: string,
  toDate: string
): Promise<ValidationResult> {
  const { data: bookingsData, error: bookingsError } = await supabase
    .from('bookings')
    .select(`
      ownerrez_booking_id,
      arrival,
      departure,
      total_amount,
      guest_name,
      status,
      properties!inner(name)
    `)
    .eq('tenant_id', tenantId)
    .gte('arrival', fromDate)
    .lte('arrival', toDate)
    .neq('status', 'canceled');

  if (bookingsError) {
    throw new Error(`Failed to fetch database data: ${bookingsError.message}`);
  }

  const bookingIds = bookingsData?.map((b: any) => b.id) || [];
  
  const { data: chargesData } = await supabase
    .from('booking_charges')
    .select('booking_id, type, amount')
    .in('booking_id', bookingIds)
    .eq('type', 'tax');

  const taxByBooking = new Map<string, number>();
  chargesData?.forEach((charge: any) => {
    const current = taxByBooking.get(charge.booking_id) || 0;
    taxByBooking.set(charge.booking_id, current + charge.amount);
  });

  const bookings = (bookingsData || []).map((row: any) => ({
    id: row.ownerrez_booking_id,
    propertyName: row.properties?.name,
    arrival: row.arrival,
    departure: row.departure,
    totalAmount: row.total_amount,
    taxes: taxByBooking.get(row.id) || 0,
    guest: row.guest_name,
    status: row.status
  }));

  const totalRevenue = bookings.reduce((sum: number, b: any) => sum + b.totalAmount, 0);
  const totalTax = bookings.reduce((sum: number, b: any) => sum + b.taxes, 0);
  
  let totalNights = 0;
  bookings.forEach((b: any) => {
    const nights = Math.floor(
      (new Date(b.departure).getTime() - new Date(b.arrival).getTime()) / (1000 * 60 * 60 * 24)
    );
    totalNights += nights;
  });

  return {
    source: 'Database',
    totalBookings: bookings.length,
    totalRevenue,
    totalTax,
    avgNightlyRate: totalNights > 0 ? totalRevenue / totalNights : 0,
    totalNights,
    bookings
  };
}

function compareResults(
  ownerrez: ValidationResult,
  database: ValidationResult
): ComparisonResult['discrepancies'] {
  const ownerrezIds = new Set(ownerrez.bookings.map(b => b.id));
  const dbIds = new Set(database.bookings.map(b => b.id));

  const missingBookings = [...ownerrezIds].filter(id => !dbIds.has(id));
  const extraBookings = [...dbIds].filter(id => !ownerrezIds.has(id));

  const amountMismatches: ComparisonResult['discrepancies']['amountMismatches'] = [];

  for (const orBooking of ownerrez.bookings) {
    const dbBooking = database.bookings.find(b => b.id === orBooking.id);
    if (dbBooking) {
      const diff = Math.abs(orBooking.totalAmount - dbBooking.totalAmount);
      if (diff > 0.01) {
        amountMismatches.push({
          bookingId: orBooking.id,
          ownerrezAmount: orBooking.totalAmount,
          dbAmount: dbBooking.totalAmount,
          difference: diff
        });
      }
    }
  }

  return {
    revenueDiff: Math.abs(ownerrez.totalRevenue - database.totalRevenue),
    bookingCountDiff: Math.abs(ownerrez.totalBookings - database.totalBookings),
    taxDiff: Math.abs(ownerrez.totalTax - database.totalTax),
    missingBookings,
    extraBookings,
    amountMismatches
  };
}

validation.use('*', authMiddleware);

validation.get('/data', async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const tenantId = c.get('tenantId');
  
  const from = c.req.query('from') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
  const to = c.req.query('to') || new Date().toISOString().split('T')[0];

  try {
    const { data: tokenData } = await supabase
      .from('oauth_tokens')
      .select('access_token')
      .eq('tenant_id', tenantId)
      .single();

    if (!tokenData?.access_token) {
      return c.json({ error: 'No OwnerRez connection found' }, 403);
    }
    
    const token = tokenData.access_token;

    const { data: properties } = await supabase
      .from('properties')
      .select('ownerrez_id')
      .eq('tenant_id', tenantId)
      .eq('active', true);

    if (!properties || properties.length === 0) {
      return c.json({ error: 'No properties found' }, 404);
    }

    const propertyIds = properties.map(p => p.ownerrez_id);

    const [ownerrezData, databaseData] = await Promise.all([
      getOwnerRezData(token, propertyIds, from, to),
      getDatabaseData(supabase, tenantId, from, to)
    ]);

    const discrepancies = compareResults(ownerrezData, databaseData);

    const result: ComparisonResult = {
      ownerrez: ownerrezData,
      database: databaseData,
      discrepancies
    };


    return c.json(result);
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Validation failed' 
    }, 500);
  }
});

validation.get('/calculations', async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const tenantId = c.get('tenantId');
  const bookingId = c.req.query('bookingId');

  if (!bookingId) {
    return c.json({ error: 'bookingId parameter required' }, 400);
  }

  try {
    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        id,
        ownerrez_booking_id,
        total_amount,
        arrival,
        departure,
        properties!inner(name)
      `)
      .eq('tenant_id', tenantId)
      .eq('ownerrez_booking_id', bookingId)
      .single();

    if (error || !booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    const { data: charges } = await supabase
      .from('booking_charges')
      .select('type, amount, description, position')
      .eq('booking_id', booking.id)
      .order('position');

    const totalFromCharges = charges?.reduce((sum: number, c: any) => sum + c.amount, 0) || 0;
    const taxes = charges?.filter((c: any) => c.type === 'tax').reduce((sum: number, c: any) => sum + c.amount, 0) || 0;
    
    const nights = Math.floor(
      (new Date(booking.departure).getTime() - new Date(booking.arrival).getTime()) / (1000 * 60 * 60 * 24)
    );
    const avgNightlyRate = nights > 0 ? booking.total_amount / nights : 0;

    return c.json({
      bookingId: booking.ownerrez_booking_id,
      propertyName: (booking as any).properties?.name,
      totalAmount: booking.total_amount,
      totalFromCharges,
      discrepancy: Math.abs(booking.total_amount - totalFromCharges),
      taxes,
      nights,
      avgNightlyRate,
      charges: charges || [],
      calculations: {
        effectiveTaxRate: booking.total_amount > 0
          ? (taxes / booking.total_amount) * 100
          : 0,
        netRevenue: booking.total_amount - taxes
      }
    });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Calculation validation failed' 
    }, 500);
  }
});

export { validation };