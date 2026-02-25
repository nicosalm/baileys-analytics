import { SupabaseClient } from '@supabase/supabase-js';
import { getActiveSeasons, buildBookingFilters } from './seasons';
import { SUPABASE_MAX_ROWS } from '../constants';

export async function getOverviewData(
	supabase: SupabaseClient,
	tenantId: string,
	from: string,
	to: string,
	tagIds: string[] = [],
	comparisonFrom?: string,
	comparisonTo?: string
) {
	const [currentMetrics, charts, alerts, recentActivity, upcoming] = await Promise.all([
		getCurrentPeriodMetrics(supabase, tenantId, from, to, tagIds),
		getChartsData(supabase, tenantId, from, to, tagIds),
		getAlerts(supabase, tenantId, from, to),
		getRecentActivity(supabase, tenantId),
		getUpcomingBookings(supabase, tenantId)
	]);

	let previousMetrics = null;
	if (comparisonFrom && comparisonTo) {
		previousMetrics = await getCurrentPeriodMetrics(supabase, tenantId, comparisonFrom, comparisonTo, tagIds);
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
	tagIds: string[] = []
) {
	const seasons = await getActiveSeasons(supabase, tenantId);
	const bookingFilters = buildBookingFilters(seasons, 'b');
	const hasTagFilter = tagIds.length > 0;

	let bookingsQuery = supabase
		.from('bookings')
		.select('*')
		.eq('tenant_id', tenantId)
		.lte('arrival', to)
		.gte('departure', from)
		.neq('status', 'canceled')
		.limit(SUPABASE_MAX_ROWS);

	if (hasTagFilter) {
		const { data: taggedBookings } = await supabase
			.from('booking_tags')
			.select('booking_id')
			.in('tag_id', tagIds);

		if (taggedBookings) {
			const bookingIds = taggedBookings.map(tb => tb.booking_id);
			bookingsQuery = bookingsQuery.in('id', bookingIds);
		}
	}

	const { data: bookings } = await bookingsQuery;

	const { data: properties, count: propertyCount } = await supabase
		.from('properties')
		.select('*', { count: 'exact' })
		.eq('tenant_id', tenantId)
		.eq('active', true);

	const { count: canceledCount } = await supabase
		.from('bookings')
		.select('*', { count: 'exact', head: true })
		.eq('tenant_id', tenantId)
		.lte('arrival', to)
		.gte('departure', from)
		.eq('status', 'canceled');

	const totalRevenue = bookings?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;
	const totalBookings = bookings?.length || 0;
	const avgBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;
	const platformFees = totalRevenue * 0.03;
	const netRevenue = totalRevenue - platformFees;
	let totalNights = 0;
	if (bookings && bookings.length > 0) {
		bookings.forEach(b => {
			const nights = Math.ceil(
				(new Date(b.departure).getTime() - new Date(b.arrival).getTime()) / (1000 * 60 * 60 * 24)
			);
			totalNights += nights;
		});
	}
	const avgNights = totalBookings > 0 ? totalNights / totalBookings : 0;

	const startDate = new Date(from);
	const endDate = new Date(to);
	const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
	const totalPossibleNights = totalDays * (propertyCount || 1);
	const occupancyRate = totalPossibleNights > 0 ? (totalNights / totalPossibleNights) * 100 : 0;

	const uniqueGuests = new Set(bookings?.map(b => b.guest_email?.toLowerCase() || b.guest_name?.toLowerCase()).filter(Boolean));
	const totalGuests = uniqueGuests.size;

	// Calculate repeat guest rate by checking historical bookings before the current period
	const { data: historicalBookings } = await supabase
		.from('bookings')
		.select('guest_email, guest_name')
		.eq('tenant_id', tenantId)
		.lt('arrival', from)
		.neq('status', 'canceled')
		.limit(SUPABASE_MAX_ROWS);

	const historicalGuestIds = new Set(
		historicalBookings?.map(b => b.guest_email?.toLowerCase() || b.guest_name?.toLowerCase()).filter(Boolean) || []
	);

	let repeatGuests = 0;
	uniqueGuests.forEach(guestId => {
		if (historicalGuestIds.has(guestId)) {
			repeatGuests++;
		}
	});

	const newGuests = totalGuests - repeatGuests;
	const repeatGuestRate = totalGuests > 0 ? repeatGuests / totalGuests : 0;

	const totalWithCanceled = totalBookings + (canceledCount || 0);
	const cancellationRate = totalWithCanceled > 0 ? ((canceledCount || 0) / totalWithCanceled) * 100 : 0;

	const today = new Date().toISOString().split('T')[0];
	const upcomingBookings = bookings?.filter(b => b.arrival >= today).length || 0;

	return {
		revenue: totalRevenue,
		netRevenue,
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

async function getChartsData(
	supabase: SupabaseClient,
	tenantId: string,
	from: string,
	to: string,
	tagIds: string[] = []
) {
	const seasons = await getActiveSeasons(supabase, tenantId);
	const hasTagFilter = tagIds.length > 0;

	const daysDiff = Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24));
	const revenueUseDaily = daysDiff <= 30;
	const revenueUseWeekly = daysDiff > 30 && daysDiff <= 180;

	let bookingsQuery = supabase
		.from('bookings')
		.select('*')
		.eq('tenant_id', tenantId)
		.lte('arrival', to)
		.gte('departure', from)
		.neq('status', 'canceled')
		.limit(SUPABASE_MAX_ROWS);

	if (hasTagFilter) {
		const { data: taggedBookings } = await supabase
			.from('booking_tags')
			.select('booking_id')
			.in('tag_id', tagIds);

		if (taggedBookings) {
			const bookingIds = taggedBookings.map(tb => tb.booking_id);
			bookingsQuery = bookingsQuery.in('id', bookingIds);
		}
	}

	const { data: bookings } = await bookingsQuery;

	const { data: properties } = await supabase
		.from('properties')
		.select('id, name')
		.eq('tenant_id', tenantId);

	const revenueData = buildRevenueChartData(bookings || [], from, to, revenueUseDaily, revenueUseWeekly);

	const propertyRevenue = new Map();
	bookings?.forEach(b => {
		const property = properties?.find(p => p.id === b.property_id);
		if (property) {
			const current = propertyRevenue.get(property.name) || { name: property.name, revenue: 0, bookings: 0 };
			current.revenue += b.total_amount || 0;
			current.bookings++;
			propertyRevenue.set(property.name, current);
		}
	});

	const topProperties = Array.from(propertyRevenue.values())
		.sort((a, b) => b.revenue - a.revenue)
		.slice(0, 5);

	const sourceMap = new Map<string, { count: number; revenue: number }>();
	bookings?.forEach(b => {
		const source = b.platform || 'Unassigned';
		const existing = sourceMap.get(source) || { count: 0, revenue: 0 };
		existing.count++;
		existing.revenue += b.total_amount || 0;
		sourceMap.set(source, existing);
	});

	const bookingsBySource = Array.from(sourceMap.entries())
		.map(([source, data]) => ({ source, count: data.count, revenue: data.revenue }))
		.sort((a, b) => b.count - a.count);

	const occupancyData = buildOccupancyChartData(bookings || [], properties || [], from, to, daysDiff <= 60);

	return {
		revenueLastWeek: revenueData, // Frontend expects this name, but it's actually the selected date range
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

		const current = revenueMap.get(key) || { day: label, revenue: 0 };
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
			result.push(revenueMap.get(key) || { day: label, revenue: 0 });
		}
	} else if (useWeekly) {
		const weekStart = new Date(startDate);
		weekStart.setDate(startDate.getDate() - startDate.getDay());
		
		for (let d = new Date(weekStart); d <= endDate; d.setDate(d.getDate() + 7)) {
			const key = d.toISOString().split('T')[0];
			const label = `Week of ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
			result.push(revenueMap.get(key) || { day: label, revenue: 0 });
		}
	} else {
		for (let d = new Date(startDate); d <= endDate; d.setMonth(d.getMonth() + 1)) {
			const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
			const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
			result.push(revenueMap.get(key) || { day: label, revenue: 0 });
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
	const occupancyMap = new Map();
	const totalProperties = properties.length || 1;

	const startDate = new Date(from);
	const endDate = new Date(to);

	if (useDaily) {
		for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
			const dateStr = d.toISOString().split('T')[0];
			const label = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
			
			const bookedProperties = new Set();
			bookings.forEach(b => {
				if (new Date(b.arrival) <= d && new Date(b.departure) > d) {
					bookedProperties.add(b.property_id);
				}
			});

			const occupancyRate = (bookedProperties.size / totalProperties) * 100;
			occupancyMap.set(dateStr, { month: label, rate: Math.round(occupancyRate * 10) / 10 });
		}
	} else {
		for (let d = new Date(startDate); d <= endDate; d.setMonth(d.getMonth() + 1)) {
			const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
			const label = d.toLocaleDateString('en-US', { month: 'short' });
			
			let totalNights = 0;
			let bookedNights = 0;
			
			const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
			const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
			const effectiveStart = monthStart > startDate ? monthStart : startDate;
			const effectiveEnd = monthEnd < endDate ? monthEnd : endDate;
			
			const daysInMonth = Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
			totalNights = daysInMonth * totalProperties;

			bookings.forEach(b => {
				const arrivalDate = new Date(b.arrival);
				const departureDate = new Date(b.departure);
				
				if (arrivalDate <= effectiveEnd && departureDate > effectiveStart) {
					const overlapStart = arrivalDate > effectiveStart ? arrivalDate : effectiveStart;
					const overlapEnd = departureDate < effectiveEnd ? departureDate : effectiveEnd;
					const nights = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24));
					bookedNights += nights;
				}
			});

			const occupancyRate = totalNights > 0 ? (bookedNights / totalNights) * 100 : 0;
			occupancyMap.set(monthKey, { month: label, rate: Math.round(occupancyRate * 10) / 10 });
		}
	}

	return Array.from(occupancyMap.values());
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
		.select('*')
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
	tenantId: string
) {
	const { data: recentBookings } = await supabase
		.from('bookings')
		.select(`
			*,
			properties!inner(name)
		`)
		.eq('tenant_id', tenantId)
		.order('booked_utc', { ascending: false, nullsFirst: false })
		.limit(10);

	return recentBookings?.map(b => ({
		id: b.id,
		type: 'booking' as const,
		description: `${b.guest_name} booked ${b.properties?.name}`,
		timestamp: b.booked_utc || b.created_at || b.arrival,
		value: b.total_amount,
		platform: b.platform || 'Unassigned',
		ownerrezBookingId: b.ownerrez_booking_id || null,
		metadata: {
			guestName: b.guest_name,
			propertyName: b.properties?.name,
			arrival: b.arrival,
			departure: b.departure,
			amount: b.total_amount
		}
	})) || [];
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