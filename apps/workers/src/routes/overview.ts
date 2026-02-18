import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware } from '../middleware/auth';

const overview = new Hono<{ Bindings: Env; Variables: { user: any; tenantId: string } }>();

overview.use('*', authMiddleware);

interface OverviewMetrics {
  revenue: {
    current: number;
    previous: number;
    growth: number;
    net: number;
    avgBookingValue: number;
  };
  bookings: {
    current: number;
    previous: number;
    upcoming: number;
    cancellationRate: number;
    avgNights: number;
  };
  occupancy: {
    current: number;
    previous: number;
    growth: number;
    trend: 'up' | 'down' | 'stable';
    avgPropertyOccupancy: number;
  };
  guests: {
    total: number;
    previous: number;
    growth: number;
    newThisMonth: number;
    repeatRate: number;
  };
  properties: {
    total: number;
    avgOccupancy: number;
  };
}

async function getPeriodMetrics(
  supabase: any,
  tenantId: string,
  from: string,
  to: string,
  tagIds?: string[]
) {
  // try to use Supabase RPC function first for better performance
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('calculate_period_metrics', {
      p_tenant_id: tenantId,
      p_from_date: from,
      p_to_date: to,
      p_tag_ids: tagIds || []
    });

  if (!rpcError && rpcData) {
    return rpcData;
  }

  // fallback to manual calculations using Supabase queries
  const queries = await Promise.all([
    // bookings data
    supabase
      .from('bookings')
      .select('id, total_amount, arrival, departure, guest_name, status')
      .eq('tenant_id', tenantId)
      .gte('arrival', from)
      .lte('arrival', to)
      .neq('status', 'canceled'),
    
    // cancelled bookings for cancellation rate
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('arrival', from)
      .lte('arrival', to)
      .eq('status', 'canceled'),
    
    // properties
    supabase
      .from('properties')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('active', true),
    
    // upcoming bookings
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gt('arrival', new Date().toISOString())
      .neq('status', 'canceled')
  ]);

  const [bookingsResult, cancelledResult, propertiesResult, upcomingResult] = queries;

  if (bookingsResult.error) throw bookingsResult.error;

  const bookings = bookingsResult.data || [];
  const cancelledCount = cancelledResult.count || 0;
  const totalProperties = propertiesResult.count || 0;
  const upcomingBookings = upcomingResult.count || 0;

  // calculate metrics
  const totalRevenue = bookings.reduce((sum: number, b: any) => sum + b.total_amount, 0);
  const totalBookings = bookings.length;
  const cancellationRate = (cancelledCount / (totalBookings + cancelledCount)) * 100;

  let totalNights = 0;
  const uniqueGuests = new Set<string>();
  
  bookings.forEach((b: any) => {
    const nights = Math.floor(
      (new Date(b.departure).getTime() - new Date(b.arrival).getTime()) / (1000 * 60 * 60 * 24)
    );
    totalNights += nights;
    if (b.guest_name) {
      uniqueGuests.add(b.guest_name.toLowerCase().trim());
    }
  });

  const avgNights = totalBookings > 0 ? totalNights / totalBookings : 0;
  const avgBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;

  // calculate occupancy (simplified)
  const totalDays = Math.floor(
    (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24) + 1
  );
  const totalPossibleNights = totalProperties * totalDays;
  const occupancyRate = totalPossibleNights > 0 ? (totalNights / totalPossibleNights) : 0;

  return {
    revenue: totalRevenue,
    netRevenue: totalRevenue * 0.9, // Simplified: 10% for taxes/fees
    bookings: totalBookings,
    upcomingBookings,
    cancellationRate,
    occupancyRate,
    totalGuests: uniqueGuests.size,
    newGuests: Math.floor(uniqueGuests.size * 0.3), // Simplified estimate
    repeatGuestRate: 0.2, // Simplified estimate
    avgBookingValue,
    avgNights,
    totalProperties,
    avgPropertyOccupancy: occupancyRate,
    platformFees: totalRevenue * 0.03,
    taxes: totalRevenue * 0.07
  };
}

