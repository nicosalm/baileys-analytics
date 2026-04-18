import { SupabaseClient } from '@supabase/supabase-js';
import { MS_PER_DAY } from '../constants';
import { fetchAllRows } from '../utils/fetch-all';
import { getBookingIdsForTags } from '../utils/tag-filter';
import { computeOverlapNights } from '../utils/prorate';

// --- types ---

export interface PacingBucket {
	bookedNights: number;
	revenue: number;
	occupancy: number;
	adr: number;             // revenue / bookedNights (0 if no nights)
	revpar: number;          // revenue / availableNights (0 if no availability)
}

export interface PacingMonthSummary {
	month: string;           // YYYY-MM
	label: string;           // "May 2026"
	daysInMonth: number;
	totalAvailableNights: number;
	priorAvailableNights: number;
	current: PacingBucket;
	priorAtThisPoint: PacingBucket;
	priorFinal: PacingBucket;
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
	window: {
		mode: 'season' | 'rolling';
		label: string;          // "Summer Season 2026" or "Next 6 months"
		seasonName?: string;    // when mode = 'season'
		seasonYear?: number;    // year the season occurrence starts
	};
}

// --- helpers ---

function getDaysInMonth(year: number, month: number): number {
	return new Date(year, month + 1, 0).getDate();
}

