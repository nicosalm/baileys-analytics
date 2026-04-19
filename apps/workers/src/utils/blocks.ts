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
export function mapToBlockRow(
	b: OwnerRezBlockLike,
	tenantId: string,
	updatedAt: string = new Date().toISOString(),
): BlockRow {
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