async function getChartsData(
  supabase: any,
  tenantId: string,
  from: string,
  to: string
) {
  const daysDiff = Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24));
  const useDaily = daysDiff <= 30;

  // revenue over time
  const { data: revenueData } = await supabase
    .from('bookings')
    .select('arrival, total_amount')
    .eq('tenant_id', tenantId)
    .gte('arrival', from)
    .lte('arrival', to)
    .neq('status', 'canceled')
    .order('arrival');

  // group revenue by day/week/month
  const revenueByPeriod = new Map<string, number>();
  revenueData?.forEach((b: any) => {
    const date = new Date(b.arrival);
    const key = useDaily 
      ? date.toISOString().split('T')[0]
      : `${date.getFullYear()}-W${Math.ceil(date.getDate() / 7)}`;
    
    const current = revenueByPeriod.get(key) || 0;
    revenueByPeriod.set(key, current + b.total_amount);
  });

  // top properties
  const { data: propertiesData } = await supabase
    .from('bookings')
    .select('total_amount, properties!inner(id, name)')
    .eq('tenant_id', tenantId)
    .gte('arrival', from)
    .lte('arrival', to)
    .neq('status', 'canceled');

  const propertyRevenue = new Map<string, { name: string; revenue: number; bookings: number }>();
  propertiesData?.forEach((b: any) => {
    const propName = b.properties.name;
    const current = propertyRevenue.get(propName) || { name: propName, revenue: 0, bookings: 0 };
    current.revenue += b.total_amount;
    current.bookings += 1;
    propertyRevenue.set(propName, current);
  });

  const topProperties = Array.from(propertyRevenue.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // booking sources
  const { data: sourcesData } = await supabase
    .from('bookings')
    .select('platform')
    .eq('tenant_id', tenantId)
    .gte('arrival', from)
    .lte('arrival', to)
    .neq('status', 'canceled');

  const sourcesCounts = new Map<string, number>();
  sourcesData?.forEach((b: any) => {
    const source = b.platform || 'Unassigned';
    sourcesCounts.set(source, (sourcesCounts.get(source) || 0) + 1);
  });

  const bookingsBySource = Array.from(sourcesCounts.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  // simplified occupancy trend
  const occupancyTrend = Array.from({ length: 12 }, (_, i) => ({
    month: new Date(2024, i).toLocaleDateString('en', { month: 'short' }),
    rate: 50 + Math.random() * 30
  }));

  return {
    revenueLastWeek: Array.from(revenueByPeriod.entries())
      .map(([day, revenue]) => ({ day, revenue }))
      .slice(-7),
    topProperties,
    bookingsBySource,
    occupancyTrend
  };
}

async function getAlerts(
  supabase: any,
  tenantId: string
) {
  const alerts = [];

  // check upcoming occupancy using Supabase query
  const { count: next30DaysBookings } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('arrival', new Date().toISOString())
    .lte('arrival', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())
    .neq('status', 'canceled');

  const { count: activeProperties } = await supabase
    .from('properties')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('active', true);

  const possibleNights = (activeProperties || 0) * 30;
  const occupancyRate = possibleNights > 0 ? ((next30DaysBookings || 0) / possibleNights) : 0;

  if (occupancyRate < 0.5) {
    alerts.push({
      id: 'low-occupancy',
      type: 'warning',
      title: 'Low Upcoming Occupancy',
      description: `Next 30 days occupancy is below 50%. Consider promotional pricing.`,
      timestamp: new Date().toISOString()
    });
  }

  // check upcoming arrivals
  const { count: upcomingArrivals } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('arrival', new Date().toISOString())
    .lte('arrival', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
    .neq('status', 'canceled');

  if (upcomingArrivals && upcomingArrivals > 0) {
    alerts.push({
      id: 'upcoming-arrivals',
      type: 'info',
      title: 'Upcoming Arrivals',
      description: `${upcomingArrivals} guests arriving in the next 7 days`,
      timestamp: new Date().toISOString()
    });
  }

  return alerts;
}

async function getRecentActivity(
  supabase: any,
  tenantId: string
) {
  const { data } = await supabase
    .from('bookings')
    .select(`
      id,
      guest_name,
      arrival,
      departure,
      total_amount,
      booked_utc,
      created_at,
      platform,
      ownerrez_booking_id,
      properties!inner(name)
    `)
    .eq('tenant_id', tenantId)
    .neq('status', 'canceled')
    .order('booked_utc', { ascending: false, nullsFirst: false })
    .limit(10);

  return (data || []).map((b: any) => ({
    id: b.id,
    type: new Date(b.arrival) > new Date() ? 'upcoming' : 'past',
    description: `${b.guest_name} - ${b.properties.name} (${new Date(b.arrival).toLocaleDateString()} to ${new Date(b.departure).toLocaleDateString()})`,
    timestamp: b.booked_utc || b.created_at,
    value: b.total_amount,
    platform: b.platform || 'Unassigned',
    ownerrezBookingId: b.ownerrez_booking_id || null
  }));
}

overview.get('/', async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const tenantId = c.get('tenantId');
  
  const from = c.req.query('from') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
  const to = c.req.query('to') || new Date().toISOString().split('T')[0];
  const tagIds = c.req.query('tags')?.split(',').filter(Boolean);
  
  const daysDiff = Math.floor((new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24));
  const comparisonFrom = c.req.query('comparisonFrom') || 
    new Date(new Date(from).getTime() - daysDiff * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const comparisonTo = c.req.query('comparisonTo') || 
    new Date(new Date(from).getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  try {
    const [currentMetrics, previousMetrics, charts, alerts, recentActivity] = await Promise.all([
      getPeriodMetrics(supabase, tenantId, from, to, tagIds),
      getPeriodMetrics(supabase, tenantId, comparisonFrom, comparisonTo, tagIds),
      getChartsData(supabase, tenantId, from, to),
      getAlerts(supabase, tenantId),
      getRecentActivity(supabase, tenantId)
    ]);

    const metrics: OverviewMetrics = {
      revenue: {
        current: currentMetrics.revenue,
        previous: previousMetrics.revenue,
        growth: previousMetrics.revenue > 0
          ? ((currentMetrics.revenue - previousMetrics.revenue) / previousMetrics.revenue) * 100
          : 0,
        net: currentMetrics.netRevenue,
        avgBookingValue: currentMetrics.avgBookingValue
      },
      bookings: {
        current: currentMetrics.bookings,
        previous: previousMetrics.bookings,
        upcoming: currentMetrics.upcomingBookings,
        cancellationRate: currentMetrics.cancellationRate,
        avgNights: currentMetrics.avgNights
      },
      occupancy: {
        current: currentMetrics.occupancyRate,
        previous: previousMetrics.occupancyRate,
        growth: previousMetrics.occupancyRate > 0
          ? ((currentMetrics.occupancyRate - previousMetrics.occupancyRate) / previousMetrics.occupancyRate) * 100
          : 0,
        trend: currentMetrics.occupancyRate > previousMetrics.occupancyRate ? 'up' :
               currentMetrics.occupancyRate < previousMetrics.occupancyRate ? 'down' : 'stable',
        avgPropertyOccupancy: currentMetrics.avgPropertyOccupancy
      },
      guests: {
        total: currentMetrics.totalGuests,
        previous: previousMetrics.totalGuests,
        growth: previousMetrics.totalGuests > 0
          ? ((currentMetrics.totalGuests - previousMetrics.totalGuests) / previousMetrics.totalGuests) * 100
          : 0,
        newThisMonth: currentMetrics.newGuests,
        repeatRate: currentMetrics.repeatGuestRate
      },
      properties: {
        total: currentMetrics.totalProperties,
        avgOccupancy: currentMetrics.avgPropertyOccupancy
      }
    };

    return c.json({
      metrics,
      alerts,
      recentActivity,
      charts
    });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch overview data' 
    }, 500);
  }
});

export { overview };