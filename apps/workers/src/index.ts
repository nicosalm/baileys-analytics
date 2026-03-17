import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authMiddleware } from './middleware/auth';
import { subscriptionMiddleware } from './middleware/subscription';
import { demoGuard } from './middleware/demo-guard';
import { rateLimit } from './middleware/rate-limit';
import { timeout } from './middleware/timeout';

import { createSupabaseClient } from './services/supabase';
import { getOverviewData } from './services/overview';
import { getFinancialBatchData } from './services/financial';
import { getPropertiesData } from './services/properties';
import { getOccupancyData } from './services/occupancy';
import { getGuestsData, getCancelledBookingsData } from './services/guests';
import { getInquiriesData } from './services/inquiries';
import { properties } from './routes/properties';
import { propertyDetail } from './routes/property-detail';
import { bookings } from './routes/bookings';
import { guests } from './routes/guests';
import { financial } from './routes/financial';
import { occupancy } from './routes/occupancy';
import { periodDetail } from './routes/period-detail';
import { seasonalAnalysis } from './routes/seasonal-analysis';
import { seasons } from './routes/seasons';
import { goals } from './routes/goals';
import { tags } from './routes/tags';
import { tax } from './routes/tax';
import { platformFees as platformFeesRoute } from './routes/platform-fees';
import { operatingExpenses as operatingExpensesRoute } from './routes/operating-expenses'
import { expenseTemplates as expenseTemplatesRoute } from './routes/expense-templates';
import { scheduler } from './routes/scheduler';
import { validation } from './routes/validation';
import { oauth } from './routes/oauth';
import { webhooks } from './routes/webhooks';
import { sync } from './routes/sync';
import { health } from './routes/health';
import { scheduled } from './scheduled';
import { billing } from './routes/billing';
import { account } from './routes/account';
import { admin } from './routes/admin';
import { announcements } from './routes/announcements';

const app = new Hono<{ Bindings: Env; Variables: { user: any; tenantId: string } }>();

app.use('/*', cors({
	origin: (origin, c) => {
		const allowedOrigins = [c.env.FRONTEND_URL];

		// Add production domains
		if (c.env.FRONTEND_URL.includes('baileys-dashboard.pages.dev')) {
			// Also allow the custom domain
			allowedOrigins.push('https://baileysanalytics.com', 'https://www.baileysanalytics.com');
		}

		// in development, also allow localhost origins
		if (c.env.FRONTEND_URL.includes('localhost')) {
			allowedOrigins.push('http://localhost:5173', 'http://localhost:5174');
		}

		return allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
	},
	allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
	allowHeaders: ['Content-Type', 'Authorization'],
	credentials: true,
}));

// timeout: 30s
app.use('/api/*', timeout({ ms: 30000 }));

// max request size: 10mb
app.use('/api/*', async (c, next) => {
	const contentLength = c.req.header('content-length');
	if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
		return c.json({ error: 'Request body too large (max 10MB)' }, 413);
	}
	await next();
});

app.route('/health', health);

// auth endpoints - only /me is used (login/signup/refresh handled by Supabase client directly)
app.get('/api/auth/me', authMiddleware, async (c) => {
	const user = c.get('user');
	const supabase = createSupabaseClient(c.env);

	const { data: tenantData } = await supabase
		.from('tenants')
		.select(`
			id,
			created_at
		`)
		.eq('user_id', user.id)
		.single();

	const { data: ownerrezToken } = tenantData ? await supabase
		.from('oauth_tokens')
		.select('id')
		.eq('tenant_id', tenantData.id)
		.single() : { data: null };

	return c.json({
		id: user.id,
		email: user.email,
		tenantId: tenantData?.id || null,
		hasOwnerRezConnection: !!ownerrezToken,
		createdAt: user.created_at || new Date().toISOString()
	});
});

app.get('/api/sync-status', authMiddleware, async (c) => {
	const tenantId = c.get('tenantId');

	if (!tenantId) {
		return c.json({
			propertyCount: 0,
			bookingCount: 0,
			guestCount: 0,
			lastPropertySync: null,
			lastBookingSync: null
		});
	}

	const supabase = createSupabaseClient(c.env);

	// get counts
	const [properties, bookings, syncStatuses] = await Promise.all([
		supabase
			.from('properties')
			.select('id', { count: 'exact', head: true })
			.eq('tenant_id', tenantId),
		supabase
			.from('bookings')
			.select('id', { count: 'exact', head: true })
			.eq('tenant_id', tenantId),
		supabase
			.from('sync_status')
			.select('*')
			.eq('tenant_id', tenantId)
			.order('last_sync', { ascending: false })
			.limit(10)
	]);

	// count guests with records
	const { count: guestCount } = await supabase
		.from('guests')
		.select('id', { count: 'exact', head: true })
		.eq('tenant_id', tenantId);

	const lastPropertySync = syncStatuses.data?.find(s => s.sync_type === 'properties')?.last_sync || null;
	const lastBookingSync = syncStatuses.data?.find(s => ['recent', 'historical', 'bookings'].includes(s.sync_type))?.last_sync || null;

	return c.json({
		propertyCount: properties.count || 0,
		bookingCount: bookings.count || 0,
		guestCount: guestCount || 0,
		lastPropertySync,
		lastBookingSync,
		syncHistory: syncStatuses.data || []
	});
});

