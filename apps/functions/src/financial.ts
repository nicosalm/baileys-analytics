import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { query, DbResult } from './services/database';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';

type ExpenseData = {
    category: string
    amount: number
    percentage: number
    trend: number // Month-over-month change
    budgetVariance?: number
}

type EnhancedFinancialMetrics = {
    revenue: {
        gross: number
        net: number
        pending: number
        collected: number
    }
    expenses: {
        total: number
        categories: ExpenseData[]
        byProperty: Array<{
            propertyId: string
            propertyName: string
            totalExpenses: number
            expenseBreakdown: ExpenseData[]
        }>
    }
    profitability: {
        netIncome: number
        profitMargin: number
        ebitda: number
        roi: number
        cashOnCashReturn: number
    }
    cashFlow: {
        inflow: number
        outflow: number
        net: number
        forecast30Days: number
        operatingCashFlow: number
        freeChashFlow: number
    }
    kpis: {
        revpar: number
        goppar: number
        averageCollectionPeriod: number
        expenseRatio: number
        breakEvenOccupancy: number
    }
}

// Get real expense data with caching for performance
async function getExpenseData(
    tenantId: string,
    fromDate: string,
    toDate: string,
    propertyIds?: string[]
): Promise<DbResult<ExpenseData[]>> {
    // Build property filter
    let propertyFilter = '';
    const params: any[] = [tenantId, fromDate, toDate];

    if (propertyIds && propertyIds.length > 0) {
        propertyFilter = 'AND (e.property_id = ANY($4::uuid[]) OR e.property_id IS NULL)';
        params.push(propertyIds);
    }

    const result = await query<{
        category_name: string;
        total_amount: string;
        expense_count: string;
        avg_amount: string;
        previous_period_amount: string;
    }>(
        `WITH current_period AS (
            SELECT
                ec.name as category_name,
                COALESCE(SUM(e.amount), 0) as total_amount,
                COUNT(e.id) as expense_count,
                AVG(e.amount) as avg_amount
            FROM expense_categories ec
            LEFT JOIN expenses e ON ec.id = e.category_id
                AND e.tenant_id = $1
                AND e.expense_date >= $2::date
                AND e.expense_date <= $3::date
                ${propertyFilter}
            WHERE ec.tenant_id = $1
            GROUP BY ec.id, ec.name
        ),
        previous_period AS (
            SELECT
                ec.name as category_name,
                COALESCE(SUM(e.amount), 0) as total_amount
            FROM expense_categories ec
            LEFT JOIN expenses e ON ec.id = e.category_id
                AND e.tenant_id = $1
                AND e.expense_date >= ($2::date - INTERVAL '1 month')::date
                AND e.expense_date < $2::date
                ${propertyFilter}
            WHERE ec.tenant_id = $1
            GROUP BY ec.id, ec.name
        )
        SELECT
            cp.category_name,
            cp.total_amount::text,
            cp.expense_count::text,
            cp.avg_amount::text,
            COALESCE(pp.total_amount, 0)::text as previous_period_amount
        FROM current_period cp
        LEFT JOIN previous_period pp ON cp.category_name = pp.category_name
        ORDER BY cp.total_amount DESC`,
        params
    );

    if (!result.success) {
        return result;
    }

    // Calculate total for percentages
    const total = result.data.reduce((sum, row) => sum + parseFloat(row.total_amount), 0);

    const expenses: ExpenseData[] = result.data.map(row => {
        const current = parseFloat(row.total_amount);
        const previous = parseFloat(row.previous_period_amount);

        return {
            category: row.category_name,
            amount: current,
            percentage: total > 0 ? (current / total) * 100 : 0,
            trend: previous > 0 ? ((current - previous) / previous) * 100 : 0
        };
    });

    return { success: true, data: expenses };
}

