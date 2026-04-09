import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_MAX_ROWS } from '../constants';
import { getBookingIdsForTags } from '../utils/tag-filter';

export interface OccupancyData {
  overall: number;
  byProperty: PropertyOccupancy[];
  byMonth: MonthlyOccupancy[];
  bookedNights: number;
  availableNights: number;
}

export interface PropertyOccupancy {
  propertyId: string;
  propertyName: string;
  propertyCode: string | null;
  rate: number;
  bookedNights: number;
  availableNights: number;
  avgNightlyRate: number;
}

export interface MonthlyOccupancy {
  month: string;
  rate: number;
  bookedNights: number;
  availableNights: number;
}

export interface DailyOccupancy {
  date: string;
  occupancyRate: number;
  bookedProperties: number;
  totalProperties: number;
}

function calculateOccupancyRate(bookedNights: number, availableNights: number): number {
  if (availableNights === 0) return 0;
  return bookedNights / availableNights;
}

function determineGranularity(from: string, to: string): 'daily' | 'weekly' | 'monthly' {
  const startDate = new Date(from);
  const endDate = new Date(to);
  const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff <= 60) return 'daily';
  if (daysDiff <= 180) return 'weekly';
  return 'monthly';
}

// compute available nights per period (date math only, no data needed)
function computePeriodAvailableNights(
  propertyCount: number,
  from: string,
  to: string,
  granularity: 'daily' | 'weekly' | 'monthly'
): Map<string, number> {
  const periods = new Map<string, number>();
  const startDate = new Date(from);
  const endDate = new Date(to);

  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    let periodKey: string;
    let periodStart: Date;
    let periodEnd: Date;

    if (granularity === 'daily') {
      periodKey = currentDate.toISOString().split('T')[0];
      periodStart = new Date(currentDate);
      periodEnd = new Date(currentDate);
    } else if (granularity === 'weekly') {
      const weekStart = new Date(currentDate);
      weekStart.setDate(currentDate.getDate() - currentDate.getDay());
      periodKey = weekStart.toISOString().split('T')[0];
      periodStart = weekStart < startDate ? new Date(startDate) : new Date(weekStart);
      periodEnd = new Date(weekStart);
      periodEnd.setDate(weekStart.getDate() + 6);
    } else {
      periodKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      periodStart = monthStart < startDate ? new Date(startDate) : monthStart;
      periodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    }

    const actualPeriodEnd = periodEnd > endDate ? endDate : periodEnd;

    if (periodStart <= actualPeriodEnd) {
      const periodNights = Math.ceil(
        (actualPeriodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;
      periods.set(periodKey, periodNights * propertyCount);
    } else {
      periods.set(periodKey, 0);
    }

    if (granularity === 'daily') {
      currentDate.setDate(currentDate.getDate() + 1);
    } else if (granularity === 'weekly') {
      currentDate.setDate(currentDate.getDate() + 7);
    } else {
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    }
  }

  return periods;
}

export async function getOccupancyData(
  supabase: SupabaseClient,
  tenantId: string,
  from: string,
  to: string,
  tagIds: string[] = [],
  filterPropertyIds: string[] = []
): Promise<OccupancyData> {
  let propertiesQuery = supabase
    .from('properties')
    .select('id, name, internal_code')
    .eq('tenant_id', tenantId)
    .eq('active', true);

  if (filterPropertyIds.length > 0) {
    propertiesQuery = propertiesQuery.in('id', filterPropertyIds);
  }

  const { data: properties } = await propertiesQuery;

  if (!properties || properties.length === 0) {
    return { overall: 0, byProperty: [], byMonth: [], bookedNights: 0, availableNights: 0 };
  }

  const propertyIds = properties.map(p => p.id);
  const hasTagFilter = tagIds.length > 0;

  let bookingIdFilter: string[] | null = null;
  if (hasTagFilter) {
    bookingIdFilter = await getBookingIdsForTags(supabase, tenantId, tagIds);

    if (!bookingIdFilter) {
      const endDate = new Date(to);
      const startDate = new Date(from);
      const totalDays = endDate >= startDate
        ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
        : 0;
      const totalAvailableNights = totalDays * properties.length;

      return {
        overall: 0,
        byProperty: properties.map(p => ({
          propertyId: p.id,
          propertyName: p.name,
          propertyCode: p.internal_code || null,
          rate: 0,
          bookedNights: 0,
          availableNights: totalDays,
          avgNightlyRate: 0
        })),
        byMonth: [],
        bookedNights: 0,
        availableNights: totalAvailableNights
      };
    }
  }

  const granularity = determineGranularity(from, to);

  // all three occupancy computations via SQL RPCs in parallel
  const rpcParams = {
    p_tenant_id: tenantId,
    p_from: from,
    p_to: to,
    p_property_ids: propertyIds,
    p_booking_ids: bookingIdFilter,
  };

  const [overallResult, propertyResult, periodicResult] = await Promise.all([
    supabase.rpc('get_overall_occupancy', rpcParams),
    supabase.rpc('get_property_occupancy', rpcParams),
    supabase.rpc('get_periodic_occupancy', { ...rpcParams, p_granularity: granularity }),
  ]);

  // overall
  const overallRow = overallResult.data?.[0] ?? { booked_nights: 0, available_nights: 0 };
  const bookedNights = Number(overallRow.booked_nights);
  const availableNights = Number(overallRow.available_nights);

  // per-property: merge RPC results with property metadata
  const propertyOccMap = new Map<string, { booked_nights: number; revenue: number }>();
  for (const row of propertyResult.data ?? []) {
    propertyOccMap.set(row.property_id, {
      booked_nights: Number(row.booked_nights),
      revenue: Number(row.revenue ?? 0),
    });
  }

  const endDate = new Date(to);
  const startDate = new Date(from);
  const totalDays = endDate >= startDate
    ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0;

  const byProperty: PropertyOccupancy[] = properties.map(p => {
    const occ = propertyOccMap.get(p.id);
    const propBookedNights = occ?.booked_nights ?? 0;
    const propRevenue = occ?.revenue ?? 0;
    return {
      propertyId: p.id,
      propertyName: p.name,
      propertyCode: p.internal_code || null,
      rate: calculateOccupancyRate(propBookedNights, totalDays),
      bookedNights: propBookedNights,
      availableNights: totalDays,
      avgNightlyRate: propBookedNights > 0 ? propRevenue / propBookedNights : 0,
    };
  }).sort((a, b) => b.rate - a.rate);

  // periodic: merge RPC booked_nights with JS-computed available nights
  const periodAvailable = computePeriodAvailableNights(properties.length, from, to, granularity);
  const periodicMap = new Map<string, number>();
  for (const row of periodicResult.data ?? []) {
    periodicMap.set(row.period, Number(row.booked_nights));
  }

  const byMonth: MonthlyOccupancy[] = [];
  for (const [month, avail] of periodAvailable) {
    const booked = periodicMap.get(month) ?? 0;
    byMonth.push({
      month,
      rate: calculateOccupancyRate(booked, avail),
      bookedNights: booked,
      availableNights: avail,
    });
  }

  return {
    overall: calculateOccupancyRate(bookedNights, availableNights),
    byProperty,
    byMonth,
    bookedNights,
    availableNights
  };
}

async function fetchDailyOccupancy(
  supabase: SupabaseClient,
  tenantId: string,
  from: string,
  to: string,
  tagIds: string[] = []
): Promise<DailyOccupancy[]> {
  const hasTagFilter = tagIds.length > 0;

  const { data: properties } = await supabase
    .from('properties')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('active', true);

  if (!properties || properties.length === 0) {
    return [];
  }

  const totalProperties = properties.length;
  const propertyIds = properties.map(p => p.id);

  let bookingsQuery = supabase
    .from('bookings')
    .select('property_id, arrival, departure')
    .eq('tenant_id', tenantId)
    .in('property_id', propertyIds)
    .lte('arrival', to)
    .gte('departure', from)
    .neq('status', 'canceled')
    .limit(SUPABASE_MAX_ROWS);

  if (hasTagFilter) {
    const matchedBookingIds = await getBookingIdsForTags(supabase, tenantId, tagIds);
    if (matchedBookingIds) {
      bookingsQuery = bookingsQuery.in('id', matchedBookingIds);
    } else {
      bookingsQuery = bookingsQuery.in('id', []);
    }
  }

  const { data: bookings } = await bookingsQuery;

  const dailyOccupancy: DailyOccupancy[] = [];
  const startDate = new Date(from);
  const endDate = new Date(to);

  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const bookedProperties = new Set<string>();

    if (bookings) {
      for (const booking of bookings) {
        const arrivalDate = new Date(booking.arrival);
        const departureDate = new Date(booking.departure);

        // Departure date is exclusive (checkout day - property becomes available)
        if (currentDate >= arrivalDate && currentDate < departureDate) {
          bookedProperties.add(booking.property_id);
        }
      }
    }

    dailyOccupancy.push({
      date: dateStr,
      occupancyRate: totalProperties > 0 ? bookedProperties.size / totalProperties : 0,
      bookedProperties: bookedProperties.size,
      totalProperties
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dailyOccupancy;
}

export async function getDailyOccupancyData(
  supabase: SupabaseClient,
  tenantId: string,
  from: string,
  to: string,
  tagIds: string[] = []
): Promise<DailyOccupancy[]> {
  return fetchDailyOccupancy(supabase, tenantId, from, to, tagIds);
}

export interface BookingGap {
  propertyId: string;
  propertyName: string;
  gapStart: string;
  gapEnd: string;
  gapDays: number;
  daysUntilGap: number;
  estimatedRevenueLoss: number;
  severity: 'critical' | 'warning' | 'info';
}

export async function detectBookingGaps(
  supabase: SupabaseClient,
  tenantId: string,
  maxDaysAhead: number = 60,
  propertyRates: Map<string, number> = new Map()
): Promise<BookingGap[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + maxDaysAhead);

  // fetch properties
  const { data: properties } = await supabase
    .from('properties')
    .select('id, name, internal_code')
    .eq('tenant_id', tenantId);

  if (!properties || properties.length === 0) {
    return [];
  }

  // fetch bookings for the period
  const { data: bookings } = await supabase
    .from('bookings')
    .select('property_id, arrival, departure')
    .eq('tenant_id', tenantId)
    .gte('arrival', today.toISOString())
    .lte('arrival', endDate.toISOString())
    .neq('status', 'canceled')
    .order('property_id', { ascending: true })
    .order('arrival', { ascending: true })
    .limit(SUPABASE_MAX_ROWS);

  const gaps: BookingGap[] = [];

  for (const property of properties) {
    const propertyBookings = bookings?.filter(b => b.property_id === property.id) || [];

    // check for gaps between bookings. the first iteration uses `today` as
    // the "last departure" so a property whose earliest upcoming booking is
    // weeks or months out still surfaces as a current gap.
    let lastDeparture: Date | null = null;

    for (const booking of propertyBookings) {
      const arrivalDate = new Date(booking.arrival);
      const departureDate = new Date(booking.departure);

      // gap source: either the previous booking's departure, or today for the
      // very first booking in this property's list.
      const gapStart = lastDeparture ? new Date(lastDeparture) : new Date(today);
      const isFirstGap = lastDeparture === null;

      if (gapStart < arrivalDate) {
        const gapDays = Math.floor((arrivalDate.getTime() - gapStart.getTime()) / (1000 * 60 * 60 * 24));

        // report gaps of 1+ days (even single-night gaps are valuable)
        if (gapDays >= 1) {
          const daysUntilGap = Math.floor((gapStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          const propertyRate = propertyRates.get(property.id) || 0;
          const estimatedRevenueLoss = gapDays * propertyRate;

          // severity thresholds: the first (current) gap is more urgent since
          // the property is already vacant
          let severity: BookingGap['severity'] = 'info';
          if (isFirstGap) {
            if (gapDays >= 7) severity = 'critical';
            else if (gapDays >= 3) severity = 'warning';
          } else {
            if (daysUntilGap <= 7 && gapDays >= 3) severity = 'critical';
            else if (daysUntilGap <= 14 || gapDays >= 4) severity = 'warning';
          }

          gaps.push({
            propertyId: property.id,
            propertyName: property.name,
            gapStart: gapStart.toISOString().split('T')[0],
            gapEnd: new Date(arrivalDate.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            gapDays,
            daysUntilGap: Math.max(0, daysUntilGap),
            estimatedRevenueLoss,
            severity
          });
        }
      }

      lastDeparture = departureDate;
    }

    // check for gap after last booking until end date
    if (lastDeparture) {
      // Departure date is exclusive - property is available starting departure date
      const finalGapStart = new Date(lastDeparture);

      if (finalGapStart < endDate) {
        const gapDays = Math.floor((endDate.getTime() - finalGapStart.getTime()) / (1000 * 60 * 60 * 24));

        // Report end gaps of 3+ days (longer threshold since this extends into future)
        if (gapDays >= 3) {
          const daysUntilGap = Math.floor((finalGapStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          const propertyRate = propertyRates.get(property.id) || 0;
          const estimatedRevenueLoss = Math.min(gapDays, 14) * propertyRate;

          let severity: BookingGap['severity'] = 'info';
          if (daysUntilGap <= 0) severity = 'critical'; // current gap
          else if (daysUntilGap <= 7) severity = 'warning';

          gaps.push({
            propertyId: property.id,
            propertyName: property.name,
            gapStart: finalGapStart.toISOString().split('T')[0],
            gapEnd: new Date(endDate.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            gapDays: Math.min(gapDays, 14), // cap display at 14 days
            daysUntilGap,
            estimatedRevenueLoss,
            severity
          });
        }
      }
    } else if (propertyBookings.length === 0) {
      // Property has no bookings at all in the period
      const gapDays = Math.floor((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (gapDays >= 3) {
        const propertyRate = propertyRates.get(property.id) || 0;
        const estimatedRevenueLoss = Math.min(gapDays, 14) * propertyRate;

        gaps.push({
          propertyId: property.id,
          propertyName: property.name,
          gapStart: today.toISOString().split('T')[0],
          gapEnd: new Date(endDate.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          gapDays: Math.min(gapDays, 14),
          daysUntilGap: 0,
          estimatedRevenueLoss,
          severity: 'critical' // No bookings at all is critical
        });
      }
    }
  }

  return gaps.sort((a, b) => a.daysUntilGap - b.daysUntilGap);
}
