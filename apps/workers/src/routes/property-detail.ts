import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { createSupabaseClient } from '../services/supabase';
import { SUPABASE_MAX_ROWS, MS_PER_DAY } from '../constants';

const propertyDetail = new Hono<{ Bindings: Env; Variables: { user: any; tenantId: string } }>();

propertyDetail.use('*', authMiddleware);

propertyDetail.get('/:propertyId/detail', async (c) => {
  const supabase = createSupabaseClient(c.env);
  const tenantId = c.get('tenantId');
  const propertyId = c.req.param('propertyId');
  
  if (!tenantId) {
    return c.json({ error: 'Tenant not found' }, 404);
  }
  
  const from = c.req.query('from') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
  const to = c.req.query('to') || new Date().toISOString().split('T')[0];
  const tags = c.req.query('tags')?.split(',').filter(Boolean);

  try {
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .eq('tenant_id', tenantId)
      .single();
    
    if (propertyError || !property) {
      return c.json({ error: 'Property not found' }, 404);
    }
    
    let bookingsQuery = supabase
      .from('bookings')
      .select(`
        id,
        arrival,
        departure,
        total_amount,
        guest_name,
        guest_email,
        status,
        platform
      `)
      .eq('property_id', propertyId)
      .lte('arrival', to)
      .gte('departure', from)
      .neq('status', 'canceled')
      .order('arrival')
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
    
    const { data: bookings, error: bookingsError } = await bookingsQuery;
    
    if (bookingsError) throw bookingsError;

    let totalRevenue = 0;
    const platformRevenue = new Map<string, number>();
    const monthlyData = new Map<string, { revenue: number; bookings: number }>();

    const periodStart = new Date(from);
    const periodEnd = new Date(to);

    // Deduplicate occupancy: count each day at most once (single property)
    const occupiedDays = new Set<string>();
    const monthOccupiedDays = new Map<string, Set<string>>();

    (bookings || []).forEach(booking => {
      totalRevenue += booking.total_amount || 0;

      const platform = booking.platform || 'Direct';
      platformRevenue.set(platform, (platformRevenue.get(platform) || 0) + (booking.total_amount || 0));

      const month = booking.arrival.substring(0, 7);
      const monthData = monthlyData.get(month) || { revenue: 0, bookings: 0 };
      monthData.revenue += booking.total_amount || 0;
      monthData.bookings += 1;
      monthlyData.set(month, monthData);

      if (booking.arrival && booking.departure) {
        const arrival = new Date(booking.arrival);
        const departure = new Date(booking.departure);
        const clampedStart = new Date(Math.max(arrival.getTime(), periodStart.getTime()));
        const clampedEnd = new Date(Math.min(departure.getTime(), periodEnd.getTime() + MS_PER_DAY));

        let day = new Date(clampedStart);
        while (day < clampedEnd) {
          const dayStr = day.toISOString().split('T')[0];
          occupiedDays.add(dayStr);

          const dayMonth = dayStr.substring(0, 7);
          if (!monthOccupiedDays.has(dayMonth)) {
            monthOccupiedDays.set(dayMonth, new Set());
          }
          monthOccupiedDays.get(dayMonth)!.add(dayStr);

          day.setDate(day.getDate() + 1);
        }
      }
    });

    const totalNights = occupiedDays.size;
    const totalDays = Math.ceil(
      (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24) + 1
    );
    const occupancyRate = totalDays > 0 ? totalNights / totalDays : 0;
    const avgNightlyRate = totalNights > 0 ? totalRevenue / totalNights : 0;

    const sortedMonths = Array.from(monthlyData.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => {
        const daysInMonth = new Date(
          parseInt(month.split('-')[0]),
          parseInt(month.split('-')[1]),
          0
        ).getDate();
        const monthNights = monthOccupiedDays.get(month)?.size || 0;

        return {
          month,
          revenue: data.revenue,
          bookings: data.bookings,
          occupancy: (monthNights / daysInMonth) * 100
        };
      });
    
    const revenueByPlatform = Array.from(platformRevenue.entries())
      .map(([platform, revenue]) => ({
        platform,
        revenue,
        percentage: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0
      }))
      .sort((a, b) => b.revenue - a.revenue);
    
    const guestMap = new Map<string, number>();
    (bookings || []).forEach(booking => {
      const guestKey = booking.guest_email || booking.guest_name;
      if (guestKey) {
        guestMap.set(guestKey, (guestMap.get(guestKey) || 0) + 1);
      }
    });
    
    const totalGuests = guestMap.size;
    const repeatGuests = Array.from(guestMap.values()).filter(count => count > 1).length;
    
    const recentBookings = (bookings || [])
      .slice(0, 10)
      .map(booking => {
        const normalizedName = (booking.guest_name || '').toLowerCase().trim();
        const normalizedEmail = (booking.guest_email || '').toLowerCase().trim();
        const guestId = `${normalizedName}_${normalizedEmail}`;
        
        return {
          id: booking.id,
          guestId,
          guestName: booking.guest_name,
          guestEmail: booking.guest_email,
          arrival: booking.arrival,
          departure: booking.departure,
          totalAmount: booking.total_amount,
          platform: booking.platform || 'Direct',
          status: booking.status
        };
      });
    
    return c.json({
      property: {
        id: property.id,
        name: property.name,
        address: property.address,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        maxGuests: property.max_guests,
        active: property.active
      },
      metrics: {
        totalRevenue,
        totalBookings: bookings?.length || 0,
        avgNightlyRate,
        occupancyRate,
        totalNights,
        totalDays,
        avgStayLength: bookings && bookings.length > 0 ? totalNights / bookings.length : 0
      },
      monthlyData: sortedMonths,
      revenueByPlatform,
      recentBookings,
      guestStats: {
        totalGuests,
        repeatGuests
      },
      summary: {
        period: { from, to },
        topPlatform: revenueByPlatform[0]?.platform || 'None',
        avgBookingValue: bookings && bookings.length > 0 ? totalRevenue / bookings.length : 0
      }
    });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch property details' 
    }, 500);
  }
});

export { propertyDetail };