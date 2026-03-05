import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_MAX_ROWS } from '../constants';

export interface FeePlatformBreakdown {
  platform: string;
  otaFees: number;
  ccFees: number;
  totalFees: number;
  bookingCount: number;
}

export interface GuestMetrics {
  totalGuests: number;
  repeatGuests: number;
  repeatRate: number;
  avgStayLength: number;
  avgSpend: number;
  topSpenders: GuestListItem[];
  guestsBySource: GuestSourceData[];
  tagDistribution: TagDistribution[];
  totalOtaFees: number;
  totalCcFees: number;
  directSavingsOpportunity: number;
  feesByPlatform: FeePlatformBreakdown[];
}

export interface GuestListItem {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  firstVisit: string;
  lastVisit: string;
  bookingCount: number;
  totalSpent: number;
  avgNightlyRate: number;
  properties: string[];
  tags: Array<{
    id: string;
    name: string;
    color?: string;
  }>;
  periodBookings: number;
  periodSpent: number;
}

export interface GuestSourceData {
  source: string;
  count: number;
  revenue: number;
}

export interface TagDistribution {
  id: string;
  name: string;
  color?: string;
  count: number;
}

export interface GuestData {
  metrics: GuestMetrics;
  guests: GuestListItem[];
}

function createGuestId(name: string, email?: string): string {
  const normalizedName = name.toLowerCase().trim();
  const normalizedEmail = (email || '').toLowerCase().trim();
  return `${normalizedName}_${normalizedEmail}`;
}

function normalizePlatform(platform: string | null): string {
  if (!platform) return 'Unassigned';
  const normalized = platform.toLowerCase().trim();

  if (normalized.includes('airbnb')) return 'Airbnb';
  if (normalized.includes('vrbo') || normalized.includes('homeaway')) return 'VRBO';
  if (normalized.includes('booking')) return 'Booking.com';
  if (normalized.includes('google')) return 'Google Vacation Rentals';
  if (normalized.includes('hopper')) return 'Hopper';
  if (normalized.includes('hometogo')) return 'HomeToGo';
  if (normalized.includes('direct') || normalized.includes('owner') || normalized.includes('website')) return 'Direct';

  return platform;
}

