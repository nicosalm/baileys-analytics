import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { createSupabaseClient } from '../services/supabase';
import { MS_PER_DAY } from '../constants';
import { getExpensesWithTemplateFallback } from '../services/expense-utils';
import { normalizePlatform } from '../utils/platform';
import { fetchAllRows, fetchChunked } from '../utils/fetch-all';
import { getBookingIdsForTags } from '../utils/tag-filter';
import { prorateBooking, arrivalInPeriodMap, sumChargesForArrivalsInPeriod } from '../utils/prorate';

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

    let matchedBookingIds: string[] | null = null;
    if (tags && tags.length > 0) {
      matchedBookingIds = await getBookingIdsForTags(supabase, tenantId, tags);
    }

    const [bookings, expensesList] = await Promise.all([
      fetchAllRows(() => {
        let q = supabase
          .from('bookings')
          .select('id, total_amount, arrival, departure, guest_name, ownerrez_guest_id, status, platform, property_id, host_service_fee, guest_listing_site_fee, ownerrez_booking_id')
          .eq('tenant_id', tenantId)
          .in('property_id', propertyIds)
          .lte('arrival', endDate)
          .gte('departure', startDate)
          .neq('status', 'canceled')
          .order('id');
        if (matchedBookingIds) q = q.in('id', matchedBookingIds);
        else if (tags && tags.length > 0) q = q.in('id', []);
        return q;
      }),
      getExpensesWithTemplateFallback(supabase, tenantId, startDate, endDate, propertyIds)
    ]);

    const totalOperatingExpenses = expensesList.reduce((sum, e) => sum + (e.amount || 0), 0);

    // prorate per-booking revenue, host fees, taxes to the selected [startDate, endDate]
    const ratioByBookingId = new Map<string, number>();
    let totalRevenue = 0;
    let totalHostFees = 0;
    for (const b of bookings) {
      const pr = prorateBooking(b, startDate, endDate);
      ratioByBookingId.set(b.id, pr.ratio);
      totalRevenue += pr.revenue;
      totalHostFees += pr.hostFee;
    }

    // tax liability follows the arrival (taxable event), not the service period
    const arrivalInPeriod = arrivalInPeriodMap(bookings, startDate, endDate);
    let totalTaxes = 0;
    if (bookings.length > 0) {
      const bookingIds = bookings.map(b => b.id);
      const charges = await fetchChunked(bookingIds, ids =>
        supabase
          .from('booking_charges')
          .select('booking_id, amount')
          .in('booking_id', ids)
          .eq('type', 'tax')
      );
      totalTaxes = sumChargesForArrivalsInPeriod(charges, arrivalInPeriod);
    }

    const combinedPlatformFees = totalHostFees;

    const propertyMap = new Map<string, string>();
    properties.forEach(p => propertyMap.set(p.id, p.name));

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
      const ratio = ratioByBookingId.get(b.id) ?? 0;
      const current = propertyRevenue.get(propId) || { revenue: 0, bookings: 0 };
      current.revenue += (b.total_amount || 0) * ratio;
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
      const platform = normalizePlatform(b.platform);
      const ratio = ratioByBookingId.get(b.id) ?? 0;
      const current = platformGroups.get(platform) || { count: 0, revenue: 0 };
      current.count += 1;
      current.revenue += (b.total_amount || 0) * ratio;
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
        guestId: b.ownerrez_guest_id ? `or_${b.ownerrez_guest_id}` : `name_${(b.guest_name || '').toLowerCase().trim()}`,
        guestName: b.guest_name,
        arrival: b.arrival,
        departure: b.departure,
        totalAmount: b.total_amount,
        platform: normalizePlatform(b.platform),
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