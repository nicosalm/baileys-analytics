import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { loginSchema, signupSchema, refreshTokenSchema } from '@baileys/schemas';

import { authMiddleware } from './middleware/auth';
import { rateLimit, strictRateLimit } from './middleware/rate-limit';
import { timeout } from './middleware/timeout';

// services
import { createSupabaseClient } from './services/supabase';
import { AuthService } from './services/auth';
import { DashboardService } from './services/dashboard';
import { getOverviewData } from './services/overview';
import { getPLData, getRevenueData, getCashflowData, getTaxData } from './services/financial';
import { getPropertiesData } from './services/properties';
import { getOccupancyData } from './services/occupancy';
import { getGuestsData } from './services/guests';
// core data routes
import { properties } from './routes/properties';
import { propertyDetail } from './routes/property-detail';
import { bookings } from './routes/bookings';
import { guests } from './routes/guests';
// dashboard routes
import { overview } from './routes/overview';
import { financial } from './routes/financial';
import { occupancy } from './routes/occupancy';
import { periodDetail } from './routes/period-detail';
import { seasonalAnalysis } from './routes/seasonal-analysis';
// configuration routes
import { seasons } from './routes/seasons';
import { tags } from './routes/tags';
import { tax } from './routes/tax';
import { platformFees } from './routes/platform-fees';
// reports and tools
import { reports } from './routes/reports';
import { scheduler } from './routes/scheduler';
import { validation } from './routes/validation';
// integration routes
import { sync } from './routes/sync';
import { oauth } from './routes/oauth';
// system routes
import { health } from './routes/health';
import { scheduled } from './scheduled';
// public routes
import { waitlist } from './routes/waitlist';

const app = new Hono<{ Bindings: Env; Variables: { user: any; tenantId: string } }>();