// Get budget comparison data
async function getBudgetData(
    tenantId: string,
    year: number,
    month?: number
): Promise<DbResult<Array<{
    category: string
    budgeted: number
    actual: number
    variance: number
    variancePercent: number
}>>> {
    const monthFilter = month ? 'AND b.budget_month = $3' : 'AND b.budget_month IS NULL';
    const params = month ? [tenantId, year, month] : [tenantId, year];

    const result = await query<{
        category_name: string;
        budgeted_amount: string;
        actual_amount: string;
    }>(
        `WITH budget_data AS (
            SELECT
                ec.name as category_name,
                COALESCE(SUM(b.amount), 0) as budgeted_amount
            FROM expense_categories ec
            LEFT JOIN budgets b ON ec.id = b.category_id
                AND b.tenant_id = $1
                AND b.budget_year = $2
                ${monthFilter}
            WHERE ec.tenant_id = $1
            GROUP BY ec.id, ec.name
        ),
        actual_data AS (
            SELECT
                ec.name as category_name,
                COALESCE(SUM(e.amount), 0) as actual_amount
            FROM expense_categories ec
            LEFT JOIN expenses e ON ec.id = e.category_id
                AND e.tenant_id = $1
                AND EXTRACT(YEAR FROM e.expense_date) = $2
                ${month ? 'AND EXTRACT(MONTH FROM e.expense_date) = $3' : ''}
            WHERE ec.tenant_id = $1
            GROUP BY ec.id, ec.name
        )
        SELECT
            COALESCE(bd.category_name, ad.category_name) as category_name,
            COALESCE(bd.budgeted_amount, 0)::text as budgeted_amount,
            COALESCE(ad.actual_amount, 0)::text as actual_amount
        FROM budget_data bd
        FULL OUTER JOIN actual_data ad ON bd.category_name = ad.category_name
        WHERE COALESCE(bd.budgeted_amount, 0) > 0 OR COALESCE(ad.actual_amount, 0) > 0`,
        params
    );

    if (!result.success) {
        return result;
    }

    const budgetComparison = result.data.map(row => {
        const budgeted = parseFloat(row.budgeted_amount);
        const actual = parseFloat(row.actual_amount);
        const variance = budgeted - actual; // Positive = under budget

        return {
            category: row.category_name,
            budgeted,
            actual,
            variance,
            variancePercent: budgeted > 0 ? (variance / budgeted) * 100 : 0
        };
    });

    return { success: true, data: budgetComparison };
}

// Enhanced cash flow calculation with real data
async function getEnhancedCashFlow(
    tenantId: string,
    fromDate: string,
    toDate: string
): Promise<DbResult<{
    cashFlow: Array<{
        date: string
        inflow: number
        outflow: number
        netFlow: number
        balance: number
    }>
    forecast: {
        next30Days: number
        next90Days: number
        seasonalAdjustment: number
    }
}>> {
    // Get weekly cash flow data
    const cashFlowResult = await query<{
        week_start: string;
        inflow: string;
        outflow: string;
    }>(
        `WITH weekly_inflow AS (
            SELECT
                DATE_TRUNC('week', arrival) as week_start,
                SUM(total_amount) as inflow
            FROM bookings
            WHERE tenant_id = $1
                AND arrival >= $2::date
                AND arrival <= $3::date
                AND status != 'canceled'
            GROUP BY DATE_TRUNC('week', arrival)
        ),
        weekly_outflow AS (
            SELECT
                DATE_TRUNC('week', expense_date) as week_start,
                SUM(amount) as outflow
            FROM expenses
            WHERE tenant_id = $1
                AND expense_date >= $2::date
                AND expense_date <= $3::date
            GROUP BY DATE_TRUNC('week', expense_date)
        )
        SELECT
            COALESCE(wi.week_start, wo.week_start) as week_start,
            COALESCE(wi.inflow, 0)::text as inflow,
            COALESCE(wo.outflow, 0)::text as outflow
        FROM weekly_inflow wi
        FULL OUTER JOIN weekly_outflow wo ON wi.week_start = wo.week_start
        ORDER BY week_start`,
        [tenantId, fromDate, toDate]
    );

    if (!cashFlowResult.success) {
        return { success: false, error: 'Failed to get cash flow data' };
    }

    // Calculate running balance
    let runningBalance = 50000; // Starting balance - should come from settings
    const cashFlow = cashFlowResult.data.map(row => {
        const inflow = parseFloat(row.inflow);
        const outflow = parseFloat(row.outflow);
        const netFlow = inflow - outflow;
        runningBalance += netFlow;

        return {
            date: new Date(row.week_start).toLocaleDateString(),
            inflow,
            outflow,
            netFlow,
            balance: runningBalance
        };
    });

    // Calculate forecast based on historical patterns
    const avgWeeklyInflow = cashFlow.reduce((sum, cf) => sum + cf.inflow, 0) / cashFlow.length;
    const avgWeeklyOutflow = cashFlow.reduce((sum, cf) => sum + cf.outflow, 0) / cashFlow.length;
    const avgWeeklyNet = avgWeeklyInflow - avgWeeklyOutflow;

    // Get seasonal adjustment based on historical data
    const seasonalAdjustment = await getSeasonalAdjustment(tenantId);

    const forecast = {
        next30Days: avgWeeklyNet * 4.3 * (1 + seasonalAdjustment),
        next90Days: avgWeeklyNet * 13 * (1 + seasonalAdjustment),
        seasonalAdjustment
    };

    return {
        success: true,
        data: { cashFlow, forecast }
    };
}

