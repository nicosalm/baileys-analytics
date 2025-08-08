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

        // Check if we have any data at all
        const dataCheck = await query<{
            total_bookings: string;
            total_properties: string;
        }>(
            `SELECT
                COUNT(DISTINCT b.id) as total_bookings,
                COUNT(DISTINCT p.id) as total_properties
            FROM properties p
            LEFT JOIN bookings b ON p.id = b.property_id
                AND b.status != 'canceled'
            WHERE p.tenant_id = $1`,
            [auth.tenantId]
        );

        if (!dataCheck.success || parseInt(dataCheck.data[0]?.total_bookings || '0') === 0) {
            // Return empty but valid structure
            return {
                status: 200,
                headers: corsHeaders(),
                jsonBody: {
                    yearOverYear: {
                        currentYear: 0,
                        previousYear: 0,
                        years: []
                    },
                    monthlyTrends: [],
                    seasonalPatterns: {
                        peakMonths: [],
                        lowMonths: [],
                        avgPeakOccupancy: 0,
                        avgLowOccupancy: 0,
                        seasonalityIndex: 0
                    },
                    propertySeasonality: [],
                    priceOptimization: {
                        underpriced: [],
                        overpriced: []
                    }
                }
            };
        }

        // Year-over-year query
        const yoyResult = await query<{
            year: number;
            revenue: string;
            bookings: string;
            nights: string;
            avg_occupancy: string;
            avg_nightly_rate: string;
        }>(
            `WITH years AS (
                SELECT $2::integer as year
                UNION ALL
                SELECT $3::integer as year
            ),
            yearly_stats AS (
                SELECT
                    EXTRACT(YEAR FROM arrival)::integer as year,
                    SUM(total_amount) as revenue,
                    COUNT(*) as bookings,
                    SUM(departure - arrival) as nights
                FROM bookings
                WHERE tenant_id = $1
                    AND status != 'canceled'
                    AND EXTRACT(YEAR FROM arrival) IN ($2, $3)
                GROUP BY EXTRACT(YEAR FROM arrival)
            ),
            property_count AS (
                SELECT COUNT(*) as prop_count
                FROM properties
                WHERE tenant_id = $1 AND active = true
            )
            SELECT
                y.year,
                COALESCE(ys.revenue, 0)::text as revenue,
                COALESCE(ys.bookings, 0)::text as bookings,
                COALESCE(ys.nights, 0)::text as nights,
                CASE
                    WHEN pc.prop_count > 0 AND ys.nights > 0 THEN
                        LEAST(100, ROUND((ys.nights::numeric / (pc.prop_count * 365)) * 100, 2))
                    ELSE 0
                END::text as avg_occupancy,
                COALESCE(ROUND(ys.revenue::numeric / NULLIF(ys.nights, 0), 2), 0)::text as avg_nightly_rate
            FROM years y
            CROSS JOIN property_count pc
            LEFT JOIN yearly_stats ys ON y.year = ys.year
            ORDER BY y.year DESC`,
            [auth.tenantId, year, previousYear]
        );

        // Monthly trends query
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
            property_count AS (
                SELECT COUNT(*) as prop_count
                FROM properties
                WHERE tenant_id = $1 AND active = true
            ),
            months AS (
                SELECT
                    TO_CHAR(m, 'MM') as month,
                    TO_CHAR(m, 'Month') as month_name
                FROM generate_series('2024-01-01'::date, '2024-12-01'::date, '1 month'::interval) as m
            )
            SELECT
                m.month,
                m.month_name,
                COALESCE(c.revenue, 0)::text as current_revenue,
                COALESCE(c.bookings, 0)::text as current_bookings,
                COALESCE(c.nights, 0)::text as current_nights,
                ROUND(
                    COALESCE(
                        (c.nights::numeric / NULLIF(pc.prop_count * 30, 0)) * 100,
                        0
                    ), 2
                )::text as current_occupancy,
                ROUND(COALESCE(c.revenue::numeric / NULLIF(c.nights, 0), 0), 2)::text as current_avg_rate,
                COALESCE(p.revenue, 0)::text as previous_revenue,
                COALESCE(p.bookings, 0)::text as previous_bookings,
                COALESCE(p.nights, 0)::text as previous_nights,
                ROUND(
                    COALESCE(
                        (p.nights::numeric / NULLIF(pc.prop_count * 30, 0)) * 100,
                        0
                    ), 2
                )::text as previous_occupancy,
                ROUND(COALESCE(p.revenue::numeric / NULLIF(p.nights, 0), 0), 2)::text as previous_avg_rate
            FROM months m
            CROSS JOIN property_count pc
            LEFT JOIN (SELECT * FROM monthly_data WHERE year = $2) c
                ON m.month = c.month
            LEFT JOIN (SELECT * FROM monthly_data WHERE year = $3) p
                ON m.month = p.month
            ORDER BY m.month`,
            [auth.tenantId, year, previousYear]
        );

        // Seasonal patterns query
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
                    AVG(total_amount) as avg_revenue_per_booking,
                    COUNT(*) as booking_count
                FROM bookings
                WHERE tenant_id = $1
                    AND status != 'canceled'
                    AND arrival >= CURRENT_DATE - INTERVAL '2 years'
                GROUP BY TO_CHAR(arrival, 'MM'), TO_CHAR(arrival, 'Month')
            ),
            property_count AS (
                SELECT COUNT(*) as prop_count
                FROM properties
                WHERE tenant_id = $1 AND active = true
            )
            SELECT
                ma.month,
                TRIM(ma.month_name) as month_name,
                CASE
                    WHEN pc.prop_count > 0 THEN
                        LEAST(100, ROUND(
                            (ma.total_nights::numeric / (pc.prop_count * 30 * 2)) * 100, 2
                        ))
                    ELSE 0
                END::text as avg_occupancy,
                ROUND(COALESCE(ma.avg_revenue_per_booking, 0)::numeric, 2)::text as avg_revenue,
                ma.booking_count::text
            FROM monthly_aggregates ma
            CROSS JOIN property_count pc
            ORDER BY ma.month`,
            [auth.tenantId]
        );

        // Property-level seasonality query
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
                    AND b.arrival >= CURRENT_DATE - INTERVAL '1 year'
                WHERE p.tenant_id = $1
                    AND p.active = true
                GROUP BY p.id, p.name, EXTRACT(MONTH FROM b.arrival)
            )
            SELECT
                property_id,
                property_name,
                month::text,
                LEAST(100, ROUND(
                    COALESCE(nights::numeric / 30, 0) * 100,
                    2
                ))::text as occupancy,
                COALESCE(revenue, 0)::text as revenue
            FROM property_monthly
            WHERE month IS NOT NULL
            ORDER BY property_id, month`,
            [auth.tenantId]
        );

        // Fixed price optimization query - removed created_at usage
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
                    AVG(b.total_amount / NULLIF(b.departure - b.arrival, 0)) as avg_nightly_rate,
                    SUM(b.departure - b.arrival) as booked_nights
                FROM properties p
                JOIN bookings b ON p.id = b.property_id
                WHERE p.tenant_id = $1
                    AND b.status != 'canceled'
                    AND b.arrival >= CURRENT_DATE - INTERVAL '6 months'
                GROUP BY p.id, p.name, TO_CHAR(b.arrival, 'MM'), TO_CHAR(b.arrival, 'Month')
            ),
            market_stats AS (
                SELECT
                    TO_CHAR(arrival, 'MM') as month,
                    AVG(total_amount / NULLIF(departure - arrival, 0)) as market_avg_rate
                FROM bookings
                WHERE tenant_id = $1
                    AND status != 'canceled'
                    AND arrival >= CURRENT_DATE - INTERVAL '6 months'
                GROUP BY TO_CHAR(arrival, 'MM')
            )
            SELECT
                pms.property_id,
                pms.property_name,
                pms.month,
                TRIM(pms.month_name) as month_name,
                ROUND(pms.avg_nightly_rate::numeric, 2)::text as avg_nightly_rate,
                -- Assume 30 days per month available
                ROUND((pms.booked_nights::numeric / 30), 4)::text as occupancy_rate,
                ROUND(ms.market_avg_rate::numeric, 2)::text as market_avg_rate,
                CASE
                    WHEN (pms.booked_nights::numeric / 30) > 0.8 THEN
                        ROUND((pms.avg_nightly_rate * 1.1)::numeric, 2)
                    WHEN (pms.booked_nights::numeric / 30) < 0.5 THEN
                        ROUND((pms.avg_nightly_rate * 0.9)::numeric, 2)
                    ELSE
                        ROUND(pms.avg_nightly_rate::numeric, 2)
                END::text as suggested_rate
            FROM property_month_stats pms
            LEFT JOIN market_stats ms ON pms.month = ms.month
            ORDER BY pms.property_id, pms.month`,
            [auth.tenantId]
        );

        // Process the results
        const yearData = yoyResult.success ? yoyResult.data : [];
        const currentYearData = yearData.find(y => y.year === year);
        const previousYearData = yearData.find(y => y.year === previousYear);

        // Process monthly trends
        const monthlyTrends = monthlyResult.success ? monthlyResult.data
            .filter(m => m.month && m.month_name)
            .map(m => ({
                month: m.month,
                monthName: m.month_name.trim(),
                currentYear: {
                    revenue: parseFloat(m.current_revenue) || 0,
                    bookings: parseInt(m.current_bookings) || 0,
                    occupancy: Math.min(100, parseFloat(m.current_occupancy) || 0),
                    avgNightlyRate: parseFloat(m.current_avg_rate) || 0
                },
                previousYear: {
                    revenue: parseFloat(m.previous_revenue) || 0,
                    bookings: parseInt(m.previous_bookings) || 0,
                    occupancy: Math.min(100, parseFloat(m.previous_occupancy) || 0),
                    avgNightlyRate: parseFloat(m.previous_avg_rate) || 0
                },
                yoyGrowth: {
                    revenue: calculateGrowthRate(
                        parseFloat(m.current_revenue) || 0,
                        parseFloat(m.previous_revenue) || 0
                    ),
                    bookings: calculateGrowthRate(
                        parseInt(m.current_bookings) || 0,
                        parseInt(m.previous_bookings) || 0
                    ),
                    occupancy: calculateGrowthRate(
                        parseFloat(m.current_occupancy) || 0,
                        parseFloat(m.previous_occupancy) || 0
                    ),
                    avgNightlyRate: calculateGrowthRate(
                        parseFloat(m.current_avg_rate) || 0,
                        parseFloat(m.previous_avg_rate) || 0
                    )
                }
            })) : [];

        // Calculate seasonal patterns
        const seasonalData = seasonalResult.success ? seasonalResult.data : [];
        const validSeasonalData = seasonalData.filter(d =>
            parseFloat(d.avg_occupancy) >= 0 && parseFloat(d.avg_occupancy) <= 100
        );

        const sortedByOccupancy = [...validSeasonalData].sort((a, b) =>
            parseFloat(b.avg_occupancy) - parseFloat(a.avg_occupancy)
        );

        const peakMonths = sortedByOccupancy.slice(0, 3).map(m => ({
            month: m.month_name.trim(),
            score: Math.min(100, parseFloat(m.avg_occupancy) || 0)
        }));

        const lowMonths = sortedByOccupancy.slice(-3).reverse().map(m => ({
            month: m.month_name.trim(),
            score: Math.min(100, parseFloat(m.avg_occupancy) || 0)
        }));

        const avgPeakOccupancy = safeDivide(
            peakMonths.reduce((sum, m) => sum + m.score, 0),
            peakMonths.length
        );
        const avgLowOccupancy = safeDivide(
            lowMonths.reduce((sum, m) => sum + m.score, 0),
            lowMonths.length
        );
        const seasonalityIndex = safeDivide(
            avgPeakOccupancy - avgLowOccupancy,
            avgPeakOccupancy
        ) * 100;

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

                const occupancy = Math.min(100, parseFloat(row.occupancy) || 0);

                propertyMap.get(row.property_id)!.monthlyOccupancy.push({
                    month: parseInt(row.month),
                    occupancy: occupancy,
                    revenue: parseFloat(row.revenue) || 0
                });
            });
        }

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        const propertySeasonality = Array.from(propertyMap.values()).map(property => {
            const validOccupancies = property.monthlyOccupancy
                .filter(m => m.occupancy >= 0 && m.occupancy <= 100);

            const sortedMonths = [...validOccupancies].sort((a, b) => b.occupancy - a.occupancy);
            const peakMonth = sortedMonths[0];
            const lowMonth = sortedMonths[sortedMonths.length - 1];

            const occupancies = validOccupancies.map(m => m.occupancy);
            const avgOccupancy = calculateAverage(occupancies);
            const stdDev = calculateStandardDeviation(occupancies);
            const seasonalityScore = Math.min(100, safeDivide(stdDev, avgOccupancy) * 100);

            return {
                ...property,
                peakMonth: peakMonth ? monthNames[peakMonth.month - 1] : 'N/A',
                lowMonth: lowMonth ? monthNames[lowMonth.month - 1] : 'N/A',
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
                const currentRate = parseFloat(row.avg_nightly_rate) || 0;
                const suggestedRate = parseFloat(row.suggested_rate) || 0;
                const occupancy = parseFloat(row.occupancy_rate) || 0;

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
                        occupancyImpact: Math.min(1, Math.max(0, 0.6 - occupancy))
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
                    revenue: parseFloat(y.revenue) || 0,
                    bookings: parseInt(y.bookings) || 0,
                    occupancy: Math.min(100, parseFloat(y.avg_occupancy) || 0),
                    avgNightlyRate: parseFloat(y.avg_nightly_rate) || 0
                }))
            },
            monthlyTrends,
            seasonalPatterns: {
                peakMonths,
                lowMonths,
                avgPeakOccupancy: Math.min(100, avgPeakOccupancy),
                avgLowOccupancy: Math.min(100, avgLowOccupancy),
                seasonalityIndex: Math.min(100, seasonalityIndex)
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
        console.error('Seasonal analysis error:', error);
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
