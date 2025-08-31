import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware } from '../middleware/auth';

const seasonalAnalysis = new Hono<{ Bindings: Env; Variables: { user: any; tenantId: string } }>();

seasonalAnalysis.use('*', authMiddleware);

seasonalAnalysis.get('/', async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const tenantId = c.get('tenantId');
  const currentYear = new Date().getFullYear();
  
  try {
    const [yearlyData, monthlyData] = await Promise.all([
      supabase
        .from('bookings')
        .select('arrival, total_amount, departure')
        .eq('tenant_id', tenantId)
        .gte('arrival', `${currentYear - 3}-01-01`)
        .neq('status', 'canceled'),
      
      supabase
        .from('properties')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('active', true)
    ]);

    if (yearlyData.error) throw yearlyData.error;
    if (monthlyData.error) throw monthlyData.error;

    const propertyCount = monthlyData.data?.length || 0;
    const bookings = yearlyData.data || [];

    const yearStats = new Map<number, any>();
    const monthStats = new Map<string, any>();

    bookings.forEach(booking => {
      const arrivalDate = new Date(booking.arrival);
      const year = arrivalDate.getFullYear();
      const month = arrivalDate.getMonth();
      const monthKey = `${year}-${month}`;
      
      const nights = Math.floor(
        (new Date(booking.departure).getTime() - arrivalDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (!yearStats.has(year)) {
        yearStats.set(year, { revenue: 0, bookings: 0, nights: 0 });
      }
      
      if (!monthStats.has(monthKey)) {
        monthStats.set(monthKey, { 
          year, 
          month, 
          revenue: 0, 
          bookings: 0, 
          nights: 0 
        });
      }

      yearStats.get(year).revenue += booking.total_amount;
      yearStats.get(year).bookings += 1;
      yearStats.get(year).nights += nights;

      monthStats.get(monthKey).revenue += booking.total_amount;
      monthStats.get(monthKey).bookings += 1;
      monthStats.get(monthKey).nights += nights;
    });

    const years = Array.from(yearStats.entries())
      .map(([year, stats]) => ({
        year,
        revenue: stats.revenue,
        bookings: stats.bookings,
        occupancy: propertyCount > 0 ? (stats.nights / (propertyCount * 365)) : 0,
        avgNightlyRate: stats.nights > 0 ? stats.revenue / stats.nights : 0
      }))
      .sort((a, b) => a.year - b.year);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyTrends = [];
    
    for (let month = 0; month < 12; month++) {
      const currentKey = `${currentYear}-${month}`;
      const previousKey = `${currentYear - 1}-${month}`;
      
      const current = monthStats.get(currentKey) || { revenue: 0, bookings: 0, nights: 0 };
      const previous = monthStats.get(previousKey) || { revenue: 0, bookings: 0, nights: 0 };
      
      const daysInMonth = new Date(currentYear, month + 1, 0).getDate();
      const possibleNights = propertyCount * daysInMonth;

      monthlyTrends.push({
        month: `${currentYear}-${String(month + 1).padStart(2, '0')}`,
        monthName: monthNames[month],
        currentYear: {
          revenue: current.revenue,
          bookings: current.bookings,
          occupancy: possibleNights > 0 ? current.nights / possibleNights : 0,
          avgNightlyRate: current.nights > 0 ? current.revenue / current.nights : 0
        },
        previousYear: {
          revenue: previous.revenue,
          bookings: previous.bookings,
          occupancy: possibleNights > 0 ? previous.nights / possibleNights : 0,
          avgNightlyRate: previous.nights > 0 ? previous.revenue / previous.nights : 0
        },
        yoyGrowth: {
          revenue: previous.revenue > 0 ? ((current.revenue - previous.revenue) / previous.revenue) * 100 : 0,
          bookings: previous.bookings > 0 ? ((current.bookings - previous.bookings) / previous.bookings) * 100 : 0,
          occupancy: 0,
          avgNightlyRate: previous.nights > 0 ? 
            ((current.revenue / (current.nights || 1)) - (previous.revenue / (previous.nights || 1))) / 
            (previous.revenue / (previous.nights || 1)) * 100 : 0
        }
      });
    }

    const allMonthOccupancies = monthlyTrends.map(m => m.currentYear.occupancy);
    const avgOccupancy = allMonthOccupancies.reduce((a, b) => a + b, 0) / 12;
    const peakMonths = monthlyTrends
      .filter(m => m.currentYear.occupancy > avgOccupancy * 1.2)
      .map(m => ({ month: m.monthName, score: m.currentYear.occupancy }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    
    const lowMonths = monthlyTrends
      .filter(m => m.currentYear.occupancy < avgOccupancy * 0.8)
      .map(m => ({ month: m.monthName, score: m.currentYear.occupancy }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 3);

    const maxOccupancy = Math.max(...allMonthOccupancies);
    const minOccupancy = Math.min(...allMonthOccupancies);
    const seasonalityIndex = maxOccupancy > 0 ? (maxOccupancy - minOccupancy) / maxOccupancy : 0;

    return c.json({
      yearOverYear: {
        currentYear,
        previousYear: currentYear - 1,
        years
      },
      monthlyTrends,
      seasonalPatterns: {
        peakMonths,
        lowMonths,
        avgPeakOccupancy: peakMonths.reduce((a, b) => a + b.score, 0) / (peakMonths.length || 1),
        avgLowOccupancy: lowMonths.reduce((a, b) => a + b.score, 0) / (lowMonths.length || 1),
        seasonalityIndex
      }
    });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to analyze seasonal data' 
    }, 500);
  }
});

export { seasonalAnalysis };