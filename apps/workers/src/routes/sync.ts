import { Hono } from 'hono';
import { z } from 'zod';
import { manualSyncSchema, syncBookingsSchema, syncPropertiesSchema } from '@baileys/schemas';
import { authMiddleware } from '../middleware/auth';
import { strictRateLimit } from '../middleware/rate-limit';
import { createSupabaseClient } from '../services/supabase';
import { OwnerRezService } from '../services/ownerrez';

const sync = new Hono<{ Bindings: Env; Variables: { user: any } }>();

sync.use('/*', authMiddleware);
sync.use('/*', strictRateLimit()); // only 10 sync operations per 5 minutes

sync.post('/properties', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const user = c.get('user');

	const { data: tenant } = await supabase
		.from('tenants')
		.select('*')
		.eq('user_id', user.id)
		.single();

	if (!tenant) {
		return c.json({ error: 'Tenant not found' }, 404);
	}

	// get oauth token for this tenant
	const { data: ownerrezToken } = await supabase
		.from('oauth_tokens')
		.select('access_token')
		.eq('tenant_id', tenant.id)
		.eq('provider', 'ownerrez')
		.single();

	if (!ownerrezToken?.access_token) {
		return c.json({
			error: 'No OwnerRez connection found. Please connect to OwnerRez first.',
			requiresAuth: true
		}, 400);
	}

	const ownerRez = new OwnerRezService(ownerrezToken.access_token);

	try {
		const properties = await ownerRez.fetchProperties();

		// batch upsert all properties at once for better performance
		const propertyData = properties.map(property => ({
			tenant_id: tenant.id,
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
		}));

		if (propertyData.length > 0) {
			const { error } = await supabase
				.from('properties')
				.upsert(propertyData, {
					onConflict: 'tenant_id,ownerrez_id',
					ignoreDuplicates: false
				});
			
			if (error) {
				console.error('Failed to upsert properties:', error);
			}
		}

		await supabase
			.from('sync_status')
			.upsert({
				tenant_id: tenant.id,
				sync_type: 'properties',
				last_sync: new Date().toISOString(),
				status: 'success',
				records_synced: properties.length
			})
			.eq('tenant_id', tenant.id)
			.eq('sync_type', 'properties');

		return c.json({
			success: true,
			propertiesSynced: properties.length
		});
	} catch (error: any) {
		await supabase
			.from('sync_status')
			.upsert({
				tenant_id: tenant.id,
				sync_type: 'properties',
				last_sync: new Date().toISOString(),
				status: 'error',
				error_message: error.message
			})
			.eq('tenant_id', tenant.id)
			.eq('sync_type', 'properties');

		return c.json({ error: error.message }, 500);
	}
});

