import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { safeDivide, calculatePercentage } from '@baileys/utils';
import { query, DbResult } from './services/database';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';

type FinancialMetrics = {
    revenue: {
        gross: number
        net: number
        pending: number
        collected: number
        platformFees: number
        taxes: number
    }
    performance: {
        netRevenueRate: number // percentage of revenue kept after fees
        avgBookingValue: number
        totalBookings: number
    }
    upcoming: {
        next30Days: number
        next60Days: number
        next90Days: number
    }
    kpis: {
        revpar: number
        adr: number
        collectionRate: number
    }
}

type PlatformFinancials = {
    platform: string
    grossRevenue: number
    fees: number
    netRevenue: number
    feeRate: number
    bookingCount: number
}

type MonthlyTrend = {
    month: string
    revenue: number
    bookings: number
    avgBookingValue: number
}

type WeeklyRevenue = {
    week: string
    revenue: number
    bookings: number
}

async function getPlatformFinancials(
    tenantId: string,
    fromDate: string,
    toDate: string
): Promise<DbResult<PlatformFinancials[]>> {
    const result = await query<{
        platform: string;
        booking_count: string;
        gross_revenue: string;
        total_fees: string;
    }>(
        `WITH platform_summary AS (
            SELECT
                COALESCE(
                    CASE
                        WHEN platform IS NULL OR platform = '' THEN 'Direct'
                        WHEN LOWER(platform) LIKE '%direct%' THEN 'Direct'
                        WHEN LOWER(platform) LIKE '%airbnb%' THEN 'Airbnb'
                        WHEN LOWER(platform) LIKE '%vrbo%' OR LOWER(platform) LIKE '%homeaway%' THEN 'VRBO'
                        WHEN LOWER(platform) LIKE '%booking.com%' THEN 'Booking.com'
                        ELSE platform  -- Keep original platform name
                    END,
                    'Direct'
                ) as platform,
                COUNT(*) as booking_count,
                SUM(total_amount) as gross_revenue
            FROM bookings
            WHERE tenant_id = $1
                AND arrival >= $2::date
                AND arrival <= $3::date
                AND status != 'canceled'
            GROUP BY
                CASE
                    WHEN platform IS NULL OR platform = '' THEN 'Direct'
                    WHEN LOWER(platform) LIKE '%direct%' THEN 'Direct'
                    WHEN LOWER(platform) LIKE '%airbnb%' THEN 'Airbnb'
                    WHEN LOWER(platform) LIKE '%vrbo%' OR LOWER(platform) LIKE '%homeaway%' THEN 'VRBO'
                    WHEN LOWER(platform) LIKE '%booking.com%' THEN 'Booking.com'
                    ELSE platform
                END
        ),
        platform_fees AS (
            SELECT DISTINCT ON (platform_name)
                platform_name,
                fee_type,
                fee_value
            FROM platform_fees
            WHERE (tenant_id = $1 OR tenant_id = '00000000-0000-0000-0000-000000000000')
                AND is_active = true
                AND effective_from <= $3::date
                AND (effective_to IS NULL OR effective_to >= $2::date)
            ORDER BY platform_name, tenant_id DESC, effective_from DESC
        )
        SELECT
            ps.platform,
            ps.booking_count::text,
            ps.gross_revenue::text,
            COALESCE(
                CASE
                    WHEN pf.fee_type = 'percentage' THEN ps.gross_revenue * pf.fee_value
                    WHEN pf.fee_type = 'flat' THEN pf.fee_value * ps.booking_count
                    ELSE
                        -- Default fees only for known platforms if not configured
                        CASE
                            WHEN LOWER(ps.platform) LIKE '%airbnb%' THEN ps.gross_revenue * 0.03
                            WHEN LOWER(ps.platform) LIKE '%vrbo%' THEN ps.gross_revenue * 0.05
                            WHEN LOWER(ps.platform) LIKE '%booking.com%' THEN ps.gross_revenue * 0.15
                            WHEN LOWER(ps.platform) = 'direct' THEN 0
                            ELSE 0  -- Unknown platforms default to 0% unless configured
                        END
                END,
                0
            )::text as total_fees
        FROM platform_summary ps
        LEFT JOIN platform_fees pf ON LOWER(ps.platform) = LOWER(pf.platform_name)
        ORDER BY ps.gross_revenue DESC`,
        [tenantId, fromDate, toDate]
    );

    if (!result.success) {
        return result;
    }

    const platforms = result.data.map(row => {
        const grossRevenue = parseFloat(row.gross_revenue);
        const fees = parseFloat(row.total_fees);
        const bookingCount = parseInt(row.booking_count);

        return {
            platform: row.platform,
            grossRevenue,
            fees,
            netRevenue: grossRevenue - fees,
            feeRate: grossRevenue > 0 ? (fees / grossRevenue) * 100 : 0,
            bookingCount
        };
    });

    return { success: true, data: platforms };
}

