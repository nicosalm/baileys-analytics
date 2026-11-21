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
import { getOccupancyData, detectBookingGaps } from './services/occupancy';
import { getGuestsData, getCancelledBookingsData } from './services/guests';
import { getInquiriesData } from './services/inquiries';
import { getPacingData } from './services/pacing';
import { buildDashboardCacheKey, DASHBOARD_TTL_SECONDS, PACING_TTL_SECONDS } from './utils/cache';
import { properties } from './routes/properties';
import { propertyDetail } from './routes/property-detail';
import { bookings } from './routes/bookings';
import { guests } from './routes/guests';
import { financial } from './routes/financial';
import { occupancy } from './routes/occupancy';
import { periodDetail } from './routes/period-detail';
import { seasons } from './routes/seasons';
import { goals } from './routes/goals';
import { tags } from './routes/tags';
import { propertyGroups } from './routes/property-groups';
import { tax } from './routes/tax';
import { platformFees as platformFeesRoute } from './routes/platform-fees';
import { operatingExpenses as operatingExpensesRoute } from './routes/operating-expenses';
import { expenseTemplates as expenseTemplatesRoute } from './routes/expense-templates';
import { validation } from './routes/validation';
import { oauth } from './routes/oauth';
import { webhooks } from './routes/webhooks';
import { sync } from './routes/sync';
import { health, ping } from './routes/health';
import { search } from './routes/search';
import { scheduled } from './scheduled';
import { billing } from './routes/billing';
import { account } from './routes/account';
import { admin } from './routes/admin';
import type { AppEnv } from './types';

// strict: false lets /api/health/ and /api/health resolve to the same route
const app = new Hono<AppEnv>({ strict: false });

app.use(
	'/*',
	cors({
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
	}),
);

// timeout: 30s
app.use('/api/*', timeout({ ms: 30000 }));

// max request size: 10mb
app.use('/api/*', async (c, next) => {
	const contentLength = c.req.header('content-length');
	if (contentLength && parseInt(contentLength, 10) > 10 * 1024 * 1024) {
		return c.json({ error: 'Request body too large (max 10MB)' }, 413);
	}
	await next();
});

// public probes, reachable on the worker and through the site's /api proxy
app.get('/api', ping);
app.route('/api/health', health);
// kept for the uptime monitor and deploy smoke test that already call it
app.route('/health', health);

app.get('/api/auth/me', authMiddleware, async (c) => {
	const user = c.get('user');
	const tenantId = c.get('tenantId') || null;
	const supabase = createSupabaseClient(c.env);

	const [tenant, ownerrezToken] = tenantId
		? await Promise.all([
				supabase.from('tenants').select('company_name').eq('id', tenantId).maybeSingle(),
				supabase.from('oauth_tokens').select('id').eq('tenant_id', tenantId).eq('provider', 'ownerrez').maybeSingle(),
			])
		: [null, null];

	return c.json({
		id: user.id,
		email: user.email,
		tenantId,
		companyName: tenant?.data?.company_name ?? null,
		hasOwnerRezConnection: !!ownerrezToken?.data,
		createdAt: user.created_at || new Date().toISOString(),
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
			lastBookingSync: null,
		});
	}

	const supabase = createSupabaseClient(c.env);
	const count = (table: string) => supabase.from(table).select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId);

	const [properties, bookings, guests, syncStatuses] = await Promise.all([
		count('properties'),
		count('bookings'),
		count('guests'),
		supabase.from('sync_status').select('*').eq('tenant_id', tenantId).order('last_sync', { ascending: false }).limit(10),
	]);

	const lastPropertySync = syncStatuses.data?.find((s) => s.sync_type === 'properties')?.last_sync || null;
	const lastBookingSync = syncStatuses.data?.find((s) => ['recent', 'historical', 'bookings'].includes(s.sync_type))?.last_sync || null;

	return c.json({
		propertyCount: properties.count || 0,
		bookingCount: bookings.count || 0,
		guestCount: guests.count || 0,
		lastPropertySync,
		lastBookingSync,
		syncHistory: syncStatuses.data || [],
	});
});

type FinancialBatch = Awaited<ReturnType<typeof getFinancialBatchData>>;

