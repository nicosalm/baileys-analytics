import { Hono } from 'hono';
import { z } from 'zod';
import { manualSyncSchema, syncBookingsSchema, syncPropertiesSchema } from '@baileys/schemas';
import { authMiddleware } from '../middleware/auth';
import { createSupabaseClient } from '../services/supabase';
import { OwnerRezService } from '../services/ownerrez';

const sync = new Hono<{ Bindings: Env; Variables: { user: any } }>();

sync.use('/*', authMiddleware);

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

	const ownerRez = new OwnerRezService(
		c.env.OWNERREZ_CLIENT_ID,
		c.env.OWNERREZ_CLIENT_SECRET,
		tenant.ownerrez_username
	);

	try {
		const properties = await ownerRez.fetchProperties();

		for (const property of properties) {
			await supabase
				.from('properties')
				.upsert({
					id: property.id,
					tenant_id: tenant.id,
					ownerrez_property_id: property.id,
					name: property.name,
					address: property.address,
					bedrooms: property.bedrooms,
					bathrooms: property.bathrooms,
					max_guests: property.max_guests,
					data: property,
					updated_at: new Date().toISOString()
				})
				.eq('ownerrez_property_id', property.id);
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

	const ownerRez = new OwnerRezService(
		c.env.OWNERREZ_CLIENT_ID,
		c.env.OWNERREZ_CLIENT_SECRET,
		tenant.ownerrez_username
	);

	try {
		const bookings = await ownerRez.fetchBookings(propertyId, startDate, endDate);

		for (const booking of bookings) {
			await supabase
				.from('bookings')
				.upsert({
					id: booking.id,
					tenant_id: tenant.id,
					property_id: booking.property_id,
					ownerrez_booking_id: booking.id,
					guest_name: booking.guest_name,
					guest_email: booking.guest_email,
					arrival: booking.arrival,
					departure: booking.departure,
					total_amount: booking.total_amount,
					booking_status: booking.status,
					booking_source: booking.source,
					data: booking,
					updated_at: new Date().toISOString()
				})
				.eq('ownerrez_booking_id', booking.id);
		}

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

	const ownerRez = new OwnerRezService(
		c.env.OWNERREZ_CLIENT_ID,
		c.env.OWNERREZ_CLIENT_SECRET,
		tenant.ownerrez_username
	);

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

export { sync };
