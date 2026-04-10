import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_MAX_ROWS } from '../constants';
import { getBookingIdsForTags } from '../utils/tag-filter';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// --- types ---

export interface PacingMonthSummary {
	month: string;           // YYYY-MM
	label: string;           // "May 2026"
	daysInMonth: number;
	totalAvailableNights: number;
	current: { bookedNights: number; revenue: number; occupancy: number };
	priorAtThisPoint: { bookedNights: number; revenue: number; occupancy: number };
	priorFinal: { bookedNights: number; revenue: number; occupancy: number };
	paceDelta: number;       // percentage points (current - prior at this point)
}

export interface PacingProperty {
	propertyId: string;
	propertyName: string;
	propertyCode: string | null;
	currentNights: number;
	currentRevenue: number;
	priorNightsAtThisPoint: number;
	priorRevenueAtThisPoint: number;
	priorNightsFinal: number;
	priorRevenueFinal: number;
	availableNights: number;
	paceDelta: number;
}

export interface PacingCurvePoint {
	daysOut: number;         // days relative to target month start (negative = before)
	currentNights: number;   // cumulative booked nights, current year
	priorNights: number;     // cumulative booked nights, prior year
	currentRevenue: number;  // cumulative revenue, current year
	priorRevenue: number;    // cumulative revenue, prior year
}

export interface PacingMonthDetail {
	byProperty: PacingProperty[];
	curve: PacingCurvePoint[];
	todayDaysOut: number;
}

export interface PacingData {
	months: PacingMonthSummary[];
	details: Record<string, PacingMonthDetail>;
	propertyCount: number;
}

// --- helpers ---

function getDaysInMonth(year: number, month: number): number {
	return new Date(year, month + 1, 0).getDate();
}

function computeOverlapNights(
	arrival: Date,
	departure: Date,
	monthStart: Date,
	nextMonthStart: Date
): number {
	const overlapStart = arrival > monthStart ? arrival : monthStart;
	const overlapEnd = departure < nextMonthStart ? departure : nextMonthStart;
	const nights = Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / MS_PER_DAY);
	return Math.max(0, nights);
}

