import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { createSupabaseClient } from '../services/supabase';

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
      .neq('status', 'canceled');
    
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
    
    let totalNights = 0;
    bookings.forEach(b => {
      if (b.arrival && b.departure) {
        const nights = Math.ceil(
          (new Date(b.departure).getTime() - new Date(b.arrival).getTime()) / (1000 * 60 * 60 * 24)
        );
        totalNights += nights;
      }
    });
    
    const avgNightlyRate = totalNights > 0 ? totalRevenue / totalNights : 0;

    const totalDays = Math.ceil(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24) + 1
    );
    const totalPossibleNights = properties.length * totalDays;
    const occupancyRate = totalPossibleNights > 0 ? (totalNights / totalPossibleNights) : 0;

    const propertyRevenue = new Map<string, { revenue: number; bookings: number; nights: number }>();
    bookings.forEach(b => {
      const propId = b.property_id;
      const current = propertyRevenue.get(propId) || { revenue: 0, bookings: 0, nights: 0 };
      current.revenue += b.total_amount || 0;
      current.bookings += 1;
      
      if (b.arrival && b.departure) {
        const nights = Math.ceil(
          (new Date(b.departure).getTime() - new Date(b.arrival).getTime()) / (1000 * 60 * 60 * 24)
        );
        current.nights += nights;
      }
      
      propertyRevenue.set(propId, current);
    });

    const byProperty = Array.from(propertyRevenue.entries())
      .map(([propertyId, data]) => ({
        propertyId,
        propertyName: propertyMap.get(propertyId) || 'Unknown Property',
        revenue: data.revenue,
        bookings: data.bookings,
        occupancyRate: totalDays > 0 ? data.nights / totalDays : 0
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
        guestId: b.guest_email || b.guest_name,
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