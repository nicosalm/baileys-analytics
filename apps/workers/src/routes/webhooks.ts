import { Hono } from 'hono';
import { z } from 'zod';
import { createSupabaseClient } from '../services/supabase';

const webhookPayloadSchema = z.object({
	id: z.union([z.string(), z.number()]),
	user_id: z.number(),
	action: z.enum([
		'entity_create',
		'entity_update',
		'entity_delete',
		'application_authorization_revoked',
		'webhook_test'
	]),
	entity_type: z.enum([
		'api_application',
		'booking',
		'guest',
		'inquiry',
		'property',
		'quote',
		'thread_message'
	]).optional(),
	entity_id: z.number().optional(),
	categories: z.array(z.string()).optional(),
	entity: z.record(z.string(), z.any()).optional()
});

type WebhookPayload = z.infer<typeof webhookPayloadSchema>;

const webhooks = new Hono<{ Bindings: Env; Variables: { user: any } }>();

webhooks.get('/status', async (c) => {
	const supabase = createSupabaseClient(c.env);
	
	const { data: recentEvents, error } = await supabase
		.from('webhook_events')
		.select('*')
		.order('created_at', { ascending: false })
		.limit(10);
	
	return c.json({
		status: 'active',
		endpoint: '/api/webhooks/ownerrez',
		recentEvents: recentEvents || [],
		error: error?.message
	});
});

webhooks.post('/ownerrez', async (c) => {
	const authHeader = c.req.header('Authorization');
	
	if (!authHeader || !authHeader.startsWith('Basic ')) {
		return c.json({ error: 'Unauthorized' }, 401);
	}

	const base64Credentials = authHeader.substring(6);
	const credentials = atob(base64Credentials);
	const [username, password] = credentials.split(':');

	const expectedUser = c.env.OWNERREZ_WEBHOOK_USER;
	const expectedPassword = c.env.OWNERREZ_WEBHOOK_PASSWORD;
	
	if (!expectedUser || !expectedPassword) {
		return c.json({ error: 'Webhook not configured' }, 500);
	}

	if (username !== expectedUser || password !== expectedPassword) {
		return c.json({ error: 'Invalid credentials' }, 401);
	}

	let payload: WebhookPayload;
	try {
		const body = await c.req.json();
		payload = webhookPayloadSchema.parse(body);
	} catch (error) {
		return c.json({ error: 'Invalid payload' }, 400);
	}

	const supabase = createSupabaseClient(c.env);

	const { data: tenant } = await supabase
		.from('tenants')
		.select('id')
		.eq('ownerrez_user_id', payload.user_id)
		.single();

	if (!tenant) {
		console.error(`[Webhook] No tenant found for OwnerRez user ID: ${payload.user_id}`);
		return c.json({ error: 'Tenant not found' }, 404);
	}

	await supabase
		.from('webhook_events')
		.insert({
			tenant_id: tenant.id,
			event_id: String(payload.id),
			action: payload.action,
			entity_type: payload.entity_type,
			entity_id: payload.entity_id ? String(payload.entity_id) : null,
			categories: payload.categories,
			payload: payload.entity,
			processed: false,
			created_at: new Date().toISOString()
		});

	switch (payload.action) {
		case 'webhook_test':
			return c.json({ status: 'success', message: 'Webhook test received' });

		case 'entity_create':
		case 'entity_update':
			await handleEntityChange(supabase, tenant.id, payload);
			// invalidate cache for dashboard updates
			if (c.env.CACHE && (payload.entity_type === 'booking' || payload.entity_type === 'property')) {
				const { invalidateTenantCache } = await import('../utils/cache');
				await invalidateTenantCache(c.env.CACHE, supabase, tenant.id);
			}
			break;

		case 'entity_delete':
			await handleEntityDelete(supabase, tenant.id, payload);
			// invalidate cache for dashboard updates
			if (c.env.CACHE && (payload.entity_type === 'booking' || payload.entity_type === 'property')) {
				const { invalidateTenantCache } = await import('../utils/cache');
				await invalidateTenantCache(c.env.CACHE, supabase, tenant.id);
			}
			break;

		case 'application_authorization_revoked':
			await handleAuthRevoked(supabase, tenant.id);
			break;
	}

	return c.json({ status: 'success' });
});