function previousFinancialPeriod(prev: FinancialBatch) {
	const { pl, revenue, cashflow, tax } = prev;
	return {
		pl: pl
			? {
					revenue: pl.metrics.revenue,
					performance: pl.metrics.performance,
					operatingExpenses: pl.metrics.operatingExpenses,
					operatingProfit: pl.metrics.operatingProfit,
					monthlyTrend: pl.monthlyTrend,
					weeklyRevenue: pl.weeklyRevenue,
				}
			: null,
		revenue: revenue
			? {
					...revenue,
					revenue: { gross: revenue.gross, net: revenue.net },
					monthlyTrend: revenue.byMonth,
				}
			: null,
		cashflow: cashflow
			? {
					...cashflow,
					revenue: {
						gross: pl?.metrics?.revenue?.gross || 0,
						net: pl?.metrics?.revenue?.net || 0,
					},
					monthlyTrend: pl?.monthlyTrend || [],
				}
			: null,
		tax: tax
			? {
					...tax,
					revenue: {
						gross: pl?.metrics?.revenue?.gross || 0,
						taxes: pl?.metrics?.revenue?.taxes || 0,
					},
				}
			: null,
	};
}

// subscriptionMiddleware is attached inline: hono runs handlers in registration order,
// and the dashboardPaths loop below registers after this route
app.get('/api/dashboard-batch', authMiddleware, subscriptionMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const view = c.req.query('view') || 'overview';
	const from = c.req.query('from') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
	const to = c.req.query('to') || new Date().toISOString().split('T')[0];
	const tags = c.req.query('tags')?.split(',').filter(Boolean);
	const properties = c.req.query('properties')?.split(',').filter(Boolean);
	const comparisonFrom = c.req.query('comparisonFrom');
	const comparisonTo = c.req.query('comparisonTo');
	const hasComparison = !!(comparisonFrom && comparisonTo);

	if (!tenantId) {
		return c.json({ error: 'Tenant not found' }, 404);
	}

	const cacheKey = await buildDashboardCacheKey(tenantId, view, from, to, {
		tags,
		properties,
		comparisonFrom,
		comparisonTo,
	});

	if (c.env.CACHE) {
		const cached = await c.env.CACHE.get(cacheKey, 'json');
		if (cached) {
			return c.json({ ...cached, _cached: true });
		}
	}

	const supabase = createSupabaseClient(c.env);
	let data: unknown;

	switch (view) {
		case 'overview':
			data = await getOverviewData(supabase, tenantId, from, to, tags, comparisonFrom, comparisonTo, properties);
			break;

		case 'financial': {
			const [current, previous] = await Promise.all([
				getFinancialBatchData(supabase, tenantId, from, to, tags, properties),
				hasComparison ? getFinancialBatchData(supabase, tenantId, comparisonFrom, comparisonTo, tags, properties) : null,
			]);
			const prev = previous ? previousFinancialPeriod(previous) : null;
			data = {
				pl: { ...current.pl, previousPeriod: prev?.pl ?? null },
				revenue: { ...current.revenue, previousPeriod: prev?.revenue ?? null },
				cashflow: { ...current.cashflow, previousPeriod: prev?.cashflow ?? null },
				tax: { ...current.tax, previousPeriod: prev?.tax ?? null },
				view: 'financial',
			};
			break;
		}

		case 'properties':
			data = await getPropertiesData(supabase, tenantId, from, to, tags, comparisonFrom, comparisonTo, properties);
			break;

		case 'occupancy': {
			const [current, gaps, previous] = await Promise.all([
				getOccupancyData(supabase, tenantId, from, to, tags, properties),
				detectBookingGaps(supabase, tenantId, 60),
				hasComparison ? getOccupancyData(supabase, tenantId, comparisonFrom, comparisonTo, tags, properties) : null,
			]);
			data = previous ? { current: { ...current, gaps }, previous, view: 'occupancy' } : { ...current, gaps };
			break;
		}

		case 'guests': {
			const [current, previous] = await Promise.all([
				getGuestsData(supabase, tenantId, from, to, tags, properties),
				hasComparison ? getGuestsData(supabase, tenantId, comparisonFrom, comparisonTo, tags, properties) : null,
			]);
			data = previous ? { current, previous, view: 'guests' } : current;
			break;
		}

		// not date-filtered: a future booking cancelled this week must still be discoverable
		case 'guests-cancelled':
			data = await getCancelledBookingsData(supabase, tenantId, undefined, undefined, properties);
			break;

		case 'guests-inquiries':
			data = await getInquiriesData(supabase, tenantId, from, to);
			break;

		default:
			return c.json({ error: 'Invalid view', view }, 400);
	}

	if (c.env.CACHE) {
		c.executionCtx.waitUntil(c.env.CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: DASHBOARD_TTL_SECONDS }));
	}

	return c.json(data as Record<string, unknown>);
});

