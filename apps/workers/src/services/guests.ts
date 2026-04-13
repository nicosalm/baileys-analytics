import { SupabaseClient } from '@supabase/supabase-js';
import { normalizePlatform } from '../utils/platform';
import { fetchAllRows, fetchChunked } from '../utils/fetch-all';
import { getBookingIdsForTags } from '../utils/tag-filter';

export interface CancelledBooking {
  id: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  ownerrezGuestId?: string;
  propertyName: string;
  propertyId: string;
  arrival: string;
  departure: string;
  totalAmount: number;
  platform: string;
  canceledUtc: string | null;
  bookedUtc: string | null;
}

export interface CancelledBookingsData {
  bookings: CancelledBooking[];
  totalCount: number;
}

export async function getCancelledBookingsData(
  supabase: SupabaseClient,
  tenantId: string,
  from?: string,
  to?: string,
  filterPropertyIds?: string[]
): Promise<CancelledBookingsData> {
  let query = supabase
    .from('bookings')
    .select('id, guest_name, ownerrez_guest_id, arrival, departure, total_amount, platform, property_id, canceled_utc, booked_utc, properties!inner(name), guests(email, phone)')
    .eq('tenant_id', tenantId)
    .eq('status', 'canceled')
    .order('canceled_utc', { ascending: false, nullsFirst: false })
    .limit(200);

  if (from && to) {
    query = query.lte('arrival', to).gte('departure', from);
  }

  if (filterPropertyIds && filterPropertyIds.length > 0) {
    query = query.in('property_id', filterPropertyIds);
  }

  const { data: bookings, error } = await query;

  if (error || !bookings) {
    return { bookings: [], totalCount: 0 };
  }

  return {
    bookings: bookings.map((b: Record<string, unknown>) => ({
      id: b.id as string,
      guestName: b.guest_name as string,
      guestEmail: ((b.guests as Record<string, unknown>)?.email as string) || undefined,
      guestPhone: ((b.guests as Record<string, unknown>)?.phone as string) || undefined,
      ownerrezGuestId: b.ownerrez_guest_id as string | undefined,
      propertyName: (b.properties as Record<string, unknown>)?.name as string || '',
      propertyId: b.property_id as string,
      arrival: b.arrival as string,
      departure: b.departure as string,
      totalAmount: (b.total_amount as number) || 0,
      platform: normalizePlatform(b.platform as string),
      canceledUtc: b.canceled_utc as string | null,
      bookedUtc: b.booked_utc as string | null,
    })),
    totalCount: bookings.length,
  };
}

