import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_MAX_ROWS, MS_PER_DAY } from '../constants';

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
  rate: number;
  bookedNights: number;
  availableNights: number;
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

async function fetchOverallOccupancy(
  supabase: SupabaseClient,
  tenantId: string,
  from: string,
  to: string,
  tagIds: string[] = []
): Promise<{ bookedNights: number; availableNights: number }> {
  const hasTagFilter = tagIds.length > 0;
  
  const { data: properties } = await supabase
    .from('properties')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('active', true);

  if (!properties || properties.length === 0) {
    return { bookedNights: 0, availableNights: 0 };
  }

  const propertyIds = properties.map(p => p.id);

  const endDate = new Date(to);
  const startDate = new Date(from);

  const totalDays = endDate >= startDate
    ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0;
  const totalAvailableNights = totalDays * properties.length;

  let bookingsQuery = supabase
    .from('bookings')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('property_id', propertyIds)
    .lte('arrival', to)
    .gte('departure', from)
    .neq('status', 'canceled')
    .limit(SUPABASE_MAX_ROWS);
  
  if (hasTagFilter) {
    const { data: taggedBookings } = await supabase
      .from('booking_tags')
      .select('booking_id')
      .in('tag_id', tagIds);
    
    if (taggedBookings && taggedBookings.length > 0) {
      const bookingIds = taggedBookings.map(tb => tb.booking_id);
      bookingsQuery = bookingsQuery.in('id', bookingIds);
    } else {
      return { bookedNights: 0, availableNights: totalAvailableNights };
    }
  }
  
  const { data: bookings } = await bookingsQuery;
  
  const countedPropertyDays = new Set<string>();
  if (bookings) {
    const periodStart = new Date(from);
    const periodEnd = new Date(to);

    for (const booking of bookings) {
      const arrivalDate = new Date(booking.arrival);
      const departureDate = new Date(booking.departure);

      const effectiveStart = new Date(Math.max(arrivalDate.getTime(), periodStart.getTime()));
      // periodEnd is an inclusive boundary; convert to exclusive for the < loop
      const effectiveEnd = new Date(Math.min(departureDate.getTime(), periodEnd.getTime() + MS_PER_DAY));

      let day = new Date(effectiveStart);
      while (day < effectiveEnd) {
        const key = `${booking.property_id}_${day.toISOString().split('T')[0]}`;
        countedPropertyDays.add(key);
        day.setDate(day.getDate() + 1);
      }
    }
  }
  const totalBookedNights = countedPropertyDays.size;
  
  return {
    bookedNights: totalBookedNights,
    availableNights: totalAvailableNights
  };
}

async function fetchPropertyOccupancy(
  supabase: SupabaseClient,
  tenantId: string,
  from: string,
  to: string,
  tagIds: string[] = []
): Promise<PropertyOccupancy[]> {
  const hasTagFilter = tagIds.length > 0;
  
  const { data: properties } = await supabase
    .from('properties')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('active', true);

  if (!properties || properties.length === 0) {
    return [];
  }

  const propertyIds = properties.map(p => p.id);

  const endDate = new Date(to);
  const startDate = new Date(from);
  const totalDays = endDate >= startDate
    ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0;

  let bookingsQuery = supabase
    .from('bookings')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('property_id', propertyIds)
    .lte('arrival', to)
    .gte('departure', from)
    .neq('status', 'canceled')
    .limit(SUPABASE_MAX_ROWS);

  if (hasTagFilter) {
    const { data: taggedBookings } = await supabase
      .from('booking_tags')
      .select('booking_id')
      .in('tag_id', tagIds);

    if (taggedBookings && taggedBookings.length > 0) {
      const bookingIds = taggedBookings.map(tb => tb.booking_id);
      bookingsQuery = bookingsQuery.in('id', bookingIds);
    } else {
      // No bookings match the tag filter — return all properties with 0 occupancy
      return properties.map(p => ({
        propertyId: p.id,
        propertyName: p.name,
        rate: 0,
        bookedNights: 0,
        availableNights: totalDays
      }));
    }
  }

  const { data: bookings } = await bookingsQuery;

  const propertyOccupancy: PropertyOccupancy[] = [];

  for (const property of properties) {
    const availableNights = totalDays;
    
    const occupiedDays = new Set<string>();
    if (bookings) {
      const propertyBookings = bookings.filter(b => b.property_id === property.id);
      for (const booking of propertyBookings) {
        const arrivalDate = new Date(booking.arrival);
        const departureDate = new Date(booking.departure);

        const effectiveStart = new Date(Math.max(arrivalDate.getTime(), startDate.getTime()));
        // endDate is an inclusive boundary; convert to exclusive for the < loop
        const effectiveEnd = new Date(Math.min(departureDate.getTime(), endDate.getTime() + MS_PER_DAY));

        let day = new Date(effectiveStart);
        while (day < effectiveEnd) {
          occupiedDays.add(day.toISOString().split('T')[0]);
          day.setDate(day.getDate() + 1);
        }
      }
    }
    const bookedNights = occupiedDays.size;
    
    propertyOccupancy.push({
      propertyId: property.id,
      propertyName: property.name,
      rate: calculateOccupancyRate(bookedNights, availableNights),
      bookedNights,
      availableNights
    });
  }
  
  return propertyOccupancy.sort((a, b) => b.rate - a.rate);
}

