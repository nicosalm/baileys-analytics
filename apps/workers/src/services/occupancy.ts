import { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllRows } from '../utils/fetch-all';
import { getBookingIdsForTags } from '../utils/tag-filter';
import { enumerateBuckets, effectiveDaysInMonth } from '../utils/prorate';
import {
	fetchBlocks,
	collectBlockedNights,
	collectBlockedNightsExclusive,
	sumBlockedNights,
	buildDailyBlockGrid,
	TranslatedBlock,
} from '../utils/blocks';
import { MS_PER_DAY } from '../constants';

export interface OccupancyData {
  overall: number;
  byProperty: PropertyOccupancy[];
  byMonth: MonthlyOccupancy[];
  bookedNights: number;
  availableNights: number;
  blockedNights: number;
}

export interface PropertyOccupancy {
  propertyId: string;
  propertyName: string;
  propertyCode: string | null;
  rate: number;
  bookedNights: number;
  availableNights: number;
  blockedNights: number;
  avgNightlyRate: number;
}

export interface MonthlyOccupancy {
  month: string;
  rate: number;
  bookedNights: number;
  availableNights: number;
  blockedNights: number;
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

// available nights per period key. Keys match the postgres RPC
// (get_periodic_occupancy) via shared enumerateBuckets, which is UTC-based.
// Returned map is { key -> { sellable, blocked } } so callers can render both.
function computePeriodAvailableNights(
  propertyCount: number,
  from: string,
  to: string,
  granularity: 'daily' | 'weekly' | 'monthly',
  blocks: TranslatedBlock[]
): Map<string, { sellable: number; blocked: number }> {
  const g = granularity === 'daily' ? 'day' : granularity === 'weekly' ? 'week' : 'month';
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  const periods = new Map<string, { sellable: number; blocked: number }>();

  for (const { key } of enumerateBuckets(from, to, g)) {
    let nights: number;
    let windowStart: Date;
    let windowEndExcl: Date;
    if (g === 'day') {
      nights = 1;
      windowStart = new Date(key);
      windowEndExcl = new Date(windowStart.getTime() + MS_PER_DAY);
    } else if (g === 'week') {
      // key = Sunday of the week (YYYY-MM-DD); clip the 7-day span to [from, to]
      const weekStartMs = new Date(key).getTime();
      const weekEndMs = weekStartMs + 6 * MS_PER_DAY;
      const clipStart = Math.max(weekStartMs, fromMs);
      const clipEnd = Math.min(weekEndMs, toMs);
      nights = clipStart <= clipEnd ? Math.round((clipEnd - clipStart) / MS_PER_DAY) + 1 : 0;
      windowStart = new Date(clipStart);
      windowEndExcl = new Date(clipEnd + MS_PER_DAY);
    } else {
      const [y, m] = key.split('-').map(Number);
      nights = effectiveDaysInMonth(y, m - 1, from, to);
      // clip month edges to [from, to]
      const monthStart = new Date(Date.UTC(y, m - 1, 1));
      const nextMonthStart = new Date(Date.UTC(y, m, 1));
      windowStart = monthStart.getTime() > fromMs ? monthStart : new Date(fromMs);
      const toExcl = toMs + MS_PER_DAY;
      windowEndExcl = nextMonthStart.getTime() < toExcl ? nextMonthStart : new Date(toExcl);
    }
    const calendarNights = nights * propertyCount;
    const blocked = nights > 0
      ? sumBlockedNights(collectBlockedNightsExclusive(blocks, windowStart, windowEndExcl))
      : 0;
    periods.set(key, { sellable: Math.max(0, calendarNights - blocked), blocked });
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
    return { overall: 0, byProperty: [], byMonth: [], bookedNights: 0, availableNights: 0, blockedNights: 0 };
  }

  const propertyIds = properties.map(p => p.id);
  const hasTagFilter = tagIds.length > 0;

  // blocks are inventory state, not booking state, so tag filters don't apply to them
  const blocks = await fetchBlocks(supabase, tenantId, from, to, propertyIds);
  const blockedByProp = collectBlockedNights(blocks, from, to);
  const totalBlocked = sumBlockedNights(blockedByProp);

  let bookingIdFilter: string[] | null = null;
  if (hasTagFilter) {
    bookingIdFilter = await getBookingIdsForTags(supabase, tenantId, tagIds);

    if (!bookingIdFilter) {
      const endDate = new Date(to);
      const startDate = new Date(from);
      const totalDays = endDate >= startDate
        ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
        : 0;
      const totalAvailableNights = Math.max(0, totalDays * properties.length - totalBlocked);

      return {
        overall: 0,
        byProperty: properties.map(p => {
          const propBlocked = blockedByProp.get(p.id) || 0;
          return {
            propertyId: p.id,
            propertyName: p.name,
            propertyCode: p.internal_code || null,
            rate: 0,
            bookedNights: 0,
            availableNights: Math.max(0, totalDays - propBlocked),
            blockedNights: propBlocked,
            avgNightlyRate: 0
          };
        }),
        byMonth: [],
        bookedNights: 0,
        availableNights: totalAvailableNights,
        blockedNights: totalBlocked
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

  const overallRow = overallResult.data?.[0] ?? { booked_nights: 0, available_nights: 0 };
  const bookedNights = Number(overallRow.booked_nights);
  const availableNights = Math.max(0, Number(overallRow.available_nights) - totalBlocked);

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
    const propBlocked = blockedByProp.get(p.id) ?? 0;
    const propSellable = Math.max(0, totalDays - propBlocked);
    return {
      propertyId: p.id,
      propertyName: p.name,
      propertyCode: p.internal_code || null,
      rate: calculateOccupancyRate(propBookedNights, propSellable),
      bookedNights: propBookedNights,
      availableNights: propSellable,
      blockedNights: propBlocked,
      avgNightlyRate: propBookedNights > 0 ? propRevenue / propBookedNights : 0,
    };
  }).sort((a, b) => b.rate - a.rate);

  // periodic: merge RPC booked_nights with JS-computed available nights
  const periodAvailable = computePeriodAvailableNights(properties.length, from, to, granularity, blocks);
  const periodicMap = new Map<string, number>();
  for (const row of periodicResult.data ?? []) {
    periodicMap.set(row.period, Number(row.booked_nights));
  }

  const byMonth: MonthlyOccupancy[] = [];
  for (const [month, avail] of periodAvailable) {
    const booked = periodicMap.get(month) ?? 0;
    byMonth.push({
      month,
      rate: calculateOccupancyRate(booked, avail.sellable),
      bookedNights: booked,
      availableNights: avail.sellable,
      blockedNights: avail.blocked,
    });
  }

  return {
    overall: calculateOccupancyRate(bookedNights, availableNights),
    byProperty,
    byMonth,
    bookedNights,
    availableNights,
    blockedNights: totalBlocked
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

  let matchedBookingIds: string[] | null = null;
  if (hasTagFilter) {
    matchedBookingIds = await getBookingIdsForTags(supabase, tenantId, tagIds);
  }

  const [bookings, blocks] = await Promise.all([
    fetchAllRows(() => {
      let q = supabase
        .from('bookings')
        .select('property_id, arrival, departure')
        .eq('tenant_id', tenantId)
        .in('property_id', propertyIds)
        .lte('arrival', to)
        .gte('departure', from)
        .neq('status', 'canceled')
        .order('id');
      if (hasTagFilter) {
        q = matchedBookingIds ? q.in('id', matchedBookingIds) : q.in('id', []);
      }
      return q;
    }),
    fetchBlocks(supabase, tenantId, from, to, propertyIds),
  ]);

  const startDate = new Date(from);
  const endDate = new Date(to);
  const startEpoch = Math.floor(startDate.getTime() / MS_PER_DAY);
  const endEpoch = Math.floor(endDate.getTime() / MS_PER_DAY);

  // single pass over bookings to build grid: epochDay -> Set<propertyId>
  const grid = new Map<number, Set<string>>();
  for (const booking of bookings) {
    const bStart = Math.max(Math.floor(new Date(booking.arrival).getTime() / MS_PER_DAY), startEpoch);
    // departure is exclusive (checkout day)
    const bEnd = Math.min(Math.floor(new Date(booking.departure).getTime() / MS_PER_DAY), endEpoch + 1);
    for (let d = bStart; d < bEnd; d++) {
      let set = grid.get(d);
      if (!set) { set = new Set(); grid.set(d, set); }
      set.add(booking.property_id);
    }
  }

  const blockGrid = buildDailyBlockGrid(blocks, startEpoch, endEpoch);

  const dailyOccupancy: DailyOccupancy[] = [];
  for (let epoch = startEpoch; epoch <= endEpoch; epoch++) {
    const d = new Date(epoch * MS_PER_DAY);
    const dateStr = d.toISOString().split('T')[0];
    const bookedCount = grid.get(epoch)?.size ?? 0;
    const blockedCount = blockGrid.get(epoch)?.size ?? 0;
    const sellable = Math.max(0, totalProperties - blockedCount);
    dailyOccupancy.push({
      date: dateStr,
      occupancyRate: sellable > 0 ? bookedCount / sellable : 0,
      bookedProperties: bookedCount,
      totalProperties: sellable
    });
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
  const bookings = await fetchAllRows(() =>
    supabase
      .from('bookings')
      .select('property_id, arrival, departure')
      .eq('tenant_id', tenantId)
      .gte('arrival', today.toISOString())
      .lte('arrival', endDate.toISOString())
      .neq('status', 'canceled')
      .order('property_id', { ascending: true })
      .order('arrival', { ascending: true })
  );

  const gaps: BookingGap[] = [];

  const bookingsByProperty = new Map<string, typeof bookings>();
  for (const b of bookings) {
    let arr = bookingsByProperty.get(b.property_id);
    if (!arr) { arr = []; bookingsByProperty.set(b.property_id, arr); }
    arr.push(b);
  }

  for (const property of properties) {
    const propertyBookings = bookingsByProperty.get(property.id) || [];

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
