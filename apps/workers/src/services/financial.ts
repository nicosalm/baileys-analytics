import { SupabaseClient } from '@supabase/supabase-js';
import { getExpensesWithTemplateFallback } from './expense-utils';
import { normalizePlatform, PLATFORM_REMITS_TAX } from '../utils/platform';
import { fetchAllRows } from '../utils/fetch-all';
import { getBookingIdsForTags } from '../utils/tag-filter';
import { subtractOneYear } from '../utils/date-filters';
import { prorateBooking, bucketBooking, bucketKeyForDate, enumerateBuckets, isArrivalInPeriod, type Granularity } from '../utils/prorate';
import { fetchBlocks, collectBlockedNights, sumBlockedNights } from '../utils/blocks';

// Compute per-booking proration ratios against [from, to] once per call.
// Every revenue/fee sum multiplies by these ratios so a booking that spans
// the period boundary contributes only the nights that fell inside.
function buildRatioMap(bookings: Array<{ id: string; arrival: string; departure: string }>, from: string, to: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const b of bookings) m.set(b.id, prorateBooking(b, from, to).ratio);
  return m;
}

// Boolean companion to buildRatioMap for tax attribution: taxes use the
// arrival event, not the service period. Precomputed once so each tax loop
// can do an O(1) lookup.
function buildArrivalInPeriodMap(bookings: Array<{ id: string; arrival: string }>, from: string, to: string): Map<string, boolean> {
  const m = new Map<string, boolean>();
  for (const b of bookings) m.set(b.id, isArrivalInPeriod(b, from, to));
  return m;
}

interface FinancialMetrics {
  revenue: {
    gross: number;
    net: number;
    pending: number;
    collected: number;
    platformFees: number;
    hostFees: number;
    guestFees: number;
    taxes: number;
  };
  operatingExpenses?: {
    total: number;
    byCategory: Record<string, number>;
  };
  operatingProfit?: number;
  performance: {
    netRevenueRate: number;
    avgBookingValue: number;
    totalBookings: number;
  };
  upcoming: {
    next30Days: number;
    next60Days: number;
    next90Days: number;
  };
  kpis: {
    revpar: number;
    adr: number;
    collectionRate: number;
  };
}

interface PlatformFinancials {
  platform: string;
  grossRevenue: number;
  fees: number;
  netRevenue: number;
  feeRate: number;
  bookingCount: number;
}

interface MonthlyTrend {
  month: string;
  revenue: number;
  bookings: number;
  avgBookingValue: number;
  hostFees: number;
  taxes: number;
}

interface WeeklyRevenue {
  week: string;
  revenue: number;
  bookings: number;
}

interface ChannelCharges {
  taxes: number;
  fees: number;
  discounts: number;
  cleaningAndLinens: number;
  petFees: number;
  creditCardFees: number;
  otherSurcharges: number;
  grossRevenue: number;
  guestFees: number;
}

export interface ChargeComposition {
  taxes: number;
  fees: number;
  discounts: number;
  cleaningAndLinens: number;
  petFees: number;
  creditCardFees: number;
  otherSurcharges: number;
  details: { type: string; description: string; total: number; count: number }[];
  byChannel?: {
    direct: ChannelCharges;
    ota: ChannelCharges;
  };
}

export interface PLData {
  metrics: FinancialMetrics;
  platforms: PlatformFinancials[];
  monthlyTrend: MonthlyTrend[];
  weeklyRevenue: WeeklyRevenue[];
  chargeComposition?: ChargeComposition;
  previousPeriod?: {
    revenue: { gross: number; net: number; taxes: number; platformFees: number; hostFees: number; guestFees: number };
    performance: { netRevenueRate: number };
    monthlyTrend?: MonthlyTrend[];
    weeklyRevenue?: WeeklyRevenue[];
  };
}

export interface RevenueData {
  gross: number;
  net: number;
  taxes: number;
  fees: number;
  bySource: { source: string; amount: number }[];
  byMonth: { month: string; amount: number }[];
  lastYearData?: {
    gross: number;
    net: number;
  };
  previousPeriod?: RevenueData;
}

export interface CashflowData {
  collected: number;
  pending: number;
  collectionRate: number;
  upcoming: {
    next30Days: number;
    next60Days: number;
    next90Days: number;
  };
  previousPeriod?: CashflowData;
}

export interface TaxData {
  summary: {
    totalTax: number;
    totalRent: number;
    totalBookings: number;
    effectiveRate: number;
    platformRemitted: number;
    ownerRemitted: number;
  };
  byProperty: {
    propertyId: string;
    propertyName: string;
    totalTax: number;
    totalRent: number;
    bookingCount: number;
    taxRate: number;
  }[];
  byMonth: {
    month: string;
    totalTax: number;
    totalRent: number;
    bookingCount: number;
    effectiveRate: number;
    ownerRemitted?: number;
    platformRemitted?: number;
  }[];
  previousPeriod?: TaxData;
}

export interface FinancialSharedData {
  bookings?: any[];
  properties?: any[];
  upcomingBookings?: any[];
  lastYearBookings?: any[];
}

function normalizeSurchargeCategory(description: string): string {
  const d = (description || '').toLowerCase();
  if (/\btax\b/.test(d)) return 'tax';
  // credit card before pet — some CC fee descriptions contain the word "pet"
  if (d.includes('credit card')) return 'credit_card';
  if (/\bpet\b/.test(d)) return 'pet';
  if (d.includes('linen') || d.includes('clean')) return 'cleaning';
  return 'other_surcharge';
}

