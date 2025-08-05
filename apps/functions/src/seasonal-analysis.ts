import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { query } from './services/database';
import { calculateGrowthRate, safeDivide, calculateAverage, calculateStandardDeviation } from '@baileys/utils';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';

type SeasonalData = {
  yearOverYear: {
    currentYear: number
    previousYear: number
    years: Array<{
      year: number
      revenue: number
      bookings: number
      occupancy: number
      avgNightlyRate: number
    }>
  }
  monthlyTrends: Array<{
    month: string
    monthName: string
    currentYear: {
      revenue: number
      bookings: number
      occupancy: number
      avgNightlyRate: number
    }
    previousYear: {
      revenue: number
      bookings: number
      occupancy: number
      avgNightlyRate: number
    }
    yoyGrowth: {
      revenue: number
      bookings: number
      occupancy: number
      avgNightlyRate: number
    }
  }>
  seasonalPatterns: {
    peakMonths: Array<{ month: string; score: number }>
    lowMonths: Array<{ month: string; score: number }>
    avgPeakOccupancy: number
    avgLowOccupancy: number
    seasonalityIndex: number
  }
  propertySeasonality: Array<{
    propertyId: string
    propertyName: string
    peakMonth: string
    lowMonth: string
    seasonalityScore: number
    monthlyOccupancy: Array<{
      month: number
      occupancy: number
      revenue: number
    }>
  }>
  priceOptimization: {
    underpriced: Array<{
      propertyId: string
      propertyName: string
      month: string
      currentRate: number
      suggestedRate: number
      revenueOpportunity: number
    }>
    overpriced: Array<{
      propertyId: string
      propertyName: string
      month: string
      currentRate: number
      suggestedRate: number
      occupancyImpact: number
    }>
  }
}

