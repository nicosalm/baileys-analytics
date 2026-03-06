import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_MAX_ROWS } from '../constants';
import { getExpensesWithTemplateFallback } from './expense-utils';

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

export interface PropertyProfitability {
  propertyId: string;
  propertyName: string;
  grossRevenue: number;
  platformFees: number;
  taxes: number;
  operatingExpenses: number;
  netRevenue: number;
}

export interface PropertyPlatformMix {
  propertyId: string;
  propertyName: string;
  platforms: { platform: string; bookings: number; revenue: number }[];
}

export async function getPropertyMetrics(
  supabase: SupabaseClient,
  tenantId: string,
  from: string,
  to: string,
  tagIds: string[] = [],
  filterPropertyIds: string[] = []
): Promise<PropertyMetrics[]> {
  const hasTagFilter = tagIds.length > 0;

  let propertiesQuery = supabase
    .from('properties')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('active', true);

  if (filterPropertyIds.length > 0) {
    propertiesQuery = propertiesQuery.in('id', filterPropertyIds);
  }

  const { data: properties } = await propertiesQuery;

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

export async function getPropertyProfitability(
  supabase: SupabaseClient,
  tenantId: string,
  from: string,
  to: string,
  tagIds: string[] = [],
  filterPropertyIds: string[] = []
): Promise<PropertyProfitability[]> {
  let propertiesQuery = supabase
    .from('properties')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('active', true);

  if (filterPropertyIds.length > 0) {
    propertiesQuery = propertiesQuery.in('id', filterPropertyIds);
  }

  const { data: properties } = await propertiesQuery;

  if (!properties || properties.length === 0) return [];

  const propertyIds = properties.map(p => p.id);

  // fetch bookings with fee columns
  let bookingsQuery = supabase
    .from('bookings')
    .select('id, property_id, total_amount, host_service_fee, guest_listing_site_fee')
    .eq('tenant_id', tenantId)
    .lte('arrival', to)
    .gte('departure', from)
    .neq('status', 'canceled')
    .limit(SUPABASE_MAX_ROWS);

  if (tagIds.length > 0) {
    const { data: taggedBookings } = await supabase
      .from('booking_tags')
      .select('booking_id')
      .in('tag_id', tagIds);
    if (taggedBookings && taggedBookings.length > 0) {
      bookingsQuery = bookingsQuery.in('id', taggedBookings.map(tb => tb.booking_id));
    } else {
      return properties.map(p => ({
        propertyId: p.id, propertyName: p.name,
        grossRevenue: 0, platformFees: 0, taxes: 0, operatingExpenses: 0, netRevenue: 0
      }));
    }
  }

  const { data: bookings } = await bookingsQuery;

  // aggregate per property
  const propMap = new Map<string, { revenue: number; fees: number; bookingIds: string[] }>();
  for (const p of properties) {
    propMap.set(p.id, { revenue: 0, fees: 0, bookingIds: [] });
  }
  for (const b of bookings || []) {
    const entry = propMap.get(b.property_id);
    if (!entry) continue;
    entry.revenue += b.total_amount || 0;
    entry.fees += (b.host_service_fee || 0) + (b.guest_listing_site_fee || 0);
    entry.bookingIds.push(b.id);
  }

  // taxes from booking_charges
  const allBookingIds = (bookings || []).map(b => b.id);
  const taxByProperty = new Map<string, number>();
  if (allBookingIds.length > 0) {
    // need to join back to bookings for property_id
    const { data: charges } = await supabase
      .from('booking_charges')
      .select('booking_id, amount')
      .in('booking_id', allBookingIds)
      .eq('type', 'tax')
      .limit(SUPABASE_MAX_ROWS);

    // build booking->property lookup
    const bookingPropertyMap = new Map<string, string>();
    for (const b of bookings || []) {
      bookingPropertyMap.set(b.id, b.property_id);
    }
    for (const c of charges || []) {
      const propId = bookingPropertyMap.get(c.booking_id);
      if (propId) {
        taxByProperty.set(propId, (taxByProperty.get(propId) || 0) + (parseFloat(c.amount) || 0));
      }
    }
  }

  // operating expenses per property
  const expensesByProperty = new Map<string, number>();
  for (const propId of propertyIds) {
    const expenses = await getExpensesWithTemplateFallback(supabase, tenantId, from, to, propertyIds, propId);
    expensesByProperty.set(propId, expenses.reduce((sum, e) => sum + e.amount, 0));
  }

  return properties.map(p => {
    const entry = propMap.get(p.id)!;
    const taxes = taxByProperty.get(p.id) || 0;
    const opex = expensesByProperty.get(p.id) || 0;
    return {
      propertyId: p.id,
      propertyName: p.name,
      grossRevenue: entry.revenue,
      platformFees: entry.fees,
      taxes,
      operatingExpenses: opex,
      netRevenue: entry.revenue - entry.fees - taxes - opex
    };
  }).sort((a, b) => b.netRevenue - a.netRevenue);
}

export async function getPropertyPlatformMix(
  supabase: SupabaseClient,
  tenantId: string,
  from: string,
  to: string,
  tagIds: string[] = [],
  filterPropertyIds: string[] = []
): Promise<PropertyPlatformMix[]> {
  let propertiesQuery = supabase
    .from('properties')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('active', true);

  if (filterPropertyIds.length > 0) {
    propertiesQuery = propertiesQuery.in('id', filterPropertyIds);
  }

  const { data: properties } = await propertiesQuery;

  if (!properties || properties.length === 0) return [];

  let bookingsQuery = supabase
    .from('bookings')
    .select('property_id, platform, total_amount')
    .eq('tenant_id', tenantId)
    .lte('arrival', to)
    .gte('departure', from)
    .neq('status', 'canceled')
    .limit(SUPABASE_MAX_ROWS);

  if (tagIds.length > 0) {
    const { data: taggedBookings } = await supabase
      .from('booking_tags')
      .select('booking_id')
      .in('tag_id', tagIds);
    if (taggedBookings && taggedBookings.length > 0) {
      bookingsQuery = bookingsQuery.in('id', taggedBookings.map(tb => tb.booking_id));
    } else {
      return properties.map(p => ({ propertyId: p.id, propertyName: p.name, platforms: [] }));
    }
  }

  const { data: bookings } = await bookingsQuery;

  const propMap = new Map<string, Map<string, { bookings: number; revenue: number }>>();
  for (const p of properties) {
    propMap.set(p.id, new Map());
  }
  for (const b of bookings || []) {
    const platforms = propMap.get(b.property_id);
    if (!platforms) continue;
    const platform = b.platform || 'Unassigned';
    const entry = platforms.get(platform) || { bookings: 0, revenue: 0 };
    entry.bookings++;
    entry.revenue += b.total_amount || 0;
    platforms.set(platform, entry);
  }

  return properties.map(p => ({
    propertyId: p.id,
    propertyName: p.name,
    platforms: Array.from(propMap.get(p.id)!.entries())
      .map(([platform, data]) => ({ platform, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
  })).sort((a, b) => {
    const aRev = a.platforms.reduce((s, p) => s + p.revenue, 0);
    const bRev = b.platforms.reduce((s, p) => s + p.revenue, 0);
    return bRev - aRev;
  });
}

export async function getPropertiesData(
  supabase: SupabaseClient,
  tenantId: string,
  from: string,
  to: string,
  tagIds: string[] = [],
  comparisonFrom?: string,
  comparisonTo?: string,
  filterPropertyIds: string[] = []
) {
  const [currentMetrics, profitability, platformMix] = await Promise.all([
    getPropertyMetrics(supabase, tenantId, from, to, tagIds, filterPropertyIds),
    getPropertyProfitability(supabase, tenantId, from, to, tagIds, filterPropertyIds),
    getPropertyPlatformMix(supabase, tenantId, from, to, tagIds, filterPropertyIds)
  ]);

  if (comparisonFrom && comparisonTo) {
    const previousMetrics = await getPropertyMetrics(supabase, tenantId, comparisonFrom, comparisonTo, tagIds, filterPropertyIds);

    return {
      properties: currentMetrics,
      previousProperties: previousMetrics,
      profitability,
      platformMix,
      view: 'properties'
    };
  }

  return {
    properties: currentMetrics,
    profitability,
    platformMix,
    view: 'properties'
  };
}