async function getMonthlyTrend(
    tenantId: string,
    fromDate: string,
    toDate: string
): Promise<DbResult<MonthlyTrend[]>> {
    const result = await query<{
        month: string;
        revenue: string;
        bookings: string;
    }>(
        `SELECT
            TO_CHAR(DATE_TRUNC('month', arrival), 'Mon YY') as month,
            SUM(total_amount)::text as revenue,
            COUNT(*)::text as bookings
        FROM bookings
        WHERE tenant_id = $1
            AND arrival >= $2::date
            AND arrival <= $3::date
            AND status != 'canceled'
        GROUP BY DATE_TRUNC('month', arrival)
        ORDER BY DATE_TRUNC('month', arrival)`,
        [tenantId, fromDate, toDate]
    );

    if (!result.success) {
        return result;
    }

    const monthlyData = result.data.map(row => {
        const revenue = parseFloat(row.revenue);
        const bookings = parseInt(row.bookings);

        return {
            month: row.month,
            revenue,
            bookings,
            avgBookingValue: safeDivide(revenue, bookings, 0)
        };
    });

    return { success: true, data: monthlyData };
}

async function getWeeklyRevenue(
    tenantId: string,
    fromDate: string,
    toDate: string
): Promise<DbResult<WeeklyRevenue[]>> {
    const result = await query<{
        week_start: string;
        revenue: string;
        bookings: string;
    }>(
        `SELECT
            TO_CHAR(DATE_TRUNC('week', arrival), 'MM/DD') as week_start,
            SUM(total_amount)::text as revenue,
            COUNT(*)::text as bookings
        FROM bookings
        WHERE tenant_id = $1
            AND arrival >= $2::date
            AND arrival <= $3::date
            AND status != 'canceled'
        GROUP BY DATE_TRUNC('week', arrival)
        ORDER BY DATE_TRUNC('week', arrival)
        LIMIT 12`,  // Show last 12 weeks max
        [tenantId, fromDate, toDate]
    );

    if (!result.success) {
        return { success: false, error: 'Failed to get weekly revenue data' };
    }

    const weeklyData = result.data.map(row => ({
        week: row.week_start,
        revenue: parseFloat(row.revenue),
        bookings: parseInt(row.bookings)
    }));

    return { success: true, data: weeklyData };
}

async function getUpcomingRevenue(
    tenantId: string
): Promise<DbResult<{
    next30Days: number
    next60Days: number
    next90Days: number
}>> {
    const result = await query<{
        next_30_days: string;
        next_60_days: string;
        next_90_days: string;
    }>(
        `SELECT
            COALESCE(SUM(CASE
                WHEN arrival BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
                THEN total_amount ELSE 0
            END), 0)::text as next_30_days,
            COALESCE(SUM(CASE
                WHEN arrival BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
                THEN total_amount ELSE 0
            END), 0)::text as next_60_days,
            COALESCE(SUM(CASE
                WHEN arrival BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
                THEN total_amount ELSE 0
            END), 0)::text as next_90_days
        FROM bookings
        WHERE tenant_id = $1
            AND arrival >= CURRENT_DATE
            AND status != 'canceled'`,
        [tenantId]
    );

    if (!result.success) {
        return { success: false, error: 'Failed to get upcoming revenue data' };
    }

    return {
        success: true,
        data: {
            next30Days: parseFloat(result.data[0].next_30_days),
            next60Days: parseFloat(result.data[0].next_60_days),
            next90Days: parseFloat(result.data[0].next_90_days)
        }
    };
}