function formatMonthLabel(year: number, month: number): string {
	return new Date(year, month, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function formatMonthKey(year: number, month: number): string {
	return `${year}-${String(month + 1).padStart(2, '0')}`;
}

interface SeasonConfig {
	name: string;
	start_month: number; // 1-12
	start_day: number;
	end_month: number;   // 1-12
	end_day: number;
}

// Pick the season occurrence that's current or next — i.e. the one whose end
// date hasn't passed yet. Cross-year seasons (e.g. Dec–Feb) are handled by
// treating the earlier end candidate first. All returned dates are UTC so
// comparisons against booking dates (UTC midnight from "YYYY-MM-DD") are
// timezone-agnostic — critical for local dev and for correctness under any
// potential non-UTC runtime.
function resolveSeasonOccurrence(s: SeasonConfig, today: Date): { start: Date; end: Date; year: number } {
	const year = today.getUTCFullYear();
	const sameYear = s.start_month <= s.end_month;

	const makeStart = (y: number) => new Date(Date.UTC(y, s.start_month - 1, s.start_day));
	const makeEnd = (y: number) => new Date(Date.UTC(y, s.end_month - 1, s.end_day, 23, 59, 59));

	if (sameYear) {
		const start = makeStart(year);
		const end = makeEnd(year);
		if (today > end) {
			return { start: makeStart(year + 1), end: makeEnd(year + 1), year: year + 1 };
		}
		return { start, end, year };
	}

	// cross-year (e.g. Dec–Feb)
	const endThisYear = makeEnd(year);
	if (today <= endThisYear) {
		return { start: makeStart(year - 1), end: endThisYear, year: year - 1 };
	}
	return { start: makeStart(year), end: makeEnd(year + 1), year };
}

type TargetMonth = {
	year: number; month: number; key: string; label: string; days: number;
	priorYear: number; priorDays: number;
};

function buildTargetMonths(from: Date, to: Date): TargetMonth[] {
	const out: TargetMonth[] = [];
	let y = from.getUTCFullYear();
	let m = from.getUTCMonth();
	const endY = to.getUTCFullYear();
	const endM = to.getUTCMonth();
	while (y < endY || (y === endY && m <= endM)) {
		const py = y - 1;
		out.push({
			year: y, month: m,
			key: formatMonthKey(y, m),
			label: formatMonthLabel(y, m),
			days: getDaysInMonth(y, m),
			priorYear: py,
			priorDays: getDaysInMonth(py, m),
		});
		if (m === 11) { y += 1; m = 0; } else { m += 1; }
	}
	return out;
}

// Shift a date by N years, clamping day for leap years (Feb 29 → Feb 28).
// Used to mirror the pacing window to the prior year for YoY comparison.
// Returns a UTC-normalized date so downstream comparisons against booking
// dates (which Postgres serializes as "YYYY-MM-DD" → UTC midnight) stay
// timezone-agnostic.
function shiftYears(d: Date, delta: number): Date {
	const year = d.getUTCFullYear() + delta;
	const month = d.getUTCMonth();
	const day = Math.min(d.getUTCDate(), getDaysInMonth(year, month));
	return new Date(Date.UTC(year, month, day));
}

// --- main ---

export async function getPacingData(
	supabase: SupabaseClient,
	tenantId: string,
	tagIds: string[] = [],
	filterPropertyIds: string[] = []
): Promise<PacingData> {
	// Anchor "today" at UTC midnight so every downstream date is timezone-agnostic.
	// Booking.arrival / departure are DATE columns serialized as "YYYY-MM-DD",
	// which JS parses as UTC midnight — keeping `today` in UTC aligns everything.
	const nowReal = new Date();
	const today = new Date(Date.UTC(nowReal.getUTCFullYear(), nowReal.getUTCMonth(), nowReal.getUTCDate()));

	const currentYear = today.getUTCFullYear();
	const currentMonth = today.getUTCMonth();

	// Fetch season config + active properties in parallel — both feed into the
	// per-month loop below but neither depends on the other. If the tenant has
	// an active season the pacing panel covers that season; otherwise falls
	// back to rolling 6 months.
	// ownerrez_id selected so we can filter the blocks table, which stores
	// block.property_id as the OwnerRez integer ID rather than our UUID.
	let propertiesQuery = supabase
		.from('properties')
		.select('id, name, internal_code, ownerrez_id')
		.eq('tenant_id', tenantId)
		.eq('active', true);

	if (filterPropertyIds.length > 0) {
		propertiesQuery = propertiesQuery.in('id', filterPropertyIds);
	}

	const [seasonRes, propertiesRes] = await Promise.all([
		supabase
			.from('season_configurations')
			.select('name, start_month, start_day, end_month, end_day')
			.eq('tenant_id', tenantId)
			.eq('is_active', true)
			.order('start_month', { ascending: true })
			.limit(1),
		propertiesQuery,
	]);

	const activeSeason: SeasonConfig | null = seasonRes.data && seasonRes.data.length > 0 ? seasonRes.data[0] : null;
	const properties = propertiesRes.data;

	let targetMonths: TargetMonth[];
	let windowInfo: PacingData['window'];
	// Clamped window bounds applied to every per-month computation below so that
	// partial-month season edges (e.g. Apr 25 – Nov 3) don't inflate the
	// available-nights denominator with days outside the season.
	let windowStart: Date;
	let windowEndExclusive: Date;

	if (activeSeason) {
		const occ = resolveSeasonOccurrence(activeSeason, today);
		const todayMonthStart = new Date(Date.UTC(currentYear, currentMonth, 1));
		const windowFrom = occ.start > todayMonthStart ? occ.start : todayMonthStart;
		targetMonths = buildTargetMonths(windowFrom, occ.end);
		windowStart = new Date(Date.UTC(windowFrom.getUTCFullYear(), windowFrom.getUTCMonth(), windowFrom.getUTCDate()));
		windowEndExclusive = new Date(Date.UTC(occ.end.getUTCFullYear(), occ.end.getUTCMonth(), occ.end.getUTCDate() + 1));
		const endYear = occ.end.getUTCFullYear();
		windowInfo = {
			mode: 'season',
			label: endYear !== occ.year
				? `${activeSeason.name} ${occ.year}–${endYear}`
				: `${activeSeason.name} ${occ.year}`,
			seasonName: activeSeason.name,
			seasonYear: occ.year,
		};
	} else {
		targetMonths = [];
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
		windowStart = new Date(Date.UTC(currentYear, currentMonth, 1));
		const lastTm = targetMonths[targetMonths.length - 1];
		windowEndExclusive = new Date(Date.UTC(
			lastTm.month === 11 ? lastTm.year + 1 : lastTm.year,
			(lastTm.month + 1) % 12, 1
		));
		windowInfo = { mode: 'rolling', label: 'Next 6 months' };
	}

	// Prior-year mirror of the window for YoY. Leap-day safe.
	const priorWindowStart = shiftYears(windowStart, -1);
	const priorWindowEndExclusive = shiftYears(windowEndExclusive, -1);

	if (!properties || properties.length === 0) {
		return { months: [], details: {}, propertyCount: 0, window: windowInfo };
	}

	const propertyCount = properties.length;
	const propertyIds = properties.map(p => p.id);

	// tag filtering
	let bookingIdFilter: string[] | null = null;
	if (tagIds.length > 0) {
		bookingIdFilter = await getBookingIdsForTags(supabase, tenantId, tagIds);
		if (!bookingIdFilter) {
			const emptyBucket: PacingBucket = { bookedNights: 0, revenue: 0, occupancy: 0, adr: 0, revpar: 0 };
			return {
				months: targetMonths.map(tm => ({
					month: tm.key, label: tm.label, daysInMonth: tm.days,
					totalAvailableNights: tm.days * propertyCount,
					priorAvailableNights: tm.priorDays * propertyCount,
					current: { ...emptyBucket }, priorAtThisPoint: { ...emptyBucket },
					priorFinal: { ...emptyBucket }, paceDelta: 0,
				})),
				details: {},
				propertyCount,
				window: windowInfo,
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
	const buildCurrentQuery = () => {
		let q = supabase.from('bookings')
			.select('id, arrival, departure, total_amount, property_id, booked_utc')
			.eq('tenant_id', tenantId).neq('status', 'canceled')
			.lte('arrival', currentTo).gte('departure', currentFrom)
			.in('property_id', propertyIds).order('id');
		if (bookingIdFilter) q = q.in('id', bookingIdFilter);
		return q;
	};

	const buildPriorQuery = () => {
		let q = supabase.from('bookings')
			.select('id, arrival, departure, total_amount, property_id, booked_utc')
			.eq('tenant_id', tenantId).neq('status', 'canceled')
			.lte('arrival', priorTo).gte('departure', priorFrom)
			.in('property_id', propertyIds).order('id');
		if (bookingIdFilter) q = q.in('id', bookingIdFilter);
		return q;
	};

	// blocks.property_id is the OwnerRez integer ID, not our internal UUID —
	// filter by the integer ids and translate results back to UUIDs below.
	const ownerrezIdToUuid = new Map<number, string>();
	const ownerrezIds: number[] = [];
	for (const p of properties) {
		const orId = p.ownerrez_id ? parseInt(p.ownerrez_id, 10) : NaN;
		if (!Number.isNaN(orId)) {
			ownerrezIdToUuid.set(orId, p.id);
			ownerrezIds.push(orId);
		}
	}

	const buildBlocksQuery = () => supabase
		.from('blocks')
		.select('property_id, arrival, departure')
		.eq('tenant_id', tenantId)
		.lte('arrival', currentTo)
		.gte('departure', currentFrom)
		.in('property_id', ownerrezIds)
		.order('id');

	const [currentBookings, priorBookings, blocksRaw] = await Promise.all([
		fetchAllRows(buildCurrentQuery),
		fetchAllRows(buildPriorQuery),
		// only run the blocks query when there are OwnerRez IDs to query against;
		// otherwise Supabase fails on an empty .in() with integer column type.
		ownerrezIds.length > 0 ? fetchAllRows(buildBlocksQuery) : Promise.resolve([]),
	]);

	// translate block.property_id (integer OwnerRez id) → internal UUID so
	// downstream blockedByProp lookups line up with properties.id
	const blocks = (blocksRaw as Array<{ property_id: number; arrival: string; departure: string }>)
		.map(bl => ({
			property_id: ownerrezIdToUuid.get(bl.property_id) ?? '',
			arrival: bl.arrival,
			departure: bl.departure,
		}))
		.filter(bl => bl.property_id !== '');

	// prior year "as of" date: today shifted back 1 year, clamped for leap days
	const priorAsOf = new Date(Date.UTC(
		today.getUTCFullYear() - 1,
		today.getUTCMonth(),
		Math.min(today.getUTCDate(), getDaysInMonth(today.getUTCFullYear() - 1, today.getUTCMonth())),
		23, 59, 59, 999
	));

	// process each target month
	const months: PacingMonthSummary[] = [];
	const details: Record<string, PacingMonthDetail> = {};

	for (const tm of targetMonths) {
		const monthStart = new Date(Date.UTC(tm.year, tm.month, 1));
		const nextMonthStart = new Date(Date.UTC(tm.month === 11 ? tm.year + 1 : tm.year, (tm.month + 1) % 12, 1));
		const priorMonthStart = new Date(Date.UTC(tm.priorYear, tm.month, 1));
		const priorNextMonthStart = new Date(Date.UTC(
			tm.month === 11 ? tm.priorYear + 1 : tm.priorYear,
			(tm.month + 1) % 12, 1
		));

		// Clamp each month's working window to the overall pacing window.
		// For a season Apr 25 – Nov 3, Apr's effective window is Apr 25 – May 1
		// and Nov's is Nov 1 – Nov 4. Middles are unchanged.
		const effMonthStart = windowStart > monthStart ? windowStart : monthStart;
		const effNextMonthStart = windowEndExclusive < nextMonthStart ? windowEndExclusive : nextMonthStart;
		const effDays = Math.max(0, Math.floor((effNextMonthStart.getTime() - effMonthStart.getTime()) / MS_PER_DAY));

		// Defensive: if the window doesn't actually overlap this calendar month, skip.
		// Prevents divide-by-zero and an empty card for a degenerate edge.
		if (effDays === 0) continue;

		const effPriorMonthStart = priorWindowStart > priorMonthStart ? priorWindowStart : priorMonthStart;
		const effPriorNextMonthStart = priorWindowEndExclusive < priorNextMonthStart ? priorWindowEndExclusive : priorNextMonthStart;
		const effPriorDays = Math.max(0, Math.floor((effPriorNextMonthStart.getTime() - effPriorMonthStart.getTime()) / MS_PER_DAY));

		// compute blocked nights per property for the effective window only
		const blockedByProp = new Map<string, number>();
		for (const bl of blocks) {
			const arr = new Date(bl.arrival);
			const dep = new Date(bl.departure);
			if (arr < effNextMonthStart && dep > effMonthStart) {
				const nights = computeOverlapNights(arr, dep, effMonthStart, effNextMonthStart);
				blockedByProp.set(bl.property_id, (blockedByProp.get(bl.property_id) || 0) + nights);
			}
		}
		let totalBlocked = 0;
		for (const n of blockedByProp.values()) totalBlocked += n;

		const availableNights = Math.max(0, effDays * propertyCount - totalBlocked);
		const priorAvailableNights = effPriorDays * propertyCount;

		// filter bookings overlapping each effective month window
		const currentMonthBookings = currentBookings.filter(b => {
			const arr = new Date(b.arrival);
			const dep = new Date(b.departure);
			return arr < effNextMonthStart && dep > effMonthStart;
		});

		const priorMonthBookings = priorBookings.filter(b => {
			const arr = new Date(b.arrival);
			const dep = new Date(b.departure);
			return arr < effPriorNextMonthStart && dep > effPriorMonthStart;
		});

		// accumulate current year
		let curNights = 0, curRevenue = 0;
		const curByProp = new Map<string, { nights: number; revenue: number }>();

		for (const b of currentMonthBookings) {
			const arr = new Date(b.arrival);
			const dep = new Date(b.departure);
			const totalNights = Math.max(1, Math.floor((dep.getTime() - arr.getTime()) / MS_PER_DAY));
			const overlap = computeOverlapNights(arr, dep, effMonthStart, effNextMonthStart);
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
			const overlap = computeOverlapNights(arr, dep, effPriorMonthStart, effPriorNextMonthStart);
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

		const bucket = (nights: number, rev: number, avail: number, occ: number): PacingBucket => ({
			bookedNights: nights,
			revenue: rev,
			occupancy: occ,
			adr: nights > 0 ? rev / nights : 0,
			revpar: avail > 0 ? rev / avail : 0,
		});

		months.push({
			month: tm.key,
			label: tm.label,
			daysInMonth: tm.days,
			totalAvailableNights: availableNights,
			priorAvailableNights,
			current: bucket(curNights, curRevenue, availableNights, curOcc),
			priorAtThisPoint: bucket(priorPtNights, priorPtRevenue, priorAvailableNights, priorPtOcc),
			priorFinal: bucket(priorFinNights, priorFinRevenue, priorAvailableNights, priorFinOcc),
			paceDelta: (curOcc - priorPtOcc) * 100,
		});

		// per-property detail (also uses effective-window day counts)
		const emptyBucket = { nights: 0, revenue: 0 };
		const byProperty: PacingProperty[] = properties.map(p => {
			const curr = curByProp.get(p.id) || emptyBucket;
			const priorPt = priorPtByProp.get(p.id) || emptyBucket;
			const priorFin = priorFinByProp.get(p.id) || emptyBucket;
			const propAvail = Math.max(0, effDays - (blockedByProp.get(p.id) || 0));
			const priorPropAvail = effPriorDays; // no prior-year block data
			const curPropOcc = propAvail > 0 ? curr.nights / propAvail : 0;
			const priorPtPropOcc = priorPropAvail > 0 ? priorPt.nights / priorPropAvail : 0;
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
				paceDelta: (curPropOcc - priorPtPropOcc) * 100,
			};
		}).sort((a, b) => a.paceDelta - b.paceDelta); // worst-pacing first

		// booking curve: cumulative nights over time, aligned by daysOut from
		// the effective month start (so a partial-month season edge anchors
		// correctly to when the season actually began in that month)
		const todayDaysOut = Math.floor((today.getTime() - effMonthStart.getTime()) / MS_PER_DAY);

		type CurveInput = { daysOut: number; nights: number; revenue: number };
		const curveCurrentRaw: CurveInput[] = [];
		const curvePriorRaw: CurveInput[] = [];

		for (const b of currentMonthBookings) {
			if (!b.booked_utc) continue;
			const arr = new Date(b.arrival);
			const dep = new Date(b.departure);
			const totalNights = Math.max(1, Math.floor((dep.getTime() - arr.getTime()) / MS_PER_DAY));
			const overlap = computeOverlapNights(arr, dep, effMonthStart, effNextMonthStart);
			if (overlap > 0) {
				curveCurrentRaw.push({
					daysOut: Math.floor((new Date(b.booked_utc).getTime() - effMonthStart.getTime()) / MS_PER_DAY),
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
			const overlap = computeOverlapNights(arr, dep, effPriorMonthStart, effPriorNextMonthStart);
			if (overlap > 0) {
				curvePriorRaw.push({
					daysOut: Math.floor((new Date(b.booked_utc).getTime() - effPriorMonthStart.getTime()) / MS_PER_DAY),
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

	return { months, details, propertyCount, window: windowInfo };
}