export interface FeePlatformBreakdown {
  platform: string;
  platformFees: number;
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
  totalPlatformFees: number;
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
  isRepeat: boolean;
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

function createGuestId(ownerrezGuestId?: string | null, name?: string): string {
  if (ownerrezGuestId) return `or_${ownerrezGuestId}`;
  return `name_${(name || '').toLowerCase().trim()}`;
}

export async function getGuestsData(
  supabase: SupabaseClient,
  tenantId: string,
  from?: string,
  to?: string,
  tagIds?: string[],
  filterPropertyIds?: string[]
): Promise<GuestData> {
  const hasDateFilter = from && to;
  const hasTagFilter = tagIds && tagIds.length > 0;
  const hasPropertyFilter = filterPropertyIds && filterPropertyIds.length > 0;

  let filteredBookingIds: string[] | null = null;
  if (hasTagFilter) {
    filteredBookingIds = await getBookingIdsForTags(supabase, tenantId, tagIds);
    if (!filteredBookingIds) {
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
          totalPlatformFees: 0,
          totalCcFees: 0,
          directSavingsOpportunity: 0,
          feesByPlatform: []
        },
        guests: []
      };
    }
  }

  const filteredPeriodBookings = await fetchAllRows(() => {
    let q = supabase
      .from('bookings')
      .select('id, guest_name, ownerrez_guest_id, arrival, departure, total_amount, platform, property_id, guest_listing_site_fee, host_service_fee, guests(email, phone)')
      .eq('tenant_id', tenantId)
      .neq('status', 'canceled')
      .order('id');
    if (hasPropertyFilter) q = q.in('property_id', filterPropertyIds!);
    if (hasDateFilter) q = q.lte('arrival', to!).gte('departure', from!);
    if (filteredBookingIds) q = q.in('id', filteredBookingIds);
    return q;
  });

  if (filteredPeriodBookings.length === 0) {
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
        totalPlatformFees: 0,
        totalCcFees: 0,
        directSavingsOpportunity: 0,
        feesByPlatform: []
      },
      guests: []
    };
  }

  const allBookings = await fetchAllRows(() =>
    supabase
      .from('bookings')
      .select('id, guest_name, ownerrez_guest_id, arrival, departure, total_amount, platform, property_id, guest_listing_site_fee, host_service_fee, guests(email, phone)')
      .eq('tenant_id', tenantId)
      .neq('status', 'canceled')
      .order('id')
  );

  // helper to extract joined guest contact from booking
  const getGuestContact = (booking: Record<string, unknown>) => {
    const g = booking.guests as Record<string, unknown> | null;
    return { email: g?.email as string | undefined, phone: g?.phone as string | undefined };
  };

  const guestPeriodMap = new Map<string, {
    name: string;
    email?: string;
    phone?: string;
    ownerrezGuestId?: string;
    bookings: any[];
    totalSpent: number;
    totalNights: number;
  }>();

  const guestAllTimeMap = new Map<string, {
    name: string;
    email?: string;
    phone?: string;
    ownerrezGuestId?: string;
    bookings: any[];
    totalSpent: number;
    totalNights: number;
    firstVisit: string;
    lastVisit: string;
    propertyIds: Set<string>;
  }>();

  for (const booking of filteredPeriodBookings) {
    if (!booking.guest_name && !booking.ownerrez_guest_id) continue;

    const guestId = createGuestId(booking.ownerrez_guest_id, booking.guest_name);
    const contact = getGuestContact(booking as Record<string, unknown>);
    const nights = Math.ceil(
      (new Date(booking.departure).getTime() - new Date(booking.arrival).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (!guestPeriodMap.has(guestId)) {
      guestPeriodMap.set(guestId, {
        name: booking.guest_name,
        email: contact.email,
        phone: contact.phone,
        ownerrezGuestId: booking.ownerrez_guest_id,
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

  for (const booking of allBookings) {
      if (!booking.guest_name && !booking.ownerrez_guest_id) continue;

      const guestId = createGuestId(booking.ownerrez_guest_id, booking.guest_name);

      if (!guestPeriodMap.has(guestId)) continue;

      const contact = getGuestContact(booking as Record<string, unknown>);
      const nights = Math.ceil(
        (new Date(booking.departure).getTime() - new Date(booking.arrival).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (!guestAllTimeMap.has(guestId)) {
        guestAllTimeMap.set(guestId, {
          name: booking.guest_name,
          email: contact.email,
          phone: contact.phone,
          ownerrezGuestId: booking.ownerrez_guest_id,
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

  const totalGuests = guestPeriodMap.size;

  // repeat = has visited more than once (all-time booking count)
  // the period filter controls which guests are shown; repeat is a property of the guest
  const repeatGuests = Array.from(guestPeriodMap.keys()).filter(guestId => {
    const allTimeData = guestAllTimeMap.get(guestId);
    return allTimeData && allTimeData.bookings.length > 1;
  }).length;

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
  const bookingTags = bookingIds.length > 0
    ? await fetchChunked(bookingIds, ids =>
        supabase.from('booking_tags').select('booking_id, tag_id').in('booking_id', ids))
    : [];

  // collect ownerrez_guest_ids from period bookings to look up guest tags
  const uniqueOwnerrezGuestIds = new Set<string>();
  for (const booking of filteredPeriodBookings) {
    if (booking.ownerrez_guest_id) uniqueOwnerrezGuestIds.add(booking.ownerrez_guest_id);
  }

  let guestRecords: any[] = [];
  if (uniqueOwnerrezGuestIds.size > 0) {
    const ids = Array.from(uniqueOwnerrezGuestIds);
    const { data } = await supabase
      .from('guests')
      .select('id, ownerrez_guest_id, full_name, email, guest_tags(tag_id)')
      .eq('tenant_id', tenantId)
      .in('ownerrez_guest_id', ids);
    guestRecords = data || [];
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

  for (const bt of bookingTags) {
      const booking = filteredPeriodBookings.find(b => b.id === bt.booking_id);
      if (booking && booking.guest_name) {
        const guestId = createGuestId(booking.ownerrez_guest_id, booking.guest_name);
        if (!guestTagsMap.has(guestId)) {
          guestTagsMap.set(guestId, new Set());
        }
        guestTagsMap.get(guestId)!.add(bt.tag_id);
      }
  }

  for (const guest of guestRecords) {
    if (guest.guest_tags && guest.ownerrez_guest_id) {
      const guestId = createGuestId(guest.ownerrez_guest_id, guest.full_name);
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
      periodSpent: periodData.totalSpent,
      isRepeat: (allTimeData?.bookings.length ?? 0) > 1
    });
  }

  guestsList.sort((a, b) => b.periodSpent - a.periodSpent);
  const topSpenders = guestsList.slice(0, 10);

  // build source breakdown from unique guests, assigning each to their most-used platform
  // to avoid double-counting guests who booked via multiple platforms in the period
  const sourceMap = new Map<string, { count: Set<string>; revenue: number }>();
  for (const [guestId, periodData] of guestPeriodMap) {
    const platformCounts = new Map<string, number>();
    for (const booking of periodData.bookings) {
      const src = normalizePlatform(booking.platform);
      platformCounts.set(src, (platformCounts.get(src) || 0) + 1);
    }
    const primarySource = [...platformCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];

    if (!sourceMap.has(primarySource)) {
      sourceMap.set(primarySource, { count: new Set(), revenue: 0 });
    }
    const sourceData = sourceMap.get(primarySource)!;
    sourceData.count.add(guestId);
    sourceData.revenue += periodData.totalSpent;
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

  // aggregate platform fees: guest fees (estimated) + host fees (real from OR) + CC fees
  let totalGuestFees = 0;
  let totalHostFees = 0;
  const platformFeeMap = new Map<string, FeePlatformBreakdown>();

  for (const booking of filteredPeriodBookings) {
    const guestFee = (booking as Record<string, unknown>).guest_listing_site_fee as number || 0;
    const hostFee = (booking as Record<string, unknown>).host_service_fee as number || 0;
    totalGuestFees += guestFee;
    totalHostFees += hostFee;

    const platform = normalizePlatform(booking.platform);
    if (!platformFeeMap.has(platform)) {
      platformFeeMap.set(platform, { platform, platformFees: 0, ccFees: 0, totalFees: 0, bookingCount: 0 });
    }
    const pf = platformFeeMap.get(platform)!;
    pf.platformFees += guestFee + hostFee;
    pf.bookingCount += 1;
  }

  // fetch CC charges for the period bookings
  let totalCcFees = 0;
  if (bookingIds.length > 0) {
    const ccCharges = await fetchChunked(bookingIds, ids =>
      supabase.from('booking_charges').select('booking_id, amount').in('booking_id', ids).ilike('description', '%credit card%')
    );
    const bookingPlatformMap = new Map(filteredPeriodBookings.map(b => [b.id, normalizePlatform(b.platform)]));
    for (const charge of ccCharges) {
      totalCcFees += charge.amount || 0;
      const platform = bookingPlatformMap.get(charge.booking_id) || 'Unknown';
      if (platformFeeMap.has(platform)) {
        platformFeeMap.get(platform)!.ccFees += charge.amount || 0;
      }
    }
  }

  const feesByPlatform: FeePlatformBreakdown[] = Array.from(platformFeeMap.values())
    .map(pf => ({ ...pf, totalFees: pf.platformFees + pf.ccFees }))
    .filter(pf => pf.totalFees > 0)
    .sort((a, b) => b.totalFees - a.totalFees);

  const totalPlatformFees = totalGuestFees + totalHostFees;
  const directSavingsOpportunity = totalPlatformFees + totalCcFees;

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
      totalPlatformFees,
      totalCcFees,
      directSavingsOpportunity,
      feesByPlatform
    },
    guests: guestsList
  };
}
