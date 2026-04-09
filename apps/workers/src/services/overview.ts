import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_MAX_ROWS } from '../constants';
import { getExpensesWithTemplateFallback } from './expense-utils';
import { normalizePlatform } from '../utils/platform';
import { getBookingIdsForTags } from '../utils/tag-filter';

async function fetchBookings(
	supabase: SupabaseClient,
	tenantId: string,
	from: string,
	to: string,
	tagIds: string[] = [],
	filterPropertyIds: string[] = []
) {
	let query = supabase
		.from('bookings')
		.select('id, total_amount, arrival, departure, ownerrez_guest_id, guest_name, platform, property_id, host_service_fee, guest_listing_site_fee')
		.eq('tenant_id', tenantId)
		.lte('arrival', to)
		.gte('departure', from)
		.neq('status', 'canceled')
		.limit(SUPABASE_MAX_ROWS);

	if (filterPropertyIds.length > 0) {
		query = query.in('property_id', filterPropertyIds);
	}

	if (tagIds.length > 0) {
		const matchedIds = await getBookingIdsForTags(supabase, tenantId, tagIds);
		if (matchedIds) {
			query = query.in('id', matchedIds);
		} else {
			return [];
		}
	}

	const { data } = await query;
	return data || [];
}

export async function getOverviewData(
	supabase: SupabaseClient,
	tenantId: string,
	from: string,
	to: string,
	tagIds: string[] = [],
	comparisonFrom?: string,
	comparisonTo?: string,
	filterPropertyIds: string[] = []
) {
	let propertiesQuery = supabase
		.from('properties')
		.select('id, name, internal_code')
		.eq('tenant_id', tenantId)
		.eq('active', true);

	if (filterPropertyIds.length > 0) {
		propertiesQuery = propertiesQuery.in('id', filterPropertyIds);
	}

	const { data: properties } = await propertiesQuery;

	const sharedProperties = properties || [];

	const currentBookings = await fetchBookings(supabase, tenantId, from, to, tagIds, filterPropertyIds);
	const comparisonBookings = comparisonFrom && comparisonTo
		? await fetchBookings(supabase, tenantId, comparisonFrom, comparisonTo, tagIds, filterPropertyIds)
		: null;

	const [currentMetrics, charts, alerts, recentActivity, upcoming] = await Promise.all([
		getCurrentPeriodMetrics(supabase, tenantId, from, to, currentBookings, sharedProperties, tagIds),
		getChartsData(currentBookings, sharedProperties, from, to),
		getAlerts(supabase, tenantId, from, to),
		getRecentActivity(supabase, tenantId, from, to),
		getUpcomingBookings(supabase, tenantId)
	]);

	let previousMetrics = null;
	if (comparisonBookings) {
		previousMetrics = await getCurrentPeriodMetrics(
			supabase, tenantId, comparisonFrom!, comparisonTo!, comparisonBookings, sharedProperties, tagIds
		);
	}

	const metrics = formatOverviewMetrics(currentMetrics, previousMetrics);

	return {
		metrics,
		charts,
		alerts,
		recentActivity,
		upcoming,
		view: 'overview'
	};
}