app.use('/*', cors({
	origin: (origin, c) => {
		const allowedOrigins = [c.env.FRONTEND_URL];
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

// global rate limiting - 1000 requests per minute per ip
app.use('/api/*', rateLimit({ max: 1000, windowMs: 60000 }));

// global timeout - 30 seconds for all requests
app.use('/api/*', timeout({ ms: 30000 }));

// request size limit - 10mb
app.use('/api/*', async (c, next) => {
	const contentLength = c.req.header('content-length');
	if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
		return c.json({ error: 'Request body too large (max 10MB)' }, 413);
	}
	await next();
});

app.route('/health', health);
app.route('/api/waitlist', waitlist);

app.post('/api/auth/login', async (c) => {
	const body = await c.req.json();
	
	// validate input
	const validation = loginSchema.safeParse(body);
	if (!validation.success) {
		return c.json({ 
			error: validation.error.errors.map(e => e.message).join(', ') 
		}, 400);
	}
	
	const { email, password } = validation.data;

	const supabase = createSupabaseClient(c.env);
	const authService = new AuthService(supabase);

	const result = await authService.login(email, password);

	if ('error' in result) {
		return c.json({ error: result.error }, 401);
	}

	const { data: tenant } = await supabase
		.from('tenants')
		.select('id')
		.eq('user_id', result.user.id)
		.single();

	return c.json({
		accessToken: result.accessToken,
		refreshToken: result.refreshToken,
		userId: result.user.id,
		email: result.user.email,
		tenantId: tenant?.id || null
	});
});

app.post('/api/auth/signup', async (c) => {
	const body = await c.req.json();
	
	// validate input
	const validation = signupSchema.safeParse(body);
	if (!validation.success) {
		return c.json({ 
			error: validation.error.errors.map(e => e.message).join(', ') 
		}, 400);
	}
	
	const { email, password, companyName } = validation.data;

	const supabase = createSupabaseClient(c.env);

	const { data: authData, error: signUpError } = await supabase.auth.signUp({
		email,
		password,
	});

	if (signUpError || !authData.user) {
		return c.json({ error: signUpError?.message || 'Signup failed' }, 400);
	}

	const { data: tenant, error: tenantError } = await supabase
		.from('tenants')
		.insert({
			user_id: authData.user.id,
			company_name: companyName || null,
			created_at: new Date().toISOString()
		})
		.select()
		.single();

	if (tenantError) {
		return c.json({ error: 'Failed to create tenant' }, 500);
	}

	return c.json({
		userId: authData.user.id,
		email: authData.user.email,
		tenantId: tenant.id,
		accessToken: authData.session?.access_token,
		refreshToken: authData.session?.refresh_token
	});
});

app.post('/api/auth/refresh', async (c) => {
	const body = await c.req.json();
	
	// validate input
	const validation = refreshTokenSchema.safeParse(body);
	if (!validation.success) {
		return c.json({ 
			error: validation.error.errors.map(e => e.message).join(', ') 
		}, 400);
	}
	
	const { refreshToken } = validation.data;

	const supabase = createSupabaseClient(c.env);
	const authService = new AuthService(supabase);

	const accessToken = await authService.refreshAccessToken(refreshToken);

	if (!accessToken) {
		return c.json({ error: 'Invalid refresh token' }, 401);
	}

	return c.json({ accessToken });
});

app.get('/api/auth/me', authMiddleware, async (c) => {
	const user = c.get('user');
	const supabase = createSupabaseClient(c.env);

	const { data: tenantData } = await supabase
		.from('tenants')
		.select(`
			id,
			company_name,
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
		companyName: tenantData?.company_name || null,
		hasOwnerRezConnection: !!ownerrezToken,
		createdAt: user.created_at || new Date().toISOString()
	});
});

app.post('/api/auth/logout', authMiddleware, async (c) => {
	return c.json({ success: true });
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

	// count guests with contact info
	const { count: guestCount } = await supabase
		.from('bookings')
		.select('guest_name', { count: 'exact', head: true })
		.eq('tenant_id', tenantId)
		.not('guest_email', 'is', null);

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

app.post('/api/manual-sync', authMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const url = new URL(c.req.url);
	const type = url.searchParams.get('type') || 'recent';
	const from = url.searchParams.get('from') || undefined;
	const to = url.searchParams.get('to') || undefined;

	if (!tenantId) {
		return c.json({ error: 'Tenant not found' }, 404);
	}

	const supabase = createSupabaseClient(c.env);

	const { data: tenant } = await supabase
		.from('tenants')
		.select('*')
		.eq('id', tenantId)
		.single();

	if (!tenant) {
		return c.json({ error: 'Tenant not found' }, 404);
	}

	const { data: ownerrezToken } = await supabase
		.from('oauth_tokens')
		.select('access_token')
		.eq('tenant_id', tenantId)
		.eq('provider', 'ownerrez')
		.single();

	if (!ownerrezToken?.access_token) {
		return c.json({
			error: 'No OwnerRez connection found. Please connect to OwnerRez first.',
			requiresAuth: true
		}, 400);
	}

	const user = c.get('user');
	const { OwnerRezService } = await import('./services/ownerrez');
	const ownerRez = new OwnerRezService(
		ownerrezToken.access_token,
		'',
		''
	);

	let { data: properties } = await supabase
		.from('properties')
		.select('ownerrez_property_id')
		.eq('tenant_id', tenantId);

	if (!properties || properties.length === 0) {
		try {
			const ownerRezProperties = await ownerRez.fetchProperties();

			for (const property of ownerRezProperties) {
				await supabase
					.from('properties')
					.upsert({
						id: property.id,
						tenant_id: tenantId,
						ownerrez_property_id: property.id,
						name: property.name,
						address: property.address,
						bedrooms: property.bedrooms,
						bathrooms: property.bathrooms,
						max_guests: property.max_guests,
						active: true,
						data: property,
						updated_at: new Date().toISOString()
					})
					.eq('ownerrez_property_id', property.id);
			}

			const { data: updatedProperties } = await supabase
				.from('properties')
				.select('ownerrez_property_id')
				.eq('tenant_id', tenantId);

			properties = updatedProperties;

			if (!properties || properties.length === 0) {
				return c.json({ 
					success: true,
					message: 'No properties found in your OwnerRez account. Please add properties in OwnerRez first.',
					propertiesSynced: 0,
					bookingsSynced: 0
				}, 200);
			}
		} catch (error: any) {
			if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) {
				return c.json({
					error: 'OwnerRez authentication failed. Please reconnect to OwnerRez.',
					requiresAuth: true
				}, 401);
			}
			return c.json({ error: 'Failed to sync properties from OwnerRez' }, 500);
		}
	}

	let startDate: string;
	let endDate: string;
	
	if (type === 'historical') {
		startDate = from || new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
		endDate = to || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
	} else {
		startDate = from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
		endDate = to || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
	}

	let totalBookings = 0;
	let errorCount = 0;

	for (const property of properties) {
		try {
			const bookings = await ownerRez.fetchBookings(property.ownerrez_property_id, startDate, endDate);

			for (const booking of bookings) {
				await supabase
					.from('bookings')
					.upsert({
						id: booking.id,
						tenant_id: tenantId,
						property_id: property.ownerrez_property_id,
						ownerrez_booking_id: booking.id,
						guest_name: booking.guest_name,
						guest_email: booking.guest_email,
						arrival: booking.arrival,
						departure: booking.departure,
						total_amount: booking.total_amount,
						status: booking.status,
						platform: booking.source,
						data: booking,
						updated_at: new Date().toISOString()
					})
					.eq('ownerrez_booking_id', booking.id);
			}

			totalBookings += bookings.length;
		} catch (error) {
			errorCount++;
		}
	}

	await supabase
		.from('sync_status')
		.upsert({
			tenant_id: tenantId,
			sync_type: type === 'historical' ? 'historical' : 'recent',
			last_sync: new Date().toISOString(),
			status: errorCount > 0 ? 'partial' : 'success',
			records_synced: totalBookings,
			error_message: errorCount > 0 ? `Failed to sync ${errorCount} properties` : null
		})
		.eq('tenant_id', tenantId)
		.eq('sync_type', type === 'historical' ? 'historical' : 'recent');

	return c.json({
		success: true,
		bookingsSynced: totalBookings,
		propertiesProcessed: properties.length - errorCount,
		errors: errorCount
	});
});

app.post('/api/sync-guest-details', authMiddleware, async (c) => {
	const tenantId = c.get('tenantId');

	if (!tenantId) {
		return c.json({ error: 'Tenant not found' }, 404);
	}

	const supabase = createSupabaseClient(c.env);

	const { data: tenant } = await supabase
		.from('tenants')
		.select('*')
		.eq('id', tenantId)
		.single();

	if (!tenant) {
		return c.json({ error: 'Tenant not found' }, 404);
	}

	const { data: ownerrezToken } = await supabase
		.from('oauth_tokens')
		.select('access_token')
		.eq('tenant_id', tenantId)
		.eq('provider', 'ownerrez')
		.single();

	if (!ownerrezToken?.access_token) {
		return c.json({
			error: 'No OwnerRez connection found. Please connect to OwnerRez first.',
			requiresAuth: true
		}, 400);
	}

	const user = c.get('user');
	const { OwnerRezService } = await import('./services/ownerrez');
	const ownerRez = new OwnerRezService(
		ownerrezToken.access_token,
		'',
		''
	);

	const { data: guestsNeedingInfo } = await supabase
		.from('bookings')
		.select('guest_name')
		.eq('tenant_id', tenantId)
		.not('guest_name', 'is', null)
		.or('guest_phone.is.null,guest_email.is.null')
		.limit(100);

	if (!guestsNeedingInfo?.length) {
		return c.json({
			status: 'success',
			message: 'No guests need updating',
			guestsUpdated: 0
		});
	}

	const uniqueGuests = Array.from(new Set(guestsNeedingInfo.map(g => g.guest_name)));
	let totalUpdated = 0;

	const batchSize = 10;
	for (let i = 0; i < uniqueGuests.length; i += batchSize) {
		const batch = uniqueGuests.slice(i, i + batchSize);

		const results = await Promise.all(
			batch.map(async (guestName) => {
				try {
					const guests = await ownerRez.searchGuests(guestName);

					if (guests.length > 0) {
						const exactMatch = guests.find(g =>
							`${g.first_name} ${g.last_name}`.toLowerCase() === guestName.toLowerCase()
						);

						const guest = exactMatch || guests[0];

						const email = guest.email_addresses?.find((e: any) => e.is_default)?.address ||
									 guest.email_addresses?.[0]?.address;

						const phone = guest.phones?.find((p: any) => p.is_default)?.number ||
									 guest.phones?.[0]?.number;

						if (email || phone) {
							const { error } = await supabase
								.from('bookings')
								.update({
									guest_email: email || undefined,
									guest_phone: phone || undefined,
									updated_at: new Date().toISOString()
								})
								.eq('tenant_id', tenantId)
								.eq('guest_name', guestName)
								.or('guest_phone.is.null,guest_email.is.null');

							if (!error) {
								return { updated: true, name: guestName };
							}
						}
					}
					return { updated: false, name: guestName };
				} catch (error) {
					return { updated: false, name: guestName };
				}
			})
		);

		totalUpdated += results.filter(r => r.updated).length;

		if (i + batchSize < uniqueGuests.length) {
			await new Promise(resolve => setTimeout(resolve, 1000));
		}
	}

	return c.json({
		status: 'success',
		guestsUpdated: totalUpdated,
		guestsProcessed: uniqueGuests.length,
		message: `Updated contact info for ${totalUpdated} out of ${uniqueGuests.length} guests`
	});
});

app.get('/api/dashboard-batch', authMiddleware, async (c) => {
	const user = c.get('user');
	const view = c.req.query('view') || 'overview';
	const from = c.req.query('from') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
	const to = c.req.query('to') || new Date().toISOString().split('T')[0];
	const tags = c.req.query('tags')?.split(',').filter(Boolean);

	const cacheKey = `dashboard:${user.id}:${view}:${from}:${to}:${tags?.join(',')}`;

	// try to get from cache if available
	if (c.env.CACHE) {
		const cached = await c.env.CACHE.get(cacheKey, 'json');
		if (cached) {
			return c.json({ ...cached, _cached: true });
		}
	}

	const supabase = createSupabaseClient(c.env);

	const { data: tenantData } = await supabase
		.from('tenants')
		.select('id')
		.eq('user_id', user.id)
		.single();

	if (!tenantData) {
		return c.json({ error: 'Tenant not found' }, 404);
	}

	const tenantId = tenantData.id;
	let data: any = {};

	switch(view) {
		case 'overview': {
			const comparisonFrom = c.req.query('comparisonFrom');
			const comparisonTo = c.req.query('comparisonTo');

			data = await getOverviewData(
				supabase,
				tenantId,
				from,
				to,
				tags,
				comparisonFrom,
				comparisonTo
			);
			break;
		}

		case 'financial': {
			const comparisonFrom = c.req.query('comparisonFrom');
			const comparisonTo = c.req.query('comparisonTo');

			const [plData, revenueData, cashflowData, taxData] = await Promise.all([
				getPLData(supabase, tenantId, from, to, tags),
				getRevenueData(supabase, tenantId, from, to, tags),
				getCashflowData(supabase, tenantId, from, to, tags),
				getTaxData(supabase, tenantId, from, to, tags)
			]);

			let previousPL = null;
			let previousRevenue = null;
			let previousCashflow = null;
			let previousTax = null;

			if (comparisonFrom && comparisonTo) {
				const [prevPL, prevRevenue, prevCashflow, prevTax] = await Promise.all([
					getPLData(supabase, tenantId, comparisonFrom, comparisonTo, tags),
					getRevenueData(supabase, tenantId, comparisonFrom, comparisonTo, tags),
					getCashflowData(supabase, tenantId, comparisonFrom, comparisonTo, tags),
					getTaxData(supabase, tenantId, comparisonFrom, comparisonTo, tags)
				]);

				previousPL = prevPL ? {
					revenue: prevPL.metrics.revenue,
					performance: prevPL.metrics.performance,
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
			const comparisonFrom = c.req.query('comparisonFrom');
			const comparisonTo = c.req.query('comparisonTo');

			data = await getPropertiesData(
				supabase,
				tenantId,
				from,
				to,
				tags,
				comparisonFrom,
				comparisonTo
			);
			break;
		}

		case 'occupancy': {
			const comparisonFrom = c.req.query('comparisonFrom');
			const comparisonTo = c.req.query('comparisonTo');

			const { detectBookingGaps } = await import('./services/occupancy');
			const currentData = await getOccupancyData(supabase, tenantId, from, to, tags);
			// detect booking gaps for the next 60 days
			const bookingGaps = await detectBookingGaps(supabase, tenantId, 60);

			if (comparisonFrom && comparisonTo) {
				const previousData = await getOccupancyData(supabase, tenantId, comparisonFrom, comparisonTo, tags);
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
			const comparisonFrom = c.req.query('comparisonFrom');
			const comparisonTo = c.req.query('comparisonTo');

			const currentData = await getGuestsData(supabase, tenantId, from, to, tags);

			if (comparisonFrom && comparisonTo) {
				const previousData = await getGuestsData(supabase, tenantId, comparisonFrom, comparisonTo, tags);
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

		default:
			data = { error: 'Invalid view' };
	}

	// cache the result if kv is available
	if (c.env.CACHE) {
		await c.env.CACHE.put(cacheKey, JSON.stringify(data), {
			expirationTtl: 300
		});
	}

	return c.json(data);
});

// core data routes
app.route('/api/properties', properties);
app.route('/api/property', propertyDetail);
app.route('/api/bookings', bookings);
app.route('/api/guests', guests);
// dashboard routes
app.route('/api/overview', overview);
app.route('/api/financial', financial);
app.route('/api/occupancy', occupancy);
app.route('/api/period-detail', periodDetail);
app.route('/api/seasonal-analysis', seasonalAnalysis);
// configuration routes
app.route('/api/seasons', seasons);
app.route('/api/tags', tags);
app.route('/api/tax', tax);


app.route('/api/platform-fees', platformFees);
// reports and tools
app.route('/api/reports', reports);
app.route('/api/scheduler', scheduler);
app.route('/api/validation', validation);
// integration routes
app.route('/api/sync', sync);
app.route('/api/oauth', oauth);

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
