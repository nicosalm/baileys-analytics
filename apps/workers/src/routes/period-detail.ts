import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { createSupabaseClient } from '../services/supabase';
import { SUPABASE_MAX_ROWS, MS_PER_DAY } from '../constants';
import { getExpensesWithTemplateFallback } from '../services/expense-utils';

const periodDetail = new Hono<{ Bindings: Env; Variables: { user: any; tenantId: string } }>();

periodDetail.use('*', authMiddleware);

periodDetail.get('/', async (c) => {
  const supabase = createSupabaseClient(c.env);
  const tenantId = c.get('tenantId');
  
  if (!tenantId) {
    return c.json({ error: 'Tenant not found' }, 404);
  }
  
  const from = c.req.query('from');
  const to = c.req.query('to');
  const tags = c.req.query('tags')?.split(',').filter(Boolean);

  if (!from || !to) {
    return c.json({ error: 'from and to date parameters are required' }, 400);
  }

  const startDate = from;
  const endDate = to;

  try {
    // Fetch active properties first so we can filter bookings to match occupancy service
    const propertiesData = await supabase
      .from('properties')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .eq('active', true);

    if (propertiesData.error) throw propertiesData.error;
    const properties = propertiesData.data || [];
    const propertyIds = properties.map(p => p.id);

    // Build bookings query filtered to active properties (matches occupancy service)
    let bookingsQuery = supabase
      .from('bookings')
      .select(`
        id,
        total_amount,
        arrival,
        departure,
        guest_name,
        guest_email,
        status,
        platform,
        property_id,
        host_service_fee,
        guest_listing_site_fee,
        ownerrez_booking_id
      `)
      .eq('tenant_id', tenantId)
      .in('property_id', propertyIds)
      .lte('arrival', endDate)
      .gte('departure', startDate)
      .neq('status', 'canceled')
      .limit(SUPABASE_MAX_ROWS);

    if (tags && tags.length > 0) {
      const { data: taggedBookings } = await supabase
        .from('booking_tags')
        .select('booking_id')
        .in('tag_id', tags);

      if (taggedBookings && taggedBookings.length > 0) {
        const bookingIds = taggedBookings.map(tb => tb.booking_id);
        bookingsQuery = bookingsQuery.in('id', bookingIds);
      } else {
        bookingsQuery = bookingsQuery.in('id', []);
      }
    }

    const [bookingsData, expensesList] = await Promise.all([
      bookingsQuery,
      getExpensesWithTemplateFallback(supabase, tenantId, startDate, endDate, propertyIds)
    ]);

    if (bookingsData.error) throw bookingsData.error;

    const bookings = bookingsData.data || [];

    // Calculate costs from booking-level fee columns
    const totalGuestFees = bookings.reduce((sum, b) => sum + (b.guest_listing_site_fee || 0), 0);
    const totalOperatingExpenses = expensesList.reduce((sum, e) => sum + (e.amount || 0), 0);

    // Query booking_charges for tax amounts on these bookings
    let totalTaxes = 0;
    if (bookings.length > 0) {
      const bookingIds = bookings.map(b => b.id);
      const { data: charges } = await supabase
        .from('booking_charges')
        .select('amount')
        .in('booking_id', bookingIds)
        .eq('type', 'tax')
        .limit(SUPABASE_MAX_ROWS);
      totalTaxes = (charges || []).reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
    }

    const totalHostFees = bookings.reduce((sum, b) => sum + (b.host_service_fee || 0), 0);
    const combinedPlatformFees = totalGuestFees + totalHostFees;
    
    const propertyMap = new Map<string, string>();
    properties.forEach(p => propertyMap.set(p.id, p.name));

    // calculate metrics
    const totalRevenue = bookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
    const totalBookings = bookings.length;

    const periodStart = new Date(startDate);
    const periodEnd = new Date(endDate);

    // Deduplicate occupancy: count each property-day at most once
    const occupiedPropertyDays = new Set<string>();
    const propertyOccupiedDays = new Map<string, Set<string>>();

    bookings.forEach(b => {
      if (b.arrival && b.departure) {
        const arrival = new Date(b.arrival);
        const departure = new Date(b.departure);
        const clampedStart = new Date(Math.max(arrival.getTime(), periodStart.getTime()));
        const clampedEnd = new Date(Math.min(departure.getTime(), periodEnd.getTime() + MS_PER_DAY));

        let day = new Date(clampedStart);
        while (day < clampedEnd) {
          const dayStr = day.toISOString().split('T')[0];
          occupiedPropertyDays.add(`${b.property_id}_${dayStr}`);

          if (!propertyOccupiedDays.has(b.property_id)) {
            propertyOccupiedDays.set(b.property_id, new Set());
          }
          propertyOccupiedDays.get(b.property_id)!.add(dayStr);

          day.setDate(day.getDate() + 1);
        }
      }
    });

    const totalNights = occupiedPropertyDays.size;
    const avgNightlyRate = totalNights > 0 ? totalRevenue / totalNights : 0;

    const totalDays = Math.ceil(
      (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;
    const totalPossibleNights = properties.length * totalDays;
    const occupancyRate = totalPossibleNights > 0 ? (totalNights / totalPossibleNights) : 0;

    const propertyRevenue = new Map<string, { revenue: number; bookings: number }>();
    bookings.forEach(b => {
      const propId = b.property_id;
      const current = propertyRevenue.get(propId) || { revenue: 0, bookings: 0 };
      current.revenue += b.total_amount || 0;
      current.bookings += 1;
      propertyRevenue.set(propId, current);
    });

    const byProperty = Array.from(propertyRevenue.entries())
      .map(([propertyId, data]) => ({
        propertyId,
        propertyName: propertyMap.get(propertyId) || 'Unknown Property',
        revenue: data.revenue,
        bookings: data.bookings,
        occupancyRate: totalDays > 0 ? (propertyOccupiedDays.get(propertyId)?.size || 0) / totalDays : 0
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const platformGroups = new Map<string, { count: number; revenue: number }>();
    bookings.forEach(b => {
      const platform = b.platform || 'Unassigned';
      const current = platformGroups.get(platform) || { count: 0, revenue: 0 };
      current.count += 1;
      current.revenue += b.total_amount || 0;
      platformGroups.set(platform, current);
    });

    const byPlatform = Array.from(platformGroups.entries())
      .map(([platform, data]) => ({
        platform,
        bookings: data.count,
        revenue: data.revenue
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const netRevenue = totalRevenue - combinedPlatformFees - totalTaxes - totalOperatingExpenses;

    return c.json({
      metrics: {
        revenue: totalRevenue,
        bookings: totalBookings,
        occupancyRate,
        avgNightlyRate
      },
      costs: {
        platformFees: combinedPlatformFees,
        taxes: totalTaxes,
        operatingExpenses: totalOperatingExpenses,
        netRevenue
      },
      summary: {
        totalRevenue,
        totalBookings,
        avgNightlyRate,
        totalNights,
        netRevenue
      },
      topProperties: byProperty.slice(0, 5),
      byProperty,
      byPlatform,
      bookings: bookings.map(b => ({
        id: b.id,
        propertyId: b.property_id,
        propertyName: propertyMap.get(b.property_id) || 'Unknown Property',
        guestId: `${(b.guest_name || '').toLowerCase().trim()}_${(b.guest_email || '').toLowerCase().trim()}`,
        guestName: b.guest_name,
        guestEmail: b.guest_email,
        arrival: b.arrival,
        departure: b.departure,
        totalAmount: b.total_amount,
        platform: b.platform || 'Unassigned',
        status: b.status,
        ownerrezBookingId: b.ownerrez_booking_id || null
      }))
    });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch period detail' 
    }, 500);
  }
});

export { periodDetail };