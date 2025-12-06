import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { loginSchema, signupSchema, refreshTokenSchema } from '@baileys/schemas';

import { authMiddleware } from './middleware/auth';
import { subscriptionMiddleware } from './middleware/subscription';
import { rateLimit, strictRateLimit } from './middleware/rate-limit';
import { timeout } from './middleware/timeout';

import { createSupabaseClient } from './services/supabase';
import { AuthService } from './services/auth';
import { DashboardService } from './services/dashboard';
import { getOverviewData } from './services/overview';
import { getPLData, getRevenueData, getCashflowData, getTaxData } from './services/financial';
import { getPropertiesData } from './services/properties';
import { getOccupancyData } from './services/occupancy';
import { getGuestsData } from './services/guests';
import { properties } from './routes/properties';
import { propertyDetail } from './routes/property-detail';
import { bookings } from './routes/bookings';
import { guests } from './routes/guests';
import { overview } from './routes/overview';
import { financial } from './routes/financial';
import { occupancy } from './routes/occupancy';
import { periodDetail } from './routes/period-detail';
import { seasonalAnalysis } from './routes/seasonal-analysis';
import { seasons } from './routes/seasons';
import { tags } from './routes/tags';
import { tax } from './routes/tax';
import { platformFees as platformFeesRoute } from './routes/platform-fees';
import { reports } from './routes/reports';
import { scheduler } from './routes/scheduler';
import { validation } from './routes/validation';
import { sync } from './routes/sync';
import { oauth } from './routes/oauth';
import { webhooks } from './routes/webhooks';
import { initialSyncChunked } from './routes/initial-sync-chunked';
import { health } from './routes/health';
import { scheduled } from './scheduled';
import { waitlist } from './routes/waitlist';
import { debug } from './routes/debug';
import { billing } from './routes/billing';
import { account } from './routes/account';
import { admin } from './routes/admin';

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