async function getCurrentPeriodMetrics(
	supabase: SupabaseClient,
	tenantId: string,
	from: string,
	to: string,
	bookings: any[],
	properties: any[],
	tagIds: string[] = []
) {
	const propertyCount = properties.length;
	const propertyIds = properties.map(p => p.id);

	// canceledCount must honor the same property and tag filters as the active
	// bookings query above, otherwise cancellationRate = canceled / (active+canceled)
	// mixes tenant-wide cancellations with a filtered numerator and produces a
	// meaningless ratio whenever the user has selected any filter.
	let canceledCount = 0;
	let canceledTagBookingIds: string[] | null = null;
	let skipCanceledQuery = false;

	if (tagIds.length > 0) {
		canceledTagBookingIds = await getBookingIdsForTags(supabase, tenantId, tagIds);
		if (!canceledTagBookingIds) {
			// no bookings match the tag filter — no cancellations can either
			skipCanceledQuery = true;
		}
	}

	if (!skipCanceledQuery && propertyIds.length > 0) {
		let canceledQuery = supabase
			.from('bookings')
			.select('*', { count: 'exact', head: true })
			.eq('tenant_id', tenantId)
			.in('property_id', propertyIds)
			.lte('arrival', to)
			.gte('departure', from)
			.eq('status', 'canceled');

		if (canceledTagBookingIds) {
			canceledQuery = canceledQuery.in('id', canceledTagBookingIds);
		}

		const { count } = await canceledQuery;
		canceledCount = count || 0;
	}

	const totalRevenue = bookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
	const totalBookings = bookings.length;
	const avgBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;
	const platformFees = bookings.reduce((sum, b) => sum + (b.host_service_fee || 0), 0);

	// fetch taxes from booking_charges
	const bookingIds = bookings.map(b => b.id);
	let taxes = 0;
	if (bookingIds.length > 0) {
		const { data: taxCharges } = await supabase
			.from('booking_charges')
			.select('amount')
			.in('booking_id', bookingIds)
			.eq('type', 'tax')
			.limit(SUPABASE_MAX_ROWS);
		taxes = (taxCharges || []).reduce((sum: number, c: any) => sum + (parseFloat(c.amount) || 0), 0);
	}

	// fetch operating expenses
	const expenseRows = await getExpensesWithTemplateFallback(supabase, tenantId, from, to, propertyIds);
	const operatingExpensesTotal = expenseRows.reduce((sum, e) => sum + e.amount, 0);
	const operatingExpensesByCategory: Record<string, number> = {};
	expenseRows.forEach(e => {
		operatingExpensesByCategory[e.category] = (operatingExpensesByCategory[e.category] || 0) + e.amount;
	});

	const netRevenue = totalRevenue - platformFees - taxes;
	const operatingProfit = netRevenue - operatingExpensesTotal;
	let totalNights = 0;
	bookings.forEach(b => {
		const nights = Math.ceil(
			(new Date(b.departure).getTime() - new Date(b.arrival).getTime()) / (1000 * 60 * 60 * 24)
		);
		totalNights += nights;
	});
	const avgNights = totalBookings > 0 ? totalNights / totalBookings : 0;

	const startDate = new Date(from);
	const endDate = new Date(to);
	const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
	const totalPossibleNights = totalDays * (propertyCount || 1);
	const occupancyRate = totalPossibleNights > 0 ? (totalNights / totalPossibleNights) * 100 : 0;

	const uniqueGuests = new Set(bookings.map(b => b.ownerrez_guest_id || b.guest_name?.toLowerCase()).filter(Boolean));
	const totalGuests = uniqueGuests.size;

	// repeat guest rate via SQL (avoids fetching all historical bookings)
	let repeatGuests = 0;
	if (totalGuests > 0) {
		const bookingIds = bookings.map((b: { id: string }) => b.id);
		const { data: repeatCount } = await supabase.rpc('get_repeat_guest_count', {
			p_tenant_id: tenantId,
			p_from: from,
			p_to: to,
			p_booking_ids: bookingIds,
		});
		repeatGuests = Number(repeatCount ?? 0);
	}

	const newGuests = totalGuests - repeatGuests;
	const repeatGuestRate = totalGuests > 0 ? repeatGuests / totalGuests : 0;

	const totalWithCanceled = totalBookings + (canceledCount || 0);
	const cancellationRate = totalWithCanceled > 0 ? ((canceledCount || 0) / totalWithCanceled) * 100 : 0;

	const today = new Date().toISOString().split('T')[0];
	const upcomingBookings = bookings.filter(b => b.arrival >= today).length;

	return {
		revenue: totalRevenue,
		netRevenue,
		platformFees,
		taxes,
		operatingExpenses: operatingExpensesTotal,
		operatingExpensesByCategory,
		operatingProfit,
		bookings: totalBookings,
		upcomingBookings,
		cancellationRate,
		occupancyRate,
		totalGuests,
		newGuests,
		repeatGuestRate,
		avgBookingValue,
		avgNights,
		totalProperties: propertyCount || 0,
		avgPropertyOccupancy: occupancyRate
	};
}

