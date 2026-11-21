import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllRows } from './fetch-all';
import { MS_PER_DAY } from '../constants';

// shape of an OwnerRez booking/block entity as it arrives from the API or
// webhook payload. only the fields we persist into `blocks` are typed.
export interface OwnerRezBlockLike {
	id: number;
	property_id: number;
	arrival: string;
	departure: string;
	type?: string | null;
	reason?: string | null;
}

export interface BlockRow {
	ownerrez_block_id: number;
	tenant_id: string;
	property_id: number;
	arrival: string;
	departure: string;
	type: string;
	reason: string | null;
	updated_at: string;
}

// Produce a blocks-table row from an OwnerRez block entity. Written the same
// way in sync.ts, webhooks.ts, and admin.ts; centralized so the field list and
// type/reason defaults stay consistent. blocks.property_id is bigint (OwnerRez
// integer), not our UUID — writing a UUID here silently fails.
export function mapToBlockRow(b: OwnerRezBlockLike, tenantId: string, updatedAt: string = new Date().toISOString()): BlockRow {
	return {
		ownerrez_block_id: b.id,
		tenant_id: tenantId,
		property_id: b.property_id,
		arrival: b.arrival,
		departure: b.departure,
		type: b.type || 'block',
		reason: b.reason ?? null,
		updated_at: updatedAt,
	};
}

// Owner blocks (personal stays, maintenance, between-management gaps) aren't
// sellable inventory. Every period-scoped occupancy metric subtracts them from
// the denominator so operators aren't penalized for calendar decisions.
// quote_holds are intentionally excluded: tentative reservations attached to
// open OwnerRez quotes, not operator decisions, and the quote-delete webhook
// doesn't reach the blocks table so stale ones accumulate.
const OCCUPANCY_BLOCK_TYPE = 'block';

export interface TranslatedBlock {
	property_id: string; // internal UUID, translated from OwnerRez integer
	arrival: string;
	departure: string;
}

// Fetch owner blocks overlapping [from, to] and translate property_id from
// OwnerRez integer to internal UUID. Blocks whose ownerrez_id doesn't resolve
// (property deleted, missing ownerrez_id) are silently dropped.
export async function fetchBlocks(
	supabase: SupabaseClient,
	tenantId: string,
	from: string,
	to: string,
	restrictPropertyIds?: string[],
): Promise<TranslatedBlock[]> {
	let q = supabase.from('properties').select('id, ownerrez_id').eq('tenant_id', tenantId);
	if (restrictPropertyIds && restrictPropertyIds.length > 0) {
		q = q.in('id', restrictPropertyIds);
	}
	const { data: properties } = await q;
	if (!properties || properties.length === 0) return [];

	const uuidByOrId = new Map<number, string>();
	const orIds: number[] = [];
	for (const p of properties) {
		const orId = p.ownerrez_id ? parseInt(String(p.ownerrez_id), 10) : NaN;
		if (!Number.isNaN(orId)) {
			uuidByOrId.set(orId, p.id);
			orIds.push(orId);
		}
	}
	if (orIds.length === 0) return [];

	const raw = (await fetchAllRows(() =>
		supabase
			.from('blocks')
			.select('property_id, arrival, departure')
			.eq('tenant_id', tenantId)
			.eq('type', OCCUPANCY_BLOCK_TYPE)
			.lte('arrival', to)
			.gte('departure', from)
			.in('property_id', orIds)
			.order('id'),
	)) as Array<{ property_id: number; arrival: string; departure: string }>;

	const out: TranslatedBlock[] = [];
	for (const bl of raw) {
		const uuid = uuidByOrId.get(bl.property_id);
		if (uuid) out.push({ property_id: uuid, arrival: bl.arrival, departure: bl.departure });
	}
	return out;
}

// Count blocked nights per property within [windowStart, windowEndInclusive].
// Mirrors prorateBooking's inclusive-end signature. Callers in exclusive-end
// semantics (pacing month windows) use collectBlockedNightsExclusive.
export function collectBlockedNights(
	blocks: TranslatedBlock[],
	windowStart: Date | string,
	windowEndInclusive: Date | string,
): Map<string, number> {
	const ws = windowStart instanceof Date ? windowStart : new Date(windowStart);
	const weInc = windowEndInclusive instanceof Date ? windowEndInclusive : new Date(windowEndInclusive);
	const we = new Date(weInc.getTime() + MS_PER_DAY);
	return collectBlockedNightsExclusive(blocks, ws, we);
}

// Count unique blocked nights per property within [windowStart, windowEndExclusive).
// Blocks for the same property may overlap on the calendar; a single night can
// only be unavailable once, so the union of nights is what counts (not the sum).
export function collectBlockedNightsExclusive(blocks: TranslatedBlock[], windowStart: Date, windowEndExclusive: Date): Map<string, number> {
	const wsEpoch = Math.floor(windowStart.getTime() / MS_PER_DAY);
	const weEpoch = Math.floor(windowEndExclusive.getTime() / MS_PER_DAY);
	const daysByProp = new Map<string, Set<number>>();
	for (const bl of blocks) {
		const bStart = Math.max(Math.floor(new Date(bl.arrival).getTime() / MS_PER_DAY), wsEpoch);
		const bEnd = Math.min(Math.floor(new Date(bl.departure).getTime() / MS_PER_DAY), weEpoch);
		if (bStart >= bEnd) continue;
		let set = daysByProp.get(bl.property_id);
		if (!set) {
			set = new Set<number>();
			daysByProp.set(bl.property_id, set);
		}
		for (let d = bStart; d < bEnd; d++) set.add(d);
	}
	const out = new Map<string, number>();
	for (const [pid, set] of daysByProp) out.set(pid, set.size);
	return out;
}

export function sumBlockedNights(map: Map<string, number>): number {
	let total = 0;
	for (const n of map.values()) total += n;
	return total;
}

// Build a per-day index of which properties are blocked on each epoch-day.
// Used by daily-granularity charts that subtract blocked properties from the
// denominator one bucket at a time, independent of the per-property map.
export function buildDailyBlockGrid(blocks: TranslatedBlock[], startEpoch: number, endEpoch: number): Map<number, Set<string>> {
	const grid = new Map<number, Set<string>>();
	for (const bl of blocks) {
		const bStart = Math.max(Math.floor(new Date(bl.arrival).getTime() / MS_PER_DAY), startEpoch);
		const bEnd = Math.min(Math.floor(new Date(bl.departure).getTime() / MS_PER_DAY), endEpoch + 1);
		for (let d = bStart; d < bEnd; d++) {
			let set = grid.get(d);
			if (!set) {
				set = new Set();
				grid.set(d, set);
			}
			set.add(bl.property_id);
		}
	}
	return grid;
}
