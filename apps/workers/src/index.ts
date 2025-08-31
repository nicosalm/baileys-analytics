import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { authMiddleware } from './middleware/auth';

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
import { taxConfig } from './routes/tax-config';
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
	origin: (origin) => origin || '*',
	allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
	allowHeaders: ['Content-Type', 'Authorization'],
	credentials: true,
}));

app.route('/health', health);
app.route('/api/waitlist', waitlist);

app.post('/api/auth/login', async (c) => {
	const { email, password } = await c.req.json();

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
	const { email, password } = await c.req.json();

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
			company_name: null,
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
	const { refreshToken } = await c.req.json();

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
		return c.json([]);
	}

	const supabase = createSupabaseClient(c.env);
	const { data: syncStatus, error } = await supabase
		.from('sync_status')
		.select('*')
		.eq('tenant_id', tenantId)
		.order('last_sync', { ascending: false });

	if (error) {
		return c.json([]);
	}

	return c.json(syncStatus || []);
});

app.post('/api/manual-sync', authMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const body = await c.req.json().catch(() => ({}));
	const { type = 'recent', from, to } = body;

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

	const user = c.get('user');
	const { OwnerRezService } = await import('./services/ownerrez');
	const ownerRez = new OwnerRezService(
		c.env.OWNERREZ_CLIENT_ID,
		c.env.OWNERREZ_CLIENT_SECRET,
		tenant.ownerrez_username
	);

	let { data: properties } = await supabase
		.from('properties')
		.select('ownerrez_property_id')
		.eq('tenant_id', tenantId);

	if (!properties || properties.length === 0) {
		const { data: ownerrezToken } = await supabase
			.from('oauth_tokens')
			.select('access_token')
			.eq('tenant_id', tenantId)
			.eq('provider', 'ownerrez')
			.single();

		if (!ownerrezToken) {
			return c.json({
				error: 'No OwnerRez connection found. Please connect to OwnerRez first.',
				requiresAuth: true
			}, 400);
		}

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
				return c.json({ error: 'No properties found in OwnerRez' }, 400);
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

	const startDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
	const endDate = to || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

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

	const user = c.get('user');
	const { OwnerRezService } = await import('./services/ownerrez');
	const ownerRez = new OwnerRezService(
		c.env.OWNERREZ_CLIENT_ID,
		c.env.OWNERREZ_CLIENT_SECRET,
		tenant.ownerrez_username
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

	const cached = await c.env.CACHE.get(cacheKey, 'json');
	if (cached) {
		return c.json({ ...cached, _cached: true });
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

			const currentData = await getOccupancyData(supabase, tenantId, from, to, tags);

			if (comparisonFrom && comparisonTo) {
				const previousData = await getOccupancyData(supabase, tenantId, comparisonFrom, comparisonTo, tags);
				data = {
					current: currentData,
					previous: previousData,
					view: 'occupancy'
				};
			} else {
				data = currentData;
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

	await c.env.CACHE.put(cacheKey, JSON.stringify(data), {
		expirationTtl: 300
	});

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
app.route('/api/tax-config', taxConfig);
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
