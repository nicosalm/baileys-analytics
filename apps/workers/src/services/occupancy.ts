import { SupabaseClient } from '@supabase/supabase-js';
import { getActiveSeasons } from './seasons';

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
  
  const { data: firstBookings } = await supabase
    .from('bookings')
    .select('property_id, arrival')
    .eq('tenant_id', tenantId)
    .neq('status', 'canceled')
    .order('arrival', { ascending: true });
  
  const firstBookingDates = new Map<string, Date>();
  if (firstBookings) {
    for (const property of properties) {
      const propertyBookings = firstBookings.filter(b => b.property_id === property.id);
      if (propertyBookings.length > 0) {
        firstBookingDates.set(property.id, new Date(propertyBookings[0].arrival));
      }
    }
  }
  
  let totalAvailableNights = 0;
  const today = new Date();
  const endDate = new Date(to);
  const startDate = new Date(from);
  
  for (const property of properties) {
    const firstBooking = firstBookingDates.get(property.id);
    if (!firstBooking || firstBooking > endDate) {
      continue;
    }
    
    const effectiveStart = firstBooking > startDate ? firstBooking : startDate;
    const effectiveEnd = endDate > today ? today : endDate;
    
    if (effectiveStart <= effectiveEnd) {
      const nights = Math.ceil(
        (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;
      totalAvailableNights += Math.max(0, nights);
    }
  }
  
  let bookingsQuery = supabase
    .from('bookings')
    .select('*')
    .eq('tenant_id', tenantId)
    .lte('arrival', to)
    .gte('departure', from)
    .neq('status', 'canceled');
  
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
  
  let totalBookedNights = 0;
  if (bookings) {
    for (const booking of bookings) {
      const arrivalDate = new Date(booking.arrival);
      const departureDate = new Date(booking.departure);
      const periodStart = new Date(from);
      const periodEnd = new Date(to);
      
      const effectiveArrival = arrivalDate < periodStart ? periodStart : arrivalDate;
      const effectiveDeparture = departureDate > periodEnd ? periodEnd : 
                                  departureDate > today ? today : departureDate;
      
      if (effectiveArrival <= effectiveDeparture && effectiveArrival <= periodEnd && effectiveDeparture >= periodStart) {
        const nights = Math.ceil(
          (effectiveDeparture.getTime() - effectiveArrival.getTime()) / (1000 * 60 * 60 * 24)
        );
        totalBookedNights += nights;
      }
    }
  }
  
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
  
  // Get first booking dates
  const { data: firstBookings } = await supabase
    .from('bookings')
    .select('property_id, arrival')
    .eq('tenant_id', tenantId)
    .neq('status', 'canceled')
    .order('arrival', { ascending: true });
  
  const firstBookingDates = new Map<string, Date>();
  if (firstBookings) {
    for (const property of properties) {
      const propertyBookings = firstBookings.filter(b => b.property_id === property.id);
      if (propertyBookings.length > 0) {
        firstBookingDates.set(property.id, new Date(propertyBookings[0].arrival));
      }
    }
  }
  
  // Get bookings
  let bookingsQuery = supabase
    .from('bookings')
    .select('*')
    .eq('tenant_id', tenantId)
    .lte('arrival', to)
    .gte('departure', from)
    .neq('status', 'canceled');
  
  if (hasTagFilter) {
    const { data: taggedBookings } = await supabase
      .from('booking_tags')
      .select('booking_id')
      .in('tag_id', tagIds);
    
    if (taggedBookings && taggedBookings.length > 0) {
      const bookingIds = taggedBookings.map(tb => tb.booking_id);
      bookingsQuery = bookingsQuery.in('id', bookingIds);
    }
  }
  
  const { data: bookings } = await bookingsQuery;
  
  // Calculate occupancy for each property
  const propertyOccupancy: PropertyOccupancy[] = [];
  const today = new Date();
  const endDate = new Date(to);
  const startDate = new Date(from);
  
  for (const property of properties) {
    const firstBooking = firstBookingDates.get(property.id);
    let availableNights = 0;
    
    if (firstBooking && firstBooking <= endDate) {
      const effectiveStart = firstBooking > startDate ? firstBooking : startDate;
      const effectiveEnd = endDate > today ? today : endDate;
      
      if (effectiveStart <= effectiveEnd) {
        availableNights = Math.ceil(
          (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1;
      }
    }
    
    let bookedNights = 0;
    if (bookings) {
      const propertyBookings = bookings.filter(b => b.property_id === property.id);
      for (const booking of propertyBookings) {
        const arrivalDate = new Date(booking.arrival);
        const departureDate = new Date(booking.departure);
        
        const effectiveArrival = arrivalDate < startDate ? startDate : arrivalDate;
        const effectiveDeparture = departureDate > endDate ? endDate : 
                                    departureDate > today ? today : departureDate;
        
        if (effectiveArrival <= effectiveDeparture && effectiveArrival <= endDate && effectiveDeparture >= startDate) {
          const nights = Math.ceil(
            (effectiveDeparture.getTime() - effectiveArrival.getTime()) / (1000 * 60 * 60 * 24)
          );
          bookedNights += nights;
        }
      }
    }
    
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
  
  // Get active properties count
  const { data: properties } = await supabase
    .from('properties')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('active', true);
  
  if (!properties || properties.length === 0) {
    return [];
  }
  
  // Get first booking dates
  const { data: firstBookings } = await supabase
    .from('bookings')
    .select('property_id, arrival')
    .eq('tenant_id', tenantId)
    .neq('status', 'canceled')
    .order('arrival', { ascending: true });
  
  const firstBookingDates = new Map<string, Date>();
  if (firstBookings) {
    for (const property of properties) {
      const propertyBookings = firstBookings.filter(b => b.property_id === property.id);
      if (propertyBookings.length > 0) {
        firstBookingDates.set(property.id, new Date(propertyBookings[0].arrival));
      }
    }
  }
  
  // Get bookings
  let bookingsQuery = supabase
    .from('bookings')
    .select('*')
    .eq('tenant_id', tenantId)
    .lte('arrival', to)
    .gte('departure', from)
    .neq('status', 'canceled');
  
  if (hasTagFilter) {
    const { data: taggedBookings } = await supabase
      .from('booking_tags')
      .select('booking_id')
      .in('tag_id', tagIds);
    
    if (taggedBookings && taggedBookings.length > 0) {
      const bookingIds = taggedBookings.map(tb => tb.booking_id);
      bookingsQuery = bookingsQuery.in('id', bookingIds);
    }
  }
  
  const { data: bookings } = await bookingsQuery;
  
  // Generate time periods based on granularity
  const periods = new Map<string, { bookedNights: number; availableNights: number }>();
  const startDate = new Date(from);
  const endDate = new Date(to);
  const today = new Date();
  
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    let periodKey: string;
    let periodEnd: Date;
    
    if (granularity === 'daily') {
      periodKey = currentDate.toISOString().split('T')[0];
      periodEnd = new Date(currentDate);
    } else if (granularity === 'weekly') {
      // Week starts on Sunday
      const weekStart = new Date(currentDate);
      weekStart.setDate(currentDate.getDate() - currentDate.getDay());
      periodKey = weekStart.toISOString().split('T')[0];
      periodEnd = new Date(weekStart);
      periodEnd.setDate(weekStart.getDate() + 6);
    } else {
      periodKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      periodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    }
    
    // Calculate available nights for this period
    let periodAvailableNights = 0;
    for (const property of properties) {
      const firstBooking = firstBookingDates.get(property.id);
      if (!firstBooking || firstBooking > periodEnd) continue;
      
      const effectiveStart = firstBooking > currentDate ? firstBooking : currentDate;
      const effectiveEnd = periodEnd > today ? today : periodEnd;
      
      if (effectiveStart <= effectiveEnd) {
        const nights = Math.ceil(
          (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1;
        periodAvailableNights += nights;
      }
    }
    
    periods.set(periodKey, { bookedNights: 0, availableNights: periodAvailableNights });
    
    // Move to next period
    if (granularity === 'daily') {
      currentDate.setDate(currentDate.getDate() + 1);
    } else if (granularity === 'weekly') {
      currentDate.setDate(currentDate.getDate() + 7);
    } else {
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
  }
  
  // Calculate booked nights for each period
  if (bookings) {
    for (const booking of bookings) {
      const arrivalDate = new Date(booking.arrival);
      const departureDate = new Date(booking.departure);
      
      let bookingDate = new Date(Math.max(arrivalDate.getTime(), startDate.getTime()));
      const bookingEnd = new Date(Math.min(departureDate.getTime(), endDate.getTime(), today.getTime()));
      
      while (bookingDate < bookingEnd) {
        let periodKey: string;
        
        if (granularity === 'daily') {
          periodKey = bookingDate.toISOString().split('T')[0];
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
        
        bookingDate.setDate(bookingDate.getDate() + 1);
      }
    }
  }
  
  // Convert to array and calculate rates
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
  
  // Get active properties count
  const { data: properties } = await supabase
    .from('properties')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('active', true);
  
  if (!properties || properties.length === 0) {
    return [];
  }
  
  const totalProperties = properties.length;
  
  // Get bookings
  let bookingsQuery = supabase
    .from('bookings')
    .select('*')
    .eq('tenant_id', tenantId)
    .lte('arrival', to)
    .gte('departure', from)
    .neq('status', 'canceled');
  
  if (hasTagFilter) {
    const { data: taggedBookings } = await supabase
      .from('booking_tags')
      .select('booking_id')
      .in('tag_id', tagIds);
    
    if (taggedBookings && taggedBookings.length > 0) {
      const bookingIds = taggedBookings.map(tb => tb.booking_id);
      bookingsQuery = bookingsQuery.in('id', bookingIds);
    }
  }
  
  const { data: bookings } = await bookingsQuery;
  
  // Calculate daily occupancy
  const dailyOccupancy: DailyOccupancy[] = [];
  const startDate = new Date(from);
  const endDate = new Date(to);
  const today = new Date();
  
  let currentDate = new Date(startDate);
  while (currentDate <= endDate && currentDate <= today) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const bookedProperties = new Set<string>();
    
    if (bookings) {
      for (const booking of bookings) {
        const arrivalDate = new Date(booking.arrival);
        const departureDate = new Date(booking.departure);
        
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