async function getPreviousPeriodMetrics(
    tenantId: string,
    fromDate: string,
    toDate: string
): Promise<{
    revenue: {
        gross: number
        net: number
    }
    performance: {
        netRevenueRate: number
    }
}> {
    const currentFrom = new Date(fromDate);
    const currentTo = new Date(toDate);
    const periodLength = currentTo.getTime() - currentFrom.getTime();

    const previousTo = new Date(currentFrom.getTime() - 1);
    const previousFrom = new Date(previousTo.getTime() - periodLength);

    const previousFromStr = previousFrom.toISOString().split('T')[0];
    const previousToStr = previousTo.toISOString().split('T')[0];

    const result = await query<{
        gross_revenue: string;
        total_fees: string;
    }>(
        `WITH platform_fee_lookup AS (
            SELECT DISTINCT ON (platform_name)
                platform_name,
                fee_type,
                fee_value
            FROM platform_fees
            WHERE (tenant_id = $1 OR tenant_id = '00000000-0000-0000-0000-000000000000')
                AND is_active = true
                AND effective_from <= $3::date
                AND (effective_to IS NULL OR effective_to >= $2::date)
            ORDER BY platform_name, tenant_id DESC, effective_from DESC
        ),
        platform_fees_calc AS (
            SELECT
                b.total_amount,
                LOWER(
                    CASE
                        WHEN b.platform IS NULL OR b.platform = '' THEN 'direct'
                        WHEN LOWER(b.platform) LIKE '%direct%' THEN 'direct'
                        WHEN LOWER(b.platform) LIKE '%airbnb%' THEN 'airbnb'
                        WHEN LOWER(b.platform) LIKE '%vrbo%' OR LOWER(b.platform) LIKE '%homeaway%' THEN 'vrbo'
                        WHEN LOWER(b.platform) LIKE '%booking.com%' OR LOWER(b.platform) LIKE '%booking%' THEN 'booking.com'
                        ELSE LOWER(b.platform)
                    END
                ) as platform_key,
                COALESCE(
                    CASE
                        WHEN pf.fee_type = 'percentage' THEN b.total_amount * pf.fee_value
                        WHEN pf.fee_type = 'flat' THEN pf.fee_value
                        ELSE NULL
                    END,
                    CASE
                        WHEN LOWER(b.platform) LIKE '%airbnb%' THEN b.total_amount * 0.03
                        WHEN LOWER(b.platform) LIKE '%vrbo%' OR LOWER(b.platform) LIKE '%homeaway%' THEN b.total_amount * 0.05
                        WHEN LOWER(b.platform) LIKE '%booking.com%' OR LOWER(b.platform) LIKE '%booking%' THEN b.total_amount * 0.15
                        ELSE 0
                    END
                ) as fee
            FROM bookings b
            LEFT JOIN platform_fee_lookup pf ON
                LOWER(
                    CASE
                        WHEN b.platform IS NULL OR b.platform = '' THEN 'direct'
                        WHEN LOWER(b.platform) LIKE '%direct%' THEN 'direct'
                        WHEN LOWER(b.platform) LIKE '%airbnb%' THEN 'airbnb'
                        WHEN LOWER(b.platform) LIKE '%vrbo%' OR LOWER(b.platform) LIKE '%homeaway%' THEN 'vrbo'
                        WHEN LOWER(b.platform) LIKE '%booking.com%' OR LOWER(b.platform) LIKE '%booking%' THEN 'booking.com'
                        ELSE LOWER(b.platform)
                    END
                ) = pf.platform_name
            WHERE b.tenant_id = $1
                AND b.arrival >= $2::date
                AND b.arrival <= $3::date
                AND b.status != 'canceled'
        )
        SELECT
            COALESCE(SUM(total_amount), 0)::text as gross_revenue,
            COALESCE(SUM(fee), 0)::text as total_fees
        FROM platform_fees_calc`,
        [tenantId, previousFromStr, previousToStr]
    );

    if (result.success && result.data.length > 0) {
        const gross = parseFloat(result.data[0].gross_revenue);
        const fees = parseFloat(result.data[0].total_fees);
        const net = gross - fees;

        return {
            revenue: { gross, net },
            performance: {
                netRevenueRate: gross > 0 ? (net / gross) * 100 : 0
            }
        };
    }

    return {
        revenue: { gross: 0, net: 0 },
        performance: { netRevenueRate: 0 }
    };
}