// apply strict rate limiting to public/auth endpoints
app.use('/api/waitlist/*', strictRateLimit());
app.use('/api/auth/login', strictRateLimit());
app.use('/api/auth/signup', strictRateLimit());
app.use('/api/auth/refresh', rateLimit({ max: 100, windowMs: 60000 }));

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
	const ownerRez = new OwnerRezService(ownerrezToken.access_token);

	let { data: properties } = await supabase
		.from('properties')
		.select('id, ownerrez_id')
		.eq('tenant_id', tenantId);

	if (!properties || properties.length === 0) {
		try {
			const ownerRezProperties = await ownerRez.fetchProperties();

			for (const property of ownerRezProperties) {
				await supabase
					.from('properties')
					.upsert({
						tenant_id: tenantId,
						ownerrez_id: property.id,
						name: property.name,
						address: property.address?.street1 || property.address,
						city: property.address?.city,
						state: property.address?.state,
						postal_code: property.address?.postal_code,
						bedrooms: property.bedrooms || 0,
						bathrooms: property.bathrooms || 0,
						max_guests: property.max_guests || 0,
						active: property.active !== false,
						latitude: property.latitude,
						longitude: property.longitude,
						updated_at: new Date().toISOString()
					}, {
						onConflict: 'tenant_id,ownerrez_id',
						ignoreDuplicates: false
					});
			}

			const { data: updatedProperties } = await supabase
				.from('properties')
				.select('id, ownerrez_id')
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

	// process properties in parallel batches for better performance
	const BATCH_SIZE = 3; // process 3 properties at a time
	const allBlocks = [];
	const allBookings = [];

	for (let i = 0; i < properties.length; i += BATCH_SIZE) {
		const batch = properties.slice(i, i + BATCH_SIZE);
		
		const batchResults = await Promise.allSettled(
			batch.map(async (property) => {
				const bookings = await ownerRez.fetchBookings(property.ownerrez_id, startDate, endDate);
				return { property, bookings };
			})
		);

		for (const result of batchResults) {
			if (result.status === 'rejected') {
				errorCount++;
				continue;
			}

			const { property, bookings } = result.value;

			for (const booking of bookings) {
				if (booking.is_block || booking.type === 'block') {
					allBlocks.push({
						ownerrez_block_id: booking.id,
						tenant_id: tenantId,
						property_id: property.id,
						arrival: booking.arrival,
						departure: booking.departure,
						type: booking.type || 'block',
						reason: booking.reason,
						updated_at: new Date().toISOString()
					});
				} else {
					const guestName = booking.guest
						? `${booking.guest.first_name || ''} ${booking.guest.last_name || ''}`.trim()
						: booking.guest_name || 'Unknown';

					allBookings.push({
						tenant_id: tenantId,
						property_id: property.id,
						ownerrez_booking_id: booking.id,
						guest_name: guestName,
						guest_email: booking.guest?.email || booking.guest_email,
						guest_phone: booking.guest?.phone || booking.guest_phone,
						arrival: booking.arrival,
						departure: booking.departure,
						total_amount: booking.total_amount || 0,
						status: booking.status,
						platform: booking.source || booking.listing_site || 'Direct',
						platform_reservation_number: booking.custom_source_id || booking.external_id,
						adults: booking.adults || 0,
						children: booking.children || 0,
						infants: booking.infants || 0,
						pets: booking.pets || 0,
						booked_utc: booking.booked_date || booking.created_date,
						canceled_utc: booking.status === 'canceled' ? booking.modified_date : null,
						updated_at: new Date().toISOString()
					});
				}
			}

			totalBookings += bookings.length;
		}
	}

	// batch insert all blocks and bookings
	const dbOperations = [];

	if (allBlocks.length > 0) {
		// insert blocks in chunks of 100
		for (let i = 0; i < allBlocks.length; i += 100) {
			const chunk = allBlocks.slice(i, i + 100);
			dbOperations.push(
				supabase
					.from('blocks')
					.upsert(chunk, {
						onConflict: 'ownerrez_block_id,tenant_id',
						ignoreDuplicates: false
					})
			);
		}
	}

	if (allBookings.length > 0) {
		// insert bookings in chunks of 100
		for (let i = 0; i < allBookings.length; i += 100) {
			const chunk = allBookings.slice(i, i + 100);
			dbOperations.push(
				supabase
					.from('bookings')
					.upsert(chunk, {
						onConflict: 'tenant_id,ownerrez_booking_id',
						ignoreDuplicates: false
					})
			);
		}
	}

	await Promise.all(dbOperations);

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

	// invalidate cache after successful sync
	if (c.env.CACHE) {
		const { invalidateDashboardCache } = await import('./utils/cache');
		await invalidateDashboardCache(c.env.CACHE, user.id);
	}

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
	const ownerRez = new OwnerRezService(ownerrezToken.access_token);

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
	const tenantId = c.get('tenantId');
	const view = c.req.query('view') || 'overview';
	const from = c.req.query('from') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
	const to = c.req.query('to') || new Date().toISOString().split('T')[0];
	const tags = c.req.query('tags')?.split(',').filter(Boolean);

	if (!tenantId) {
		return c.json({ error: 'Tenant not found' }, 404);
	}

	const cacheKey = `dashboard:${user.id}:${view}:${from}:${to}:${tags?.join(',')}`;

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

// apply subscription middleware to dashboard routes
const dashboardPaths = [
	'/api/properties',
	'/api/property',
	'/api/bookings',
	'/api/guests',
	'/api/overview',
	'/api/financial',
	'/api/occupancy',
	'/api/period-detail',
	'/api/seasonal-analysis',
	'/api/reports',
	'/api/platform-fees',
	'/api/tax',
	'/api/dashboard-batch',
	'/api/manual-sync',
	'/api/sync-guest-details',
	'/api/seasons',
	'/api/tags'
];

// apply subscription check to dashboard routes
dashboardPaths.forEach(path => {
	app.use(`${path}/*`, subscriptionMiddleware);
	app.use(path, subscriptionMiddleware);
});

app.route('/api/properties', properties);
app.route('/api/property', propertyDetail);
app.route('/api/bookings', bookings);
app.route('/api/guests', guests);
app.route('/api/overview', overview);
app.route('/api/financial', financial);
app.route('/api/occupancy', occupancy);
app.route('/api/period-detail', periodDetail);
app.route('/api/seasonal-analysis', seasonalAnalysis);
app.route('/api/seasons', seasons);
app.route('/api/tags', tags);
app.route('/api/tax', tax);
app.route('/api/platform-fees', platformFeesRoute);

// rate limit billing checkout to prevent abuse
app.use('/api/billing/create-checkout-session', rateLimit({ max: 20, windowMs: 60000 }));

app.route('/api/billing', billing);
app.route('/api/account', account);
app.route('/api/admin', admin);
app.route('/api/reports', reports);
app.route('/api/scheduler', scheduler);
app.route('/api/validation', validation);
app.route('/api/sync', sync);
app.route('/api/oauth', oauth);
app.route('/api/webhooks', webhooks);
app.route('/api/initial-sync-chunked', initialSyncChunked);
// debug routes (dev only)
app.route('/api/debug', debug);

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
