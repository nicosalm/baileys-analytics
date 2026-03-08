import { Hono } from 'hono';
import { z } from 'zod';
import { manualSyncSchema, syncBookingsSchema, syncPropertiesSchema } from '@baileys/schemas';
import { authMiddleware } from '../middleware/auth';
import { strictRateLimit } from '../middleware/rate-limit';
import { createSupabaseClient } from '../services/supabase';
import { OwnerRezService } from '../services/ownerrez';
import { getValidOwnerRezToken } from '../services/ownerrez-token';
import { estimateGuestListingSiteFee } from '../constants';

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

	const tokenResult = await getValidOwnerRezToken(c.env, tenant.id);
	if (tokenResult.error) {
		return c.json({
			error: tokenResult.error.message,
			requiresAuth: true
		}, tokenResult.error.status);
	}

	const ownerRez = new OwnerRezService(tokenResult.accessToken);

	try {
		const properties = await ownerRez.fetchProperties();

		// batch upsert all properties at once for better performance
		const propertyData = properties.map(property => ({
			tenant_id: tenant.id,
			ownerrez_id: property.id,
			name: property.name,
			internal_code: property.internal_code || null,
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
			}, { onConflict: 'tenant_id,sync_type' });

		const { invalidateBookingViews } = await import('../utils/cache');
		await invalidateBookingViews(c.env.CACHE, c.get('user').id);

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
			}, { onConflict: 'tenant_id,sync_type' });

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

	const tokenResult = await getValidOwnerRezToken(c.env, tenant.id);
	if (tokenResult.error) {
		return c.json({
			error: tokenResult.error.message,
			requiresAuth: true
		}, tokenResult.error.status);
	}

	const ownerRez = new OwnerRezService(tokenResult.accessToken);

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
		const bookingChargesMap = new Map<number, any[]>();

		for (const booking of bookings) {
			if (booking.is_block || booking.type === 'block') {
				blocks.push({
					ownerrez_block_id: booking.id,
					tenant_id: tenant.id,
					property_id: parseInt(propertyId),
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

				const platform = booking.source || booking.listing_site || 'Unassigned';
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
					guest_listing_site_fee: estimateGuestListingSiteFee(platform, booking.total_amount || 0, booking.booked_utc || booking.created_utc),
					host_service_fee: booking.total_host_fees || 0,
					status: booking.status,
					platform,
					platform_reservation_number: booking.custom_source_id || booking.external_id,
					adults: booking.adults || 0,
					children: booking.children || 0,
					infants: booking.infants || 0,
					pets: booking.pets || 0,
					booked_utc: booking.booked_utc || booking.created_utc,
					canceled_utc: booking.canceled_utc || null,
					updated_at: new Date().toISOString()
				});

				if (booking.charges && Array.isArray(booking.charges) && booking.charges.length > 0) {
					bookingChargesMap.set(booking.id, booking.charges);
				}
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

		// Re-enrich contact info from the guests table — the upsert above may
		// have overwritten previously-enriched email/phone with null from the API.
		if (bookingData.length > 0) {
			const guestIdsNeedingContact = [...new Set(
				bookingData
					.filter(b => b.ownerrez_guest_id && (!b.guest_email || !b.guest_phone))
					.map(b => b.ownerrez_guest_id)
			)].filter(Boolean);

			if (guestIdsNeedingContact.length > 0) {
				const { data: guestsWithContact } = await supabase
					.from('guests')
					.select('ownerrez_guest_id, email, phone')
					.eq('tenant_id', tenant.id)
					.in('ownerrez_guest_id', guestIdsNeedingContact);

				if (guestsWithContact && guestsWithContact.length > 0) {
					const contactMap = new Map(
						guestsWithContact
							.filter(g => g.email || g.phone)
							.map(g => [String(g.ownerrez_guest_id), g])
					);

					if (contactMap.size > 0) {
						const { data: bookingsToFix } = await supabase
							.from('bookings')
							.select('id, ownerrez_guest_id, guest_email, guest_phone')
							.eq('tenant_id', tenant.id)
							.in('ownerrez_guest_id', [...contactMap.keys()])
							.or('guest_email.is.null,guest_phone.is.null');

						if (bookingsToFix) {
							const fixes: PromiseLike<any>[] = [];
							for (const b of bookingsToFix) {
								const contact = b.ownerrez_guest_id && contactMap.get(String(b.ownerrez_guest_id));
								if (!contact) continue;
								const fields: any = {};
								if (!b.guest_email && contact.email) fields.guest_email = contact.email;
								if (!b.guest_phone && contact.phone) fields.guest_phone = contact.phone;
								if (Object.keys(fields).length > 0) {
									fixes.push(supabase.from('bookings').update(fields).eq('id', b.id));
								}
							}
							for (let i = 0; i < fixes.length; i += 10) {
								await Promise.all(fixes.slice(i, i + 10));
							}
						}
					}
				}
			}
		}

		// Upsert charges — idempotent, safe under concurrent syncs
		if (bookingChargesMap.size > 0) {
			const chargeOwnerrezIds = [...bookingChargesMap.keys()].map(String);
			const { data: dbBookingsForCharges } = await supabase
				.from('bookings')
				.select('id, ownerrez_booking_id')
				.eq('tenant_id', tenant.id)
				.in('ownerrez_booking_id', chargeOwnerrezIds);

			if (dbBookingsForCharges) {
				const allCharges: any[] = [];
				const staleDeletes: any[] = [];

				for (const dbBooking of dbBookingsForCharges) {
					const charges = bookingChargesMap.get(Number(dbBooking.ownerrez_booking_id));
					if (!charges) continue;
					for (let i = 0; i < charges.length; i++) {
						allCharges.push({
							booking_id: dbBooking.id,
							type: charges[i].type,
							amount: charges[i].amount,
							description: charges[i].description,
							position: i
						});
					}
					// remove any charges beyond the current count (e.g. if OR removed one)
					staleDeletes.push(
						supabase.from('booking_charges')
							.delete()
							.eq('booking_id', dbBooking.id)
							.gte('position', charges.length)
					);
				}

				const CHUNK_SIZE = 100;
				for (let i = 0; i < allCharges.length; i += CHUNK_SIZE) {
					const chunk = allCharges.slice(i, i + CHUNK_SIZE);
					await supabase.from('booking_charges').upsert(chunk, {
						onConflict: 'booking_id,position',
						ignoreDuplicates: false
					});
				}
				await Promise.all(staleDeletes);
			}
		}

		await supabase
			.from('sync_status')
			.upsert({
				tenant_id: tenant.id,
				sync_type: 'bookings',
				last_sync: new Date().toISOString(),
				status: 'success',
				records_synced: bookings.length
			}, { onConflict: 'tenant_id,sync_type' });

		const { invalidateBookingViews } = await import('../utils/cache');
		await invalidateBookingViews(c.env.CACHE, c.get('user').id);

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
			}, { onConflict: 'tenant_id,sync_type' });

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

	const tokenResult = await getValidOwnerRezToken(c.env, tenant.id);
	if (tokenResult.error) {
		return c.json({ error: tokenResult.error.message }, tokenResult.error.status);
	}

	const ownerRez = new OwnerRezService(tokenResult.accessToken);

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

			const recoveryChargesMap = new Map<number, any[]>();

			for (const booking of bookings) {
				if (booking.is_block || booking.type === 'block') {
					await supabase
						.from('blocks')
						.upsert({
							ownerrez_block_id: booking.id,
							tenant_id: tenant.id,
							property_id: property.id,
							arrival: booking.arrival,
							departure: booking.departure,
							type: booking.type || 'block',
							reason: booking.reason,
							updated_at: new Date().toISOString()
						}, { onConflict: 'ownerrez_block_id,tenant_id' });
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
							platform: booking.source || booking.listing_site || 'Unassigned',
							platform_reservation_number: booking.custom_source_id || booking.external_id,
							adults: booking.adults || 0,
							children: booking.children || 0,
							infants: booking.infants || 0,
							pets: booking.pets || 0,
							booked_utc: booking.booked_utc || booking.created_utc,
							canceled_utc: booking.canceled_utc || null,
							updated_at: new Date().toISOString()
						}, {
							onConflict: 'tenant_id,ownerrez_booking_id',
							ignoreDuplicates: false
						});

					if (booking.charges && Array.isArray(booking.charges) && booking.charges.length > 0) {
						recoveryChargesMap.set(booking.id, booking.charges);
					}

					bookingCount++;
				}
			}

			// Upsert charges for this property's bookings
			if (recoveryChargesMap.size > 0) {
				const chargeOwnerrezIds = [...recoveryChargesMap.keys()].map(String);
				const { data: dbBookingsForCharges } = await supabase
					.from('bookings')
					.select('id, ownerrez_booking_id')
					.eq('tenant_id', tenant.id)
					.in('ownerrez_booking_id', chargeOwnerrezIds);

				if (dbBookingsForCharges) {
					const allCharges: any[] = [];
					const staleDeletes: any[] = [];

					for (const dbBooking of dbBookingsForCharges) {
						const charges = recoveryChargesMap.get(Number(dbBooking.ownerrez_booking_id));
						if (!charges) continue;
						for (let i = 0; i < charges.length; i++) {
							allCharges.push({
								booking_id: dbBooking.id,
								type: charges[i].type,
								amount: charges[i].amount,
								description: charges[i].description,
								position: i
							});
						}
						staleDeletes.push(
							supabase.from('booking_charges')
								.delete()
								.eq('booking_id', dbBooking.id)
								.gte('position', charges.length)
						);
					}

					const CHUNK_SIZE = 100;
					for (let i = 0; i < allCharges.length; i += CHUNK_SIZE) {
						const chunk = allCharges.slice(i, i + CHUNK_SIZE);
						await supabase.from('booking_charges').upsert(chunk, {
							onConflict: 'booking_id,position',
							ignoreDuplicates: false
						});
					}
					await Promise.all(staleDeletes);
				}
			}

			// Re-enrich contact info from guests table for this property's bookings
			const { data: propertyBookingsToFix } = await supabase
				.from('bookings')
				.select('id, ownerrez_guest_id, guest_email, guest_phone')
				.eq('tenant_id', tenant.id)
				.eq('property_id', upsertedProperty.id)
				.or('guest_email.is.null,guest_phone.is.null')
				.not('ownerrez_guest_id', 'is', null);

			if (propertyBookingsToFix && propertyBookingsToFix.length > 0) {
				const guestIds = [...new Set(propertyBookingsToFix.map(b => String(b.ownerrez_guest_id)))];
				const { data: guestsWithContact } = await supabase
					.from('guests')
					.select('ownerrez_guest_id, email, phone')
					.eq('tenant_id', tenant.id)
					.in('ownerrez_guest_id', guestIds);

				if (guestsWithContact) {
					const contactMap = new Map(
						guestsWithContact
							.filter(g => g.email || g.phone)
							.map(g => [String(g.ownerrez_guest_id), g])
					);

					const fixes: PromiseLike<any>[] = [];
					for (const b of propertyBookingsToFix) {
						const contact = b.ownerrez_guest_id && contactMap.get(String(b.ownerrez_guest_id));
						if (!contact) continue;
						const fields: any = {};
						if (!b.guest_email && contact.email) fields.guest_email = contact.email;
						if (!b.guest_phone && contact.phone) fields.guest_phone = contact.phone;
						if (Object.keys(fields).length > 0) {
							fixes.push(supabase.from('bookings').update(fields).eq('id', b.id));
						}
					}
					for (let i = 0; i < fixes.length; i += 10) {
						await Promise.all(fixes.slice(i, i + 10));
					}
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
				records_synced: bookingCount
			});

		const { invalidateBookingViews } = await import('../utils/cache');
		await invalidateBookingViews(c.env.CACHE, c.get('user').id);

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

	const tokenResult = await getValidOwnerRezToken(c.env, tenant.id);
	if (tokenResult.error) {
		return c.json({
			error: tokenResult.error.message,
			requiresAuth: true
		}, tokenResult.error.status);
	}

	const ownerRez = new OwnerRezService(tokenResult.accessToken);

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

	const { invalidateBookingViews } = await import('../utils/cache');
	await invalidateBookingViews(c.env.CACHE, c.get('user').id);

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