async function fetchMonthlyOccupancy(
  supabase: SupabaseClient,
  tenantId: string,
  from: string,
  to: string,
  tagIds: string[] = [],
  granularity: 'daily' | 'weekly' | 'monthly'
): Promise<MonthlyOccupancy[]> {
  const hasTagFilter = tagIds.length > 0;
  
  const { data: properties } = await supabase
    .from('properties')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('active', true);

  if (!properties || properties.length === 0) {
    return [];
  }

  const propertyIds = properties.map(p => p.id);
  const propertyCount = properties.length;

  let bookingsQuery = supabase
    .from('bookings')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('property_id', propertyIds)
    .lte('arrival', to)
    .gte('departure', from)
    .neq('status', 'canceled')
    .limit(SUPABASE_MAX_ROWS);

  if (hasTagFilter) {
    const { data: taggedBookings } = await supabase
      .from('booking_tags')
      .select('booking_id')
      .in('tag_id', tagIds);

    if (taggedBookings && taggedBookings.length > 0) {
      const bookingIds = taggedBookings.map(tb => tb.booking_id);
      bookingsQuery = bookingsQuery.in('id', bookingIds);
    } else {
      bookingsQuery = bookingsQuery.in('id', []);
    }
  }

  const { data: bookings } = await bookingsQuery;

  const periods = new Map<string, { bookedNights: number; availableNights: number }>();
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

    let periodAvailableNights = 0;

    const actualPeriodEnd = periodEnd > endDate ? endDate : periodEnd;

    if (periodStart <= actualPeriodEnd) {
      const periodNights = Math.ceil(
        (actualPeriodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;

      periodAvailableNights = periodNights * propertyCount;
    }

    periods.set(periodKey, { bookedNights: 0, availableNights: periodAvailableNights });

    if (granularity === 'daily') {
      currentDate.setDate(currentDate.getDate() + 1);
    } else if (granularity === 'weekly') {
      currentDate.setDate(currentDate.getDate() + 7);
    } else {
      // Advance to the 1st of the next month
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    }
  }
  
  // Track property-day pairs to avoid double-counting overlapping bookings
  const countedPropertyDays = new Set<string>();

  if (bookings) {
    for (const booking of bookings) {
      const arrivalDate = new Date(booking.arrival);
      const departureDate = new Date(booking.departure);

      let bookingDate = new Date(Math.max(arrivalDate.getTime(), startDate.getTime()));
      // endDate is an inclusive boundary; convert to exclusive for the < loop
      const bookingEnd = new Date(Math.min(departureDate.getTime(), endDate.getTime() + MS_PER_DAY));

      while (bookingDate < bookingEnd) {
        const dayKey = bookingDate.toISOString().split('T')[0];
        const propertyDayKey = `${booking.property_id}_${dayKey}`;

        if (!countedPropertyDays.has(propertyDayKey)) {
          countedPropertyDays.add(propertyDayKey);

          let periodKey: string;

          if (granularity === 'daily') {
            periodKey = dayKey;
          } else if (granularity === 'weekly') {
            const weekStart = new Date(bookingDate);
            weekStart.setDate(bookingDate.getDate() - bookingDate.getDay());
            periodKey = weekStart.toISOString().split('T')[0];
          } else {
            periodKey = `${bookingDate.getFullYear()}-${String(bookingDate.getMonth() + 1).padStart(2, '0')}`;
          }

          const period = periods.get(periodKey);
          if (period) {
            period.bookedNights++;
          }
        }

        bookingDate.setDate(bookingDate.getDate() + 1);
      }
    }
  }
  
  const result: MonthlyOccupancy[] = [];
  for (const [month, data] of periods) {
    result.push({
      month,
      rate: calculateOccupancyRate(data.bookedNights, data.availableNights),
      bookedNights: data.bookedNights,
      availableNights: data.availableNights
    });
  }
  
  return result.sort((a, b) => a.month.localeCompare(b.month));
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
    .select('*')
    .eq('tenant_id', tenantId)
    .in('property_id', propertyIds)
    .lte('arrival', to)
    .gte('departure', from)
    .neq('status', 'canceled')
    .limit(SUPABASE_MAX_ROWS);

  if (hasTagFilter) {
    const { data: taggedBookings } = await supabase
      .from('booking_tags')
      .select('booking_id')
      .in('tag_id', tagIds);

    if (taggedBookings && taggedBookings.length > 0) {
      const bookingIds = taggedBookings.map(tb => tb.booking_id);
      bookingsQuery = bookingsQuery.in('id', bookingIds);
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

export async function getOccupancyData(
  supabase: SupabaseClient,
  tenantId: string,
  from: string,
  to: string,
  tagIds: string[] = []
): Promise<OccupancyData> {
  const granularity = determineGranularity(from, to);
  
  const [overall, byProperty, byMonth] = await Promise.all([
    fetchOverallOccupancy(supabase, tenantId, from, to, tagIds),
    fetchPropertyOccupancy(supabase, tenantId, from, to, tagIds),
    fetchMonthlyOccupancy(supabase, tenantId, from, to, tagIds, granularity)
  ]);
  
  return {
    overall: calculateOccupancyRate(overall.bookedNights, overall.availableNights),
    byProperty,
    byMonth,
    bookedNights: overall.bookedNights,
    availableNights: overall.availableNights
  };
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
  maxDaysAhead: number = 60
): Promise<BookingGap[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + maxDaysAhead);
  
  // fetch properties
  const { data: properties } = await supabase
    .from('properties')
    .select('id, name, active')
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
    
    // check for gaps between bookings
    let lastDeparture: Date | null = null;

    for (const booking of propertyBookings) {
      const arrivalDate = new Date(booking.arrival);
      const departureDate = new Date(booking.departure);

      // if there's a gap between last departure and this arrival
      if (lastDeparture) {
        // Departure date is exclusive - property is available starting departure date
        const gapStart = new Date(lastDeparture);

        if (gapStart < arrivalDate) {
          const gapDays = Math.floor((arrivalDate.getTime() - gapStart.getTime()) / (1000 * 60 * 60 * 24));

          // Report gaps of 1+ days (even single-night gaps are valuable)
          if (gapDays >= 1) {
            const daysUntilGap = Math.floor((gapStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            const estimatedRevenueLoss = gapDays * 150; // default nightly rate

            let severity: BookingGap['severity'] = 'info';
            if (daysUntilGap <= 7 && gapDays >= 3) severity = 'critical';
            else if (daysUntilGap <= 14 || gapDays >= 4) severity = 'warning';

            gaps.push({
              propertyId: property.id,
              propertyName: property.name,
              gapStart: gapStart.toISOString().split('T')[0],
              gapEnd: new Date(arrivalDate.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              gapDays,
              daysUntilGap,
              estimatedRevenueLoss,
              severity
            });
          }
        }
      }

      lastDeparture = departureDate;
    }

    // check for gap from today to first booking
    if (lastDeparture === null && propertyBookings.length > 0) {
      const firstBooking = propertyBookings[0];
      const arrivalDate = new Date(firstBooking.arrival);

      if (today < arrivalDate) {
        const gapDays = Math.floor((arrivalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (gapDays >= 1) {
          const estimatedRevenueLoss = gapDays * 150; // default nightly rate

          let severity: BookingGap['severity'] = 'info';
          if (gapDays >= 7) severity = 'critical'; // no bookings for a week
          else if (gapDays >= 3) severity = 'warning';

          gaps.push({
            propertyId: property.id,
            propertyName: property.name,
            gapStart: today.toISOString().split('T')[0],
            gapEnd: new Date(arrivalDate.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            gapDays,
            daysUntilGap: 0, // current gap
            estimatedRevenueLoss,
            severity
          });
        }
      }
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
          const estimatedRevenueLoss = Math.min(gapDays, 14) * 150; // cap at 14 days, default nightly rate

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
        const estimatedRevenueLoss = Math.min(gapDays, 14) * 150; // default nightly rate

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