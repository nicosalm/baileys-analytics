import { SupabaseClient } from '@supabase/supabase-js';
import { normalizePlatform } from '../utils/platform';

export interface InquiryItem {
	id: string;
	ownerrezInquiryId: number;
	guestName: string | null;
	guestEmail: string | null;
	propertyName: string | null;
	propertyId: string | null;
	arrival: string | null;
	departure: string | null;
	source: string | null;
	listingSite: string | null;
	comments: string | null;
	guests: number | null;
	createdAt: string | null;
	updatedAt: string | null;
}

export interface InquiriesData {
	inquiries: InquiryItem[];
	totalCount: number;
}

export async function getInquiriesData(
	supabase: SupabaseClient,
	tenantId: string,
	from?: string,
	to?: string
): Promise<InquiriesData> {
	// inquiries.property_id is an ownerrez numeric id, not a uuid fk
	// we need to join through properties.ownerrez_id to get the property name
	const { data: properties } = await supabase
		.from('properties')
		.select('id, name, ownerrez_id')
		.eq('tenant_id', tenantId);

	const propertyByOrId = new Map<string, { id: string; name: string }>();
	if (properties) {
		for (const p of properties) {
			if (p.ownerrez_id) {
				propertyByOrId.set(String(p.ownerrez_id), { id: p.id, name: p.name });
			}
		}
	}

	let query = supabase
		.from('inquiries')
		.select('id, ownerrez_inquiry_id, guest_name, guest_email, property_id, arrival, departure, status, data, created_at, updated_at')
		.eq('tenant_id', tenantId)
		.order('created_at', { ascending: false })
		.limit(200);

	if (from && to) {
		query = query.gte('created_at', `${from}T00:00:00Z`).lte('created_at', `${to}T23:59:59Z`);
	}

	const { data: inquiries, error } = await query;

	if (error || !inquiries) {
		return { inquiries: [], totalCount: 0 };
	}

	return {
		inquiries: inquiries.map(inq => {
			const prop = inq.property_id ? propertyByOrId.get(String(inq.property_id)) : null;
			const data = inq.data as Record<string, unknown> | null;
			// prefer the actual OwnerRez timestamp over the DB column
			// (created_at may have been set to the sync date if the OR fields were missing)
			const receivedAt = (data?.created_utc as string)
				?? (data?.received_utc as string)
				?? inq.created_at;
			return {
				id: inq.id,
				ownerrezInquiryId: inq.ownerrez_inquiry_id,
				guestName: inq.guest_name,
				guestEmail: inq.guest_email,
				propertyName: prop?.name ?? null,
				propertyId: prop?.id ?? null,
				arrival: inq.arrival,
				departure: inq.departure,
				source: inq.status,
				listingSite: data?.listing_site ? normalizePlatform(data.listing_site as string) : null,
				comments: (data?.comments as string) ?? null,
				guests: (data?.guests as number) ?? null,
				createdAt: receivedAt,
				updatedAt: inq.updated_at,
			};
		}),
		totalCount: inquiries.length,
	};
}
