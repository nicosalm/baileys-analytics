import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_MAX_ROWS } from '../constants';
import { getExpensesWithTemplateFallback } from './expense-utils';
import { normalizePlatform } from '../utils/platform';

export interface PropertyMetrics {
  propertyId: string;
  propertyName: string;
  propertyCode: string | null;
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
  propertyCode: string | null;
  grossRevenue: number;
  platformFees: number;
  taxes: number;
  operatingExpenses: number;
  netRevenue: number;
}

export interface PropertyPlatformMix {
  propertyId: string;
  propertyName: string;
  propertyCode: string | null;
  platforms: { platform: string; bookings: number; revenue: number }[];
}

interface PropertyInfo {
  id: string;
  name: string;
  internal_code: string | null;
}

interface BookingRow {
  id: string;
  property_id: string;
  arrival: string;
  departure: string;
  total_amount: number;
  host_service_fee: number;
  guest_listing_site_fee: number;
  platform: string | null;
}

function computePropertyMetrics(
  properties: PropertyInfo[],
  bookings: BookingRow[],
  from: string,
  to: string,
  firstBookingDates: Map<string, Date | null>
): PropertyMetrics[] {
  const bookingsByProperty = new Map<string, BookingRow[]>();
  for (const b of bookings) {
    const list = bookingsByProperty.get(b.property_id);
    if (list) {
      list.push(b);
    } else {
      bookingsByProperty.set(b.property_id, [b]);
    }
  }

  const result: PropertyMetrics[] = [];

  for (const property of properties) {
    const firstBookingDate = firstBookingDates.get(property.id) || null;
    const availableNights = calculateAvailableNights(from, to, firstBookingDate);

    const metrics: PropertyMetrics = {
      propertyId: property.id,
      propertyName: property.name,
      propertyCode: property.internal_code || null,
      revenue: 0,
      bookings: 0,
      occupancyRate: 0,
      avgNightlyRate: 0,
      bookedNights: 0,
      availableNights
    };

    const propBookings = bookingsByProperty.get(property.id) || [];
    const periodStart = new Date(from);
    const periodEnd = new Date(to);
    const today = new Date();

    for (const booking of propBookings) {
      const arrivalDate = new Date(booking.arrival);
      const departureDate = new Date(booking.departure);

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

function computePropertyProfitability(
  properties: PropertyInfo[],
  bookings: BookingRow[],
  taxCharges: { booking_id: string; amount: number }[],
  expenses: { property_id: string; category: string; amount: number }[]
): PropertyProfitability[] {
  const bookingsByProperty = new Map<string, BookingRow[]>();
  for (const b of bookings) {
    const list = bookingsByProperty.get(b.property_id);
    if (list) {
      list.push(b);
    } else {
      bookingsByProperty.set(b.property_id, [b]);
    }
  }

  // build booking -> property lookup for tax charges
  const bookingPropertyMap = new Map<string, string>();
  for (const b of bookings) {
    bookingPropertyMap.set(b.id, b.property_id);
  }

  const taxByProperty = new Map<string, number>();
  for (const c of taxCharges) {
    const propId = bookingPropertyMap.get(c.booking_id);
    if (propId) {
      taxByProperty.set(propId, (taxByProperty.get(propId) || 0) + c.amount);
    }
  }

  const expensesByProperty = new Map<string, number>();
  for (const e of expenses) {
    expensesByProperty.set(e.property_id, (expensesByProperty.get(e.property_id) || 0) + e.amount);
  }

  return properties.map(p => {
    const propBookings = bookingsByProperty.get(p.id) || [];
    let revenue = 0;
    let fees = 0;
    for (const b of propBookings) {
      revenue += b.total_amount || 0;
      fees += b.host_service_fee || 0;
    }
    const taxes = taxByProperty.get(p.id) || 0;
    const opex = expensesByProperty.get(p.id) || 0;
    return {
      propertyId: p.id,
      propertyName: p.name,
      propertyCode: p.internal_code || null,
      grossRevenue: revenue,
      platformFees: fees,
      taxes,
      operatingExpenses: opex,
      netRevenue: revenue - fees - taxes - opex
    };
  }).sort((a, b) => b.netRevenue - a.netRevenue);
}

function computePropertyPlatformMix(
  properties: PropertyInfo[],
  bookings: BookingRow[]
): PropertyPlatformMix[] {
  const propMap = new Map<string, Map<string, { bookings: number; revenue: number }>>();
  for (const p of properties) {
    propMap.set(p.id, new Map());
  }
  for (const b of bookings) {
    const platforms = propMap.get(b.property_id);
    if (!platforms) continue;
    const platform = normalizePlatform(b.platform);
    const entry = platforms.get(platform) || { bookings: 0, revenue: 0 };
    entry.bookings++;
    entry.revenue += b.total_amount || 0;
    platforms.set(platform, entry);
  }

  return properties.map(p => ({
    propertyId: p.id,
    propertyName: p.name,
    propertyCode: p.internal_code || null,
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
    return {
      properties: [],
      profitability: [],
      platformMix: [],
      view: 'properties'
    };
  }

  const propertyIds = properties.map((p: PropertyInfo) => p.id);
  const firstBookingDates = await fetchFirstBookingDates(supabase, tenantId, properties);

  let tagBookingIds: string[] | null = null;
  if (tagIds.length > 0) {
    const { data: taggedBookings } = await supabase
      .from('booking_tags')
      .select('booking_id')
      .in('tag_id', tagIds);

    if (taggedBookings && taggedBookings.length > 0) {
      tagBookingIds = taggedBookings.map((tb: { booking_id: string }) => tb.booking_id);
    } else {
      const emptyMetrics: PropertyMetrics[] = properties.map((p: PropertyInfo) => ({
        propertyId: p.id,
        propertyName: p.name,
        propertyCode: p.internal_code || null,
        revenue: 0,
        bookings: 0,
        occupancyRate: 0,
        avgNightlyRate: 0,
        bookedNights: 0,
        availableNights: calculateAvailableNights(from, to, firstBookingDates.get(p.id) ?? null)
      }));
      const emptyProfitability: PropertyProfitability[] = properties.map((p: PropertyInfo) => ({
        propertyId: p.id,
        propertyName: p.name,
        propertyCode: p.internal_code || null,
        grossRevenue: 0,
        platformFees: 0,
        taxes: 0,
        operatingExpenses: 0,
        netRevenue: 0
      }));
      const emptyPlatformMix: PropertyPlatformMix[] = properties.map((p: PropertyInfo) => ({
        propertyId: p.id,
        propertyName: p.name,
        propertyCode: p.internal_code || null,
        platforms: []
      }));
      return {
        properties: emptyMetrics,
        profitability: emptyProfitability,
        platformMix: emptyPlatformMix,
        view: 'properties'
      };
    }
  }

  const currentBookings = await fetchBookings(supabase, tenantId, from, to, propertyIds, tagBookingIds);

  const [taxCharges, expenses] = await Promise.all([
    fetchTaxCharges(supabase, currentBookings),
    getExpensesWithTemplateFallback(supabase, tenantId, from, to, propertyIds)
  ]);

  const currentMetrics = computePropertyMetrics(properties, currentBookings, from, to, firstBookingDates);
  const profitability = computePropertyProfitability(properties, currentBookings, taxCharges, expenses);
  const platformMix = computePropertyPlatformMix(properties, currentBookings);

  if (comparisonFrom && comparisonTo) {
    const compBookings = await fetchBookings(supabase, tenantId, comparisonFrom, comparisonTo, propertyIds, tagBookingIds);
    const previousMetrics = computePropertyMetrics(properties, compBookings, comparisonFrom, comparisonTo, firstBookingDates);

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

async function fetchBookings(
  supabase: SupabaseClient,
  tenantId: string,
  from: string,
  to: string,
  propertyIds: string[],
  tagBookingIds: string[] | null
): Promise<BookingRow[]> {
  let query = supabase
    .from('bookings')
    .select('id, property_id, arrival, departure, total_amount, host_service_fee, guest_listing_site_fee, platform')
    .eq('tenant_id', tenantId)
    .in('property_id', propertyIds)
    .lte('arrival', to)
    .gte('departure', from)
    .neq('status', 'canceled')
    .limit(SUPABASE_MAX_ROWS);

  if (tagBookingIds) {
    query = query.in('id', tagBookingIds);
  }

  const { data } = await query;
  return (data as BookingRow[]) || [];
}

async function fetchFirstBookingDates(
  supabase: SupabaseClient,
  tenantId: string,
  properties: PropertyInfo[]
): Promise<Map<string, Date | null>> {
  const { data: firstBookings } = await supabase
    .from('bookings')
    .select('property_id, arrival')
    .eq('tenant_id', tenantId)
    .neq('status', 'canceled')
    .order('arrival', { ascending: true });

  const firstBookingDates = new Map<string, Date | null>();
  for (const property of properties) {
    if (firstBookings) {
      const first = firstBookings.find((b: { property_id: string; arrival: string }) => b.property_id === property.id);
      if (first) {
        firstBookingDates.set(property.id, new Date(first.arrival));
      } else {
        firstBookingDates.set(property.id, null);
      }
    } else {
      firstBookingDates.set(property.id, null);
    }
  }

  return firstBookingDates;
}

async function fetchTaxCharges(
  supabase: SupabaseClient,
  bookings: BookingRow[]
): Promise<{ booking_id: string; amount: number }[]> {
  if (bookings.length === 0) return [];

  const bookingIds = bookings.map(b => b.id);
  const { data: charges } = await supabase
    .from('booking_charges')
    .select('booking_id, amount')
    .in('booking_id', bookingIds)
    .eq('type', 'tax')
    .limit(SUPABASE_MAX_ROWS);

  return (charges || []).map((c: { booking_id: string; amount: string | number }) => ({
    booking_id: c.booking_id,
    amount: parseFloat(String(c.amount)) || 0
  }));
}