async function handleEntityChange(
	supabase: any,
	tenantId: string,
	payload: WebhookPayload
) {
	if (!payload.entity_type || !payload.entity_id || !payload.entity) {
		return;
	}

	switch (payload.entity_type) {
		case 'property':
			await handlePropertyUpdate(supabase, tenantId, payload.entity);
			break;

		case 'booking':
			await handleBookingUpdate(supabase, tenantId, payload.entity, payload.categories);
			break;

		case 'guest':
			await handleGuestUpdate(supabase, tenantId, payload.entity);
			break;

		case 'inquiry':
			await handleInquiryUpdate(supabase, tenantId, payload.entity);
			break;

		case 'quote':
			await handleQuoteUpdate(supabase, tenantId, payload.entity);
			break;
	}

	await supabase
		.from('webhook_events')
		.update({ processed: true, processed_at: new Date().toISOString() })
		.eq('tenant_id', tenantId)
		.eq('event_id', String(payload.id));
}

async function handlePropertyUpdate(supabase: any, tenantId: string, property: any) {
	const { data: upsertedProperty, error } = await supabase
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
		})
		.select()
		.single();
	
	if (error) {
		console.error('Failed to update property via webhook:', error);
		return;
	}

	if (property.tags && Array.isArray(property.tags) && upsertedProperty) {
		await supabase
			.from('property_tags')
			.delete()
			.eq('property_id', upsertedProperty.id);

		for (const tag of property.tags) {
			const tagName = typeof tag === 'string' ? tag : (tag.name || tag);
			
			const { data: existingTags } = await supabase
				.from('tags')
				.select('id')
				.eq('tenant_id', tenantId)
				.eq('name', tagName);

			let tagId = existingTags && existingTags.length > 0 ? existingTags[0].id : null;
			
			if (!tagId) {
				const { data: newTag } = await supabase
					.from('tags')
					.insert({
						tenant_id: tenantId,
						name: tagName,
						color: typeof tag === 'object' ? (tag.color || null) : null
					})
					.select()
					.single();
				tagId = newTag?.id;
			}

			if (tagId) {
				await supabase
					.from('property_tags')
					.insert({
						property_id: upsertedProperty.id,
						tag_id: tagId
					});
			}
		}
	}

	await supabase
		.from('sync_status')
		.upsert({
			tenant_id: tenantId,
			sync_type: 'properties_webhook',
			last_sync: new Date().toISOString(),
			status: 'success',
			records_synced: 1
		})
		.eq('tenant_id', tenantId)
		.eq('sync_type', 'properties_webhook');
}