export async function getSeasonalAnalysis(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') {
    return handleOptions();
  }

  const authCheck = await requireAuth(request);
  if (!authCheck.authenticated) {
    return authCheck.response;
  }

  const { auth } = authCheck.request;

  if (!auth.tenantId) {
    return {
      status: 403,
      headers: corsHeaders(),
      jsonBody: {
        error: 'OwnerRez connection required',
        code: 'NO_OWNERREZ_CONNECTION'
      }
    };
  }

  try {
    const year = parseInt(request.query.get('year') || new Date().getFullYear().toString());
    const previousYear = year - 1;

    // Get year-over-year summary
    const yoyResult = await query<{
      year: number;
      revenue: string;
      bookings: string;
      nights: string;
      avg_occupancy: string;
      avg_nightly_rate: string;
    }>(
      `WITH yearly_stats AS (
        SELECT
          EXTRACT(YEAR FROM arrival)::integer as year,
          SUM(total_amount) as revenue,
          COUNT(*) as bookings,
          SUM(departure - arrival) as nights,
          COUNT(DISTINCT property_id) as property_count
        FROM bookings
        WHERE tenant_id = $1
          AND status != 'canceled'
          AND EXTRACT(YEAR FROM arrival) IN ($2, $3)
        GROUP BY EXTRACT(YEAR FROM arrival)
      ),
      property_days AS (
        SELECT
          EXTRACT(YEAR FROM generate_series(
            GREATEST('${previousYear}-01-01'::date, created_at::date),
            LEAST('${year}-12-31'::date, CURRENT_DATE),
            '1 day'::interval
          ))::integer as year,
          COUNT(*) as total_days
        FROM properties
        WHERE tenant_id = $1 AND active = true
        GROUP BY year
      )
      SELECT
        ys.year,
        ys.revenue::text,
        ys.bookings::text,
        ys.nights::text,
        (ys.nights::float / pd.total_days)::text as avg_occupancy,
        (ys.revenue / NULLIF(ys.nights, 0))::text as avg_nightly_rate
      FROM yearly_stats ys
      JOIN property_days pd ON ys.year = pd.year
      ORDER BY year DESC`,
      [auth.tenantId, year, previousYear]
    );

    // Get monthly trends comparison
    const monthlyResult = await query<{
      month: string;
      month_name: string;
      current_revenue: string;
      current_bookings: string;
      current_nights: string;
      current_occupancy: string;
      current_avg_rate: string;
      previous_revenue: string;
      previous_bookings: string;
      previous_nights: string;
      previous_occupancy: string;
      previous_avg_rate: string;
    }>(
      `WITH monthly_data AS (
        SELECT
          TO_CHAR(arrival, 'MM') as month,
          TO_CHAR(arrival, 'Month') as month_name,
          EXTRACT(YEAR FROM arrival) as year,
          SUM(total_amount) as revenue,
          COUNT(*) as bookings,
          SUM(departure - arrival) as nights
        FROM bookings
        WHERE tenant_id = $1
          AND status != 'canceled'
          AND EXTRACT(YEAR FROM arrival) IN ($2, $3)
        GROUP BY TO_CHAR(arrival, 'MM'), TO_CHAR(arrival, 'Month'), EXTRACT(YEAR FROM arrival)
      ),
      property_monthly_days AS (
        SELECT
          TO_CHAR(date_series, 'MM') as month,
          EXTRACT(YEAR FROM date_series) as year,
          COUNT(*) * (SELECT COUNT(*) FROM properties WHERE tenant_id = $1 AND active = true) as total_days
        FROM generate_series(
          GREATEST('${previousYear}-01-01'::date, (SELECT MIN(created_at) FROM properties WHERE tenant_id = $1)),
          LEAST('${year}-12-31'::date, CURRENT_DATE),
          '1 day'::interval
        ) date_series
        GROUP BY TO_CHAR(date_series, 'MM'), EXTRACT(YEAR FROM date_series)
      )
      SELECT
        COALESCE(c.month, p.month) as month,
        COALESCE(c.month_name, p.month_name) as month_name,
        COALESCE(c.revenue, 0)::text as current_revenue,
        COALESCE(c.bookings, 0)::text as current_bookings,
        COALESCE(c.nights, 0)::text as current_nights,
        COALESCE(c.nights::float / cmd.total_days, 0)::text as current_occupancy,
        COALESCE(c.revenue / NULLIF(c.nights, 0), 0)::text as current_avg_rate,
        COALESCE(p.revenue, 0)::text as previous_revenue,
        COALESCE(p.bookings, 0)::text as previous_bookings,
        COALESCE(p.nights, 0)::text as previous_nights,
        COALESCE(p.nights::float / pmd.total_days, 0)::text as previous_occupancy,
        COALESCE(p.revenue / NULLIF(p.nights, 0), 0)::text as previous_avg_rate
      FROM (SELECT * FROM monthly_data WHERE year = $2) c
      FULL OUTER JOIN (SELECT * FROM monthly_data WHERE year = $3) p
        ON c.month = p.month
      LEFT JOIN property_monthly_days cmd ON c.month = cmd.month AND cmd.year = $2
      LEFT JOIN property_monthly_days pmd ON p.month = pmd.month AND pmd.year = $3
      ORDER BY COALESCE(c.month, p.month)`,
      [auth.tenantId, year, previousYear]
    );

    // Calculate seasonal patterns
    const seasonalResult = await query<{
      month: string;
      month_name: string;
      avg_occupancy: string;
      avg_revenue: string;
      booking_count: string;
    }>(
      `WITH monthly_aggregates AS (
        SELECT
          TO_CHAR(arrival, 'MM') as month,
          TO_CHAR(arrival, 'Month') as month_name,
          SUM(departure - arrival) as total_nights,
          SUM(total_amount) as total_revenue,
          COUNT(*) as booking_count
        FROM bookings
        WHERE tenant_id = $1
          AND status != 'canceled'
          AND arrival >= CURRENT_DATE - INTERVAL '3 years'
        GROUP BY TO_CHAR(arrival, 'MM'), TO_CHAR(arrival, 'Month')
      ),
      monthly_capacity AS (
        SELECT
          TO_CHAR(date_series, 'MM') as month,
          COUNT(*) * (SELECT COUNT(*) FROM properties WHERE tenant_id = $1 AND active = true) as total_days
        FROM generate_series(
          CURRENT_DATE - INTERVAL '3 years',
          CURRENT_DATE,
          '1 day'::interval
        ) date_series
        GROUP BY TO_CHAR(date_series, 'MM')
      ),
      year_count AS (
        SELECT COUNT(DISTINCT EXTRACT(YEAR FROM arrival)) as years
        FROM bookings
        WHERE tenant_id = $1
          AND status != 'canceled'
          AND arrival >= CURRENT_DATE - INTERVAL '3 years'
      )
      SELECT
        ma.month,
        TRIM(ma.month_name) as month_name,
        (ma.total_nights::float / mc.total_days)::text as avg_occupancy,
        (ma.total_revenue / yc.years)::text as avg_revenue,
        ma.booking_count::text
      FROM monthly_aggregates ma
      JOIN monthly_capacity mc ON ma.month = mc.month
      CROSS JOIN year_count yc
      ORDER BY ma.month`,
      [auth.tenantId]
    );

    // Get property-level seasonality
    const propertySeasonalResult = await query<{
      property_id: string;
      property_name: string;
      month: string;
      occupancy: string;
      revenue: string;
    }>(
      `WITH property_monthly AS (
        SELECT
          p.id as property_id,
          p.name as property_name,
          EXTRACT(MONTH FROM b.arrival) as month,
          SUM(b.departure - b.arrival) as nights,
          SUM(b.total_amount) as revenue
        FROM properties p
        LEFT JOIN bookings b ON p.id = b.property_id
          AND b.status != 'canceled'
          AND b.arrival >= CURRENT_DATE - INTERVAL '2 years'
        WHERE p.tenant_id = $1 AND p.active = true
        GROUP BY p.id, p.name, EXTRACT(MONTH FROM b.arrival)
      ),
      month_capacity AS (
        SELECT
          property_id,
          month,
          DATE_PART('days',
            DATE_TRUNC('month', make_date(2024, month::int, 1)) + INTERVAL '1 month' -
            DATE_TRUNC('month', make_date(2024, month::int, 1))
          ) * 2 as available_days -- 2 years of data
        FROM property_monthly
        WHERE month IS NOT NULL
      )
      SELECT
        pm.property_id,
        pm.property_name,
        pm.month::text,
        (pm.nights::float / NULLIF(mc.available_days, 0))::text as occupancy,
        pm.revenue::text
      FROM property_monthly pm
      JOIN month_capacity mc ON pm.property_id = mc.property_id AND pm.month = mc.month
      WHERE pm.month IS NOT NULL
      ORDER BY pm.property_id, pm.month`,
      [auth.tenantId]
    );

    // Price optimization analysis
    const priceOptimizationResult = await query<{
      property_id: string;
      property_name: string;
      month: string;
      month_name: string;
      avg_nightly_rate: string;
      occupancy_rate: string;
      market_avg_rate: string;
      suggested_rate: string;
    }>(
      `WITH property_month_stats AS (
        SELECT
          p.id as property_id,
          p.name as property_name,
          TO_CHAR(b.arrival, 'MM') as month,
          TO_CHAR(b.arrival, 'Month') as month_name,
          AVG(b.total_amount / (b.departure - b.arrival)) as avg_nightly_rate,
          SUM(b.departure - b.arrival)::float /
            (DATE_PART('days', DATE_TRUNC('month', MIN(b.arrival)) + INTERVAL '1 month' - DATE_TRUNC('month', MIN(b.arrival)))) as occupancy_rate
        FROM properties p
        JOIN bookings b ON p.id = b.property_id
        WHERE p.tenant_id = $1
          AND b.status != 'canceled'
          AND b.arrival >= CURRENT_DATE - INTERVAL '1 year'
        GROUP BY p.id, p.name, TO_CHAR(b.arrival, 'MM'), TO_CHAR(b.arrival, 'Month')
      ),
      market_stats AS (
        SELECT
          TO_CHAR(arrival, 'MM') as month,
          AVG(total_amount / (departure - arrival)) as market_avg_rate
        FROM bookings
        WHERE tenant_id = $1
          AND status != 'canceled'
          AND arrival >= CURRENT_DATE - INTERVAL '1 year'
        GROUP BY TO_CHAR(arrival, 'MM')
      )
      SELECT
        pms.property_id,
        pms.property_name,
        pms.month,
        TRIM(pms.month_name) as month_name,
        pms.avg_nightly_rate::text,
        pms.occupancy_rate::text,
        ms.market_avg_rate::text,
        CASE
          WHEN pms.occupancy_rate > 0.8 THEN (pms.avg_nightly_rate * 1.1)
          WHEN pms.occupancy_rate < 0.5 THEN (pms.avg_nightly_rate * 0.9)
          ELSE pms.avg_nightly_rate
        END::text as suggested_rate
      FROM property_month_stats pms
      JOIN market_stats ms ON pms.month = ms.month
      ORDER BY pms.property_id, pms.month`,
      [auth.tenantId]
    );

    // Process the results
    const yearData = yoyResult.success ? yoyResult.data : [];
    const currentYearData = yearData.find(y => y.year === year);
    const previousYearData = yearData.find(y => y.year === previousYear);

    const monthlyTrends = monthlyResult.success ? monthlyResult.data.map(m => ({
      month: m.month,
      monthName: m.month_name.trim(),
      currentYear: {
        revenue: parseFloat(m.current_revenue),
        bookings: parseInt(m.current_bookings),
        occupancy: parseFloat(m.current_occupancy),
        avgNightlyRate: parseFloat(m.current_avg_rate)
      },
      previousYear: {
        revenue: parseFloat(m.previous_revenue),
        bookings: parseInt(m.previous_bookings),
        occupancy: parseFloat(m.previous_occupancy),
        avgNightlyRate: parseFloat(m.previous_avg_rate)
        },
        yoyGrowth: {
            revenue: calculateGrowthRate(parseFloat(m.current_revenue), parseFloat(m.previous_revenue)) / 100,
            bookings: calculateGrowthRate(parseInt(m.current_bookings), parseInt(m.previous_bookings)) / 100,
            occupancy: calculateGrowthRate(parseFloat(m.current_occupancy), parseFloat(m.previous_occupancy)) / 100,
            avgNightlyRate: calculateGrowthRate(parseFloat(m.current_avg_rate), parseFloat(m.previous_avg_rate)) / 100
        }
    })) : [];

    // Calculate seasonal patterns
    const seasonalData = seasonalResult.success ? seasonalResult.data : [];
    const sortedByOccupancy = [...seasonalData].sort((a, b) =>
      parseFloat(b.avg_occupancy) - parseFloat(a.avg_occupancy)
    );

    const peakMonths = sortedByOccupancy.slice(0, 3).map(m => ({
      month: m.month_name.trim(),
      score: parseFloat(m.avg_occupancy)
    }));

    const lowMonths = sortedByOccupancy.slice(-3).reverse().map(m => ({
      month: m.month_name.trim(),
      score: parseFloat(m.avg_occupancy)
    }));

    const avgPeakOccupancy = safeDivide(peakMonths.reduce((sum, m) => sum + m.score, 0), peakMonths.length);
    const avgLowOccupancy = safeDivide(lowMonths.reduce((sum, m) => sum + m.score, 0), lowMonths.length);
    const seasonalityIndex = safeDivide(avgPeakOccupancy - avgLowOccupancy, avgPeakOccupancy);

    // Process property seasonality
    const propertyMap = new Map<string, {
      propertyId: string
      propertyName: string
      monthlyOccupancy: Array<{
        month: number
        occupancy: number
        revenue: number
      }>
    }>();
    if (propertySeasonalResult.success) {
      propertySeasonalResult.data.forEach(row => {
        if (!propertyMap.has(row.property_id)) {
          propertyMap.set(row.property_id, {
            propertyId: row.property_id,
            propertyName: row.property_name,
            monthlyOccupancy: []
          });
        }
        propertyMap.get(row.property_id)!.monthlyOccupancy.push({
          month: parseInt(row.month),
          occupancy: parseFloat(row.occupancy),
          revenue: parseFloat(row.revenue)
        });
      });
    }

    const propertySeasonality = Array.from(propertyMap.values()).map(property => {
      const sortedMonths = [...property.monthlyOccupancy].sort((a, b) => b.occupancy - a.occupancy);
      const peakMonth = sortedMonths[0];
      const lowMonth = sortedMonths[sortedMonths.length - 1];

      const occupancies = property.monthlyOccupancy.map(m => m.occupancy);
      const avgOccupancy = calculateAverage(occupancies);
      const stdDev = calculateStandardDeviation(occupancies);
      const seasonalityScore = safeDivide(stdDev, avgOccupancy);

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      return {
        ...property,
        peakMonth: monthNames[peakMonth.month - 1],
        lowMonth: monthNames[lowMonth.month - 1],
        seasonalityScore
      };
    });

    // Process price optimization
    const priceOptimization: {
      underpriced: Array<{
        propertyId: string
        propertyName: string
        month: string
        currentRate: number
        suggestedRate: number
        revenueOpportunity: number
      }>
      overpriced: Array<{
        propertyId: string
        propertyName: string
        month: string
        currentRate: number
        suggestedRate: number
        occupancyImpact: number
      }>
    } = {
      underpriced: [],
      overpriced: []
    };

    if (priceOptimizationResult.success) {
      priceOptimizationResult.data.forEach(row => {
        const currentRate = parseFloat(row.avg_nightly_rate);
        const suggestedRate = parseFloat(row.suggested_rate);
        const occupancy = parseFloat(row.occupancy_rate);

        if (occupancy > 0.8 && suggestedRate > currentRate) {
          priceOptimization.underpriced.push({
            propertyId: row.property_id,
            propertyName: row.property_name,
            month: row.month_name.trim(),
            currentRate,
            suggestedRate,
            revenueOpportunity: (suggestedRate - currentRate) * 30 * occupancy
          });
        } else if (occupancy < 0.5 && suggestedRate < currentRate) {
          priceOptimization.overpriced.push({
            propertyId: row.property_id,
            propertyName: row.property_name,
            month: row.month_name.trim(),
            currentRate,
            suggestedRate,
            occupancyImpact: 0.6 - occupancy
          });
        }
      });
    }

    const seasonalAnalysisData: SeasonalData = {
      yearOverYear: {
        currentYear: currentYearData ? parseFloat(currentYearData.revenue) : 0,
        previousYear: previousYearData ? parseFloat(previousYearData.revenue) : 0,
        years: yearData.map(y => ({
          year: y.year,
          revenue: parseFloat(y.revenue),
          bookings: parseInt(y.bookings),
          occupancy: parseFloat(y.avg_occupancy),
          avgNightlyRate: parseFloat(y.avg_nightly_rate)
        }))
      },
      monthlyTrends,
      seasonalPatterns: {
        peakMonths,
        lowMonths,
        avgPeakOccupancy,
        avgLowOccupancy,
        seasonalityIndex
      },
      propertySeasonality,
      priceOptimization
    };

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: seasonalAnalysisData
    };
  } catch (error) {
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: {
        error: error instanceof Error ? error.message : 'Failed to fetch seasonal analysis'
      }
    };
  }
}

app.http('seasonal-analysis', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: getSeasonalAnalysis
});