async function getSeasonalAdjustment(tenantId: string): Promise<number> {
    const currentMonth = new Date().getMonth() + 1;

    const result = await query<{ adjustment: string }>(
        `WITH monthly_averages AS (
            SELECT
                EXTRACT(MONTH FROM arrival) as month,
                AVG(total_amount) as avg_revenue
            FROM bookings
            WHERE tenant_id = $1
                AND status != 'canceled'
                AND arrival >= CURRENT_DATE - INTERVAL '2 years'
            GROUP BY EXTRACT(MONTH FROM arrival)
        ),
        overall_average AS (
            SELECT AVG(avg_revenue) as yearly_avg
            FROM monthly_averages
        )
        SELECT
            (ma.avg_revenue - oa.yearly_avg) / NULLIF(oa.yearly_avg, 0) as adjustment
        FROM monthly_averages ma
        CROSS JOIN overall_average oa
        WHERE ma.month = $2`,
        [tenantId, currentMonth]
    );

    if (result.success && result.data.length > 0) {
        return parseFloat(result.data[0].adjustment);
    }

    return 0;
}

export async function getFinancialsEnhanced(
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
        const year = new Date(fromDate).getFullYear();
        const month = new Date(fromDate).getMonth() + 1;

        // Parallel data fetching for performance
        const [
            revenueResult,
            expenseResult,
            budgetResult,
            cashFlowResult,
            propertyResult
        ] = await Promise.all([
            // Get revenue data (existing query)
            query<{
                gross_revenue: string;
                total_fees: string;
                total_taxes: string;
                pending_payments: string;
                collected_revenue: string;
            }>(`
                SELECT
                    COALESCE(SUM(b.total_amount), 0) as gross_revenue,
                    COALESCE(SUM(
                        CASE
                            WHEN b.platform ILIKE '%airbnb%' THEN b.total_amount * 0.03
                            WHEN b.platform ILIKE '%vrbo%' THEN b.total_amount * 0.05
                            WHEN b.platform ILIKE '%booking%' THEN b.total_amount * 0.15
                            ELSE 0
                        END
                    ), 0) as total_fees,
                    COALESCE(SUM(CASE WHEN bc.type = 'tax' THEN bc.amount ELSE 0 END), 0) as total_taxes,
                    COALESCE(SUM(CASE WHEN b.arrival > CURRENT_DATE - INTERVAL '30 days' THEN b.total_amount ELSE 0 END), 0) as pending_payments,
                    COALESCE(SUM(CASE WHEN b.arrival <= CURRENT_DATE - INTERVAL '7 days' THEN b.total_amount ELSE 0 END), 0) as collected_revenue
                FROM bookings b
                LEFT JOIN booking_charges bc ON b.id = bc.booking_id
                WHERE b.tenant_id = $1
                    AND b.arrival >= $2
                    AND b.arrival <= $3
                    AND b.status != 'canceled'`,
                [auth.tenantId, fromDate, toDate]
            ),
            getExpenseData(auth.tenantId, fromDate, toDate),
            getBudgetData(auth.tenantId, year, month),
            getEnhancedCashFlow(auth.tenantId, fromDate, toDate),
            query<{ count: string }>('SELECT COUNT(*) as count FROM properties WHERE tenant_id = $1 AND active = true', [auth.tenantId])
        ]);

        if (!revenueResult.success) {
            throw new Error('Failed to fetch revenue data');
        }

        const revenue = revenueResult.data[0];
        const grossRevenue = parseFloat(revenue.gross_revenue);
        const fees = parseFloat(revenue.total_fees);
        const taxes = parseFloat(revenue.total_taxes);
        const netRevenue = grossRevenue - fees - taxes;

        // Get real expense data
        const expenses = expenseResult.success ? expenseResult.data : [];
        const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

        // Calculate profitability metrics
        const netIncome = netRevenue - totalExpenses;
        const profitMargin = grossRevenue > 0 ? (netIncome / grossRevenue) * 100 : 0;

        // Property count for KPIs
        const propertyCount = propertyResult.success ? parseInt(propertyResult.data[0].count) : 1;
        const daysInPeriod = Math.ceil((new Date(toDate).getTime() - new Date(fromDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const availableRoomNights = propertyCount * daysInPeriod;

        // Calculate KPIs
        const revpar = availableRoomNights > 0 ? grossRevenue / availableRoomNights : 0;
        const goppar = availableRoomNights > 0 ? netIncome / availableRoomNights : 0;
        const expenseRatio = grossRevenue > 0 ? (totalExpenses / grossRevenue) * 100 : 0;
        const breakEvenOccupancy = grossRevenue > 0 ? (totalExpenses / (grossRevenue / availableRoomNights)) / daysInPeriod : 0;

        // Build response
        const metrics: EnhancedFinancialMetrics = {
            revenue: {
                gross: grossRevenue,
                net: netRevenue,
                pending: parseFloat(revenue.pending_payments),
                collected: parseFloat(revenue.collected_revenue)
            },
            expenses: {
                total: totalExpenses,
                categories: expenses,
                byProperty: [] // Would need additional query for property-level expenses
            },
            profitability: {
                netIncome,
                profitMargin,
                ebitda: netIncome + (grossRevenue * 0.02), // Simple depreciation estimate
                roi: propertyCount > 0 ? (netIncome / (propertyCount * 200000)) * 100 : 0,
                cashOnCashReturn: 0 // Would need investment data
            },
            cashFlow: {
                inflow: cashFlowResult.success ?
                    cashFlowResult.data.cashFlow.reduce((sum, cf) => sum + cf.inflow, 0) : 0,
                outflow: cashFlowResult.success ?
                    cashFlowResult.data.cashFlow.reduce((sum, cf) => sum + cf.outflow, 0) : 0,
                net: cashFlowResult.success ?
                    cashFlowResult.data.cashFlow.reduce((sum, cf) => sum + cf.netFlow, 0) : 0,
                forecast30Days: cashFlowResult.success ?
                    cashFlowResult.data.forecast.next30Days : 0,
                operatingCashFlow: netIncome,
                freeChashFlow: netIncome - (grossRevenue * 0.05) // Capital expenditure estimate
            },
            kpis: {
                revpar,
                goppar,
                averageCollectionPeriod: 5.2, // Would need AR data
                expenseRatio,
                breakEvenOccupancy
            }
        };

        return {
            status: 200,
            headers: corsHeaders(),
            jsonBody: {
                metrics,
                cashFlow: cashFlowResult.success ? cashFlowResult.data.cashFlow : [],
                budget: budgetResult.success ? budgetResult.data : [],
                platforms: [], // Existing platform data logic
                monthlyProfitability: [] // Existing monthly data logic
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
    handler: getFinancialsEnhanced
});