app.get('/api/pacing', authMiddleware, subscriptionMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const tags = c.req.query('tags')?.split(',').filter(Boolean) || [];
	const filterPropertyIds = c.req.query('properties')?.split(',').filter(Boolean) || [];

	if (!tenantId) {
		return c.json({ error: 'Tenant not found' }, 404);
	}

	try {
		const cacheKey = await buildDashboardCacheKey(tenantId, 'pacing', '', '', {
			tags,
			properties: filterPropertyIds,
		});

		if (c.env.CACHE) {
			const cached = await c.env.CACHE.get<Record<string, unknown>>(cacheKey, 'json');
			if (cached) {
				return c.json({ ...cached, _cached: true });
			}
		}

		const data = await getPacingData(createSupabaseClient(c.env), tenantId, tags, filterPropertyIds);

		if (c.env.CACHE) {
			c.executionCtx.waitUntil(c.env.CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: PACING_TTL_SECONDS }));
		}

		return c.json(data);
	} catch (error) {
		console.error('pacing route error:', error);
		return c.json(
			{
				error: error instanceof Error ? error.message : 'Failed to load pacing data',
			},
			500,
		);
	}
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
	'/api/platform-fees',
	'/api/tax',
	'/api/dashboard-batch',
	'/api/seasons',
	'/api/goals',
	'/api/tags',
	'/api/expense-templates',
	'/api/operating-expenses',
	'/api/property-groups',
];

// apply subscription check to dashboard routes. authMiddleware must run first so
// tenantId is set; the sub-apps' own authMiddleware runs too late for this check.
dashboardPaths.forEach((path) => {
	app.use(`${path}/*`, authMiddleware, subscriptionMiddleware);
	app.use(path, authMiddleware, subscriptionMiddleware);
});

// block write operations for demo users
const demoBlockedPaths = ['/api/sync', '/api/oauth', '/api/account'];
demoBlockedPaths.forEach((path) => {
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
	'/api/property-groups',
];
demoReadOnlyPaths.forEach((path) => {
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
app.route('/api/seasons', seasons);
app.route('/api/goals', goals);
app.route('/api/tags', tags);
app.route('/api/property-groups', propertyGroups);
app.route('/api/tax', tax);
app.route('/api/platform-fees', platformFeesRoute);
app.route('/api/operating-expenses', operatingExpensesRoute);
app.route('/api/expense-templates', expenseTemplatesRoute);

// rate limit billing checkout to prevent abuse
app.use('/api/billing/create-checkout-session', rateLimit({ max: 20, windowMs: 60000 }));

// sync is a multi-step flow (reset + status + properties + bookings + guests + inquiries + complete)
// limit must accommodate the full sequence
app.use('/api/sync/*', rateLimit({ max: 50, windowMs: 300000 }));

// rate limit destructive account operations
app.use('/api/account/delete', rateLimit({ max: 3, windowMs: 300000 }));

app.route('/api/billing', billing);
app.route('/api/account', account);
app.route('/api/admin', admin);
app.route('/api/validation', validation);
app.route('/api/oauth', oauth);
app.route('/api/webhooks', webhooks);
app.route('/api/sync', sync);
app.route('/api/search', search);

app.notFound((c) => {
	return c.json({ error: 'Not Found' }, 404);
});

// unhandled errors return JSON like every other response; details stay in the logs
app.onError((err, c) => {
	console.error(`${c.req.method} ${c.req.path} failed:`, err);
	return c.json({ error: 'Internal Server Error' }, 500);
});

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		return app.fetch(request, env, ctx);
	},
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		return scheduled(event, env, ctx);
	},
};