function formatMonthLabel(year: number, month: number): string {
	return new Date(year, month, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function formatMonthKey(year: number, month: number): string {
	return `${year}-${String(month + 1).padStart(2, '0')}`;
}

// --- main ---

export async function getPacingData(
	supabase: SupabaseClient,
	tenantId: string,
	tagIds: string[] = [],
	filterPropertyIds: string[] = []
): Promise<PacingData> {
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const currentYear = today.getFullYear();
	const currentMonth = today.getMonth();

	// target months: current month + next 5
	const targetMonths: Array<{
		year: number; month: number; key: string; label: string; days: number;
		priorYear: number; priorDays: number;
	}> = [];

	for (let i = 0; i < 6; i++) {
		const m = (currentMonth + i) % 12;
		const y = currentYear + Math.floor((currentMonth + i) / 12);
		const py = y - 1;
		targetMonths.push({
			year: y, month: m,
			key: formatMonthKey(y, m),
			label: formatMonthLabel(y, m),
			days: getDaysInMonth(y, m),
			priorYear: py,
			priorDays: getDaysInMonth(py, m),
		});
	}

	// active properties
	let propertiesQuery = supabase
		.from('properties')
		.select('id, name, internal_code')
		.eq('tenant_id', tenantId)
		.eq('active', true);

	if (filterPropertyIds.length > 0) {
		propertiesQuery = propertiesQuery.in('id', filterPropertyIds);
	}

	const { data: properties } = await propertiesQuery;

	if (!properties || properties.length === 0) {
		return { months: [], details: {}, propertyCount: 0 };
	}

	const propertyCount = properties.length;
	const propertyIds = properties.map(p => p.id);

	// tag filtering
	let bookingIdFilter: string[] | null = null;
	if (tagIds.length > 0) {
		bookingIdFilter = await getBookingIdsForTags(supabase, tenantId, tagIds);
		if (!bookingIdFilter) {
			const emptyBucket = { bookedNights: 0, revenue: 0, occupancy: 0 };
			return {
				months: targetMonths.map(tm => ({
					month: tm.key, label: tm.label, daysInMonth: tm.days,
					totalAvailableNights: tm.days * propertyCount,
					current: { ...emptyBucket }, priorAtThisPoint: { ...emptyBucket },
					priorFinal: { ...emptyBucket }, paceDelta: 0,
				})),
				details: {},
				propertyCount,
			};
		}
	}

	// date ranges for the two bulk queries
	const first = targetMonths[0];
	const last = targetMonths[targetMonths.length - 1];

	const currentFrom = `${first.year}-${String(first.month + 1).padStart(2, '0')}-01`;
	const currentTo = `${last.year}-${String(last.month + 1).padStart(2, '0')}-${String(last.days).padStart(2, '0')}`;

	const priorFrom = `${first.priorYear}-${String(first.month + 1).padStart(2, '0')}-01`;
	const priorTo = `${last.priorYear}-${String(last.month + 1).padStart(2, '0')}-${String(last.priorDays).padStart(2, '0')}`;

	// two queries: current year target months + prior year equivalent months
	let currentQuery = supabase
		.from('bookings')
		.select('id, arrival, departure, total_amount, property_id, booked_utc')
		.eq('tenant_id', tenantId)
		.neq('status', 'canceled')
		.lte('arrival', currentTo)
		.gte('departure', currentFrom)
		.in('property_id', propertyIds)
		.limit(SUPABASE_MAX_ROWS);

	let priorQuery = supabase
		.from('bookings')
		.select('id, arrival, departure, total_amount, property_id, booked_utc')
		.eq('tenant_id', tenantId)
		.neq('status', 'canceled')
		.lte('arrival', priorTo)
		.gte('departure', priorFrom)
		.in('property_id', propertyIds)
		.limit(SUPABASE_MAX_ROWS);

	if (bookingIdFilter) {
		currentQuery = currentQuery.in('id', bookingIdFilter);
		priorQuery = priorQuery.in('id', bookingIdFilter);
	}

	// blocks query: only current year (prior year available nights stay as-is for fair comparison)
	const blocksQuery = supabase
		.from('blocks')
		.select('property_id, arrival, departure')
		.eq('tenant_id', tenantId)
		.lte('arrival', currentTo)
		.gte('departure', currentFrom)
		.in('property_id', propertyIds)
		.limit(SUPABASE_MAX_ROWS);

	const [currentResult, priorResult, blocksResult] = await Promise.all([currentQuery, priorQuery, blocksQuery]);
	const currentBookings = currentResult.data || [];
	const priorBookings = priorResult.data || [];
	const blocks = blocksResult.data || [];

	// prior year "as of" date: today shifted back 1 year, clamped for leap days
	const priorAsOf = new Date(
		today.getFullYear() - 1,
		today.getMonth(),
		Math.min(today.getDate(), getDaysInMonth(today.getFullYear() - 1, today.getMonth()))
	);
	priorAsOf.setHours(23, 59, 59, 999);

	// process each target month
	const months: PacingMonthSummary[] = [];
	const details: Record<string, PacingMonthDetail> = {};

	for (const tm of targetMonths) {
		const monthStart = new Date(tm.year, tm.month, 1);
		const nextMonthStart = new Date(tm.month === 11 ? tm.year + 1 : tm.year, (tm.month + 1) % 12, 1);
		const priorMonthStart = new Date(tm.priorYear, tm.month, 1);
		const priorNextMonthStart = new Date(
			tm.month === 11 ? tm.priorYear + 1 : tm.priorYear,
			(tm.month + 1) % 12, 1
		);

		// compute blocked nights per property for this month
		const blockedByProp = new Map<string, number>();
		for (const bl of blocks) {
			const arr = new Date(bl.arrival);
			const dep = new Date(bl.departure);
			if (arr < nextMonthStart && dep > monthStart) {
				const nights = computeOverlapNights(arr, dep, monthStart, nextMonthStart);
				blockedByProp.set(bl.property_id, (blockedByProp.get(bl.property_id) || 0) + nights);
			}
		}
		let totalBlocked = 0;
		for (const n of blockedByProp.values()) totalBlocked += n;

		const availableNights = tm.days * propertyCount - totalBlocked;
		const priorAvailableNights = tm.priorDays * propertyCount;

		// filter bookings overlapping each month window
		const currentMonthBookings = currentBookings.filter(b => {
			const arr = new Date(b.arrival);
			const dep = new Date(b.departure);
			return arr < nextMonthStart && dep > monthStart;
		});

		const priorMonthBookings = priorBookings.filter(b => {
			const arr = new Date(b.arrival);
			const dep = new Date(b.departure);
			return arr < priorNextMonthStart && dep > priorMonthStart;
		});

		// accumulate current year
		let curNights = 0, curRevenue = 0;
		const curByProp = new Map<string, { nights: number; revenue: number }>();

		for (const b of currentMonthBookings) {
			const arr = new Date(b.arrival);
			const dep = new Date(b.departure);
			const totalNights = Math.max(1, Math.floor((dep.getTime() - arr.getTime()) / MS_PER_DAY));
			const overlap = computeOverlapNights(arr, dep, monthStart, nextMonthStart);
			const revenue = (b.total_amount || 0) * (overlap / totalNights);
			curNights += overlap;
			curRevenue += revenue;
			const prev = curByProp.get(b.property_id) || { nights: 0, revenue: 0 };
			curByProp.set(b.property_id, { nights: prev.nights + overlap, revenue: prev.revenue + revenue });
		}

		// accumulate prior year (split into "at this point" vs "final")
		let priorPtNights = 0, priorPtRevenue = 0;
		let priorFinNights = 0, priorFinRevenue = 0;
		const priorPtByProp = new Map<string, { nights: number; revenue: number }>();
		const priorFinByProp = new Map<string, { nights: number; revenue: number }>();

		for (const b of priorMonthBookings) {
			const arr = new Date(b.arrival);
			const dep = new Date(b.departure);
			const totalNights = Math.max(1, Math.floor((dep.getTime() - arr.getTime()) / MS_PER_DAY));
			const overlap = computeOverlapNights(arr, dep, priorMonthStart, priorNextMonthStart);
			const revenue = (b.total_amount || 0) * (overlap / totalNights);

			priorFinNights += overlap;
			priorFinRevenue += revenue;
			const prevFin = priorFinByProp.get(b.property_id) || { nights: 0, revenue: 0 };
			priorFinByProp.set(b.property_id, { nights: prevFin.nights + overlap, revenue: prevFin.revenue + revenue });

			if (b.booked_utc && new Date(b.booked_utc) <= priorAsOf) {
				priorPtNights += overlap;
				priorPtRevenue += revenue;
				const prevPt = priorPtByProp.get(b.property_id) || { nights: 0, revenue: 0 };
				priorPtByProp.set(b.property_id, { nights: prevPt.nights + overlap, revenue: prevPt.revenue + revenue });
			}
		}

		const curOcc = availableNights > 0 ? curNights / availableNights : 0;
		const priorPtOcc = priorAvailableNights > 0 ? priorPtNights / priorAvailableNights : 0;
		const priorFinOcc = priorAvailableNights > 0 ? priorFinNights / priorAvailableNights : 0;

		months.push({
			month: tm.key,
			label: tm.label,
			daysInMonth: tm.days,
			totalAvailableNights: availableNights,
			current: { bookedNights: curNights, revenue: curRevenue, occupancy: curOcc },
			priorAtThisPoint: { bookedNights: priorPtNights, revenue: priorPtRevenue, occupancy: priorPtOcc },
			priorFinal: { bookedNights: priorFinNights, revenue: priorFinRevenue, occupancy: priorFinOcc },
			paceDelta: (curOcc - priorPtOcc) * 100,
		});

		// per-property detail
		const emptyBucket = { nights: 0, revenue: 0 };
		const byProperty: PacingProperty[] = properties.map(p => {
			const curr = curByProp.get(p.id) || emptyBucket;
			const priorPt = priorPtByProp.get(p.id) || emptyBucket;
			const priorFin = priorFinByProp.get(p.id) || emptyBucket;
			const propAvail = Math.max(0, tm.days - (blockedByProp.get(p.id) || 0));
			return {
				propertyId: p.id,
				propertyName: p.name,
				propertyCode: p.internal_code || null,
				currentNights: curr.nights,
				currentRevenue: curr.revenue,
				priorNightsAtThisPoint: priorPt.nights,
				priorRevenueAtThisPoint: priorPt.revenue,
				priorNightsFinal: priorFin.nights,
				priorRevenueFinal: priorFin.revenue,
				availableNights: propAvail,
				paceDelta: propAvail > 0 ? ((curr.nights / propAvail) - (priorPt.nights / propAvail)) * 100 : 0,
			};
		}).sort((a, b) => a.paceDelta - b.paceDelta); // worst-pacing first

		// booking curve: cumulative nights over time, aligned by daysOut from month start
		const todayDaysOut = Math.floor((today.getTime() - monthStart.getTime()) / MS_PER_DAY);

		type CurveInput = { daysOut: number; nights: number; revenue: number };
		const curveCurrentRaw: CurveInput[] = [];
		const curvePriorRaw: CurveInput[] = [];

		for (const b of currentMonthBookings) {
			if (!b.booked_utc) continue;
			const arr = new Date(b.arrival);
			const dep = new Date(b.departure);
			const totalNights = Math.max(1, Math.floor((dep.getTime() - arr.getTime()) / MS_PER_DAY));
			const overlap = computeOverlapNights(arr, dep, monthStart, nextMonthStart);
			if (overlap > 0) {
				curveCurrentRaw.push({
					daysOut: Math.floor((new Date(b.booked_utc).getTime() - monthStart.getTime()) / MS_PER_DAY),
					nights: overlap,
					revenue: (b.total_amount || 0) * (overlap / totalNights),
				});
			}
		}

		for (const b of priorMonthBookings) {
			if (!b.booked_utc) continue;
			const arr = new Date(b.arrival);
			const dep = new Date(b.departure);
			const totalNights = Math.max(1, Math.floor((dep.getTime() - arr.getTime()) / MS_PER_DAY));
			const overlap = computeOverlapNights(arr, dep, priorMonthStart, priorNextMonthStart);
			if (overlap > 0) {
				curvePriorRaw.push({
					daysOut: Math.floor((new Date(b.booked_utc).getTime() - priorMonthStart.getTime()) / MS_PER_DAY),
					nights: overlap,
					revenue: (b.total_amount || 0) * (overlap / totalNights),
				});
			}
		}

		curveCurrentRaw.sort((a, b) => a.daysOut - b.daysOut);
		curvePriorRaw.sort((a, b) => a.daysOut - b.daysOut);

		// merge into a single weekly-sampled curve
		const allDaysOut = [...curveCurrentRaw.map(p => p.daysOut), ...curvePriorRaw.map(p => p.daysOut)];
		if (allDaysOut.length === 0) {
			details[tm.key] = { byProperty, curve: [], todayDaysOut };
			continue;
		}

		const minD = Math.max(Math.min(...allDaysOut), -365);
		// extend curve to cover: today (current year) and full prior year arc
		// prior year bookings made during the month itself have daysOut > 0,
		// so we need maxD to reach those points for a smooth curve
		const maxPriorD = curvePriorRaw.length > 0
			? curvePriorRaw[curvePriorRaw.length - 1].daysOut  // already sorted
			: 0;
		const maxD = Math.max(todayDaysOut, 0, maxPriorD);

		const curve: PacingCurvePoint[] = [];
		let cumCN = 0, cumPN = 0;
		let cumCR = 0, cumPR = 0;
		let ci = 0, pi = 0;

		// skip points before our window
		while (ci < curveCurrentRaw.length && curveCurrentRaw[ci].daysOut < minD) {
			cumCN += curveCurrentRaw[ci].nights;
			cumCR += curveCurrentRaw[ci].revenue;
			ci++;
		}
		while (pi < curvePriorRaw.length && curvePriorRaw[pi].daysOut < minD) {
			cumPN += curvePriorRaw[pi].nights;
			cumPR += curvePriorRaw[pi].revenue;
			pi++;
		}

		const rangeSpan = maxD - minD;
		const step = rangeSpan > 180 ? 14 : 7;

		for (let d = minD; d <= maxD; d += step) {
			// current year: only accumulate up to today
			while (ci < curveCurrentRaw.length && curveCurrentRaw[ci].daysOut <= d && curveCurrentRaw[ci].daysOut <= todayDaysOut) {
				cumCN += curveCurrentRaw[ci].nights;
				cumCR += curveCurrentRaw[ci].revenue;
				ci++;
			}
			while (pi < curvePriorRaw.length && curvePriorRaw[pi].daysOut <= d) {
				cumPN += curvePriorRaw[pi].nights;
				cumPR += curvePriorRaw[pi].revenue;
				pi++;
			}
			curve.push({ daysOut: d, currentNights: cumCN, priorNights: cumPN, currentRevenue: cumCR, priorRevenue: cumPR });
		}

		details[tm.key] = { byProperty, curve, todayDaysOut };
	}

	return { months, details, propertyCount };
}