export async function getGuestsData(
  supabase: SupabaseClient,
  tenantId: string,
  from?: string,
  to?: string,
  tagIds?: string[]
): Promise<GuestData> {
  const hasDateFilter = from && to;
  const hasTagFilter = tagIds && tagIds.length > 0;

  let bookingsQuery = supabase
    .from('bookings')
    .select('id, guest_name, guest_email, guest_phone, arrival, departure, total_amount, platform, property_id, guest_listing_site_fee')
    .eq('tenant_id', tenantId)
    .neq('status', 'canceled')
    .limit(SUPABASE_MAX_ROWS);

  if (hasDateFilter) {
    bookingsQuery = bookingsQuery
      .lte('arrival', to)
      .gte('departure', from);
  }

  let filteredBookingIds: string[] | null = null;
  if (hasTagFilter) {
    const { data: taggedBookings } = await supabase
      .from('booking_tags')
      .select('booking_id')
      .in('tag_id', tagIds);

    if (taggedBookings && taggedBookings.length > 0) {
      filteredBookingIds = taggedBookings.map(tb => tb.booking_id);
    } else {
      return {
        metrics: {
          totalGuests: 0,
          repeatGuests: 0,
          repeatRate: 0,
          avgStayLength: 0,
          avgSpend: 0,
          topSpenders: [],
          guestsBySource: [],
          tagDistribution: [],
          totalOtaFees: 0,
          totalCcFees: 0,
          directSavingsOpportunity: 0,
          feesByPlatform: []
        },
        guests: []
      };
    }
  }

  const { data: periodBookings } = await bookingsQuery;

  if (!periodBookings || periodBookings.length === 0) {
    return {
      metrics: {
        totalGuests: 0,
        repeatGuests: 0,
        repeatRate: 0,
        avgStayLength: 0,
        avgSpend: 0,
        topSpenders: [],
        guestsBySource: [],
        tagDistribution: [],
        totalOtaFees: 0,
        totalCcFees: 0,
        directSavingsOpportunity: 0,
        feesByPlatform: []
      },
      guests: []
    };
  }

  const filteredPeriodBookings = filteredBookingIds
    ? periodBookings.filter(b => filteredBookingIds.includes(b.id))
    : periodBookings;

  const { data: allBookings } = await supabase
    .from('bookings')
    .select('id, guest_name, guest_email, guest_phone, arrival, departure, total_amount, platform, property_id, guest_listing_site_fee')
    .eq('tenant_id', tenantId)
    .neq('status', 'canceled')
    .limit(SUPABASE_MAX_ROWS);

  const guestPeriodMap = new Map<string, {
    name: string;
    email?: string;
    phone?: string;
    bookings: any[];
    totalSpent: number;
    totalNights: number;
  }>();

  const guestAllTimeMap = new Map<string, {
    name: string;
    email?: string;
    phone?: string;
    bookings: any[];
    totalSpent: number;
    totalNights: number;
    firstVisit: string;
    lastVisit: string;
    propertyIds: Set<string>;
  }>();

  for (const booking of filteredPeriodBookings) {
    if (!booking.guest_name) continue;

    const guestId = createGuestId(booking.guest_name, booking.guest_email);
    const nights = Math.ceil(
      (new Date(booking.departure).getTime() - new Date(booking.arrival).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (!guestPeriodMap.has(guestId)) {
      guestPeriodMap.set(guestId, {
        name: booking.guest_name,
        email: booking.guest_email,
        phone: booking.guest_phone,
        bookings: [],
        totalSpent: 0,
        totalNights: 0
      });
    }

    const guest = guestPeriodMap.get(guestId)!;
    guest.bookings.push(booking);
    guest.totalSpent += booking.total_amount || 0;
    guest.totalNights += nights;
  }

  if (allBookings) {
    for (const booking of allBookings) {
      if (!booking.guest_name) continue;

      const guestId = createGuestId(booking.guest_name, booking.guest_email);

      if (!guestPeriodMap.has(guestId)) continue;

      const nights = Math.ceil(
        (new Date(booking.departure).getTime() - new Date(booking.arrival).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (!guestAllTimeMap.has(guestId)) {
        guestAllTimeMap.set(guestId, {
          name: booking.guest_name,
          email: booking.guest_email,
          phone: booking.guest_phone,
          bookings: [],
          totalSpent: 0,
          totalNights: 0,
          firstVisit: booking.arrival,
          lastVisit: booking.arrival,
          propertyIds: new Set()
        });
      }

      const guest = guestAllTimeMap.get(guestId)!;
      guest.bookings.push(booking);
      guest.totalSpent += booking.total_amount || 0;
      guest.totalNights += nights;
      guest.propertyIds.add(booking.property_id);

      if (booking.arrival < guest.firstVisit) {
        guest.firstVisit = booking.arrival;
      }
      if (booking.arrival > guest.lastVisit) {
        guest.lastVisit = booking.arrival;
      }
    }
  }

  const totalGuests = guestPeriodMap.size;

  // Calculate repeat guests: guests in the period who also have bookings before the period start
  let repeatGuests = 0;
  if (hasDateFilter && from) {
    for (const [guestId, periodData] of guestPeriodMap) {
      const allTimeData = guestAllTimeMap.get(guestId);
      if (allTimeData) {
        // Check if this guest has any bookings before the period start
        const hasHistoricalBookings = allTimeData.bookings.some(b => b.arrival < from);
        if (hasHistoricalBookings) {
          repeatGuests++;
        }
      }
    }
  } else {
    // If no date filter, count guests with multiple bookings total
    repeatGuests = Array.from(guestPeriodMap.values()).filter(g => {
      const allTimeData = guestAllTimeMap.get(createGuestId(g.name, g.email));
      return allTimeData && allTimeData.bookings.length > 1;
    }).length;
  }

  const repeatRate = totalGuests > 0 ? repeatGuests / totalGuests : 0;

  let totalRevenue = 0;
  let totalStayNights = 0;
  let totalBookings = 0;

  for (const guest of guestPeriodMap.values()) {
    totalRevenue += guest.totalSpent;
    totalStayNights += guest.totalNights;
    totalBookings += guest.bookings.length;
  }

  const avgStayLength = totalBookings > 0 ? totalStayNights / totalBookings : 0;
  const avgSpend = totalGuests > 0 ? totalRevenue / totalGuests : 0;

  const { data: properties } = await supabase
    .from('properties')
    .select('id, name')
    .eq('tenant_id', tenantId);

  const propertyMap = new Map<string, string>();
  if (properties) {
    for (const prop of properties) {
      propertyMap.set(prop.id, prop.name);
    }
  }

  const bookingIds = filteredPeriodBookings.map(b => b.id);
  const { data: bookingTags } = await supabase
    .from('booking_tags')
    .select('booking_id, tag_id')
    .in('booking_id', bookingIds);

  const uniqueGuestEmails = new Set<string>();
  const uniqueGuestNames = new Set<string>();
  for (const booking of filteredPeriodBookings) {
    if (booking.guest_name) uniqueGuestNames.add(booking.guest_name);
    if (booking.guest_email) uniqueGuestEmails.add(booking.guest_email);
  }

  let guestRecords: any[] = [];
  if (uniqueGuestNames.size > 0 || uniqueGuestEmails.size > 0) {
    const { data: guests } = await supabase
      .from('guests')
      .select('id, full_name, email, guest_tags(tag_id)')
      .eq('tenant_id', tenantId)
      .or(`full_name.in.(${Array.from(uniqueGuestNames).join(',')}),email.in.(${Array.from(uniqueGuestEmails).join(',')})`);
    guestRecords = guests || [];
  }

  const { data: tags } = await supabase
    .from('tags')
    .select('id, name, color')
    .eq('tenant_id', tenantId);

  const tagMap = new Map<string, { id: string; name: string; color?: string }>();
  if (tags) {
    for (const tag of tags) {
      tagMap.set(tag.id, { id: tag.id, name: tag.name, color: tag.color });
    }
  }

  const guestTagsMap = new Map<string, Set<string>>();

  if (bookingTags) {
    for (const bt of bookingTags) {
      const booking = filteredPeriodBookings.find(b => b.id === bt.booking_id);
      if (booking && booking.guest_name) {
        const guestId = createGuestId(booking.guest_name, booking.guest_email);
        if (!guestTagsMap.has(guestId)) {
          guestTagsMap.set(guestId, new Set());
        }
        guestTagsMap.get(guestId)!.add(bt.tag_id);
      }
    }
  }

  for (const guest of guestRecords) {
    if (guest.guest_tags && guest.full_name) {
      const guestId = createGuestId(guest.full_name, guest.email);
      if (!guestTagsMap.has(guestId)) {
        guestTagsMap.set(guestId, new Set());
      }
      for (const gt of guest.guest_tags) {
        guestTagsMap.get(guestId)!.add(gt.tag_id);
      }
    }
  }

  const guestsList: GuestListItem[] = [];
  for (const [guestId, periodData] of guestPeriodMap) {
    const allTimeData = guestAllTimeMap.get(guestId);
    const guestTags = guestTagsMap.get(guestId) || new Set();

    guestsList.push({
      id: guestId,
      name: periodData.name,
      email: periodData.email,
      phone: periodData.phone,
      firstVisit: allTimeData?.firstVisit || periodData.bookings[0].arrival,
      lastVisit: allTimeData?.lastVisit || periodData.bookings[periodData.bookings.length - 1].arrival,
      bookingCount: allTimeData?.bookings.length || periodData.bookings.length,
      totalSpent: allTimeData?.totalSpent || periodData.totalSpent,
      avgNightlyRate: allTimeData && allTimeData.totalNights > 0
        ? allTimeData.totalSpent / allTimeData.totalNights
        : periodData.totalNights > 0
          ? periodData.totalSpent / periodData.totalNights
          : 0,
      properties: allTimeData
        ? Array.from(allTimeData.propertyIds).map(id => propertyMap.get(id) || id).slice(0, 3)
        : Array.from(new Set(periodData.bookings.map(b => propertyMap.get(b.property_id) || b.property_id))),
      tags: Array.from(guestTags).map(tagId => tagMap.get(tagId) || { id: tagId, name: 'Unknown' }),
      periodBookings: periodData.bookings.length,
      periodSpent: periodData.totalSpent
    });
  }

  guestsList.sort((a, b) => b.periodSpent - a.periodSpent);
  const topSpenders = guestsList.slice(0, 10);

  const sourceMap = new Map<string, { count: Set<string>; revenue: number }>();
  for (const booking of filteredPeriodBookings) {
    if (!booking.guest_name) continue;

    const source = normalizePlatform(booking.platform);
    const guestId = createGuestId(booking.guest_name, booking.guest_email);

    if (!sourceMap.has(source)) {
      sourceMap.set(source, { count: new Set(), revenue: 0 });
    }

    const sourceData = sourceMap.get(source)!;
    sourceData.count.add(guestId);
    sourceData.revenue += booking.total_amount || 0;
  }

  const guestsBySource: GuestSourceData[] = Array.from(sourceMap.entries()).map(([source, data]) => ({
    source,
    count: data.count.size,
    revenue: data.revenue
  })).sort((a, b) => b.count - a.count);

  const tagDistMap = new Map<string, number>();
  for (const guestTags of guestTagsMap.values()) {
    for (const tagId of guestTags) {
      tagDistMap.set(tagId, (tagDistMap.get(tagId) || 0) + 1);
    }
  }

  const tagDistribution: TagDistribution[] = Array.from(tagDistMap.entries())
    .map(([tagId, count]) => {
      const tag = tagMap.get(tagId);
      return {
        id: tagId,
        name: tag?.name || 'Unknown',
        color: tag?.color,
        count
      };
    })
    .sort((a, b) => b.count - a.count);

  // aggregate fee leakage: OTA fees (from booking field) + CC fees (from booking_charges)
  let totalOtaFees = 0;
  const platformFeeMap = new Map<string, FeePlatformBreakdown>();

  for (const booking of filteredPeriodBookings) {
    const otaFee = (booking as any).guest_listing_site_fee || 0;
    totalOtaFees += otaFee;

    const platform = normalizePlatform(booking.platform);
    if (!platformFeeMap.has(platform)) {
      platformFeeMap.set(platform, { platform, otaFees: 0, ccFees: 0, totalFees: 0, bookingCount: 0 });
    }
    const pf = platformFeeMap.get(platform)!;
    pf.otaFees += otaFee;
    pf.bookingCount += 1;
  }

  // fetch CC charges for the period bookings
  let totalCcFees = 0;
  if (bookingIds.length > 0) {
    const { data: ccCharges } = await supabase
      .from('booking_charges')
      .select('booking_id, amount')
      .in('booking_id', bookingIds)
      .ilike('description', '%credit card%');

    if (ccCharges) {
      const bookingPlatformMap = new Map(filteredPeriodBookings.map(b => [b.id, normalizePlatform(b.platform)]));
      for (const charge of ccCharges) {
        totalCcFees += charge.amount || 0;
        const platform = bookingPlatformMap.get(charge.booking_id) || 'Unknown';
        if (platformFeeMap.has(platform)) {
          platformFeeMap.get(platform)!.ccFees += charge.amount || 0;
        }
      }
    }
  }

  const feesByPlatform: FeePlatformBreakdown[] = Array.from(platformFeeMap.values())
    .map(pf => ({ ...pf, totalFees: pf.otaFees + pf.ccFees }))
    .filter(pf => pf.totalFees > 0)
    .sort((a, b) => b.totalFees - a.totalFees);

  const directSavingsOpportunity = totalOtaFees + totalCcFees;

  return {
    metrics: {
      totalGuests,
      repeatGuests,
      repeatRate,
      avgStayLength,
      avgSpend,
      topSpenders,
      guestsBySource,
      tagDistribution,
      totalOtaFees,
      totalCcFees,
      directSavingsOpportunity,
      feesByPlatform
    },
    guests: guestsList.slice(0, 100)
  };
}
