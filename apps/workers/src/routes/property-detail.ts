import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { createSupabaseClient } from '../services/supabase';
import { MS_PER_DAY } from '../constants';
import { getExpensesWithTemplateFallback } from '../services/expense-utils';
import { normalizePlatform } from '../utils/platform';
import { fetchAllRows, fetchChunked } from '../utils/fetch-all';
import { getBookingIdsForTags } from '../utils/tag-filter';
import { prorateBooking, bucketBooking, arrivalInPeriodMap, sumChargesForArrivalsInPeriod, effectiveDaysInMonth, enumerateBuckets } from '../utils/prorate';
import { fetchBlocks, collectBlockedNights, collectBlockedNightsExclusive, sumBlockedNights } from '../utils/blocks';
import type { AppEnv } from '../types';

const propertyDetail = new Hono<AppEnv>();

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
    
    let matchedBookingIds: string[] | null = null;
    if (tags && tags.length > 0) {
      matchedBookingIds = await getBookingIdsForTags(supabase, tenantId, tags);
    }

    const [bookings, expensesList, blocks] = await Promise.all([
      fetchAllRows(() => {
        let q = supabase
          .from('bookings')
          .select('id, arrival, departure, total_amount, guest_name, ownerrez_guest_id, status, platform, host_service_fee, guest_listing_site_fee')
          .eq('tenant_id', tenantId)
          .eq('property_id', propertyId)
          .lte('arrival', to)
          .gte('departure', from)
          .neq('status', 'canceled')
          // desc so `.slice(0, 10)` downstream actually returns the 10 most recent
          // bookings, matching the "Recent Bookings" label in the detail modal
          .order('arrival', { ascending: false });
        if (matchedBookingIds) q = q.in('id', matchedBookingIds);
        else if (tags && tags.length > 0) q = q.in('id', []);
        return q;
      }),
      getExpensesWithTemplateFallback(supabase, tenantId, from, to, [propertyId], propertyId),
      fetchBlocks(supabase, tenantId, from, to, [propertyId])
    ]);

    const totalOperatingExpenses = expensesList.reduce((sum, e) => sum + (e.amount || 0), 0);

    // prorate revenue + host fees by the booking's overlap with [from, to].
    // Taxes use a different rule (arrival-in-period, full amount) below.
    let totalRevenue = 0;
    let totalHostFees = 0;
    const platformRevenue = new Map<string, number>();
    const monthlyData = new Map<string, { revenue: number; bookings: number; nights: number }>();

    const occupiedDays = new Set<string>();
    const monthOccupiedDays = new Map<string, Set<string>>();

    bookings.forEach(booking => {
      const pr = prorateBooking(booking, from, to);
      totalRevenue += pr.revenue;
      totalHostFees += pr.hostFee;

      const platform = normalizePlatform(booking.platform);
      platformRevenue.set(platform, (platformRevenue.get(platform) || 0) + pr.revenue);

      // bucket revenue by the month each night belongs to (not just arrival month)
      for (const bkt of bucketBooking(booking, from, to, 'month')) {
        const cur = monthlyData.get(bkt.key) || { revenue: 0, bookings: 0, nights: 0 };
        cur.revenue += bkt.revenue;
        cur.nights += bkt.nights;
        monthlyData.set(bkt.key, cur);
      }
      // booking counts stay whole, attributed to arrival month
      const arrivalMonth = booking.arrival.substring(0, 7);
      const arrCur = monthlyData.get(arrivalMonth) || { revenue: 0, bookings: 0, nights: 0 };
      arrCur.bookings += 1;
      monthlyData.set(arrivalMonth, arrCur);

      if (booking.arrival && booking.departure) {
        const arrival = new Date(booking.arrival);
        const departure = new Date(booking.departure);
        const periodStart = new Date(from);
        const periodEnd = new Date(to);
        const clampedStart = new Date(Math.max(arrival.getTime(), periodStart.getTime()));
        const clampedEnd = new Date(Math.min(departure.getTime(), periodEnd.getTime() + MS_PER_DAY));

        // UTC ms advance, DST-safe
        for (let t = clampedStart.getTime(); t < clampedEnd.getTime(); t += MS_PER_DAY) {
          const dayStr = new Date(t).toISOString().split('T')[0];
          occupiedDays.add(dayStr);

          const dayMonth = dayStr.substring(0, 7);
          if (!monthOccupiedDays.has(dayMonth)) {
            monthOccupiedDays.set(dayMonth, new Set());
          }
          monthOccupiedDays.get(dayMonth)!.add(dayStr);
        }
      }
    });

    // tax totals are NOT prorated — tax liability attaches to the guest's
    // arrival (the taxable event) so this matches what the host remits.
    // Include only bookings whose arrival falls in the selected period.
    const arrivalInPeriod = arrivalInPeriodMap(bookings, from, to);
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

    const periodStart = new Date(from);
    const periodEnd = new Date(to);

    const totalNights = occupiedDays.size;
    const totalDays = Math.ceil(
      (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24) + 1
    );
    const blockedNights = sumBlockedNights(collectBlockedNights(blocks, from, to));
    const sellableDays = Math.max(0, totalDays - blockedNights);
    const occupancyRate = sellableDays > 0 ? totalNights / sellableDays : 0;
    const avgNightlyRate = totalNights > 0 ? totalRevenue / totalNights : 0;

    // enumerate every month in the selected range, not just months that had
    // bookings, so the chart shows explicit zeros for empty months instead of
    // a visual gap that readers might misinterpret as missing data.
    const sortedMonths = enumerateBuckets(from, to, 'month').map(({ key: month }) => {
      const data = monthlyData.get(month) || { revenue: 0, bookings: 0, nights: 0 };
      const [y, m] = month.split('-').map(Number);
      // denominator clipped to the user's window so edge months (e.g. Feb 20
      // through Mar 10) don't dilute occupancy with days outside the range.
      const daysInMonth = effectiveDaysInMonth(y, m - 1, from, to);
      // month-scoped block subtraction
      const monthStart = new Date(Date.UTC(y, m - 1, 1));
      const monthEndExcl = new Date(Date.UTC(y, m, 1));
      const fromExcl = new Date(new Date(to).getTime() + MS_PER_DAY);
      const effMonthStart = monthStart.getTime() > new Date(from).getTime() ? monthStart : new Date(from);
      const effMonthEndExcl = monthEndExcl.getTime() < fromExcl.getTime() ? monthEndExcl : fromExcl;
      const monthBlocked = sumBlockedNights(collectBlockedNightsExclusive(blocks, effMonthStart, effMonthEndExcl));
      const monthSellable = Math.max(0, daysInMonth - monthBlocked);
      const monthNights = monthOccupiedDays.get(month)?.size || 0;

      return {
        month,
        revenue: data.revenue,
        bookings: data.bookings,
        occupancy: monthSellable > 0 ? (monthNights / monthSellable) * 100 : 0
      };
    });
    
    const revenueByPlatform = Array.from(platformRevenue.entries())
      .map(([platform, revenue]) => ({
        platform,
        revenue,
        percentage: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0
      }))
      .sort((a, b) => b.revenue - a.revenue);
    
    const periodGuestKeys = new Set<string>();
    bookings.forEach(booking => {
      const key = booking.ownerrez_guest_id || booking.guest_name;
      if (key) periodGuestKeys.add(key);
    });

    const totalGuests = periodGuestKeys.size;

    const allTimePropertyBookings = await fetchAllRows(() =>
      supabase
        .from('bookings')
        .select('ownerrez_guest_id, guest_name')
        .eq('tenant_id', tenantId)
        .eq('property_id', propertyId)
        .neq('status', 'canceled')
        .order('id')
    );

    const allTimeCountMap = new Map<string, number>();
    allTimePropertyBookings.forEach(b => {
      const key = b.ownerrez_guest_id || b.guest_name;
      if (key) allTimeCountMap.set(key, (allTimeCountMap.get(key) || 0) + 1);
    });

    const repeatGuests = Array.from(periodGuestKeys).filter(key => (allTimeCountMap.get(key) || 0) > 1).length;
    
    const recentBookings = bookings
      .slice(0, 10)
      .map(booking => {
        const guestId = booking.ownerrez_guest_id
          ? `or_${booking.ownerrez_guest_id}`
          : `name_${(booking.guest_name || '').toLowerCase().trim()}`;

        return {
          id: booking.id,
          guestId,
          guestName: booking.guest_name,
          arrival: booking.arrival,
          departure: booking.departure,
          totalAmount: booking.total_amount,
          platform: normalizePlatform(booking.platform),
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
        active: property.active,
        ownerrezId: property.ownerrez_id || null
      },
      metrics: {
        totalRevenue,
        totalBookings: bookings?.length || 0,
        avgNightlyRate,
        occupancyRate,
        totalNights,
        totalDays,
        sellableDays,
        blockedNights,
        avgStayLength: bookings && bookings.length > 0 ? totalNights / bookings.length : 0,
        platformFees: combinedPlatformFees,
        taxes: totalTaxes,
        operatingExpenses: totalOperatingExpenses,
        netRevenue: totalRevenue - combinedPlatformFees - totalTaxes - totalOperatingExpenses
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