sync.post('/bookings', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const user = c.get('user');
	const body = await c.req.json();
	
	// validate input
	const validation = manualSyncSchema.safeParse(body);
	if (!validation.success) {
		return c.json({ 
			error: validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') 
		}, 400);
	}
	
	const { propertyId, startDate, endDate } = validation.data;

	const { data: tenant } = await supabase
		.from('tenants')
		.select('*')
		.eq('user_id', user.id)
		.single();

	if (!tenant) {
		return c.json({ error: 'Tenant not found' }, 404);
	}

	// get oauth token for this tenant
	const { data: ownerrezToken } = await supabase
		.from('oauth_tokens')
		.select('access_token')
		.eq('tenant_id', tenant.id)
		.eq('provider', 'ownerrez')
		.single();

	if (!ownerrezToken?.access_token) {
		return c.json({
			error: 'No OwnerRez connection found. Please connect to OwnerRez first.',
			requiresAuth: true
		}, 400);
	}

	const ownerRez = new OwnerRezService(ownerrezToken.access_token);

	try {
		// first, look up the actual property UUID
		const { data: property } = await supabase
			.from('properties')
			.select('id')
			.eq('tenant_id', tenant.id)
			.eq('ownerrez_id', propertyId)
			.single();

		if (!property) {
			return c.json({ error: `Property not found for OwnerRez ID ${propertyId}` }, 404);
		}

		const bookings = await ownerRez.fetchBookings(propertyId, startDate, endDate);

		// separate blocks and bookings for batch processing
		const blocks = [];
		const bookingData = [];

		for (const booking of bookings) {
			if (booking.is_block || booking.type === 'block') {
				blocks.push({
					ownerrez_block_id: booking.id,
					tenant_id: tenant.id,
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

				// extract email/phone from nested arrays (if available) or flat properties
				const guestEmail = booking.guest?.email_addresses?.find((e: any) => e.is_default)?.address ||
					booking.guest?.email_addresses?.[0]?.address ||
					booking.guest?.email ||
					booking.guest_email;

				const guestPhone = booking.guest?.phones?.find((p: any) => p.is_default)?.number ||
					booking.guest?.phones?.[0]?.number ||
					booking.guest?.phone ||
					booking.guest_phone;

				bookingData.push({
					tenant_id: tenant.id,
					property_id: property.id,
					ownerrez_booking_id: booking.id,
					ownerrez_guest_id: booking.guest?.id?.toString(),
					guest_name: guestName,
					guest_email: guestEmail,
					guest_phone: guestPhone,
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

		// batch upsert blocks and bookings
		const operations = [];
		
		if (blocks.length > 0) {
			operations.push(
				supabase
					.from('blocks')
					.upsert(blocks, {
						onConflict: 'ownerrez_block_id,tenant_id',
						ignoreDuplicates: false
					})
			);
		}

		if (bookingData.length > 0) {
			operations.push(
				supabase
					.from('bookings')
					.upsert(bookingData, {
						onConflict: 'tenant_id,ownerrez_booking_id',
						ignoreDuplicates: false
					})
			);
		}

		await Promise.all(operations);

		await supabase
			.from('sync_status')
			.upsert({
				tenant_id: tenant.id,
				sync_type: 'bookings',
				last_sync: new Date().toISOString(),
				status: 'success',
				records_synced: bookings.length
			})
			.eq('tenant_id', tenant.id)
			.eq('sync_type', 'bookings');

		return c.json({
			success: true,
			bookingsSynced: bookings.length
		});
	} catch (error: any) {
		await supabase
			.from('sync_status')
			.upsert({
				tenant_id: tenant.id,
				sync_type: 'bookings',
				last_sync: new Date().toISOString(),
				status: 'error',
				error_message: error.message
			})
			.eq('tenant_id', tenant.id)
			.eq('sync_type', 'bookings');

		return c.json({ error: error.message }, 500);
	}
});

// recovery sync for emergencies or webhook failures
sync.post('/recovery', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const user = c.get('user');
	
	const { data: tenant } = await supabase
		.from('tenants')
		.select('*')
		.eq('user_id', user.id)
		.single();

	if (!tenant) {
		return c.json({ error: 'Tenant not found' }, 404);
	}

	const { data: lastWebhook } = await supabase
		.from('webhook_events')
		.select('created_at')
		.eq('tenant_id', tenant.id)
		.order('created_at', { ascending: false })
		.limit(1)
		.single();

	const hoursSinceLastWebhook = lastWebhook 
		? (Date.now() - new Date(lastWebhook.created_at).getTime()) / (1000 * 60 * 60)
		: 999;

	// only allow recovery sync if webhooks seem broken or explicitly forced
	const isForced = c.req.header('X-Force-Sync') === 'true';
	
	if (hoursSinceLastWebhook < 24 && !isForced) {
		return c.json({ 
			error: 'Webhooks are working normally. Recovery sync not needed.',
			lastWebhookHoursAgo: hoursSinceLastWebhook
		}, 400);
	}

	const { data: ownerrezToken } = await supabase
		.from('oauth_tokens')
		.select('access_token')
		.eq('tenant_id', tenant.id)
		.eq('provider', 'ownerrez')
		.single();

	if (!ownerrezToken?.access_token) {
		return c.json({ error: 'No OwnerRez connection found' }, 400);
	}

	const ownerRez = new OwnerRezService(ownerrezToken.access_token);

	try {
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - 7);
		const endDate = new Date();
		endDate.setDate(endDate.getDate() + 90);

		const properties = await ownerRez.fetchProperties();
		let bookingCount = 0;

		for (const property of properties) {
			const { data: upsertedProperty } = await supabase
				.from('properties')
				.upsert({
					tenant_id: tenant.id,
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
				})
				.select('id')
				.single();

			if (!upsertedProperty) {
				console.error(`Failed to upsert property ${property.id}`);
				continue;
			}

			const bookings = await ownerRez.fetchBookings(
				property.id,
				startDate.toISOString().split('T')[0],
				endDate.toISOString().split('T')[0]
			);

			for (const booking of bookings) {
				if (booking.is_block || booking.type === 'block') {
					await supabase
						.from('blocks')
						.upsert({
							ownerrez_block_id: booking.id,
							tenant_id: tenant.id,
							property_id: upsertedProperty.id,
							arrival: booking.arrival,
							departure: booking.departure,
							type: booking.type || 'block',
							reason: booking.reason,
							updated_at: new Date().toISOString()
						})
						.eq('ownerrez_block_id', booking.id)
						.eq('tenant_id', tenant.id);
				} else {
					const guestName = booking.guest
						? `${booking.guest.first_name || ''} ${booking.guest.last_name || ''}`.trim()
						: booking.guest_name || 'Unknown';

					await supabase
						.from('bookings')
						.upsert({
							tenant_id: tenant.id,
							property_id: upsertedProperty.id,
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
						}, {
							onConflict: 'tenant_id,ownerrez_booking_id',
							ignoreDuplicates: false
						});
					
					bookingCount++;
				}
			}
		}

		await supabase
			.from('sync_status')
			.insert({
				tenant_id: tenant.id,
				sync_type: 'recovery',
				last_sync: new Date().toISOString(),
				status: 'success',
				records_synced: bookingCount,
				metadata: {
					reason: isForced ? 'forced' : 'webhook_failure',
					hours_since_last_webhook: hoursSinceLastWebhook
				}
			});

		return c.json({
			success: true,
			type: 'recovery',
			propertiesSynced: properties.length,
			bookingsSynced: bookingCount,
			reason: hoursSinceLastWebhook > 24 ? 'webhook_failure_detected' : 'forced_sync'
		});

	} catch (error: any) {
		await supabase
			.from('sync_status')
			.insert({
				tenant_id: tenant.id,
				sync_type: 'recovery',
				last_sync: new Date().toISOString(),
				status: 'error',
				error_message: error.message
			});

		return c.json({ error: error.message }, 500);
	}
});

sync.post('/guest-details', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const user = c.get('user');

	const { data: tenant } = await supabase
		.from('tenants')
		.select('*')
		.eq('user_id', user.id)
		.single();

	if (!tenant) {
		return c.json({ error: 'Tenant not found' }, 404);
	}

	// get oauth token for this tenant
	const { data: ownerrezToken } = await supabase
		.from('oauth_tokens')
		.select('access_token')
		.eq('tenant_id', tenant.id)
		.eq('provider', 'ownerrez')
		.single();

	if (!ownerrezToken?.access_token) {
		return c.json({
			error: 'No OwnerRez connection found. Please connect to OwnerRez first.',
			requiresAuth: true
		}, 400);
	}

	const ownerRez = new OwnerRezService(ownerrezToken.access_token);

	const { data: guestsNeedingInfo } = await supabase
		.from('bookings')
		.select('guest_name')
		.eq('tenant_id', tenant.id)
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
								.eq('tenant_id', tenant.id)
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

sync.get('/status', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const user = c.get('user');

	const { data: tenant } = await supabase
		.from('tenants')
		.select('id')
		.eq('user_id', user.id)
		.single();

	if (!tenant) {
		return c.json({ error: 'Tenant not found' }, 404);
	}

	const { data: syncStatus, error } = await supabase
		.from('sync_status')
		.select('*')
		.eq('tenant_id', tenant.id)
		.order('last_sync', { ascending: false });

	if (error) {
		return c.json({ error: error.message }, 500);
	}

	return c.json(syncStatus);
});

// webhook health check endpoint
sync.get('/health', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const user = c.get('user');
	
	const { data: tenant } = await supabase
		.from('tenants')
		.select('id')
		.eq('user_id', user.id)
		.single();

	if (!tenant) {
		return c.json({ error: 'Tenant not found' }, 404);
	}

	// get webhook statistics
	const oneDayAgo = new Date();
	oneDayAgo.setDate(oneDayAgo.getDate() - 1);

	const { data: recentWebhooks, count } = await supabase
		.from('webhook_events')
		.select('*', { count: 'exact' })
		.eq('tenant_id', tenant.id)
		.gte('created_at', oneDayAgo.toISOString())
		.order('created_at', { ascending: false })
		.limit(10);

	const { data: lastWebhook } = await supabase
		.from('webhook_events')
		.select('*')
		.eq('tenant_id', tenant.id)
		.order('created_at', { ascending: false })
		.limit(1)
		.single();

	const hoursSinceLastWebhook = lastWebhook
		? (Date.now() - new Date(lastWebhook.created_at).getTime()) / (1000 * 60 * 60)
		: 999;

	return c.json({
		healthy: hoursSinceLastWebhook < 24,
		lastWebhookHoursAgo: hoursSinceLastWebhook,
		webhooksLast24Hours: count || 0,
		lastWebhookEvent: lastWebhook,
		recentEvents: recentWebhooks || []
	});
});

export { sync };
