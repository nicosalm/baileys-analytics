import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { createSupabaseClient } from '../services/supabase';
import { SUPABASE_MAX_ROWS, MS_PER_DAY } from '../constants';

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
  const year = c.req.query('year');
  const month = c.req.query('month');
  const tags = c.req.query('tags')?.split(',').filter(Boolean);
  
  let startDate: string;
  let endDate: string;
  
  if (from && to) {
    startDate = from;
    endDate = to;
  } else if (year && month) {
    startDate = `${year}-${month.padStart(2, '0')}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0);
    endDate = `${year}-${month.padStart(2, '0')}-${lastDay.getDate().toString().padStart(2, '0')}`;
  } else {
    return c.json({ error: 'Either from/to dates or year/month are required' }, 400);
  }

  try {
    // Fetch all bookings that might overlap with the period
    // We'll filter more precisely in code to match the calendar logic
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
        property_id
      `)
      .eq('tenant_id', tenantId)
      .lte('arrival', endDate)
      .gt('departure', startDate)  // Changed: departure must be AFTER start (not on checkout day)
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
      }
    }
    
    const [bookingsData, propertiesData] = await Promise.all([
      bookingsQuery,
      supabase
        .from('properties')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .eq('active', true)
    ]);

    if (bookingsData.error) throw bookingsData.error;
    if (propertiesData.error) throw propertiesData.error;

    const bookings = bookingsData.data || [];
    const properties = propertiesData.data || [];
    
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
      (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24) + 1
    );
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
      const platform = b.platform || 'Direct';
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

    return c.json({
      metrics: {
        revenue: totalRevenue,
        bookings: totalBookings,
        occupancyRate,
        avgNightlyRate
      },
      summary: {
        totalRevenue,
        totalBookings,
        avgNightlyRate,
        totalNights,
        netRevenue: totalRevenue
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
        platform: b.platform || 'Direct',
        status: b.status
      }))
    });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch period detail' 
    }, 500);
  }
});

export { periodDetail };