async function handleBookingUpdate(
	supabase: any,
	tenantId: string,
	booking: any,
	categories?: string[]
) {
	if (booking.is_block || booking.type === 'block') {
		const { data: existingBlock } = await supabase
			.from('blocks')
			.select('id')
			.eq('ownerrez_block_id', booking.id)
			.eq('tenant_id', tenantId)
			.single();

		if (booking.status === 'canceled' || booking.canceled_utc) {
			if (existingBlock) {
				await supabase
					.from('blocks')
					.delete()
					.eq('id', existingBlock.id);
			}
			return;
		}

		const { data: blockProperty } = await supabase
			.from('properties')
			.select('id')
			.eq('tenant_id', tenantId)
			.eq('ownerrez_id', booking.property_id)
			.single();

		if (!blockProperty) {
			console.error(`Property not found for OwnerRez ID ${booking.property_id} (block)`);
			return;
		}

		await supabase
			.from('blocks')
			.upsert({
				ownerrez_block_id: booking.id,
				tenant_id: tenantId,
				property_id: blockProperty.id,
				arrival: booking.arrival,
				departure: booking.departure,
				type: booking.type || 'block',
				reason: booking.reason,
				updated_at: new Date().toISOString()
			})
			.eq('ownerrez_block_id', booking.id)
			.eq('tenant_id', tenantId);
	} else {
		const { data: property } = await supabase
			.from('properties')
			.select('id')
			.eq('tenant_id', tenantId)
			.eq('ownerrez_id', booking.property_id)
			.single();

		if (!property) {
			console.error(`Property not found for OwnerRez ID ${booking.property_id}`);
			return;
		}

		const guestName = booking.guest 
			? `${booking.guest.first_name || ''} ${booking.guest.last_name || ''}`.trim()
			: booking.guest_name || 'Unknown';

		const bookingData = {
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
		};

		if (booking.status === 'canceled' || booking.canceled_utc) {
			bookingData.status = 'canceled';
		}

		const { data: upsertedBooking, error } = await supabase
			.from('bookings')
			.upsert(bookingData, {
				onConflict: 'tenant_id,ownerrez_booking_id',
				ignoreDuplicates: false
			})
			.select()
			.single();
		
		if (error) {
			console.error('Failed to update booking via webhook:', error);
			return;
		}

		if (booking.tags && Array.isArray(booking.tags) && upsertedBooking) {
			await supabase
				.from('booking_tags')
				.delete()
				.eq('booking_id', upsertedBooking.id);

			for (const tag of booking.tags) {
				const tagName = typeof tag === 'string' ? tag : (tag.name || tag);
				
				// ensure tag exists
				const { data: existingTag } = await supabase
					.from('tags')
					.select('id')
					.eq('tenant_id', tenantId)
					.eq('name', tagName)
					.single();

				let tagId = existingTag?.id;
				
				if (!tagId) {
					// create tag if it doesn't exist
					const { data: newTag } = await supabase
						.from('tags')
						.insert({
							tenant_id: tenantId,
							name: tagName,
							color: typeof tag === 'object' ? (tag.color || null) : null
						})
						.select()
						.single();
					tagId = newTag?.id;
				}

				if (tagId) {
					await supabase
						.from('booking_tags')
						.insert({
							booking_id: upsertedBooking.id,
							tag_id: tagId
						});
				}
			}
		}

		if (categories?.includes('charge') && booking.charges) {
			const { data: existingBooking } = await supabase
				.from('bookings')
				.select('id')
				.eq('ownerrez_booking_id', booking.id)
				.eq('tenant_id', tenantId)
				.single();

			if (existingBooking) {
				await supabase
					.from('booking_charges')
					.delete()
					.eq('booking_id', existingBooking.id);

				const charges = booking.charges.map((charge: any, index: number) => ({
					booking_id: existingBooking.id,
					type: charge.type,
					amount: charge.amount,
					description: charge.description,
					position: index
				}));

				if (charges.length > 0) {
					await supabase.from('booking_charges').insert(charges);
				}
			}
		}
	}

	await supabase
		.from('sync_status')
		.upsert({
			tenant_id: tenantId,
			sync_type: 'bookings_webhook',
			last_sync: new Date().toISOString(),
			status: 'success',
			records_synced: 1
		})
		.eq('tenant_id', tenantId)
		.eq('sync_type', 'bookings_webhook');
}

async function handleGuestUpdate(supabase: any, tenantId: string, guest: any) {
	const fullName = `${guest.first_name || ''} ${guest.last_name || ''}`.trim();
	
	const email = guest.email_addresses?.find((e: any) => e.is_default)?.address ||
				 guest.email_addresses?.[0]?.address;
	
	const phone = guest.phones?.find((p: any) => p.is_default)?.number ||
				 guest.phones?.[0]?.number;

	if (fullName) {
		await supabase
			.from('bookings')
			.update({
				guest_email: email,
				guest_phone: phone,
				updated_at: new Date().toISOString()
			})
			.eq('tenant_id', tenantId)
			.eq('guest_name', fullName);
	}

	const { data: upsertedGuest } = await supabase
		.from('guests')
		.upsert({
			ownerrez_guest_id: guest.id,
			tenant_id: tenantId,
			first_name: guest.first_name,
			last_name: guest.last_name,
			full_name: fullName,
			email: email,
			phone: phone,
			data: guest,
			updated_at: new Date().toISOString()
		})
		.eq('ownerrez_guest_id', guest.id)
		.eq('tenant_id', tenantId)
		.select()
		.single();

	if (guest.tags && Array.isArray(guest.tags) && upsertedGuest) {
		await supabase
			.from('guest_tags')
			.delete()
			.eq('guest_id', upsertedGuest.id);

		for (const tag of guest.tags) {
			const tagName = typeof tag === 'string' ? tag : (tag.name || tag);
			
			const { data: existingTags } = await supabase
				.from('tags')
				.select('id')
				.eq('tenant_id', tenantId)
				.eq('name', tagName);

			let tagId = existingTags && existingTags.length > 0 ? existingTags[0].id : null;
			
			if (!tagId) {
				const { data: newTag } = await supabase
					.from('tags')
					.insert({
						tenant_id: tenantId,
						name: tagName,
						color: typeof tag === 'object' ? (tag.color || null) : null
					})
					.select()
					.single();
				tagId = newTag?.id;
			}

			if (tagId) {
				await supabase
					.from('guest_tags')
					.insert({
						guest_id: upsertedGuest.id,
						tag_id: tagId
					});
			}
		}
	}
}