app.get('/api/dashboard-batch', authMiddleware, async (c) => {
	const user = c.get('user');
	const tenantId = c.get('tenantId');
	const view = c.req.query('view') || 'overview';
	const from = c.req.query('from') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
	const to = c.req.query('to') || new Date().toISOString().split('T')[0];
	const tags = c.req.query('tags')?.split(',').filter(Boolean);
	const properties = c.req.query('properties')?.split(',').filter(Boolean);
	const comparisonFrom = c.req.query('comparisonFrom');
	const comparisonTo = c.req.query('comparisonTo');

	if (!tenantId) {
		return c.json({ error: 'Tenant not found' }, 404);
	}

	const cacheKey = `dashboard:${user.id}:${view}:${from}:${to}:${tags?.join(',')}:${properties?.join(',')}:${comparisonFrom || ''}:${comparisonTo || ''}`;

	// try to get from cache if available
	if (c.env.CACHE) {
		const cached = await c.env.CACHE.get(cacheKey, 'json');
		if (cached) {
			return c.json({ ...cached, _cached: true });
		}
	}

	const supabase = createSupabaseClient(c.env);
	let data: any = {};

	switch(view) {
		case 'overview': {
			data = await getOverviewData(
				supabase,
				tenantId,
				from,
				to,
				tags,
				comparisonFrom,
				comparisonTo,
				properties
			);
			break;
		}

		case 'financial': {
			const { pl: plData, revenue: revenueData, cashflow: cashflowData, tax: taxData } =
				await getFinancialBatchData(supabase, tenantId, from, to, tags, properties);

			let previousPL = null;
			let previousRevenue = null;
			let previousCashflow = null;
			let previousTax = null;

			if (comparisonFrom && comparisonTo) {
				const { pl: prevPL, revenue: prevRevenue, cashflow: prevCashflow, tax: prevTax } =
					await getFinancialBatchData(supabase, tenantId, comparisonFrom, comparisonTo, tags, properties);

				previousPL = prevPL ? {
					revenue: prevPL.metrics.revenue,
					performance: prevPL.metrics.performance,
					operatingExpenses: prevPL.metrics.operatingExpenses,
					operatingProfit: prevPL.metrics.operatingProfit,
					monthlyTrend: prevPL.monthlyTrend,
					weeklyRevenue: prevPL.weeklyRevenue
				} : null;

				previousRevenue = prevRevenue ? {
					...prevRevenue,
					revenue: {
						gross: prevRevenue.gross,
						net: prevRevenue.net
					},
					monthlyTrend: prevRevenue.byMonth
				} : null;

				previousCashflow = prevCashflow ? {
					...prevCashflow,
					revenue: {
						gross: prevPL?.metrics?.revenue?.gross || 0,
						net: prevPL?.metrics?.revenue?.net || 0
					},
					monthlyTrend: prevPL?.monthlyTrend || []
				} : null;

				previousTax = prevTax ? {
					...prevTax,
					revenue: {
						gross: prevPL?.metrics?.revenue?.gross || 0,
						taxes: prevPL?.metrics?.revenue?.taxes || 0
					}
				} : null;
			}

			data = {
				pl: { ...plData, previousPeriod: previousPL },
				revenue: { ...revenueData, previousPeriod: previousRevenue },
				cashflow: { ...cashflowData, previousPeriod: previousCashflow },
				tax: { ...taxData, previousPeriod: previousTax },
				view: 'financial'
			};
			break;
		}

		case 'properties': {
			data = await getPropertiesData(
				supabase,
				tenantId,
				from,
				to,
				tags,
				comparisonFrom,
				comparisonTo,
				properties
			);
			break;
		}

		case 'occupancy': {
			const { detectBookingGaps } = await import('./services/occupancy');
			const currentData = await getOccupancyData(supabase, tenantId, from, to, tags, properties);
			// detect booking gaps for the next 60 days
			const bookingGaps = await detectBookingGaps(supabase, tenantId, 60);

			if (comparisonFrom && comparisonTo) {
				const previousData = await getOccupancyData(supabase, tenantId, comparisonFrom, comparisonTo, tags, properties);
				data = {
					current: { ...currentData, gaps: bookingGaps },
					previous: previousData,
					view: 'occupancy'
				};
			} else {
				data = { ...currentData, gaps: bookingGaps };
			}
			break;
		}

		case 'guests': {
			const currentData = await getGuestsData(supabase, tenantId, from, to, tags, properties);

			if (comparisonFrom && comparisonTo) {
				const previousData = await getGuestsData(supabase, tenantId, comparisonFrom, comparisonTo, tags, properties);
				data = {
					current: currentData,
					previous: previousData,
					view: 'guests'
				};
			} else {
				data = currentData;
			}
			break;
		}

		case 'guests-cancelled': {
			data = await getCancelledBookingsData(supabase, tenantId, from, to, properties);
			break;
		}

		case 'guests-inquiries': {
			data = await getInquiriesData(supabase, tenantId, from, to);
			break;
		}

		default:
			data = { error: 'Invalid view' };
	}

	if (c.env.CACHE) {
		const { getDashboardTtl } = await import('./utils/cache');
		await c.env.CACHE.put(cacheKey, JSON.stringify(data), {
			expirationTtl: getDashboardTtl(view)
		});
	}

	return c.json(data);
});