const SURCHARGE_DISPLAY_NAMES: Record<string, string> = {
  pet: 'Pet Fees',
  cleaning: 'Cleaning & Linens',
  credit_card: 'Credit Card Fees',
  other_surcharge: 'Other Surcharges',
};

function determineGranularity(from: string, to: string) {
  const daysDiff = Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24));
  return {
    useDaily: daysDiff <= 30,
    useWeekly: daysDiff > 30 && daysDiff <= 180,
    useMonthly: daysDiff > 180
  };
}

export async function getPLData(
  supabase: SupabaseClient,
  tenantId: string,
  from: string,
  to: string,
  tagIds: string[] = [],
  filterPropertyIds: string[] = [],
  shared?: FinancialSharedData
): Promise<PLData> {
  const hasTagFilter = tagIds.length > 0;
  const { useDaily, useWeekly } = determineGranularity(from, to);

  let bookings: any[];
  let properties: any[];
  let upcomingBookings: any[];

  if (shared?.bookings && shared?.properties && shared?.upcomingBookings) {
    bookings = shared.bookings;
    properties = shared.properties;
    upcomingBookings = shared.upcomingBookings;
  } else {
    let matchedBookingIds: string[] | null = null;
    let tagFilterMatchedNothing = false;
    if (hasTagFilter) {
      matchedBookingIds = await getBookingIdsForTags(supabase, tenantId, tagIds);
      if (!matchedBookingIds) tagFilterMatchedNothing = true;
    }

    let propertiesQuery = supabase
      .from('properties')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('active', true);
    if (filterPropertyIds.length > 0) propertiesQuery = propertiesQuery.in('id', filterPropertyIds);

    const [fetchedBookings, propertiesResult, fetchedUpcoming] = await Promise.all([
      fetchAllRows(() => {
        let q = supabase.from('bookings')
          .select('*, booking_charges(amount, type, description, is_taxable)')
          .eq('tenant_id', tenantId).lte('arrival', to).gte('departure', from)
          .neq('status', 'canceled').order('id');
        if (filterPropertyIds.length > 0) q = q.in('property_id', filterPropertyIds);
        if (matchedBookingIds) q = q.in('id', matchedBookingIds);
        else if (tagFilterMatchedNothing) q = q.in('id', []);
        return q;
      }),
      propertiesQuery,
      fetchAllRows(() => {
        let q = supabase.from('bookings')
          .select('total_amount, arrival')
          .eq('tenant_id', tenantId)
          .gte('arrival', new Date().toISOString().split('T')[0])
          .neq('status', 'canceled').order('id');
        if (filterPropertyIds.length > 0) q = q.in('property_id', filterPropertyIds);
        if (matchedBookingIds) q = q.in('id', matchedBookingIds);
        else if (tagFilterMatchedNothing) q = q.in('id', []);
        return q;
      }),
    ]);

    bookings = fetchedBookings;
    properties = propertiesResult.data || [];
    upcomingBookings = fetchedUpcoming;
  }

  const propertyIds = properties.map((p: any) => p.id);
  const operatingExpensesList = await getExpensesWithTemplateFallback(supabase, tenantId, from, to, propertyIds);

  // prorate every revenue/fee number by the booking's overlap with [from, to]
  const ratios = buildRatioMap(bookings, from, to);
  const r = (id: string) => ratios.get(id) ?? 0;
  // taxes follow the arrival event instead (jurisdictional)
  const arrInPeriod = buildArrivalInPeriodMap(bookings, from, to);
  const inPeriod = (id: string) => arrInPeriod.get(id) === true;

  const grossRevenue = bookings.reduce((sum, b) => sum + (b.total_amount || 0) * r(b.id), 0);
  const totalHostFees = bookings.reduce((sum, b) => sum + (b.host_service_fee || 0) * r(b.id), 0);
  const totalGuestFees = bookings.reduce((sum, b) => sum + (b.guest_listing_site_fee || 0) * r(b.id), 0);

  const totalPlatformFees = totalHostFees + totalGuestFees;

  const totalTaxes = bookings.reduce((sum, b) => {
    if (!inPeriod(b.id)) return sum;
    const taxCharges = b.booking_charges?.filter((c: any) => c.type === 'tax') || [];
    return sum + taxCharges.reduce((chargeSum: number, c: any) => chargeSum + (c.amount || 0), 0);
  }, 0);

  // guest fees are estimated and not deducted from owner revenue (billed to guest separately)
  // only host fees are a real deduction from what the owner receives
  const netRevenue = grossRevenue - totalHostFees - totalTaxes;

  const operatingExpensesByCategory = operatingExpensesList.reduce((acc: Record<string, number>, exp: any) => {
    const category = exp.category || 'other';
    acc[category] = (acc[category] || 0) + (parseFloat(exp.amount) || 0);
    return acc;
  }, {});
  const totalOperatingExpenses = Object.values(operatingExpensesByCategory).reduce((sum: number, amt) => sum + (amt as number), 0);
  const operatingProfit = netRevenue - totalOperatingExpenses;

  const today = new Date();
  // pending = in-period bookings whose stay starts in the future
  const pendingRevenue = bookings
    .filter(b => new Date(b.arrival) > today)
    .reduce((sum, b) => sum + (b.total_amount || 0) * r(b.id), 0);
  const collectedRevenue = grossRevenue - pendingRevenue;

  let next30Days = 0, next60Days = 0, next90Days = 0;
  for (const b of upcomingBookings) {
    const days = Math.ceil((new Date(b.arrival).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const amt = b.total_amount || 0;
    if (days <= 90) { next90Days += amt; if (days <= 60) { next60Days += amt; if (days <= 30) { next30Days += amt; } } }
  }

  // booked nights in-period (overlap nights, not full stay length) for ADR
  const totalNights = bookings.reduce((sum, b) => {
    return sum + prorateBooking(b, from, to).overlapNights;
  }, 0);

  const daysDiff = Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const propertyCount = properties.length || 1;
  const financialPropertyIds = properties.map(p => p.id).filter(Boolean);
  const financialBlocks = financialPropertyIds.length > 0
    ? await fetchBlocks(supabase, tenantId, from, to, financialPropertyIds)
    : [];
  const financialBlockedNights = sumBlockedNights(collectBlockedNights(financialBlocks, from, to));
  const revparDenominator = Math.max(1, propertyCount * daysDiff - financialBlockedNights);
  const revpar = grossRevenue / revparDenominator;
  const adr = totalNights > 0 ? grossRevenue / totalNights : 0;

  const platformBreakdown = new Map<string, PlatformFinancials>();
  bookings.forEach(b => {
    const platform = normalizePlatform(b.platform);
    const existing = platformBreakdown.get(platform) || {
      platform,
      grossRevenue: 0,
      fees: 0,
      netRevenue: 0,
      feeRate: 0,
      bookingCount: 0
    };

    existing.grossRevenue += (b.total_amount || 0) * r(b.id);
    existing.bookingCount++;
    platformBreakdown.set(platform, existing);
  });

  const platforms = Array.from(platformBreakdown.values()).map(p => ({
    ...p,
    netRevenue: p.grossRevenue - p.fees,
    feeRate: p.grossRevenue > 0 ? (p.fees / p.grossRevenue) * 100 : 0
  }));

  // Build charge composition breakdown
  // 'rent' is the base lodging amount already captured in total_amount — exclude it here
  const chargeDetailMap = new Map<string, { type: string; description: string; total: number; bookingIds: Set<string> }>();
  let compositionTaxes = 0;
  let compositionFees = 0;
  let compositionDiscounts = 0;
  let compositionCleaning = 0;
  let compositionPetFees = 0;
  let compositionCreditCardFees = 0;
  let compositionOtherSurcharges = 0;

  const emptyChannel = (): ChannelCharges => ({
    taxes: 0, fees: 0, discounts: 0, cleaningAndLinens: 0,
    petFees: 0, creditCardFees: 0, otherSurcharges: 0, grossRevenue: 0, guestFees: 0,
  });
  const channelDirect = emptyChannel();
  const channelOta = emptyChannel();

  bookings.forEach(b => {
    const ratio = r(b.id);
    const bookingArrivalInPeriod = inPeriod(b.id);
    const isDirect = normalizePlatform(b.platform) === 'Direct';
    const ch = isDirect ? channelDirect : channelOta;
    ch.grossRevenue += (b.total_amount || 0) * ratio;
    ch.guestFees += (b.guest_listing_site_fee || 0) * ratio;

    const charges = b.booking_charges || [];
    charges.forEach((c: any) => {
      if (c.type === 'rent') return;
      // OwnerRez sometimes sends tax as type: 'surcharge' with a "Tax" description,
      // so detect tax-like charges before picking the attribution rule.
      const isEffectivelyTax = c.type === 'tax'
        || (c.type !== 'fee' && c.type !== 'discount' && normalizeSurchargeCategory(c.description) === 'tax');
      const amount = isEffectivelyTax
        ? (bookingArrivalInPeriod ? (c.amount || 0) : 0)
        : (c.amount || 0) * ratio;
      const desc = (c.description || '').toLowerCase();

      // security deposits are refunded — exclude entirely
      if (desc.includes('security')) return;

      let detailKey: string;
      let displayType: string;
      let displayDescription: string;

      if (c.type === 'tax') {
        compositionTaxes += amount;
        ch.taxes += amount;
        detailKey = `tax:${c.description || 'Tax'}`;
        displayType = 'tax';
        displayDescription = c.description || 'Tax';
      } else if (c.type === 'fee') {
        // some fee-type charges are actually surcharges — categorize by description
        const feeCategory = normalizeSurchargeCategory(c.description);
        if (feeCategory === 'pet') {
          compositionPetFees += amount;
          ch.petFees += amount;
          detailKey = `surcharge:pet`;
          displayType = 'pet';
          displayDescription = SURCHARGE_DISPLAY_NAMES.pet;
        } else if (feeCategory === 'cleaning') {
          compositionCleaning += amount;
          ch.cleaningAndLinens += amount;
          detailKey = `surcharge:cleaning`;
          displayType = 'cleaning';
          displayDescription = SURCHARGE_DISPLAY_NAMES.cleaning;
        } else if (feeCategory === 'credit_card') {
          compositionCreditCardFees += amount;
          ch.creditCardFees += amount;
          detailKey = `surcharge:credit_card`;
          displayType = 'credit_card';
          displayDescription = SURCHARGE_DISPLAY_NAMES.credit_card;
        } else {
          compositionFees += amount;
          ch.fees += amount;
          detailKey = `fee:${c.description || 'Fee'}`;
          displayType = 'fee';
          displayDescription = c.description || 'Fee';
        }
      } else if (c.type === 'discount') {
        compositionDiscounts += amount;
        ch.discounts += amount;
        detailKey = `discount:${c.description || 'Discount'}`;
        displayType = 'discount';
        displayDescription = c.description || 'Discount';
      } else {
        // surcharge / surcharge_other / any other type — categorize by description
        const category = normalizeSurchargeCategory(c.description);
        if (category === 'tax') {
          // ownerrez sometimes sends taxes as type: 'surcharge'
          compositionTaxes += amount;
          ch.taxes += amount;
          detailKey = `tax:${c.description || 'Tax'}`;
          displayType = 'tax';
          displayDescription = c.description || 'Tax';
        } else {
          switch (category) {
            case 'cleaning': compositionCleaning += amount; ch.cleaningAndLinens += amount; break;
            case 'pet': compositionPetFees += amount; ch.petFees += amount; break;
            case 'credit_card': compositionCreditCardFees += amount; ch.creditCardFees += amount; break;
            default: compositionOtherSurcharges += amount; ch.otherSurcharges += amount; break;
          }
          detailKey = `surcharge:${category}`;
          displayType = category;
          displayDescription = SURCHARGE_DISPLAY_NAMES[category] || c.description || c.type;
        }
      }

      const existing = chargeDetailMap.get(detailKey) || { type: displayType, description: displayDescription, total: 0, bookingIds: new Set<string>() };
      existing.total += amount;
      existing.bookingIds.add(b.id);
      chargeDetailMap.set(detailKey, existing);
    });
  });

  const chargeComposition: ChargeComposition = {
    taxes: compositionTaxes,
    fees: compositionFees,
    discounts: compositionDiscounts,
    cleaningAndLinens: compositionCleaning,
    petFees: compositionPetFees,
    creditCardFees: compositionCreditCardFees,
    otherSurcharges: compositionOtherSurcharges,
    details: Array.from(chargeDetailMap.values())
      .map(({ bookingIds, ...rest }) => ({ ...rest, count: bookingIds.size }))
      .sort((a, b) => b.total - a.total),
    byChannel: { direct: channelDirect, ota: channelOta },
  };

  const monthlyData = buildTrendData(bookings, from, to, useDaily, useWeekly);
  const weeklyData = buildWeeklyData(bookings, from, to);

  return {
    metrics: {
      revenue: {
        gross: grossRevenue,
        net: netRevenue,
        pending: pendingRevenue,
        collected: collectedRevenue,
        platformFees: totalPlatformFees,
        hostFees: totalHostFees,
        guestFees: totalGuestFees,
        taxes: totalTaxes
      },
      operatingExpenses: {
        total: totalOperatingExpenses,
        byCategory: operatingExpensesByCategory
      },
      operatingProfit,
      performance: {
        netRevenueRate: grossRevenue > 0 ? (netRevenue / grossRevenue) * 100 : 0,
        avgBookingValue: bookings.length > 0 ? grossRevenue / bookings.length : 0,
        totalBookings: bookings.length
      },
      upcoming: {
        next30Days,
        next60Days,
        next90Days
      },
      kpis: {
        revpar,
        adr,
        collectionRate: grossRevenue > 0 ? (collectedRevenue / grossRevenue) * 100 : 0
      }
    },
    platforms,
    monthlyTrend: monthlyData,
    weeklyRevenue: weeklyData,
    chargeComposition
  };
}

export async function getRevenueData(
  supabase: SupabaseClient,
  tenantId: string,
  from: string,
  to: string,
  tagIds: string[] = [],
  filterPropertyIds: string[] = [],
  shared?: FinancialSharedData
): Promise<RevenueData> {
  const hasTagFilter = tagIds.length > 0;
  const { useDaily, useWeekly } = determineGranularity(from, to);

  let bookings: any[];

  if (shared?.bookings) {
    bookings = shared.bookings;
  } else {
    let matchedBookingIds: string[] | null = null;
    let tagFilterMatchedNothing = false;
    if (hasTagFilter) {
      matchedBookingIds = await getBookingIdsForTags(supabase, tenantId, tagIds);
      if (!matchedBookingIds) tagFilterMatchedNothing = true;
    }

    bookings = await fetchAllRows(() => {
      let q = supabase.from('bookings')
        .select('*, booking_charges(amount, type)')
        .eq('tenant_id', tenantId).lte('arrival', to).gte('departure', from)
        .neq('status', 'canceled').order('id');
      if (filterPropertyIds.length > 0) q = q.in('property_id', filterPropertyIds);
      if (matchedBookingIds) q = q.in('id', matchedBookingIds);
      else if (tagFilterMatchedNothing) q = q.in('id', []);
      return q;
    });
  }

  const rvRatios = buildRatioMap(bookings, from, to);
  const rr = (id: string) => rvRatios.get(id) ?? 0;
  const rvArrInPeriod = buildArrivalInPeriodMap(bookings, from, to);

  const gross = bookings.reduce((sum, b) => sum + (b.total_amount || 0) * rr(b.id), 0);

  // taxes attribute to arrival — don't prorate
  const taxes = bookings.reduce((sum, b) => {
    if (!rvArrInPeriod.get(b.id)) return sum;
    const taxCharges = b.booking_charges?.filter((c: any) => c.type === 'tax') || [];
    return sum + taxCharges.reduce((chargeSum: number, c: any) => chargeSum + (c.amount || 0), 0);
  }, 0);

  const hostFees = bookings.reduce((sum, b) =>
    sum + (b.host_service_fee || 0) * rr(b.id), 0
  );

  const net = gross - taxes - hostFees;

  const sourceMap = new Map<string, number>();
  bookings.forEach(b => {
    const source = normalizePlatform(b.platform);
    sourceMap.set(source, (sourceMap.get(source) || 0) + (b.total_amount || 0) * rr(b.id));
  });

  const bySource = Array.from(sourceMap.entries())
    .map(([source, amount]) => ({ source, amount }))
    .sort((a, b) => b.amount - a.amount);

  const byMonth = buildMonthlyRevenue(bookings, from, to, useDaily, useWeekly);

  let lastYearBookings: any[];

  if (shared?.lastYearBookings) {
    lastYearBookings = shared.lastYearBookings;
  } else {
    const lastYearFrom = subtractOneYear(from);
    const lastYearTo = subtractOneYear(to);

    let matchedBookingIds: string[] | null = null;
    if (hasTagFilter) {
      matchedBookingIds = await getBookingIdsForTags(supabase, tenantId, tagIds);
    }

    lastYearBookings = await fetchAllRows(() => {
      let q = supabase.from('bookings')
        .select('id, arrival, departure, total_amount, host_service_fee, guest_listing_site_fee, booking_charges(amount, type)')
        .eq('tenant_id', tenantId).lte('arrival', lastYearTo).gte('departure', lastYearFrom)
        .neq('status', 'canceled').order('id');
      if (filterPropertyIds.length > 0) q = q.in('property_id', filterPropertyIds);
      if (matchedBookingIds) q = q.in('id', matchedBookingIds);
      else if (hasTagFilter) q = q.in('id', []);
      return q;
    });
  }

  const lyFrom = subtractOneYear(from);
  const lyTo = subtractOneYear(to);
  const lyRatios = buildRatioMap(lastYearBookings, lyFrom, lyTo);
  const lyr = (id: string) => lyRatios.get(id) ?? 0;
  const lyArrInPeriod = buildArrivalInPeriodMap(lastYearBookings, lyFrom, lyTo);

  const lastYearGross = lastYearBookings.reduce((sum, b) => sum + (b.total_amount || 0) * lyr(b.id), 0);

  // taxes attribute to arrival
  const lastYearTaxes = lastYearBookings.reduce((sum, b) => {
    if (!lyArrInPeriod.get(b.id)) return sum;
    const taxCharges = b.booking_charges?.filter((c: any) => c.type === 'tax') || [];
    return sum + taxCharges.reduce((chargeSum: number, c: any) => chargeSum + (c.amount || 0), 0);
  }, 0);

  const lastYearHostFees = lastYearBookings.reduce((sum, b) =>
    sum + (b.host_service_fee || 0) * lyr(b.id), 0
  );

  const lastYearNet = lastYearGross - lastYearTaxes - lastYearHostFees;

  return {
    gross,
    net,
    taxes,
    fees: hostFees,
    bySource,
    byMonth,
    lastYearData: lastYearBookings.length > 0 ? {
      gross: lastYearGross,
      net: lastYearNet
    } : undefined
  };
}

export async function getCashflowData(
  supabase: SupabaseClient,
  tenantId: string,
  from: string,
  to: string,
  tagIds: string[] = [],
  filterPropertyIds: string[] = [],
  shared?: FinancialSharedData
): Promise<CashflowData> {
  const hasTagFilter = tagIds.length > 0;

  let bookings: any[];
  let upcomingBookings: any[];

  if (shared?.bookings && shared?.upcomingBookings) {
    bookings = shared.bookings;
    upcomingBookings = shared.upcomingBookings;
  } else {
    let matchedBookingIds: string[] | null = null;
    let tagFilterMatchedNothing = false;
    if (hasTagFilter) {
      matchedBookingIds = await getBookingIdsForTags(supabase, tenantId, tagIds);
      if (!matchedBookingIds) tagFilterMatchedNothing = true;
    }

    const [fetchedBookings, fetchedUpcoming] = await Promise.all([
      fetchAllRows(() => {
        let q = supabase.from('bookings').select('*')
          .eq('tenant_id', tenantId).lte('arrival', to).gte('departure', from)
          .neq('status', 'canceled').order('id');
        if (filterPropertyIds.length > 0) q = q.in('property_id', filterPropertyIds);
        if (matchedBookingIds) q = q.in('id', matchedBookingIds);
        else if (tagFilterMatchedNothing) q = q.in('id', []);
        return q;
      }),
      fetchAllRows(() => {
        let q = supabase.from('bookings').select('total_amount, arrival')
          .eq('tenant_id', tenantId)
          .gte('arrival', new Date().toISOString().split('T')[0])
          .neq('status', 'canceled').order('id');
        if (filterPropertyIds.length > 0) q = q.in('property_id', filterPropertyIds);
        if (matchedBookingIds) q = q.in('id', matchedBookingIds);
        else if (tagFilterMatchedNothing) q = q.in('id', []);
        return q;
      }),
    ]);

    bookings = fetchedBookings;
    upcomingBookings = fetchedUpcoming;
  }

  const today = new Date();
  const cfRatios = buildRatioMap(bookings, from, to);
  const cfr = (id: string) => cfRatios.get(id) ?? 0;
  const collected = bookings.filter(b => new Date(b.arrival) <= today)
    .reduce((sum, b) => sum + (b.total_amount || 0) * cfr(b.id), 0);

  // pending = all confirmed future bookings (from the upcomingBookings query
  // which uses arrival >= today). the main bookings query is bounded by the
  // selected date range, so arrival > today is always empty when the range
  // ends at or before today.
  let pending = 0;
  let next30Days = 0, next60Days = 0, next90Days = 0;
  for (const b of upcomingBookings) {
      const days = Math.ceil((new Date(b.arrival).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const amt = b.total_amount || 0;
      pending += amt;
      if (days <= 90) { next90Days += amt; if (days <= 60) { next60Days += amt; if (days <= 30) { next30Days += amt; } } }
  }

  const total = collected + pending;

  return {
    collected,
    pending,
    collectionRate: total > 0 ? (collected / total) * 100 : 0,
    upcoming: {
      next30Days,
      next60Days,
      next90Days
    }
  };
}

export async function getTaxData(
  supabase: SupabaseClient,
  tenantId: string,
  from: string,
  to: string,
  tagIds: string[] = [],
  filterPropertyIds: string[] = [],
  shared?: FinancialSharedData
): Promise<TaxData> {
  const hasTagFilter = tagIds.length > 0;
  const { useDaily, useWeekly } = determineGranularity(from, to);

  let bookings: any[];

  if (shared?.bookings) {
    bookings = shared.bookings;
  } else {
    let matchedBookingIds: string[] | null = null;
    if (hasTagFilter) {
      matchedBookingIds = await getBookingIdsForTags(supabase, tenantId, tagIds);
    }

    bookings = await fetchAllRows(() => {
      let q = supabase.from('bookings')
        .select('*, properties!inner(id, name, internal_code), booking_charges(amount, type, is_taxable)')
        .eq('tenant_id', tenantId).lte('arrival', to).gte('departure', from)
        .neq('status', 'canceled').order('id');
      if (filterPropertyIds.length > 0) q = q.in('property_id', filterPropertyIds);
      if (matchedBookingIds) q = q.in('id', matchedBookingIds);
      return q;
    });
  }

  // when using shared data, bookings lack the joined `properties` field,
  // so build a lookup map from shared.properties instead
  const propertyLookup = shared?.properties
    ? new Map(shared.properties.map((p: any) => [p.id, p]))
    : null;

  // check if is_taxable data has been synced (short-circuits on first match)
  const hasTaxableData = bookings.some(b =>
    b.booking_charges?.some((c: any) => c.is_taxable === true)
  );

  // Revenue denominator prorates by service period; tax totals attribute to
  // the booking's arrival (the taxable event) so "taxes collected" matches
  // what the host remits to their city/state.
  const taxRatios = buildRatioMap(bookings, from, to);
  const tr = (id: string) => taxRatios.get(id) ?? 0;
  const taxArrInPeriod = buildArrivalInPeriodMap(bookings, from, to);

  let totalRent = 0;
  let ownerTax = 0;
  let platformTax = 0;
  let taxableBase = 0;

  const propertyTaxMap = new Map();
  bookings.forEach(b => {
    const ratio = tr(b.id);
    const countTax = taxArrInPeriod.get(b.id) === true;
    const charges = b.booking_charges || [];
    let bookingTax = 0;
    let bookingTaxable = 0;

    for (const c of charges) {
      if (c.type === 'tax' && countTax) bookingTax += c.amount || 0;
      if (hasTaxableData && c.is_taxable === true && countTax) bookingTaxable += c.amount || 0;
    }

    totalRent += (b.total_amount || 0) * ratio;
    taxableBase += bookingTaxable;

    if (PLATFORM_REMITS_TAX.has(normalizePlatform(b.platform))) {
      platformTax += bookingTax;
    } else {
      ownerTax += bookingTax;
    }

    const property = b.properties || (propertyLookup ? propertyLookup.get(b.property_id) : null);
    if (!property) return;

    const existing = propertyTaxMap.get(property.id) || {
      propertyId: property.id,
      propertyName: property.name,
      propertyCode: property.internal_code || null,
      totalTax: 0,
      totalRent: 0,
      bookingCount: 0,
      taxRate: 0
    };

    existing.totalTax += bookingTax;
    existing.totalRent += hasTaxableData ? bookingTaxable : (b.total_amount || 0) * ratio;
    existing.bookingCount++;

    propertyTaxMap.set(property.id, existing);
  });

  const totalTax = ownerTax + platformTax;

  const byProperty = Array.from(propertyTaxMap.values()).map(p => ({
    ...p,
    taxRate: p.totalRent > 0 ? (p.totalTax / p.totalRent) * 100 : 0
  }));

  const byMonth = buildMonthlyTaxData(bookings, from, to, useDaily, useWeekly, hasTaxableData);

  const effectiveDenominator = hasTaxableData ? taxableBase : totalRent;

  return {
    summary: {
      totalTax,
      totalRent,
      totalBookings: bookings.length,
      effectiveRate: effectiveDenominator > 0 ? (totalTax / effectiveDenominator) * 100 : 0,
      platformRemitted: platformTax,
      ownerRemitted: ownerTax
    },
    byProperty,
    byMonth
  };
}

export async function getFinancialBatchData(
  supabase: SupabaseClient,
  tenantId: string,
  from: string,
  to: string,
  tagIds: string[] = [],
  filterPropertyIds: string[] = []
): Promise<{ pl: PLData; revenue: RevenueData; cashflow: CashflowData; tax: TaxData }> {
  const hasTagFilter = tagIds.length > 0;

  // resolve tag filter once up front so every sub-query (current, upcoming,
  // last-year) can reuse the same booking-id set. without this the upcoming
  // and last-year queries below would silently ignore the tag filter and the
  // numbers wouldn't match the main period view.
  let matchedBookingIds: string[] | null = null;
  let tagFilterMatchedNothing = false;
  if (hasTagFilter) {
    matchedBookingIds = await getBookingIdsForTags(supabase, tenantId, tagIds);
    if (!matchedBookingIds) {
      tagFilterMatchedNothing = true;
    }
  }

  const buildBookingsQuery = () => {
    let q = supabase
      .from('bookings')
      .select('*, booking_charges(amount, type, description, is_taxable)')
      .eq('tenant_id', tenantId)
      .lte('arrival', to)
      .gte('departure', from)
      .neq('status', 'canceled')
      .order('id');
    if (filterPropertyIds.length > 0) q = q.in('property_id', filterPropertyIds);
    if (matchedBookingIds) q = q.in('id', matchedBookingIds);
    else if (tagFilterMatchedNothing) q = q.in('id', []);
    return q;
  };

  let propertiesQuery = supabase
    .from('properties')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('active', true);

  if (filterPropertyIds.length > 0) {
    propertiesQuery = propertiesQuery.in('id', filterPropertyIds);
  }

  const lastYearFrom = subtractOneYear(from);
  const lastYearTo = subtractOneYear(to);

  // upcoming bookings query: must share the same property + tag filter as the
  // main bookings query so the next-30/60/90 cards match the rest of the view.
  const buildUpcomingQuery = () => {
    let q = supabase
      .from('bookings')
      .select('total_amount, arrival')
      .eq('tenant_id', tenantId)
      .gte('arrival', new Date().toISOString().split('T')[0])
      .neq('status', 'canceled')
      .order('id');
    if (filterPropertyIds.length > 0) q = q.in('property_id', filterPropertyIds);
    if (matchedBookingIds) q = q.in('id', matchedBookingIds);
    else if (tagFilterMatchedNothing) q = q.in('id', []);
    return q;
  };

  // last-year comparison query: same filters so YoY comparisons aren't
  // comparing a property-filtered current period against an all-properties
  // last-year snapshot.
  const buildLastYearQuery = () => {
    let q = supabase
      .from('bookings')
      .select('id, arrival, departure, total_amount, host_service_fee, guest_listing_site_fee, booking_charges(amount, type)')
      .eq('tenant_id', tenantId)
      .lte('arrival', lastYearTo)
      .gte('departure', lastYearFrom)
      .neq('status', 'canceled')
      .order('id');
    if (filterPropertyIds.length > 0) q = q.in('property_id', filterPropertyIds);
    if (matchedBookingIds) q = q.in('id', matchedBookingIds);
    else if (tagFilterMatchedNothing) q = q.in('id', []);
    return q;
  };

  const [bookings, propertiesResult, upcomingBookings, lastYearBookings] = await Promise.all([
    fetchAllRows(buildBookingsQuery),
    propertiesQuery,
    fetchAllRows(buildUpcomingQuery),
    fetchAllRows(buildLastYearQuery)
  ]);

  const properties = propertiesResult.data || [];

  const shared: FinancialSharedData = { bookings, properties, upcomingBookings };

  const [pl, revenue, cashflow, tax] = await Promise.all([
    getPLData(supabase, tenantId, from, to, tagIds, filterPropertyIds, shared),
    getRevenueData(supabase, tenantId, from, to, tagIds, filterPropertyIds,
      { bookings, lastYearBookings }),
    getCashflowData(supabase, tenantId, from, to, tagIds, filterPropertyIds, shared),
    getTaxData(supabase, tenantId, from, to, tagIds, filterPropertyIds, shared)
  ]);

  return { pl, revenue, cashflow, tax };
}

function buildTrendData(
  bookings: any[],
  from: string,
  to: string,
  useDaily: boolean,
  useWeekly: boolean
): MonthlyTrend[] {
  const granularity: Granularity = useDaily ? 'day' : useWeekly ? 'week' : 'month';
  const trendMap = new Map<string, MonthlyTrend & { _arrivalBookings: number }>();

  for (const b of bookings) {
    const taxTotal = (b.booking_charges || [])
      .filter((c: { type: string }) => c.type === 'tax')
      .reduce((sum: number, c: { amount: number }) => sum + (c.amount || 0), 0);
    const buckets = bucketBooking(b, from, to, granularity);
    if (buckets.length === 0) continue;

    // Revenue and host fees spread across every bucket the booking overlaps.
    for (const bkt of buckets) {
      const existing = trendMap.get(bkt.key) ||
        { month: bkt.key, revenue: 0, bookings: 0, avgBookingValue: 0, hostFees: 0, taxes: 0, _arrivalBookings: 0 };
      existing.revenue += bkt.revenue;
      existing.hostFees += bkt.hostFee;
      trendMap.set(bkt.key, existing);
    }

    // Taxes + booking counts attribute to the arrival date's bucket, and only
    // if the arrival itself fell inside the visible period. A stay that arrived
    // before `from` but spans into it contributes revenue here (service period)
    // but its tax event already happened outside this window.
    if (isArrivalInPeriod(b, from, to)) {
      const arrivalKey = bucketKeyForDate(b.arrival, granularity);
      const arr = trendMap.get(arrivalKey)
        ?? { month: arrivalKey, revenue: 0, bookings: 0, avgBookingValue: 0, hostFees: 0, taxes: 0, _arrivalBookings: 0 };
      arr.taxes += taxTotal;
      arr._arrivalBookings += 1;
      arr.bookings += 1;
      trendMap.set(arrivalKey, arr);
    }
  }

  return enumerateBuckets(from, to, granularity).map(b => {
    const data = trendMap.get(b.key) ||
      { month: b.key, revenue: 0, bookings: 0, avgBookingValue: 0, hostFees: 0, taxes: 0, _arrivalBookings: 0 };
    data.avgBookingValue = data.bookings > 0 ? data.revenue / data.bookings : 0;
    const { _arrivalBookings, ...rest } = data;
    return rest;
  });
}

function buildWeeklyData(bookings: any[], from: string, to: string): WeeklyRevenue[] {
  const weekMap = new Map<string, WeeklyRevenue>();

  for (const b of bookings) {
    const buckets = bucketBooking(b, from, to, 'week');
    if (buckets.length === 0) continue;
    for (const bkt of buckets) {
      const existing = weekMap.get(bkt.key) || { week: bkt.key, revenue: 0, bookings: 0 };
      existing.revenue += bkt.revenue;
      weekMap.set(bkt.key, existing);
    }
    // booking count attributed to the arrival week — only if the arrival
    // itself falls inside the visible period
    if (isArrivalInPeriod(b, from, to)) {
      const arrivalKey = bucketKeyForDate(b.arrival, 'week');
      const arr = weekMap.get(arrivalKey) || { week: arrivalKey, revenue: 0, bookings: 0 };
      arr.bookings += 1;
      weekMap.set(arrivalKey, arr);
    }
  }

  return Array.from(weekMap.values())
    .sort((a, b) => b.week.localeCompare(a.week))
    .slice(0, 12);
}

function buildMonthlyRevenue(
  bookings: any[],
  from: string,
  to: string,
  useDaily: boolean,
  useWeekly: boolean
): { month: string; amount: number }[] {
  const granularity: Granularity = useDaily ? 'day' : useWeekly ? 'week' : 'month';
  const revenueMap = new Map<string, number>();

  for (const b of bookings) {
    for (const bkt of bucketBooking(b, from, to, granularity)) {
      revenueMap.set(bkt.key, (revenueMap.get(bkt.key) || 0) + bkt.revenue);
    }
  }

  return enumerateBuckets(from, to, granularity).map(b => ({
    month: b.key,
    amount: revenueMap.get(b.key) || 0,
  }));
}

function buildMonthlyTaxData(
  bookings: any[],
  from: string,
  to: string,
  useDaily: boolean,
  useWeekly: boolean,
  hasTaxableData: boolean = false
): any[] {
  const granularity: Granularity = useDaily ? 'day' : useWeekly ? 'week' : 'month';
  const taxMap = new Map<string, {
    month: string; totalTax: number; totalRent: number; bookingCount: number;
    ownerRemitted: number; platformRemitted: number; effectiveRate: number;
  }>();

  const ensureBucket = (key: string) => {
    let existing = taxMap.get(key);
    if (!existing) {
      existing = {
        month: key, totalTax: 0, totalRent: 0, bookingCount: 0,
        ownerRemitted: 0, platformRemitted: 0, effectiveRate: 0,
      };
      taxMap.set(key, existing);
    }
    return existing;
  };

  for (const b of bookings) {
    const charges = b.booking_charges || [];
    let bookingTax = 0;
    let bookingTaxable = 0;
    for (const c of charges) {
      if (c.type === 'tax') bookingTax += c.amount || 0;
      if (hasTaxableData && c.is_taxable === true) bookingTaxable += c.amount || 0;
    }

    // Revenue denominator (`totalRent`) follows service-period proration
    // across every bucket the booking overlaps.
    if (!hasTaxableData) {
      for (const bkt of bucketBooking(b, from, to, granularity)) {
        ensureBucket(bkt.key).totalRent += bkt.revenue;
      }
    }

    // Tax liability, taxable base, booking count: all attributed in full to
    // the arrival bucket when the arrival falls inside the visible period.
    if (isArrivalInPeriod(b, from, to)) {
      const arrivalKey = bucketKeyForDate(b.arrival, granularity);
      const arr = ensureBucket(arrivalKey);
      arr.totalTax += bookingTax;
      if (hasTaxableData) arr.totalRent += bookingTaxable;
      arr.bookingCount += 1;
      if (PLATFORM_REMITS_TAX.has(normalizePlatform(b.platform))) {
        arr.platformRemitted += bookingTax;
      } else {
        arr.ownerRemitted += bookingTax;
      }
    }
  }

  return enumerateBuckets(from, to, granularity).map(b => {
    const data = ensureBucket(b.key);
    data.effectiveRate = data.totalRent > 0 ? (data.totalTax / data.totalRent) * 100 : 0;
    return data;
  });
}