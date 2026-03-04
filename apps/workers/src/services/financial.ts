import { SupabaseClient } from '@supabase/supabase-js';
import { getActiveSeasons } from './seasons';
import { TaxCalculator } from './tax-calculator';
import { SUPABASE_MAX_ROWS } from '../constants';
import { buildYearMonthFilter } from '../utils/date-filters';

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
}

interface WeeklyRevenue {
  week: string;
  revenue: number;
  bookings: number;
}

export interface ChargeComposition {
  taxes: number;
  fees: number;
  discounts: number;
  other: number;
  details: { type: string; description: string; total: number; count: number }[];
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
  tagIds: string[] = []
): Promise<PLData> {
  const seasons = await getActiveSeasons(supabase, tenantId);
  const hasTagFilter = tagIds.length > 0;
  const { useDaily, useWeekly } = determineGranularity(from, to);

  let bookingsQuery = supabase
    .from('bookings')
    .select(`
      *,
      booking_charges(amount, type, description)
    `)
    .eq('tenant_id', tenantId)
    .lte('arrival', to)
    .gte('departure', from)
    .neq('status', 'canceled')
    .limit(SUPABASE_MAX_ROWS);

  if (hasTagFilter) {
    const { data: taggedBookings } = await supabase
      .from('booking_tags')
      .select('booking_id')
      .in('tag_id', tagIds);

    if (taggedBookings) {
      const bookingIds = taggedBookings.map(tb => tb.booking_id);
      bookingsQuery = bookingsQuery.in('id', bookingIds);
    }
  }

  // get year/month range for platform_guest_fees query
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const fromYear = fromDate.getFullYear();
  const fromMonth = fromDate.getMonth() + 1;
  const toYear = toDate.getFullYear();
  const toMonth = toDate.getMonth() + 1;

  const [bookingsResult, guestFeesResult, propertiesResult, upcomingResult, operatingExpensesResult] = await Promise.all([
    bookingsQuery,
    supabase
      .from('platform_guest_fees')
      .select('*')
      .eq('tenant_id', tenantId)
      .or(buildYearMonthFilter(fromYear, fromMonth, toYear, toMonth))
      .limit(SUPABASE_MAX_ROWS),
    supabase
      .from('properties')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('active', true),
    supabase
      .from('bookings')
      .select('total_amount, arrival')
      .eq('tenant_id', tenantId)
      .gte('arrival', new Date().toISOString().split('T')[0])
      .neq('status', 'canceled')
      .limit(SUPABASE_MAX_ROWS),
    supabase
      .from('operating_expenses')
      .select('category, amount')
      .eq('tenant_id', tenantId)
      .or(buildYearMonthFilter(fromYear, fromMonth, toYear, toMonth))
      .limit(SUPABASE_MAX_ROWS)
  ]);

  const bookings = bookingsResult.data || [];
  const guestFees = guestFeesResult.data || [];
  const properties = propertiesResult.data || [];
  const upcomingBookings = upcomingResult.data || [];
  const operatingExpensesList = operatingExpensesResult.data || [];

  const grossRevenue = bookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);

  // host fees from bookings (captured from ownerrez)
  const totalHostFees = bookings.reduce((sum, b) => sum + (b.host_service_fee || 0), 0);

  // guest fees from manual entry
  const totalGuestFees = guestFees.reduce((sum, gf) => sum + (gf.amount || 0), 0);

  const totalPlatformFees = totalHostFees + totalGuestFees;

  const totalTaxes = bookings.reduce((sum, b) => {
    const taxCharges = b.booking_charges?.filter((c: any) => c.type === 'tax') || [];
    return sum + taxCharges.reduce((chargeSum: number, c: any) => chargeSum + (c.amount || 0), 0);
  }, 0);

  const netRevenue = grossRevenue - totalPlatformFees - totalTaxes;

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

  const next30Days = upcomingBookings
    .filter(b => {
      const arrival = new Date(b.arrival);
      const daysDiff = Math.ceil((arrival.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff <= 30;
    })
    .reduce((sum, b) => sum + (b.total_amount || 0), 0);

  const next60Days = upcomingBookings
    .filter(b => {
      const arrival = new Date(b.arrival);
      const daysDiff = Math.ceil((arrival.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff <= 60;
    })
    .reduce((sum, b) => sum + (b.total_amount || 0), 0);

  const next90Days = upcomingBookings
    .filter(b => {
      const arrival = new Date(b.arrival);
      const daysDiff = Math.ceil((arrival.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff <= 90;
    })
    .reduce((sum, b) => sum + (b.total_amount || 0), 0);

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
    const platform = b.platform || 'Unassigned';
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

  // add guest fees to platform breakdown
  guestFees.forEach((gf: any) => {
    const platform = gf.platform || 'Unknown';
    const existing = platformBreakdown.get(platform);
    if (existing) {
      existing.fees += gf.amount || 0;
    }
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
  let compositionOther = 0;

  bookings.forEach(b => {
    const charges = b.booking_charges || [];
    charges.forEach((c: any) => {
      if (c.type === 'rent') return;
      const amount = c.amount || 0;
      switch (c.type) {
        case 'tax': compositionTaxes += amount; break;
        case 'fee': compositionFees += amount; break;
        case 'discount': compositionDiscounts += amount; break;
        default: compositionOther += amount; break;
      }
      const key = `${c.type}:${c.description || c.type}`;
      const existing = chargeDetailMap.get(key) || { type: c.type, description: c.description || c.type, total: 0, bookingIds: new Set<string>() };
      existing.total += amount;
      existing.bookingIds.add(b.id);
      chargeDetailMap.set(key, existing);
    });
  });

  const chargeComposition: ChargeComposition = {
    taxes: compositionTaxes,
    fees: compositionFees,
    discounts: compositionDiscounts,
    other: compositionOther,
    details: Array.from(chargeDetailMap.values())
      .map(({ bookingIds, ...rest }) => ({ ...rest, count: bookingIds.size }))
      .sort((a, b) => b.total - a.total)
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
  tagIds: string[] = []
): Promise<RevenueData> {
  const seasons = await getActiveSeasons(supabase, tenantId);
  const hasTagFilter = tagIds.length > 0;
  const { useDaily, useWeekly } = determineGranularity(from, to);

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

  if (hasTagFilter) {
    const { data: taggedBookings } = await supabase
      .from('booking_tags')
      .select('booking_id')
      .in('tag_id', tagIds);

    if (taggedBookings) {
      const bookingIds = taggedBookings.map(tb => tb.booking_id);
      bookingsQuery = bookingsQuery.in('id', bookingIds);
    }
  }

  const [bookingsResult, platformFeesResult] = await Promise.all([
    bookingsQuery,
    supabase
      .from('platform_fee_entries')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('month', from.substring(0, 7))
      .lte('month', to.substring(0, 7))
      .limit(SUPABASE_MAX_ROWS)
  ]);

  const bookings = bookingsResult.data || [];
  const platformFees = platformFeesResult.data || [];

  const gross = bookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);

  const taxes = bookings.reduce((sum, b) => {
    const taxCharges = b.booking_charges?.filter((c: any) => c.type === 'tax') || [];
    return sum + taxCharges.reduce((chargeSum: number, c: any) => chargeSum + (c.amount || 0), 0);
  }, 0);

  const fees = platformFees.reduce((sum, pf) =>
    sum + (pf.guest_service_fee || 0) + (pf.host_service_fee || 0), 0
  );

  const net = gross - taxes - fees;

  const sourceMap = new Map<string, number>();
  bookings?.forEach(b => {
    const source = b.platform || 'Unassigned';
    sourceMap.set(source, (sourceMap.get(source) || 0) + (b.total_amount || 0));
  });

  const bySource = Array.from(sourceMap.entries())
    .map(([source, amount]) => ({ source, amount }))
    .sort((a, b) => b.amount - a.amount);

  const byMonth = buildMonthlyRevenue(bookings, from, to, useDaily, useWeekly);

  const lastYear = new Date(from).getFullYear() - 1;
  const lastYearFrom = from.replace(/\d{4}/, lastYear.toString());
  const lastYearTo = to.replace(/\d{4}/, lastYear.toString());

  const [lastYearBookingsResult, lastYearFeesResult] = await Promise.all([
    supabase
      .from('bookings')
      .select(`
        total_amount,
        booking_charges(amount, type)
      `)
      .eq('tenant_id', tenantId)
      .lte('arrival', lastYearTo)
      .gte('departure', lastYearFrom)
      .neq('status', 'canceled')
      .limit(SUPABASE_MAX_ROWS),
    supabase
      .from('platform_fee_entries')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('month', lastYearFrom.substring(0, 7))
      .lte('month', lastYearTo.substring(0, 7))
      .limit(SUPABASE_MAX_ROWS)
  ]);

  const lastYearBookings = lastYearBookingsResult.data || [];
  const lastYearPlatformFees = lastYearFeesResult.data || [];

  const lastYearGross = lastYearBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);

  const lastYearTaxes = lastYearBookings.reduce((sum, b) => {
    const taxCharges = b.booking_charges?.filter((c: any) => c.type === 'tax') || [];
    return sum + taxCharges.reduce((chargeSum: number, c: any) => chargeSum + (c.amount || 0), 0);
  }, 0);

  const lastYearFees = lastYearPlatformFees.reduce((sum, pf) =>
    sum + (pf.guest_service_fee || 0) + (pf.host_service_fee || 0), 0
  );

  const lastYearNet = lastYearGross - lastYearTaxes - lastYearFees;

  return {
    gross,
    net,
    taxes,
    fees,
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
  tagIds: string[] = []
): Promise<CashflowData> {
  const hasTagFilter = tagIds.length > 0;

  let bookingsQuery = supabase
    .from('bookings')
    .select('*')
    .eq('tenant_id', tenantId)
    .lte('arrival', to)
    .gte('departure', from)
    .neq('status', 'canceled')
    .limit(SUPABASE_MAX_ROWS);

  if (hasTagFilter) {
    const { data: taggedBookings } = await supabase
      .from('booking_tags')
      .select('booking_id')
      .in('tag_id', tagIds);

    if (taggedBookings) {
      const bookingIds = taggedBookings.map(tb => tb.booking_id);
      bookingsQuery = bookingsQuery.in('id', bookingIds);
    }
  }

  const { data: bookings } = await bookingsQuery;

  const today = new Date();
  const collected = bookings?.filter(b => new Date(b.arrival) <= today)
    .reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;
  const pending = bookings?.filter(b => new Date(b.arrival) > today)
    .reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;
  const total = collected + pending;

  const { data: upcomingBookings } = await supabase
    .from('bookings')
    .select('total_amount, arrival')
    .eq('tenant_id', tenantId)
    .gte('arrival', today.toISOString().split('T')[0])
    .neq('status', 'canceled')
    .limit(SUPABASE_MAX_ROWS);

  const next30Days = upcomingBookings?.filter(b => {
    const daysDiff = Math.ceil((new Date(b.arrival).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff <= 30;
  }).reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;

  const next60Days = upcomingBookings?.filter(b => {
    const daysDiff = Math.ceil((new Date(b.arrival).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff <= 60;
  }).reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;

  const next90Days = upcomingBookings?.filter(b => {
    const daysDiff = Math.ceil((new Date(b.arrival).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff <= 90;
  }).reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;

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
  tagIds: string[] = []
): Promise<TaxData> {
  const taxCalculator = new TaxCalculator(supabase);
  const hasTagFilter = tagIds.length > 0;
  const { useDaily, useWeekly } = determineGranularity(from, to);

  let bookingsQuery = supabase
    .from('bookings')
    .select(`
      *,
      properties!inner(id, name),
      booking_charges(amount, type)
    `)
    .eq('tenant_id', tenantId)
    .lte('arrival', to)
    .gte('departure', from)
    .neq('status', 'canceled')
    .limit(SUPABASE_MAX_ROWS);

  if (hasTagFilter) {
    const { data: taggedBookings } = await supabase
      .from('booking_tags')
      .select('booking_id')
      .in('tag_id', tagIds);

    if (taggedBookings) {
      const bookingIds = taggedBookings.map(tb => tb.booking_id);
      bookingsQuery = bookingsQuery.in('id', bookingIds);
    }
  }

  const [bookingsResult, platformFeesResult, taxConfigResult] = await Promise.all([
    bookingsQuery,
    supabase
      .from('platform_fee_entries')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('month', from.substring(0, 7))
      .lte('month', to.substring(0, 7))
      .limit(SUPABASE_MAX_ROWS),
    supabase
      .from('property_tax_configs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
  ]);

  const bookings = bookingsResult.data || [];
  const platformFees = platformFeesResult.data || [];
  const taxConfigs = taxConfigResult.data || [];

  const totalRent = bookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
  
  const ownerTax = bookings.reduce((sum, b) => {
    const taxCharges = b.booking_charges?.filter((c: any) => c.type === 'tax') || [];
    return sum + taxCharges.reduce((chargeSum: number, c: any) => chargeSum + (c.amount || 0), 0);
  }, 0);

  const platformTax = platformFees.reduce((sum, pf) => sum + (pf.platform_tax_remitted || 0), 0);
  const totalTax = ownerTax + platformTax;

  const propertyTaxMap = new Map();
  bookings.forEach(b => {
    const property = b.properties;
    if (!property) return;
    
    const existing = propertyTaxMap.get(property.id) || {
      propertyId: property.id,
      propertyName: property.name,
      totalTax: 0,
      totalRent: 0,
      bookingCount: 0,
      taxRate: 0
    };

    const bookingTax = b.booking_charges?.filter((c: any) => c.type === 'tax')
      .reduce((sum: number, c: any) => sum + (c.amount || 0), 0) || 0;
    
    existing.totalTax += bookingTax;
    existing.totalRent += b.total_amount || 0;
    existing.bookingCount++;
    
    propertyTaxMap.set(property.id, existing);
  });

  const byProperty = Array.from(propertyTaxMap.values()).map(p => ({
    ...p,
    taxRate: p.totalRent > 0 ? (p.totalTax / p.totalRent) * 100 : 0
  }));

  const byMonth = buildMonthlyTaxData(bookings, platformFees, from, to, useDaily, useWeekly);

  return {
    summary: {
      totalTax,
      totalRent,
      totalBookings: bookings.length,
      effectiveRate: totalRent > 0 ? (totalTax / totalRent) * 100 : 0,
      platformRemitted: platformTax,
      ownerRemitted: ownerTax
    },
    byProperty,
    byMonth
  };
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
    
    const existing = trendMap.get(key) || { month: key, revenue: 0, bookings: 0, avgBookingValue: 0 };
    existing.revenue += b.total_amount || 0;
    existing.bookings++;
    trendMap.set(key, existing);
  });

  const startDate = new Date(from);
  const endDate = new Date(to);
  const result = [];

  if (useDaily) {
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      const data = trendMap.get(key) || { month: key, revenue: 0, bookings: 0, avgBookingValue: 0 };
      data.avgBookingValue = data.bookings > 0 ? data.revenue / data.bookings : 0;
      result.push(data);
    }
  } else if (useWeekly) {
    const weekStart = new Date(startDate);
    weekStart.setDate(startDate.getDate() - startDate.getDay());
    
    for (let d = new Date(weekStart); d <= endDate; d.setDate(d.getDate() + 7)) {
      const key = d.toISOString().split('T')[0];
      const data = trendMap.get(key) || { month: key, revenue: 0, bookings: 0, avgBookingValue: 0 };
      data.avgBookingValue = data.bookings > 0 ? data.revenue / data.bookings : 0;
      result.push(data);
    }
  } else {
    for (let d = new Date(startDate); d <= endDate; d.setMonth(d.getMonth() + 1)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const data = trendMap.get(key) || { month: key, revenue: 0, bookings: 0, avgBookingValue: 0 };
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
  platformFees: any[],
  from: string,
  to: string,
  useDaily: boolean,
  useWeekly: boolean
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
    
    const bookingTax = b.booking_charges?.filter((c: any) => c.type === 'tax')
      .reduce((sum: number, c: any) => sum + (c.amount || 0), 0) || 0;
    
    existing.totalTax += bookingTax;
    existing.totalRent += b.total_amount || 0;
    existing.bookingCount++;
    existing.ownerRemitted += bookingTax;
    
    taxMap.set(key, existing);
  });

  platformFees.forEach(pf => {
    const key = useDaily || useWeekly ? pf.month + '-01' : pf.month;
    const existing = taxMap.get(key);
    if (existing) {
      existing.platformRemitted += pf.platform_tax_remitted || 0;
      existing.totalTax += pf.platform_tax_remitted || 0;
    }
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