import { SupabaseClient } from '@supabase/supabase-js';

export interface PropertyMetrics {
  propertyId: string;
  propertyName: string;
  revenue: number;
  bookings: number;
  occupancyRate: number;
  avgNightlyRate: number;
  bookedNights: number;
  availableNights: number;
}

export async function getPropertyMetrics(
  supabase: SupabaseClient,
  tenantId: string,
  from: string,
  to: string,
  tagIds: string[] = []
): Promise<PropertyMetrics[]> {
  const hasTagFilter = tagIds.length > 0;

  const { data: properties } = await supabase
    .from('properties')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('active', true);

  if (!properties || properties.length === 0) {
    return [];
  }

  const { data: firstBookings } = await supabase
    .from('bookings')
    .select('property_id, arrival')
    .eq('tenant_id', tenantId)
    .neq('status', 'canceled')
    .order('arrival', { ascending: true });

  const firstBookingDates = new Map<string, Date | null>();
  if (firstBookings) {
    for (const property of properties) {
      const propertyBookings = firstBookings.filter(b => b.property_id === property.id);
      if (propertyBookings.length > 0) {
        firstBookingDates.set(property.id, new Date(propertyBookings[0].arrival));
      } else {
        firstBookingDates.set(property.id, null);
      }
    }
  }

  let bookingsQuery = supabase
    .from('bookings')
    .select('id, property_id, arrival, departure, total_amount')
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
      return properties.map(p => ({
        propertyId: p.id,
        propertyName: p.name,
        revenue: 0,
        bookings: 0,
        occupancyRate: 0,
        avgNightlyRate: 0,
        avgStayLength: 0,
        bookedNights: 0,
        availableNights: calculateAvailableNights(from, to, firstBookingDates.get(p.id) || null)
      }));
    }
  }

  const { data: bookings } = await bookingsQuery;

  const propertyMetricsMap = new Map<string, PropertyMetrics>();

  for (const property of properties) {
    const firstBookingDate = firstBookingDates.get(property.id) || null;
    const availableNights = calculateAvailableNights(from, to, firstBookingDate);
    
    propertyMetricsMap.set(property.id, {
      propertyId: property.id,
      propertyName: property.name,
      revenue: 0,
      bookings: 0,
      occupancyRate: 0,
      avgNightlyRate: 0,
      bookedNights: 0,
      availableNights
    });
  }

  if (bookings && bookings.length > 0) {
    for (const booking of bookings) {
      const metrics = propertyMetricsMap.get(booking.property_id);
      if (!metrics) continue;

      const arrivalDate = new Date(booking.arrival);
      const departureDate = new Date(booking.departure);
      const periodStart = new Date(from);
      const periodEnd = new Date(to);
      const today = new Date();

      const effectiveArrival = arrivalDate < periodStart ? periodStart : arrivalDate;
      const effectiveDeparture = departureDate > periodEnd ? periodEnd : 
                                  departureDate > today ? today : departureDate;
      
      if (effectiveArrival <= effectiveDeparture && effectiveArrival <= periodEnd && effectiveDeparture >= periodStart) {
        const nights = Math.ceil(
          (effectiveDeparture.getTime() - effectiveArrival.getTime()) / (1000 * 60 * 60 * 24)
        );

        metrics.revenue += booking.total_amount || 0;
        metrics.bookings++;
        metrics.bookedNights += nights;
      }
    }
  }

  const result: PropertyMetrics[] = [];
  for (const metrics of propertyMetricsMap.values()) {
    if (metrics.bookedNights > 0) {
      metrics.avgNightlyRate = metrics.revenue / metrics.bookedNights;
    }
    if (metrics.availableNights > 0) {
      metrics.occupancyRate = metrics.bookedNights / metrics.availableNights;
    }
    result.push(metrics);
  }

  return result.sort((a, b) => b.revenue - a.revenue);
}

function calculateAvailableNights(from: string, to: string, firstBookingDate: Date | null): number {
  const startDate = new Date(from);
  const endDate = new Date(to);
  const today = new Date();
  
  if (!firstBookingDate || firstBookingDate > endDate) {
    return 0;
  }
  
  let effectiveStart = startDate;
  if (firstBookingDate > startDate) {
    effectiveStart = firstBookingDate;
  }
  
  const effectiveEnd = endDate > today ? today : endDate;
  
  if (effectiveStart > effectiveEnd) {
    return 0;
  }
  
  const nights = Math.ceil(
    (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;
  
  return Math.max(0, nights);
}

export async function getPropertiesData(
  supabase: SupabaseClient,
  tenantId: string,
  from: string,
  to: string,
  tagIds: string[] = [],
  comparisonFrom?: string,
  comparisonTo?: string
) {
  const currentMetrics = await getPropertyMetrics(supabase, tenantId, from, to, tagIds);
  
  if (comparisonFrom && comparisonTo) {
    const previousMetrics = await getPropertyMetrics(supabase, tenantId, comparisonFrom, comparisonTo, tagIds);
    
    return {
      properties: currentMetrics,
      previousProperties: previousMetrics,
      view: 'properties'
    };
  }
  
  return {
    properties: currentMetrics,
    view: 'properties'
  };
}