export async function getFinancials(
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
        const fromDate = request.query.get('from') ||
            new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
        const toDate = request.query.get('to') ||
            new Date().toISOString().split('T')[0];

        const [
            revenueResult,
            platformResult,
            monthlyTrendResult,
            weeklyRevenueResult,
            upcomingRevenueResult,
            propertyResult,
            bookingStatsResult,
            previousPeriodMetrics
        ] = await Promise.all([
            query<{
                gross_revenue: string;
                total_fees: string;
                total_taxes: string;
                pending_revenue: string;
                collected_revenue: string;
                booking_count: string;
            }>(`
                WITH platform_fee_lookup AS (
                    SELECT DISTINCT ON (platform_name)
                        platform_name,
                        fee_type,
                        fee_value
                    FROM platform_fees
                    WHERE (tenant_id = $1 OR tenant_id = '00000000-0000-0000-0000-000000000000')
                        AND is_active = true
                        AND effective_from <= $3::date
                        AND (effective_to IS NULL OR effective_to >= $2::date)
                    ORDER BY platform_name, tenant_id DESC, effective_from DESC
                ),
                booking_data AS (
                    SELECT
                        b.id,
                        b.total_amount,
                        b.arrival,
                        b.platform,
                        LOWER(
                            CASE
                                WHEN b.platform IS NULL OR b.platform = '' THEN 'direct'
                                WHEN LOWER(b.platform) LIKE '%direct%' THEN 'direct'
                                WHEN LOWER(b.platform) LIKE '%airbnb%' THEN 'airbnb'
                                WHEN LOWER(b.platform) LIKE '%vrbo%' OR LOWER(b.platform) LIKE '%homeaway%' THEN 'vrbo'
                                WHEN LOWER(b.platform) LIKE '%booking.com%' OR LOWER(b.platform) LIKE '%booking%' THEN 'booking.com'
                                ELSE LOWER(b.platform)
                            END
                        ) as platform_key
                    FROM bookings b
                    WHERE b.tenant_id = $1
                        AND b.arrival >= $2::date
                        AND b.arrival <= $3::date
                        AND b.status != 'canceled'
                ),
                fee_calc AS (
                    SELECT
                        bd.id,
                        bd.total_amount,
                        bd.arrival,
                        COALESCE(
                            CASE
                                WHEN pf.fee_type = 'percentage' THEN bd.total_amount * pf.fee_value
                                WHEN pf.fee_type = 'flat' THEN pf.fee_value
                                ELSE
                                    CASE
                                        WHEN bd.platform_key = 'airbnb' THEN bd.total_amount * 0.03
                                        WHEN bd.platform_key = 'vrbo' THEN bd.total_amount * 0.05
                                        WHEN bd.platform_key = 'booking.com' THEN bd.total_amount * 0.15
                                        ELSE 0
                                    END
                            END, 0
                        ) as platform_fee
                    FROM booking_data bd
                    LEFT JOIN platform_fee_lookup pf ON bd.platform_key = pf.platform_name
                ),
                tax_data AS (
                    SELECT
                        bd.id,
                        COALESCE(SUM(bc.amount), 0) as tax_amount
                    FROM booking_data bd
                    LEFT JOIN booking_charges bc ON bd.id = bc.booking_id AND bc.type = 'tax'
                    GROUP BY bd.id
                )
                SELECT
                    COALESCE(SUM(fc.total_amount), 0)::text as gross_revenue,
                    COALESCE(SUM(fc.platform_fee), 0)::text as total_fees,
                    COALESCE(SUM(td.tax_amount), 0)::text as total_taxes,
                    COALESCE(SUM(CASE
                        WHEN fc.arrival > CURRENT_DATE THEN fc.total_amount
                        ELSE 0
                    END), 0)::text as pending_revenue,
                    COALESCE(SUM(CASE
                        WHEN fc.arrival <= CURRENT_DATE THEN fc.total_amount
                        ELSE 0
                    END), 0)::text as collected_revenue,
                    COUNT(*)::text as booking_count
                FROM fee_calc fc
                LEFT JOIN tax_data td ON fc.id = td.id`,
                [auth.tenantId, fromDate, toDate]
            ),
            getPlatformFinancials(auth.tenantId, fromDate, toDate),
            getMonthlyTrend(auth.tenantId, fromDate, toDate),
            getWeeklyRevenue(auth.tenantId, fromDate, toDate),
            getUpcomingRevenue(auth.tenantId),
            query<{ count: string }>(
                'SELECT COUNT(*)::text as count FROM properties WHERE tenant_id = $1 AND active = true',
                [auth.tenantId]
            ),
            query<{ nights_booked: string }>(
                `SELECT COUNT(DISTINCT (booking_date))::text as nights_booked
                FROM bookings b
                CROSS JOIN LATERAL generate_series(
                    b.arrival::date,
                    b.departure::date - interval '1 day',
                    interval '1 day'
                ) AS booking_date
                WHERE b.tenant_id = $1
                    AND b.arrival >= $2::date
                    AND b.departure <= $3::date
                    AND b.status != 'canceled'`,
                [auth.tenantId, fromDate, toDate]
            ),
            getPreviousPeriodMetrics(auth.tenantId, fromDate, toDate)
        ]);

        if (!revenueResult.success) {
            throw new Error('Failed to fetch revenue data');
        }

        const revenue = revenueResult.data[0];
        const grossRevenue = parseFloat(revenue.gross_revenue);
        const platformFees = parseFloat(revenue.total_fees);
        const taxes = parseFloat(revenue.total_taxes);
        const netRevenue = grossRevenue - platformFees - taxes;
        const pendingRevenue = parseFloat(revenue.pending_revenue);
        const collectedRevenue = parseFloat(revenue.collected_revenue);
        const bookingCount = parseInt(revenue.booking_count);

        // Calculate KPIs
        const propertyCount = propertyResult.success ? parseInt(propertyResult.data[0].count) : 1;
        const daysInPeriod = Math.ceil(
            (new Date(toDate).getTime() - new Date(fromDate).getTime()) / (1000 * 60 * 60 * 24)
        ) + 1;
        const availableRoomNights = propertyCount * daysInPeriod;
        const nightsBooked = bookingStatsResult.success ?
            parseInt(bookingStatsResult.data[0].nights_booked) : 0;

        const metrics: FinancialMetrics = {
            revenue: {
                gross: grossRevenue,
                net: netRevenue,
                pending: pendingRevenue,
                collected: collectedRevenue,
                platformFees,
                taxes
            },
            performance: {
                netRevenueRate: calculatePercentage(netRevenue, grossRevenue),
                avgBookingValue: safeDivide(grossRevenue, bookingCount, 0),
                totalBookings: bookingCount
            },
            upcoming: upcomingRevenueResult.success ? upcomingRevenueResult.data : {
                next30Days: 0,
                next60Days: 0,
                next90Days: 0
            },
            kpis: {
                revpar: safeDivide(grossRevenue, availableRoomNights, 0),
                adr: safeDivide(grossRevenue, nightsBooked, 0),
                collectionRate: calculatePercentage(collectedRevenue, grossRevenue)
            }
        };

        return {
            status: 200,
            headers: corsHeaders(),
            jsonBody: {
                metrics,
                weeklyRevenue: weeklyRevenueResult.success ? weeklyRevenueResult.data : [],
                platforms: platformResult.success ? platformResult.data : [],
                monthlyTrend: monthlyTrendResult.success ? monthlyTrendResult.data : [],
                previousPeriod: previousPeriodMetrics
            }
        };
    } catch (error) {
        context.error('Financial data error:', error);
        return {
            status: 500,
            headers: corsHeaders(),
            jsonBody: {
                error: error instanceof Error ? error.message : 'Failed to fetch financial data'
            }
        };
    }
}

app.http('financials', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    handler: getFinancials
});