async function handleInquiryUpdate(supabase: any, tenantId: string, inquiry: any) {
	await supabase
		.from('inquiries')
		.upsert({
			ownerrez_inquiry_id: inquiry.id,
			tenant_id: tenantId,
			property_id: inquiry.property_id,
			guest_name: inquiry.guest_name,
			guest_email: inquiry.guest_email,
			arrival: inquiry.arrival,
			departure: inquiry.departure,
			status: inquiry.status,
			data: inquiry,
			updated_at: new Date().toISOString()
		})
		.eq('ownerrez_inquiry_id', inquiry.id)
		.eq('tenant_id', tenantId);
}

async function handleQuoteUpdate(supabase: any, tenantId: string, quote: any) {
	await supabase
		.from('quotes')
		.upsert({
			ownerrez_quote_id: quote.id,
			tenant_id: tenantId,
			property_id: quote.property_id,
			guest_name: quote.guest_name,
			guest_email: quote.guest_email,
			arrival: quote.arrival,
			departure: quote.departure,
			total_amount: quote.total_amount,
			status: quote.status,
			data: quote,
			updated_at: new Date().toISOString()
		})
		.eq('ownerrez_quote_id', quote.id)
		.eq('tenant_id', tenantId);
}

async function handleEntityDelete(
	supabase: any,
	tenantId: string,
	payload: WebhookPayload
) {
	if (!payload.entity_type || !payload.entity_id) {
		return;
	}

	switch (payload.entity_type) {
		case 'booking':
			await supabase
				.from('bookings')
				.delete()
				.eq('ownerrez_booking_id', payload.entity_id)
				.eq('tenant_id', tenantId);
			
			await supabase
				.from('blocks')
				.delete()
				.eq('ownerrez_block_id', payload.entity_id)
				.eq('tenant_id', tenantId);
			break;

		case 'property':
			await supabase
				.from('properties')
				.update({ active: false, deleted_at: new Date().toISOString() })
				.eq('ownerrez_property_id', payload.entity_id)
				.eq('tenant_id', tenantId);
			break;

		case 'guest':
			await supabase
				.from('guests')
				.delete()
				.eq('ownerrez_guest_id', payload.entity_id)
				.eq('tenant_id', tenantId);
			break;

		case 'inquiry':
			await supabase
				.from('inquiries')
				.delete()
				.eq('ownerrez_inquiry_id', payload.entity_id)
				.eq('tenant_id', tenantId);
			break;

		case 'quote':
			await supabase
				.from('quotes')
				.delete()
				.eq('ownerrez_quote_id', payload.entity_id)
				.eq('tenant_id', tenantId);
			break;
	}

	await supabase
		.from('webhook_events')
		.update({ processed: true, processed_at: new Date().toISOString() })
		.eq('tenant_id', tenantId)
		.eq('event_id', String(payload.id));
}

async function handleAuthRevoked(supabase: any, tenantId: string) {
	await supabase
		.from('oauth_tokens')
		.delete()
		.eq('tenant_id', tenantId)
		.eq('provider', 'ownerrez');

	await supabase
		.from('tenants')
		.update({
			ownerrez_connected: false,
			ownerrez_disconnected_at: new Date().toISOString()
		})
		.eq('id', tenantId);
}

export { webhooks };