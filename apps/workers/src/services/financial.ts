import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_MAX_ROWS } from '../constants';
import { getExpensesWithTemplateFallback } from './expense-utils';
import { normalizePlatform, PLATFORM_REMITS_TAX } from '../utils/platform';
import { getBookingIdsForTags } from '../utils/tag-filter';

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
    let bookingsQuery = supabase
      .from('bookings')
      .select(`
        *,
        booking_charges(amount, type, description, is_taxable)
      `)
      .eq('tenant_id', tenantId)
      .lte('arrival', to)
      .gte('departure', from)
      .neq('status', 'canceled')
      .limit(SUPABASE_MAX_ROWS);

    if (filterPropertyIds.length > 0) {
      bookingsQuery = bookingsQuery.in('property_id', filterPropertyIds);
    }

    let matchedBookingIds: string[] | null = null;
    let tagFilterMatchedNothing = false;
    if (hasTagFilter) {
      matchedBookingIds = await getBookingIdsForTags(supabase, tenantId, tagIds);
      if (matchedBookingIds) {
        bookingsQuery = bookingsQuery.in('id', matchedBookingIds);
      } else {
        tagFilterMatchedNothing = true;
        bookingsQuery = bookingsQuery.in('id', []);
      }
    }

    let propertiesQuery = supabase
      .from('properties')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('active', true);

    if (filterPropertyIds.length > 0) {
      propertiesQuery = propertiesQuery.in('id', filterPropertyIds);
    }

    // upcoming bookings query must share the same property + tag filter as the
    // main bookings query so next-30/60/90 totals match the filtered view.
    let upcomingQuery = supabase
      .from('bookings')
      .select('total_amount, arrival')
      .eq('tenant_id', tenantId)
      .gte('arrival', new Date().toISOString().split('T')[0])
      .neq('status', 'canceled')
      .limit(SUPABASE_MAX_ROWS);

    if (filterPropertyIds.length > 0) {
      upcomingQuery = upcomingQuery.in('property_id', filterPropertyIds);
    }
    if (matchedBookingIds) {
      upcomingQuery = upcomingQuery.in('id', matchedBookingIds);
    } else if (tagFilterMatchedNothing) {
      upcomingQuery = upcomingQuery.in('id', []);
    }

    const [bookingsResult, propertiesResult, upcomingResult] = await Promise.all([
      bookingsQuery,
      propertiesQuery,
      upcomingQuery
    ]);

    bookings = bookingsResult.data || [];
    properties = propertiesResult.data || [];
    upcomingBookings = upcomingResult.data || [];
  }

  const propertyIds = properties.map((p: any) => p.id);
  const operatingExpensesList = await getExpensesWithTemplateFallback(supabase, tenantId, from, to, propertyIds);

  const grossRevenue = bookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);

  // host fees (actual, from ownerrez) and guest fees (estimated at sync time, ~13-15%)
  const totalHostFees = bookings.reduce((sum, b) => sum + (b.host_service_fee || 0), 0);
  const totalGuestFees = bookings.reduce((sum, b) => sum + (b.guest_listing_site_fee || 0), 0);

  const totalPlatformFees = totalHostFees + totalGuestFees;

  const totalTaxes = bookings.reduce((sum, b) => {
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
  const pendingRevenue = bookings
    .filter(b => new Date(b.arrival) > today)
    .reduce((sum, b) => sum + (b.total_amount || 0), 0);
  const collectedRevenue = grossRevenue - pendingRevenue;

  let next30Days = 0, next60Days = 0, next90Days = 0;
  for (const b of upcomingBookings) {
    const days = Math.ceil((new Date(b.arrival).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const amt = b.total_amount || 0;
    if (days <= 90) { next90Days += amt; if (days <= 60) { next60Days += amt; if (days <= 30) { next30Days += amt; } } }
  }

  const totalNights = bookings.reduce((sum, b) => {
    const nights = Math.ceil(
      (new Date(b.departure).getTime() - new Date(b.arrival).getTime()) / (1000 * 60 * 60 * 24)
    );
    return sum + nights;
  }, 0);

  const daysDiff = Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const propertyCount = properties.length || 1;
  const revpar = grossRevenue / (propertyCount * daysDiff);
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

    existing.grossRevenue += b.total_amount || 0;
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
    const isDirect = normalizePlatform(b.platform) === 'Direct';
    const ch = isDirect ? channelDirect : channelOta;
    ch.grossRevenue += b.total_amount || 0;
    ch.guestFees += b.guest_listing_site_fee || 0;

    const charges = b.booking_charges || [];
    charges.forEach((c: any) => {
      if (c.type === 'rent') return;
      const amount = c.amount || 0;
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
  const weeklyData = buildWeeklyData(bookings);

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
    let bookingsQuery = supabase
      .from('bookings')
      .select(`
        *,
        booking_charges(amount, type)
      `)
      .eq('tenant_id', tenantId)
      .lte('arrival', to)
      .gte('departure', from)
      .neq('status', 'canceled')
      .limit(SUPABASE_MAX_ROWS);

    if (filterPropertyIds.length > 0) {
      bookingsQuery = bookingsQuery.in('property_id', filterPropertyIds);
    }

    if (hasTagFilter) {
      const matchedBookingIds = await getBookingIdsForTags(supabase, tenantId, tagIds);
      if (matchedBookingIds) {
        bookingsQuery = bookingsQuery.in('id', matchedBookingIds);
      }
    }

    const { data: bookingsData } = await bookingsQuery;
    bookings = bookingsData || [];
  }

  const gross = bookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);

  const taxes = bookings.reduce((sum, b) => {
    const taxCharges = b.booking_charges?.filter((c: any) => c.type === 'tax') || [];
    return sum + taxCharges.reduce((chargeSum: number, c: any) => chargeSum + (c.amount || 0), 0);
  }, 0);

  const hostFees = bookings.reduce((sum, b) =>
    sum + (b.host_service_fee || 0), 0
  );

  const net = gross - taxes - hostFees;

  const sourceMap = new Map<string, number>();
  bookings.forEach(b => {
    const source = normalizePlatform(b.platform);
    sourceMap.set(source, (sourceMap.get(source) || 0) + (b.total_amount || 0));
  });

  const bySource = Array.from(sourceMap.entries())
    .map(([source, amount]) => ({ source, amount }))
    .sort((a, b) => b.amount - a.amount);

  const byMonth = buildMonthlyRevenue(bookings, from, to, useDaily, useWeekly);

  let lastYearBookings: any[];

  if (shared?.lastYearBookings) {
    lastYearBookings = shared.lastYearBookings;
  } else {
    const lastYear = new Date(from).getFullYear() - 1;
    const lastYearFrom = from.replace(/\d{4}/, lastYear.toString());
    const lastYearTo = to.replace(/\d{4}/, lastYear.toString());

    // last-year comparison must honor the same property + tag filter as the
    // current-period query, otherwise YoY deltas compare a filtered current
    // period against an all-properties historical snapshot.
    let lastYearQuery = supabase
      .from('bookings')
      .select(`
        total_amount,
        host_service_fee,
        guest_listing_site_fee,
        booking_charges(amount, type)
      `)
      .eq('tenant_id', tenantId)
      .lte('arrival', lastYearTo)
      .gte('departure', lastYearFrom)
      .neq('status', 'canceled')
      .limit(SUPABASE_MAX_ROWS);

    if (filterPropertyIds.length > 0) {
      lastYearQuery = lastYearQuery.in('property_id', filterPropertyIds);
    }

    if (hasTagFilter) {
      const matchedBookingIds = await getBookingIdsForTags(supabase, tenantId, tagIds);
      if (matchedBookingIds) {
        lastYearQuery = lastYearQuery.in('id', matchedBookingIds);
      } else {
        lastYearQuery = lastYearQuery.in('id', []);
      }
    }

    const { data: lastYearBookingsData } = await lastYearQuery;
    lastYearBookings = lastYearBookingsData || [];
  }

  const lastYearGross = lastYearBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);

  const lastYearTaxes = lastYearBookings.reduce((sum, b) => {
    const taxCharges = b.booking_charges?.filter((c: any) => c.type === 'tax') || [];
    return sum + taxCharges.reduce((chargeSum: number, c: any) => chargeSum + (c.amount || 0), 0);
  }, 0);

  const lastYearHostFees = lastYearBookings.reduce((sum, b) =>
    sum + (b.host_service_fee || 0), 0
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

  let bookings: any[] | null;
  let upcomingBookings: any[] | null;

  if (shared?.bookings && shared?.upcomingBookings) {
    bookings = shared.bookings;
    upcomingBookings = shared.upcomingBookings;
  } else {
    let bookingsQuery = supabase
      .from('bookings')
      .select('*')
      .eq('tenant_id', tenantId)
      .lte('arrival', to)
      .gte('departure', from)
      .neq('status', 'canceled')
      .limit(SUPABASE_MAX_ROWS);

    if (filterPropertyIds.length > 0) {
      bookingsQuery = bookingsQuery.in('property_id', filterPropertyIds);
    }

    let matchedBookingIds: string[] | null = null;
    let tagFilterMatchedNothing = false;
    if (hasTagFilter) {
      matchedBookingIds = await getBookingIdsForTags(supabase, tenantId, tagIds);
      if (matchedBookingIds) {
        bookingsQuery = bookingsQuery.in('id', matchedBookingIds);
      } else {
        tagFilterMatchedNothing = true;
        bookingsQuery = bookingsQuery.in('id', []);
      }
    }

    const { data: bookingsData } = await bookingsQuery;
    bookings = bookingsData;

    // upcoming bookings query must share the same property + tag filter as the
    // main bookings query so next-30/60/90 totals match the filtered view.
    let upcomingQuery = supabase
      .from('bookings')
      .select('total_amount, arrival')
      .eq('tenant_id', tenantId)
      .gte('arrival', new Date().toISOString().split('T')[0])
      .neq('status', 'canceled')
      .limit(SUPABASE_MAX_ROWS);

    if (filterPropertyIds.length > 0) {
      upcomingQuery = upcomingQuery.in('property_id', filterPropertyIds);
    }
    if (matchedBookingIds) {
      upcomingQuery = upcomingQuery.in('id', matchedBookingIds);
    } else if (tagFilterMatchedNothing) {
      upcomingQuery = upcomingQuery.in('id', []);
    }

    const { data: upcomingData } = await upcomingQuery;
    upcomingBookings = upcomingData;
  }

  const today = new Date();
  const collected = bookings?.filter(b => new Date(b.arrival) <= today)
    .reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;
  const pending = bookings?.filter(b => new Date(b.arrival) > today)
    .reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;
  const total = collected + pending;

  let next30Days = 0, next60Days = 0, next90Days = 0;
  if (upcomingBookings) {
    for (const b of upcomingBookings) {
      const days = Math.ceil((new Date(b.arrival).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const amt = b.total_amount || 0;
      if (days <= 90) { next90Days += amt; if (days <= 60) { next60Days += amt; if (days <= 30) { next30Days += amt; } } }
    }
  }

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
    let bookingsQuery = supabase
      .from('bookings')
      .select(`
        *,
        properties!inner(id, name, internal_code),
        booking_charges(amount, type, is_taxable)
      `)
      .eq('tenant_id', tenantId)
      .lte('arrival', to)
      .gte('departure', from)
      .neq('status', 'canceled')
      .limit(SUPABASE_MAX_ROWS);

    if (filterPropertyIds.length > 0) {
      bookingsQuery = bookingsQuery.in('property_id', filterPropertyIds);
    }

    if (hasTagFilter) {
      const matchedBookingIds = await getBookingIdsForTags(supabase, tenantId, tagIds);
      if (matchedBookingIds) {
        bookingsQuery = bookingsQuery.in('id', matchedBookingIds);
      }
    }

    const { data: bookingsData } = await bookingsQuery;
    bookings = bookingsData || [];
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

  // single pass: compute totals and per-property breakdown
  let totalRent = 0;
  let ownerTax = 0;
  let platformTax = 0;
  let taxableBase = 0;

  const propertyTaxMap = new Map();
  bookings.forEach(b => {
    const charges = b.booking_charges || [];
    let bookingTax = 0;
    let bookingTaxable = 0;

    for (const c of charges) {
      if (c.type === 'tax') bookingTax += c.amount || 0;
      if (hasTaxableData && c.is_taxable === true) bookingTaxable += c.amount || 0;
    }

    totalRent += b.total_amount || 0;
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
    existing.totalRent += hasTaxableData ? bookingTaxable : (b.total_amount || 0);
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

  let bookingsQuery = supabase
    .from('bookings')
    .select('*, booking_charges(amount, type, description, is_taxable)')
    .eq('tenant_id', tenantId)
    .lte('arrival', to)
    .gte('departure', from)
    .neq('status', 'canceled')
    .limit(SUPABASE_MAX_ROWS);

  if (filterPropertyIds.length > 0) {
    bookingsQuery = bookingsQuery.in('property_id', filterPropertyIds);
  }

  if (matchedBookingIds) {
    bookingsQuery = bookingsQuery.in('id', matchedBookingIds);
  } else if (tagFilterMatchedNothing) {
    bookingsQuery = bookingsQuery.in('id', []);
  }

  let propertiesQuery = supabase
    .from('properties')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('active', true);

  if (filterPropertyIds.length > 0) {
    propertiesQuery = propertiesQuery.in('id', filterPropertyIds);
  }

  const lastYear = new Date(from).getFullYear() - 1;
  const lastYearFrom = from.replace(/\d{4}/, lastYear.toString());
  const lastYearTo = to.replace(/\d{4}/, lastYear.toString());

  // upcoming bookings query: must share the same property + tag filter as the
  // main bookings query so the next-30/60/90 cards match the rest of the view.
  let upcomingQuery = supabase
    .from('bookings')
    .select('total_amount, arrival')
    .eq('tenant_id', tenantId)
    .gte('arrival', new Date().toISOString().split('T')[0])
    .neq('status', 'canceled')
    .limit(SUPABASE_MAX_ROWS);

  if (filterPropertyIds.length > 0) {
    upcomingQuery = upcomingQuery.in('property_id', filterPropertyIds);
  }
  if (matchedBookingIds) {
    upcomingQuery = upcomingQuery.in('id', matchedBookingIds);
  } else if (tagFilterMatchedNothing) {
    upcomingQuery = upcomingQuery.in('id', []);
  }

  // last-year comparison query: same filters so YoY comparisons aren't
  // comparing a property-filtered current period against an all-properties
  // last-year snapshot.
  let lastYearQuery = supabase
    .from('bookings')
    .select('total_amount, host_service_fee, guest_listing_site_fee, booking_charges(amount, type)')
    .eq('tenant_id', tenantId)
    .lte('arrival', lastYearTo)
    .gte('departure', lastYearFrom)
    .neq('status', 'canceled')
    .limit(SUPABASE_MAX_ROWS);

  if (filterPropertyIds.length > 0) {
    lastYearQuery = lastYearQuery.in('property_id', filterPropertyIds);
  }
  if (matchedBookingIds) {
    lastYearQuery = lastYearQuery.in('id', matchedBookingIds);
  } else if (tagFilterMatchedNothing) {
    lastYearQuery = lastYearQuery.in('id', []);
  }

  const [bookingsResult, propertiesResult, upcomingResult, lastYearResult] = await Promise.all([
    bookingsQuery,
    propertiesQuery,
    upcomingQuery,
    lastYearQuery
  ]);

  const bookings = bookingsResult.data || [];
  const properties = propertiesResult.data || [];
  const upcomingBookings = upcomingResult.data || [];
  const lastYearBookings = lastYearResult.data || [];

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
  const trendMap = new Map();
  
  bookings.forEach(b => {
    const date = new Date(b.arrival);
    let key: string;
    
    if (useDaily) {
      key = date.toISOString().split('T')[0];
    } else if (useWeekly) {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      key = weekStart.toISOString().split('T')[0];
    } else {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
    
    const existing = trendMap.get(key) || { month: key, revenue: 0, bookings: 0, avgBookingValue: 0, hostFees: 0, taxes: 0 };
    existing.revenue += b.total_amount || 0;
    existing.hostFees += b.host_service_fee || 0;
    existing.taxes += (b.booking_charges || [])
      .filter((c: { type: string }) => c.type === 'tax')
      .reduce((sum: number, c: { amount: number }) => sum + (c.amount || 0), 0);
    existing.bookings++;
    trendMap.set(key, existing);
  });

  const startDate = new Date(from);
  const endDate = new Date(to);
  const result = [];

  if (useDaily) {
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      const data = trendMap.get(key) || { month: key, revenue: 0, bookings: 0, avgBookingValue: 0, hostFees: 0, taxes: 0 };
      data.avgBookingValue = data.bookings > 0 ? data.revenue / data.bookings : 0;
      result.push(data);
    }
  } else if (useWeekly) {
    const weekStart = new Date(startDate);
    weekStart.setDate(startDate.getDate() - startDate.getDay());
    
    for (let d = new Date(weekStart); d <= endDate; d.setDate(d.getDate() + 7)) {
      const key = d.toISOString().split('T')[0];
      const data = trendMap.get(key) || { month: key, revenue: 0, bookings: 0, avgBookingValue: 0, hostFees: 0, taxes: 0 };
      data.avgBookingValue = data.bookings > 0 ? data.revenue / data.bookings : 0;
      result.push(data);
    }
  } else {
    for (let d = new Date(startDate); d <= endDate; d.setMonth(d.getMonth() + 1)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const data = trendMap.get(key) || { month: key, revenue: 0, bookings: 0, avgBookingValue: 0, hostFees: 0, taxes: 0 };
      data.avgBookingValue = data.bookings > 0 ? data.revenue / data.bookings : 0;
      result.push(data);
    }
  }

  return result;
}

function buildWeeklyData(bookings: any[]): WeeklyRevenue[] {
  const weekMap = new Map();
  
  bookings.forEach(b => {
    const date = new Date(b.arrival);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const key = weekStart.toISOString().split('T')[0];
    
    const existing = weekMap.get(key) || { week: key, revenue: 0, bookings: 0 };
    existing.revenue += b.total_amount || 0;
    existing.bookings++;
    weekMap.set(key, existing);
  });

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
  const revenueMap = new Map();
  
  bookings.forEach(b => {
    const date = new Date(b.arrival);
    let key: string;
    
    if (useDaily) {
      key = date.toISOString().split('T')[0];
    } else if (useWeekly) {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      key = weekStart.toISOString().split('T')[0];
    } else {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
    
    revenueMap.set(key, (revenueMap.get(key) || 0) + (b.total_amount || 0));
  });

  const startDate = new Date(from);
  const endDate = new Date(to);
  const result = [];

  if (useDaily) {
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      result.push({ month: key, amount: revenueMap.get(key) || 0 });
    }
  } else if (useWeekly) {
    const weekStart = new Date(startDate);
    weekStart.setDate(startDate.getDate() - startDate.getDay());
    
    for (let d = new Date(weekStart); d <= endDate; d.setDate(d.getDate() + 7)) {
      const key = d.toISOString().split('T')[0];
      result.push({ month: key, amount: revenueMap.get(key) || 0 });
    }
  } else {
    for (let d = new Date(startDate); d <= endDate; d.setMonth(d.getMonth() + 1)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      result.push({ month: key, amount: revenueMap.get(key) || 0 });
    }
  }

  return result;
}

function buildMonthlyTaxData(
  bookings: any[],
  from: string,
  to: string,
  useDaily: boolean,
  useWeekly: boolean,
  hasTaxableData: boolean = false
): any[] {
  const taxMap = new Map();

  bookings.forEach(b => {
    const date = new Date(b.arrival);
    let key: string;

    if (useDaily) {
      key = date.toISOString().split('T')[0];
    } else if (useWeekly) {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      key = weekStart.toISOString().split('T')[0];
    } else {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    const existing = taxMap.get(key) || {
      month: key,
      totalTax: 0,
      totalRent: 0,
      bookingCount: 0,
      ownerRemitted: 0,
      platformRemitted: 0
    };

    const charges = b.booking_charges || [];
    let bookingTax = 0;
    let bookingTaxable = 0;
    for (const c of charges) {
      if (c.type === 'tax') bookingTax += c.amount || 0;
      if (hasTaxableData && c.is_taxable === true) bookingTaxable += c.amount || 0;
    }

    existing.totalTax += bookingTax;
    existing.totalRent += hasTaxableData ? bookingTaxable : (b.total_amount || 0);
    existing.bookingCount++;

    if (PLATFORM_REMITS_TAX.has(normalizePlatform(b.platform))) {
      existing.platformRemitted += bookingTax;
    } else {
      existing.ownerRemitted += bookingTax;
    }

    taxMap.set(key, existing);
  });

  const startDate = new Date(from);
  const endDate = new Date(to);
  const result = [];

  if (useDaily) {
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      const data = taxMap.get(key) || {
        month: key,
        totalTax: 0,
        totalRent: 0,
        bookingCount: 0,
        effectiveRate: 0,
        ownerRemitted: 0,
        platformRemitted: 0
      };
      data.effectiveRate = data.totalRent > 0 ? (data.totalTax / data.totalRent) * 100 : 0;
      result.push(data);
    }
  } else if (useWeekly) {
    const weekStart = new Date(startDate);
    weekStart.setDate(startDate.getDate() - startDate.getDay());
    
    for (let d = new Date(weekStart); d <= endDate; d.setDate(d.getDate() + 7)) {
      const key = d.toISOString().split('T')[0];
      const data = taxMap.get(key) || {
        month: key,
        totalTax: 0,
        totalRent: 0,
        bookingCount: 0,
        effectiveRate: 0,
        ownerRemitted: 0,
        platformRemitted: 0
      };
      data.effectiveRate = data.totalRent > 0 ? (data.totalTax / data.totalRent) * 100 : 0;
      result.push(data);
    }
  } else {
    for (let d = new Date(startDate); d <= endDate; d.setMonth(d.getMonth() + 1)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const data = taxMap.get(key) || {
        month: key,
        totalTax: 0,
        totalRent: 0,
        bookingCount: 0,
        effectiveRate: 0,
        ownerRemitted: 0,
        platformRemitted: 0
      };
      data.effectiveRate = data.totalRent > 0 ? (data.totalTax / data.totalRent) * 100 : 0;
      result.push(data);
    }
  }

  return result;
}