// apply subscription middleware to dashboard routes
const dashboardPaths = [
	'/api/properties',
	'/api/property',
	'/api/bookings',
	'/api/guests',
	'/api/financial',
	'/api/occupancy',
	'/api/period-detail',
	'/api/seasonal-analysis',
	'/api/platform-fees',
	'/api/tax',
	'/api/dashboard-batch',
	'/api/seasons',
	'/api/goals',
	'/api/tags',
	'/api/expense-templates'
];

// apply subscription check to dashboard routes
dashboardPaths.forEach(path => {
	app.use(`${path}/*`, subscriptionMiddleware);
	app.use(path, subscriptionMiddleware);
});

// block write operations for demo users
const demoBlockedPaths = [
	'/api/sync',
	'/api/oauth',
	'/api/account',
	'/api/scheduler',
];
demoBlockedPaths.forEach(path => {
	app.use(path, authMiddleware, demoGuard);
	app.use(`${path}/*`, authMiddleware, demoGuard);
});

// block POST/PUT/DELETE on data routes for demo users (allow GET)
const demoReadOnlyPaths = [
	'/api/tags',
	'/api/seasons',
	'/api/goals',
	'/api/operating-expenses',
	'/api/expense-templates',
	'/api/tax',
];
demoReadOnlyPaths.forEach(path => {
	app.post(path, authMiddleware, demoGuard);
	app.put(path, authMiddleware, demoGuard);
	app.delete(path, authMiddleware, demoGuard);
	app.post(`${path}/*`, authMiddleware, demoGuard);
	app.put(`${path}/*`, authMiddleware, demoGuard);
	app.delete(`${path}/*`, authMiddleware, demoGuard);
});

app.route('/api/properties', properties);
app.route('/api/property', propertyDetail);
app.route('/api/bookings', bookings);
app.route('/api/guests', guests);
app.route('/api/financial', financial);
app.route('/api/occupancy', occupancy);
app.route('/api/period-detail', periodDetail);
app.route('/api/seasonal-analysis', seasonalAnalysis);
app.route('/api/seasons', seasons);
app.route('/api/goals', goals);
app.route('/api/tags', tags);
app.route('/api/tax', tax);
app.route('/api/platform-fees', platformFeesRoute);
app.route('/api/operating-expenses', operatingExpensesRoute);
app.route('/api/expense-templates', expenseTemplatesRoute);

// rate limit billing checkout to prevent abuse
app.use('/api/billing/create-checkout-session', rateLimit({ max: 20, windowMs: 60000 }));

// sync is a multi-step flow (reset + status + properties + bookings + guests + contacts + complete)
// limit must accommodate the full sequence
app.use('/api/sync/*', rateLimit({ max: 50, windowMs: 300000 }));

// rate limit destructive account operations
app.use('/api/account/delete', rateLimit({ max: 3, windowMs: 300000 }));

app.route('/api/billing', billing);
app.route('/api/account', account);
app.route('/api/admin', admin);
app.route('/api/announcements', announcements);
app.route('/api/scheduler', scheduler);
app.route('/api/validation', validation);
app.route('/api/oauth', oauth);
app.route('/api/webhooks', webhooks);
app.route('/api/sync', sync);

app.notFound((c) => {
	return c.json({ error: 'Not Found' }, 404);
});

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		return app.fetch(request, env, ctx);
	},
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		return scheduled(event, env, ctx);
	},
};