function getChartsData(
	bookings: any[],
	properties: any[],
	from: string,
	to: string
) {
	const daysDiff = Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24));
	const revenueUseDaily = daysDiff <= 30;
	const revenueUseWeekly = daysDiff > 30 && daysDiff <= 180;

	const revenueData = buildRevenueChartData(bookings, from, to, revenueUseDaily, revenueUseWeekly);

	const propertyRevenue = new Map();
	bookings.forEach(b => {
		const property = properties.find(p => p.id === b.property_id);
		if (property) {
			const current = propertyRevenue.get(property.name) || { name: property.name, code: property.internal_code || null, revenue: 0, bookings: 0 };
			current.revenue += b.total_amount || 0;
			current.bookings++;
			propertyRevenue.set(property.name, current);
		}
	});

	const topProperties = Array.from(propertyRevenue.values())
		.sort((a, b) => b.revenue - a.revenue)
		.slice(0, 5);

	const sourceMap = new Map<string, { count: number; revenue: number }>();
	bookings.forEach(b => {
		const source = normalizePlatform(b.platform);
		const existing = sourceMap.get(source) || { count: 0, revenue: 0 };
		existing.count++;
		existing.revenue += b.total_amount || 0;
		sourceMap.set(source, existing);
	});

	const bookingsBySource = Array.from(sourceMap.entries())
		.map(([source, data]) => ({ source, count: data.count, revenue: data.revenue }))
		.sort((a, b) => b.count - a.count);

	const occupancyData = buildOccupancyChartData(bookings, properties, from, to, daysDiff <= 60);

	return {
		revenueLastWeek: revenueData,
		topProperties,
		bookingsBySource,
		occupancyTrend: occupancyData
	};
}

