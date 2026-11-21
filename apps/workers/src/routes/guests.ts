import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { cache } from '../middleware/cache';
import { createSupabaseClient } from '../services/supabase';
import { normalizePlatform } from '../utils/platform';
import type { AppEnv } from '../types';

const guests = new Hono<AppEnv>();

guests.use('/*', authMiddleware);

guests.get('/recurring-search', cache({ ttl: 1800 }), async (c) => {
	const { startMonth, startDay, endMonth, endDay, yearsBack = '4' } = c.req.query();
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');

	if (!startMonth || !startDay || !endMonth || !endDay) {
		return c.json({ error: 'startMonth, startDay, endMonth, endDay are required' }, 400);
	}

	if (!tenantId) {
		return c.json({ error: 'Tenant not found' }, 404);
	}

	const currentYear = new Date().getFullYear();
	const numYears = Math.min(parseInt(yearsBack, 10) || 4, 5);
	const results: any[] = [];

	for (let offset = 0; offset < numYears; offset++) {
		const year = currentYear - offset;
		const rangeFrom = `${year}-${String(startMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
		const rangeTo = `${year}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

		const { data: bookings } = await supabase
			.from('bookings')
			.select(`
				id,
				guest_name,
				ownerrez_guest_id,
				arrival,
				departure,
				total_amount,
				platform,
				property_id,
				properties!inner(name),
				guests(email)
			`)
			.eq('tenant_id', tenantId)
			.neq('status', 'canceled')
			.lte('arrival', rangeTo)
			.gte('departure', rangeFrom)
			.order('arrival', { ascending: true });

		results.push({
			year,
			from: rangeFrom,
			to: rangeTo,
			bookings: (bookings || []).map((b: any) => ({
				id: b.id,
				guestName: b.guest_name,
				guestEmail: b.guests?.email || undefined,
				arrival: b.arrival,
				departure: b.departure,
				amount: b.total_amount,
				platform: normalizePlatform(b.platform),
				propertyName: b.properties?.name || 'Unknown',
			})),
			guestCount: new Set((bookings || []).map((b: any) => b.ownerrez_guest_id || b.guest_name?.toLowerCase())).size,
			totalRevenue: (bookings || []).reduce((sum: number, b: any) => sum + (b.total_amount || 0), 0),
		});
	}

	return c.json({ results });
});

guests.get('/:guestId/detail', cache({ ttl: 1800 }), async (c) => {
	const guestId = decodeURIComponent(c.req.param('guestId'));
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');

	if (!tenantId) {
		return c.json({ error: 'Tenant not found' }, 404);
	}

	// guestId format: "or_<ownerrez_guest_id>" or legacy "name_<name>" or "<name>_<email>"
	let query = supabase
		.from('bookings')
		.select(`
			id,
			arrival,
			departure,
			total_amount,
			guest_listing_site_fee,
			platform,
			status,
			guest_name,
			ownerrez_guest_id,
			property_id,
			ownerrez_booking_id,
			host_service_fee,
			booking_charges(id, type, description, amount, position),
			guests(email, phone)
		`)
		.eq('tenant_id', tenantId);

	if (guestId.startsWith('or_')) {
		query = query.eq('ownerrez_guest_id', guestId.substring(3));
	} else if (guestId.startsWith('name_')) {
		query = query.ilike('guest_name', guestId.substring(5));
	} else {
		// legacy format: "name_email"
		const lastUnderscoreIndex = guestId.lastIndexOf('_');
		const name = guestId.substring(0, lastUnderscoreIndex);
		const email = guestId.substring(lastUnderscoreIndex + 1);
		if (email) {
			query = query.ilike('guest_name', name);
			// fall back to name-only match since guest_email is no longer on bookings
		} else {
			query = query.ilike('guest_name', name);
		}
	}

	const { data: bookings } = await query.order('arrival', { ascending: false });

	if (!bookings || bookings.length === 0) {
		return c.json({ error: 'Guest not found' }, 404);
	}

	const propertyIds = [...new Set(bookings.map((b) => b.property_id))];
	const { data: properties } = await supabase.from('properties').select('id, name').in('id', propertyIds);

	const propertyMap = new Map<string, string>();
	properties?.forEach((p) => propertyMap.set(p.id, p.name));

	let totalNights = 0;
	let totalRevenue = 0;
	let totalListingSiteFees = 0;
	const propertySet = new Set<string>();
	const platformSet = new Set<string>();

	bookings.forEach((booking) => {
		totalRevenue += booking.total_amount || 0;
		totalListingSiteFees += (booking as any).guest_listing_site_fee || 0;
		propertySet.add(booking.property_id);
		platformSet.add(normalizePlatform(booking.platform));

		if (booking.arrival && booking.departure) {
			const nights = Math.ceil((new Date(booking.departure).getTime() - new Date(booking.arrival).getTime()) / (1000 * 60 * 60 * 24));
			totalNights += nights;
		}
	});

	const avgNightlyRate = totalNights > 0 ? totalRevenue / totalNights : 0;
	const avgStayLength = bookings.length > 0 ? totalNights / bookings.length : 0;

	const monthlySpending = new Map<string, number>();
	bookings.forEach((booking) => {
		const month = booking.arrival.substring(0, 7);
		monthlySpending.set(month, (monthlySpending.get(month) || 0) + (booking.total_amount || 0));
	});

	const spendingTrend = Array.from(monthlySpending.entries())
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([month, amount]) => ({
			month,
			amount,
		}));

	const guestContact = (bookings[0] as any).guests;

	let guestTags: { id: string; name: string; color?: string }[] = [];
	const ownerrezGuestId = bookings[0].ownerrez_guest_id;
	if (ownerrezGuestId) {
		const { data: guestWithTags } = await supabase
			.from('guests')
			.select('guest_tags(tag_id, tags!inner(name, color))')
			.eq('tenant_id', tenantId)
			.eq('ownerrez_guest_id', ownerrezGuestId)
			.single();

		guestTags = ((guestWithTags as any)?.guest_tags || []).map((t: any) => ({
			id: t.tag_id,
			name: t.tags?.name,
			color: t.tags?.color,
		}));
	}

	return c.json({
		guest: {
			id: guestId,
			name: bookings[0].guest_name,
			email: guestContact?.email || undefined,
			phone: guestContact?.phone || undefined,
			tags: guestTags,
			totalBookings: bookings.length,
			totalSpent: totalRevenue,
			totalListingSiteFees,
			avgStayLength,
			avgNightlyRate,
			properties: Array.from(propertySet).map((id) => ({
				id,
				name: propertyMap.get(id) || 'Unknown Property',
			})),
			platforms: Array.from(platformSet),
			firstBooking: bookings[bookings.length - 1].arrival,
			lastBooking: bookings[0].arrival,
		},
		bookings: bookings.map((b) => ({
			id: b.id,
			arrival: b.arrival,
			departure: b.departure,
			propertyId: b.property_id,
			propertyName: propertyMap.get(b.property_id) || 'Unknown Property',
			totalAmount: b.total_amount,
			guestListingSiteFee: b.guest_listing_site_fee || 0,
			hostServiceFee: b.host_service_fee || 0,
			platform: normalizePlatform(b.platform),
			status: b.status,
			nights:
				b.arrival && b.departure ? Math.ceil((new Date(b.departure).getTime() - new Date(b.arrival).getTime()) / (1000 * 60 * 60 * 24)) : 0,
			ownerrezBookingId: b.ownerrez_booking_id,
			charges: (b as any).booking_charges || [],
		})),
		spendingTrend,
	});
});

export { guests };
