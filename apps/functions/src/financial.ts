import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { query, DbResult } from './services/database';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';

type FinancialMetrics = {
    revenue: {
        gross: number
        net: number
        pending: number
        collected: number
    }
    expenses: {
        total: number
        categories: Array<{
            category: string
            amount: number
            percentage: number
        }>
    }
    profitability: {
        netIncome: number
        profitMargin: number
        ebitda: number
        roi: number
    }
    cashFlow: {
        inflow: number
        outflow: number
        net: number
        forecast30Days: number
    }
    kpis: {
        revpar: number
        goppar: number
        averageCollectionPeriod: number
        expenseRatio: number
    }
}

type CashFlowData = {
    date: string
    inflow: number
    outflow: number
    netFlow: number
    balance: number
}

type BudgetComparison = {
    category: string
    budgeted: number
    actual: number
    variance: number
    variancePercent: number
}

type PlatformFinancials = {
    platform: string
    grossRevenue: number
    fees: number
    netRevenue: number
    feeRate: number
    bookingCount: number
}

type MonthlyProfitability = {
    month: string
    revenue: number
    expenses: number
    profit: number
}

function isSuccess<T>(result: DbResult<T>): result is { success: true; data: T } {
    return result.success;
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
        const fromDate = request.query.get('from') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
        const toDate = request.query.get('to') || new Date().toISOString().split('T')[0];
        const tagIds = request.query.get('tags')?.split(',').filter(Boolean) || [];

        // Build tag filter
        let tagFilter = '';
        const baseParams = [auth.tenantId, fromDate, toDate];
        const queryParams = tagIds.length > 0 ? [...baseParams, tagIds] : baseParams;

        if (tagIds.length > 0) {
            tagFilter = `AND EXISTS (
SELECT 1 FROM booking_tags bt
WHERE bt.booking_id = b.id
AND bt.tag_id = ANY($4::uuid[])
)`;
        }

        // Get revenue metrics
        const revenueResult = await query<{
            gross_revenue: string;
            total_fees: string;
            total_taxes: string;
            pending_payments: string;
            collected_revenue: string;
        }>(
            `WITH revenue_data AS (
SELECT
COALESCE(SUM(b.total_amount), 0) as gross_revenue,
COALESCE(SUM(
CASE
WHEN b.platform ILIKE '%airbnb%' THEN b.total_amount * 0.03
WHEN b.platform ILIKE '%vrbo%' THEN b.total_amount * 0.05
WHEN b.platform ILIKE '%booking%' THEN b.total_amount * 0.15
ELSE 0
END
), 0) as platform_fees,
COALESCE(SUM(CASE WHEN bc.type = 'tax' THEN bc.amount ELSE 0 END), 0) as total_taxes
FROM bookings b
LEFT JOIN booking_charges bc ON b.id = bc.booking_id
WHERE b.tenant_id = $1
AND b.arrival >= $2
AND b.arrival <= $3
AND b.status != 'canceled'
${tagFilter}
),
pending_data AS (
SELECT
COALESCE(SUM(total_amount), 0) as pending_payments
FROM bookings
WHERE tenant_id = $1
AND arrival <= CURRENT_DATE
AND arrival >= CURRENT_DATE - INTERVAL '30 days'
AND status = 'confirmed'
${tagFilter}
),
collected_data AS (
SELECT
COALESCE(SUM(total_amount), 0) as collected_revenue
FROM bookings
WHERE tenant_id = $1
AND arrival >= $2
AND arrival <= $3
AND arrival <= CURRENT_DATE - INTERVAL '7 days'
AND status != 'canceled'
${tagFilter}
)
SELECT
rd.gross_revenue::text,
rd.platform_fees::text as total_fees,
rd.total_taxes::text,
pd.pending_payments::text,
cd.collected_revenue::text
FROM revenue_data rd, pending_data pd, collected_data cd`,
            queryParams
        );

        if (!revenueResult.success || revenueResult.data.length === 0) {
            throw new Error('Failed to fetch revenue metrics');
        }

        const revenue = revenueResult.data[0];
        const grossRevenue = parseFloat(revenue.gross_revenue);
        const fees = parseFloat(revenue.total_fees);
        const taxes = parseFloat(revenue.total_taxes);
        const netRevenue = grossRevenue - fees - taxes;

        // Get expense data (mock for now - in real implementation, this would come from expense tracking)
        const expenseCategories = [
            { category: 'Cleaning', amount: grossRevenue * 0.12, percentage: 35 },
            { category: 'Platform Fees', amount: fees, percentage: 18 },
            { category: 'Maintenance', amount: grossRevenue * 0.05, percentage: 15 },
            { category: 'Utilities', amount: grossRevenue * 0.04, percentage: 12 },
            { category: 'Insurance', amount: grossRevenue * 0.03, percentage: 9 },
            { category: 'Property Management', amount: grossRevenue * 0.025, percentage: 7 },
            { category: 'Other', amount: grossRevenue * 0.015, percentage: 4 }
        ];

        const totalExpenses = expenseCategories.reduce((sum, cat) => sum + cat.amount, 0);
        const netIncome = netRevenue - totalExpenses;
        const profitMargin = grossRevenue > 0 ? (netIncome / grossRevenue) * 100 : 0;

        // Get property count for KPI calculations
        const propertyCountResult = await query<{ count: string }>(
            'SELECT COUNT(*) as count FROM properties WHERE tenant_id = $1 AND active = true',
            [auth.tenantId]
        );

        let propertyCount = 1;
        if (isSuccess(propertyCountResult)) {
            propertyCount = parseInt(propertyCountResult.data[0]?.count || '1');
        }

        const daysInPeriod = Math.ceil((new Date(toDate).getTime() - new Date(fromDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const availableRoomNights = propertyCount * daysInPeriod;

        // Get occupancy for GOPPAR calculation
        const occupancyResult = await query<{ booked_nights: string }>(
            `SELECT
COALESCE(SUM(
CASE
WHEN arrival <= $3 AND departure >= $2 THEN
LEAST(departure, $3::date) - GREATEST(arrival, $2::date)
ELSE 0
END
), 0) as booked_nights
FROM bookings
WHERE tenant_id = $1
AND arrival <= $3
AND departure >= $2
AND status != 'canceled'
${tagFilter}`,
            queryParams
        );

        let bookedNights = 0;
        if (isSuccess(occupancyResult)) {
            bookedNights = parseInt(occupancyResult.data[0]?.booked_nights || '0');
        }

        // Calculate KPIs
        const revpar = availableRoomNights > 0 ? grossRevenue / availableRoomNights : 0;
        const goppar = availableRoomNights > 0 ? netIncome / availableRoomNights : 0;
        const expenseRatio = grossRevenue > 0 ? (totalExpenses / grossRevenue) * 100 : 0;

        // Get cash flow data
        const cashFlowResult = await query<{
            week_start: string;
            inflow: string;
            outflow: string;
        }>(
            `WITH weekly_data AS (
SELECT
DATE_TRUNC('week', arrival) as week_start,
SUM(total_amount) as inflow
FROM bookings
WHERE tenant_id = $1
AND arrival >= $2
AND arrival <= $3
AND status != 'canceled'
${tagFilter}
GROUP BY DATE_TRUNC('week', arrival)
),
weekly_expenses AS (
SELECT
DATE_TRUNC('week', arrival) as week_start,
SUM(total_amount) * 0.3 as outflow -- Estimated 30% expense ratio
FROM bookings
WHERE tenant_id = $1
AND arrival >= $2
AND arrival <= $3
AND status != 'canceled'
${tagFilter}
GROUP BY DATE_TRUNC('week', arrival)
)
SELECT
TO_CHAR(wd.week_start, 'Mon DD') as week_start,
COALESCE(wd.inflow, 0)::text as inflow,
COALESCE(we.outflow, 0)::text as outflow
FROM weekly_data wd
LEFT JOIN weekly_expenses we ON wd.week_start = we.week_start
ORDER BY wd.week_start
LIMIT 12`,
            queryParams
        );

        let runningBalance = 50000; // Starting balance (mock)
        const cashFlow: CashFlowData[] = cashFlowResult.success ? cashFlowResult.data.map(row => {
            const inflow = parseFloat(row.inflow);
            const outflow = parseFloat(row.outflow);
            const netFlow = inflow - outflow;
            runningBalance += netFlow;

            return {
                date: row.week_start,
                inflow,
                outflow,
                netFlow,
                balance: runningBalance
            };
        }) : [];

        // Get platform financials
        const platformResult = await query<{
            platform: string;
            gross_revenue: string;
            booking_count: string;
        }>(
            `SELECT
COALESCE(
CASE
WHEN platform ILIKE '%airbnb%' THEN 'Airbnb'
WHEN platform ILIKE '%vrbo%' THEN 'VRBO'
WHEN platform ILIKE '%booking%' THEN 'Booking.com'
ELSE 'Direct'
END,
'Direct'
) as platform,
SUM(total_amount) as gross_revenue,
COUNT(*) as booking_count
FROM bookings
WHERE tenant_id = $1
AND arrival >= $2
AND arrival <= $3
AND status != 'canceled'
${tagFilter}
GROUP BY platform
ORDER BY gross_revenue DESC`,
            queryParams
        );

        const platforms: PlatformFinancials[] = platformResult.success ? platformResult.data.map(row => {
            const platform = row.platform;
            const gross = parseFloat(row.gross_revenue);
            const feeRate = platform === 'Airbnb' ? 3 :
                platform === 'VRBO' ? 5 :
                    platform === 'Booking.com' ? 15 : 2.5;
            const platformFees = gross * (feeRate / 100);

            return {
                platform,
                grossRevenue: gross,
                fees: platformFees,
                netRevenue: gross - platformFees,
                feeRate,
                bookingCount: parseInt(row.booking_count)
            };
        }) : [];

        // Get monthly profitability
        const monthlyResult = await query<{
            month: string;
            revenue: string;
        }>(
            `SELECT
TO_CHAR(arrival, 'YYYY-MM') as month,
SUM(total_amount) as revenue
FROM bookings
WHERE tenant_id = $1
AND arrival >= $2
AND arrival <= $3
AND status != 'canceled'
${tagFilter}
GROUP BY TO_CHAR(arrival, 'YYYY-MM')
ORDER BY month`,
            queryParams
        );

        const monthlyProfitability: MonthlyProfitability[] = monthlyResult.success ? monthlyResult.data.map(row => {
            const monthRevenue = parseFloat(row.revenue);
            const monthExpenses = monthRevenue * 0.3; // Estimated 30% expense ratio

            return {
                month: row.month,
                revenue: monthRevenue,
                expenses: monthExpenses,
                profit: monthRevenue - monthExpenses
            };
        }) : [];

        // Mock budget data (in real implementation, this would come from budget tables)
        const budget: BudgetComparison[] = [
            {
                category: 'Revenue',
                budgeted: grossRevenue * 0.95,
                actual: grossRevenue,
                variance: grossRevenue - (grossRevenue * 0.95),
                variancePercent: 5
            },
            {
                category: 'Cleaning',
                budgeted: grossRevenue * 0.10,
                actual: expenseCategories[0].amount,
                variance: (grossRevenue * 0.10) - expenseCategories[0].amount,
                variancePercent: -20
            },
            {
                category: 'Maintenance',
                budgeted: grossRevenue * 0.06,
                actual: expenseCategories[2].amount,
                variance: (grossRevenue * 0.06) - expenseCategories[2].amount,
                variancePercent: 16.7
            },
            {
                category: 'Platform Fees',
                budgeted: fees * 0.95,
                actual: fees,
                variance: (fees * 0.95) - fees,
                variancePercent: -5.3
            }
        ];

        // Calculate 30-day forecast
        const recentDailyAvg = cashFlow.length > 0
            ? cashFlow.slice(-4).reduce((sum, cf) => sum + cf.netFlow, 0) / 4 * 7 // Convert weekly to daily
            : 0;
        const forecast30Days = runningBalance + (recentDailyAvg * 30);

        // Build response
        const metrics: FinancialMetrics = {
            revenue: {
                gross: grossRevenue,
                net: netRevenue,
                pending: parseFloat(revenue.pending_payments),
                collected: parseFloat(revenue.collected_revenue)
            },
            expenses: {
                total: totalExpenses,
                categories: expenseCategories
            },
            profitability: {
                netIncome,
                profitMargin,
                ebitda: netIncome + (grossRevenue * 0.02), // Add back depreciation estimate
                roi: propertyCount > 0 ? (netIncome / (propertyCount * 200000)) * 100 : 0 // Assume $200k per property
            },
            cashFlow: {
                inflow: cashFlow.reduce((sum, cf) => sum + cf.inflow, 0),
                outflow: cashFlow.reduce((sum, cf) => sum + cf.outflow, 0),
                net: cashFlow.reduce((sum, cf) => sum + cf.netFlow, 0),
                forecast30Days
            },
            kpis: {
                revpar,
                goppar,
                averageCollectionPeriod: 5.2, // Mock value
                expenseRatio
            }
        };

        return {
            status: 200,
            headers: corsHeaders(),
            jsonBody: {
                metrics,
                cashFlow,
                budget,
                platforms,
                monthlyProfitability
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