function buildRevenueChartData(
	bookings: any[],
	from: string,
	to: string,
	useDaily: boolean,
	useWeekly: boolean
) {
	const revenueMap = new Map();

	bookings.forEach(b => {
		const date = new Date(b.arrival);
		let key: string;
		let label: string;

		if (useDaily) {
			key = date.toISOString().split('T')[0];
			label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		} else if (useWeekly) {
			const weekStart = new Date(date);
			weekStart.setDate(date.getDate() - date.getDay());
			key = weekStart.toISOString().split('T')[0];
			label = `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
		} else {
			key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
			label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
		}

		const current = revenueMap.get(key) || { day: label, date: key, revenue: 0 };
		current.revenue += b.total_amount || 0;
		revenueMap.set(key, current);
	});

	const startDate = new Date(from);
	const endDate = new Date(to);
	const result = [];

	if (useDaily) {
		for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
			const key = d.toISOString().split('T')[0];
			const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
			result.push(revenueMap.get(key) || { day: label, date: key, revenue: 0 });
		}
	} else if (useWeekly) {
		const weekStart = new Date(startDate);
		weekStart.setDate(startDate.getDate() - startDate.getDay());

		for (let d = new Date(weekStart); d <= endDate; d.setDate(d.getDate() + 7)) {
			const key = d.toISOString().split('T')[0];
			const label = `Week of ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
			result.push(revenueMap.get(key) || { day: label, date: key, revenue: 0 });
		}
	} else {
		for (let d = new Date(startDate); d <= endDate; d.setMonth(d.getMonth() + 1)) {
			const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
			const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
			result.push(revenueMap.get(key) || { day: label, date: key, revenue: 0 });
		}
	}

	return result;
}

function buildOccupancyChartData(
	bookings: any[],
	properties: any[],
	from: string,
	to: string,
	useDaily: boolean
) {
	const totalProperties = properties.length || 1;
	const startDate = new Date(from);
	const endDate = new Date(to);
	const MS_PER_DAY = 1000 * 60 * 60 * 24;

	if (useDaily) {
		// single pass over bookings to build grid: epochDay -> Set<propertyId>
		const startEpoch = Math.floor(startDate.getTime() / MS_PER_DAY);
		const endEpoch = Math.floor(endDate.getTime() / MS_PER_DAY);
		const grid = new Map<number, Set<string>>();

		for (const b of bookings) {
			const bStart = Math.max(Math.floor(new Date(b.arrival).getTime() / MS_PER_DAY), startEpoch);
			const bEnd = Math.min(Math.floor(new Date(b.departure).getTime() / MS_PER_DAY), endEpoch + 1);
			for (let d = bStart; d < bEnd; d++) {
				let set = grid.get(d);
				if (!set) { set = new Set(); grid.set(d, set); }
				set.add(b.property_id);
			}
		}

		// iterate days to read from grid: O(D)
		const result = [];
		for (let epoch = startEpoch; epoch <= endEpoch; epoch++) {
			const d = new Date(epoch * MS_PER_DAY);
			const label = `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
			const bookedCount = grid.get(epoch)?.size ?? 0;
			const rate = (bookedCount / totalProperties) * 100;
			result.push({ month: label, rate: Math.round(rate * 10) / 10 });
		}
		return result;
	} else {
		// single pass over bookings to accumulate nights per month
		const monthNights = new Map<string, number>();

		for (const b of bookings) {
			const arrivalDate = new Date(b.arrival);
			const departureDate = new Date(b.departure);
			const bStart = arrivalDate > startDate ? arrivalDate : startDate;
			const bEnd = departureDate < endDate ? departureDate : endDate;

			// walk month boundaries this booking spans
			let cursor = new Date(bStart.getFullYear(), bStart.getMonth(), 1);
			while (cursor <= bEnd) {
				const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
				const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
				const effectiveStart = monthStart > startDate ? monthStart : startDate;
				const effectiveEnd = monthEnd < endDate ? monthEnd : endDate;

				if (arrivalDate <= effectiveEnd && departureDate > effectiveStart) {
					const overlapStart = arrivalDate > effectiveStart ? arrivalDate : effectiveStart;
					const overlapEnd = departureDate < effectiveEnd ? departureDate : effectiveEnd;
					const nights = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / MS_PER_DAY);
					const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
					monthNights.set(key, (monthNights.get(key) || 0) + nights);
				}
				cursor.setMonth(cursor.getMonth() + 1);
			}
		}

		// iterate months to build result
		const result = [];
		for (let d = new Date(startDate); d <= endDate; d.setMonth(d.getMonth() + 1)) {
			const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
			const label = d.toLocaleDateString('en-US', { month: 'short' });

			const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
			const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
			const effectiveStart = monthStart > startDate ? monthStart : startDate;
			const effectiveEnd = monthEnd < endDate ? monthEnd : endDate;
			const daysInMonth = Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / MS_PER_DAY) + 1;
			const totalNights = daysInMonth * totalProperties;

			const bookedNights = monthNights.get(key) || 0;
			const rate = totalNights > 0 ? (bookedNights / totalNights) * 100 : 0;
			result.push({ month: label, rate: Math.round(rate * 10) / 10 });
		}
		return result;
	}
}

async function getAlerts(
	supabase: SupabaseClient,
	tenantId: string,
	from: string,
	to: string
) {
	const alerts = [];

	const today = new Date();
	const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
	
	const { count: upcomingCount } = await supabase
		.from('bookings')
		.select('*', { count: 'exact', head: true })
		.eq('tenant_id', tenantId)
		.gte('arrival', today.toISOString().split('T')[0])
		.lte('arrival', sevenDaysFromNow.toISOString().split('T')[0])
		.neq('status', 'canceled');

	if (upcomingCount && upcomingCount > 0) {
		alerts.push({
			id: 'upcoming-arrivals',
			type: 'info' as const,
			title: `${upcomingCount} ${upcomingCount === 1 ? 'Guest' : 'Guests'} Arriving Soon`,
			description: `Check-ins scheduled within the next 7 days`,
			timestamp: new Date().toISOString()
		});
	}

	const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
	
	const { data: upcomingBookings } = await supabase
		.from('bookings')
		.select('arrival, departure')
		.eq('tenant_id', tenantId)
		.gte('arrival', today.toISOString().split('T')[0])
		.lte('arrival', thirtyDaysFromNow.toISOString().split('T')[0])
		.neq('status', 'canceled')
		.limit(SUPABASE_MAX_ROWS);

	const { count: propertyCount } = await supabase
		.from('properties')
		.select('*', { count: 'exact', head: true })
		.eq('tenant_id', tenantId)
		.eq('active', true);

	if (propertyCount) {
		const totalPossibleNights = 30 * propertyCount;
		let bookedNights = 0;
		
		upcomingBookings?.forEach(b => {
			const nights = Math.ceil(
				(new Date(b.departure).getTime() - new Date(b.arrival).getTime()) / (1000 * 60 * 60 * 24)
			);
			bookedNights += nights;
		});

		const occupancyRate = (bookedNights / totalPossibleNights) * 100;

		if (occupancyRate < 50) {
			alerts.push({
				id: 'low-occupancy',
				type: 'warning' as const,
				title: `${Math.round(occupancyRate)}% Occupancy Next 30 Days`,
				description: `${bookedNights} of ${totalPossibleNights} available nights booked across ${propertyCount} ${propertyCount === 1 ? 'property' : 'properties'}`,
				timestamp: new Date().toISOString()
			});
		}
	}

	const { count: totalBookings } = await supabase
		.from('bookings')
		.select('*', { count: 'exact', head: true })
		.eq('tenant_id', tenantId)
		.lte('arrival', to)
		.gte('departure', from);

	const { count: canceledBookings } = await supabase
		.from('bookings')
		.select('*', { count: 'exact', head: true })
		.eq('tenant_id', tenantId)
		.lte('arrival', to)
		.gte('departure', from)
		.eq('status', 'canceled');

	if (totalBookings && canceledBookings) {
		const cancellationRate = (canceledBookings / totalBookings) * 100;

		if (cancellationRate > 10) {
			alerts.push({
				id: 'high-cancellations',
				type: 'warning' as const,
				title: `${Math.round(cancellationRate)}% Cancellation Rate`,
				description: `${canceledBookings} of ${totalBookings} bookings canceled in selected period`,
				timestamp: new Date().toISOString()
			});
		}
	}

	return alerts;
}

async function getRecentActivity(
	supabase: SupabaseClient,
	tenantId: string,
	from: string,
	to: string
) {
	const [{ data: recentBookings }, { data: recentInquiries }] = await Promise.all([
		supabase
			.from('bookings')
			.select(`
				id, guest_name, ownerrez_guest_id, ownerrez_booking_id,
				total_amount, arrival, departure, platform, status,
				booked_utc, canceled_utc, created_at,
				properties!inner(name)
			`)
			.eq('tenant_id', tenantId)
			.gte('booked_utc', `${from}T00:00:00Z`)
			.lte('booked_utc', `${to}T23:59:59Z`)
			.order('booked_utc', { ascending: false, nullsFirst: false })
			.limit(20),
		supabase
			.from('inquiries')
			.select('id, ownerrez_inquiry_id, guest_name, guest_email, property_id, arrival, departure, data, created_at')
			.eq('tenant_id', tenantId)
			.gte('created_at', `${from}T00:00:00Z`)
			.lte('created_at', `${to}T23:59:59Z`)
			.order('created_at', { ascending: false })
			.limit(10),
	]);

	// build property lookup for inquiries (they store ownerrez numeric id, not uuid)
	const inquiryPropertyIds = (recentInquiries || [])
		.map(i => i.property_id)
		.filter(Boolean);
	let propertyByOrId = new Map<string, string>();
	if (inquiryPropertyIds.length > 0) {
		const { data: props } = await supabase
			.from('properties')
			.select('name, ownerrez_id')
			.eq('tenant_id', tenantId);
		if (props) {
			for (const p of props) {
				if (p.ownerrez_id) propertyByOrId.set(String(p.ownerrez_id), p.name);
			}
		}
	}

	const bookingItems = (recentBookings || []).map(b => ({
		id: b.id,
		type: 'booking' as const,
		description: b.status === 'canceled'
			? `${b.guest_name} cancelled ${(b.properties as unknown as { name: string })?.name}`
			: `${b.guest_name} booked ${(b.properties as unknown as { name: string })?.name}`,
		timestamp: b.status === 'canceled'
			? (b.canceled_utc || b.booked_utc || b.created_at || b.arrival)
			: (b.booked_utc || b.created_at || b.arrival),
		value: b.total_amount,
		platform: normalizePlatform(b.platform),
		ownerrezBookingId: b.ownerrez_booking_id || null,
		ownerrezGuestId: b.ownerrez_guest_id || null,
		guestName: b.guest_name,
		status: b.status || 'confirmed',
		metadata: {
			arrival: b.arrival,
			departure: b.departure,
		}
	}));

	const inquiryItems = (recentInquiries || []).map(i => {
		const data = i.data as Record<string, unknown> | null;
		const propertyName = i.property_id ? propertyByOrId.get(String(i.property_id)) : null;
		return {
			id: i.id,
			type: 'inquiry' as const,
			description: `${i.guest_name || 'Unknown'} inquired about ${propertyName || 'a property'}`,
			timestamp: (data?.created_utc as string) ?? (data?.received_utc as string) ?? i.created_at,
			value: null,
			platform: data?.listing_site ? normalizePlatform(data.listing_site as string) : null,
			ownerrezBookingId: null,
			ownerrezGuestId: null,
			ownerrezInquiryId: i.ownerrez_inquiry_id || null,
			guestName: i.guest_name,
			status: 'inquiry',
			metadata: {
				arrival: i.arrival,
				departure: i.departure,
			}
		};
	});

	// merge and sort by timestamp descending, take top 10
	const all = [...bookingItems, ...inquiryItems]
		.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
		.slice(0, 10);

	return all;
}

async function getUpcomingBookings(
	supabase: SupabaseClient,
	tenantId: string
) {
	const today = new Date().toISOString().split('T')[0];
	const thirtyDaysOut = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

	const { data: bookings } = await supabase
		.from('bookings')
		.select(`
			id,
			guest_name,
			arrival,
			departure,
			total_amount,
			property_id,
			properties!inner(name)
		`)
		.eq('tenant_id', tenantId)
		.neq('status', 'canceled')
		.or(`and(arrival.gte.${today},arrival.lte.${thirtyDaysOut}),and(departure.gte.${today},departure.lte.${thirtyDaysOut})`)
		.order('arrival', { ascending: true })
		.limit(50);

	if (!bookings || bookings.length === 0) return [];

	const todayDate = new Date(today);
	const endOfToday = new Date(today);
	endOfToday.setDate(endOfToday.getDate() + 1);
	const endOfWeek = new Date(today);
	endOfWeek.setDate(endOfWeek.getDate() + 7);
	const endOfMonth = new Date(today);
	endOfMonth.setDate(endOfMonth.getDate() + 30);

	return bookings.map((b: any) => {
		const arrivalDate = new Date(b.arrival);
		const departureDate = new Date(b.departure);
		const isCheckIn = arrivalDate >= todayDate;
		const isCheckOut = departureDate >= todayDate && departureDate <= endOfMonth && arrivalDate < todayDate;

		return {
			id: b.id,
			guestName: b.guest_name,
			propertyName: b.properties?.name || 'Unknown',
			arrival: b.arrival,
			departure: b.departure,
			amount: b.total_amount,
			type: isCheckIn ? 'check-in' : 'check-out',
			isToday: isCheckIn
				? arrivalDate.toISOString().split('T')[0] === today
				: departureDate.toISOString().split('T')[0] === today,
			isThisWeek: isCheckIn
				? arrivalDate < endOfWeek
				: departureDate < endOfWeek,
		};
	});
}

function formatOverviewMetrics(current: any, previous: any = null) {
	return {
		revenue: {
			current: current.revenue,
			previous: previous?.revenue || 0,
			growth: previous?.revenue ? ((current.revenue - previous.revenue) / previous.revenue) * 100 : 0,
			net: current.netRevenue,
			platformFees: current.platformFees,
			taxes: current.taxes,
			operatingExpenses: current.operatingExpenses,
			operatingExpensesByCategory: current.operatingExpensesByCategory,
			operatingProfit: current.operatingProfit,
			previousOperatingProfit: previous?.operatingProfit || 0,
			avgBookingValue: current.avgBookingValue
		},
		bookings: {
			current: current.bookings,
			previous: previous?.bookings || 0,
			upcoming: current.upcomingBookings,
			cancellationRate: current.cancellationRate,
			avgNights: current.avgNights
		},
		occupancy: {
			current: current.occupancyRate,
			previous: previous?.occupancyRate || 0,
			growth: previous?.occupancyRate ? ((current.occupancyRate - previous.occupancyRate) / previous.occupancyRate) * 100 : 0,
			trend: current.occupancyRate > (previous?.occupancyRate || 0) ? 'up' :
			       current.occupancyRate < (previous?.occupancyRate || 0) ? 'down' : 'stable',
			avgPropertyOccupancy: current.avgPropertyOccupancy
		},
		guests: {
			total: current.totalGuests,
			previous: previous?.totalGuests || 0,
			growth: previous?.totalGuests ? ((current.totalGuests - previous.totalGuests) / previous.totalGuests) * 100 : 0,
			newThisMonth: current.newGuests,
			repeatRate: current.repeatGuestRate
		},
		properties: {
			total: current.totalProperties,
			avgOccupancy: current.avgPropertyOccupancy
		}
	};
}