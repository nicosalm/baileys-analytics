import { SupabaseClient } from '@supabase/supabase-js';

// returns booking IDs that match the given tags via either booking_tags or guest_tags.
// guest_tags are resolved through: guest_tags → guests → bookings (by ownerrez_guest_id).
// returns null if no matches found, so callers can return empty results.
export async function getBookingIdsForTags(
	supabase: SupabaseClient,
	tenantId: string,
	tagIds: string[]
): Promise<string[] | null> {
	const [bookingTagsResult, guestTagsResult] = await Promise.all([
		supabase.from('booking_tags').select('booking_id').in('tag_id', tagIds),
		supabase.from('guest_tags').select('guest_id').in('tag_id', tagIds)
	]);

	const bookingIds = new Set<string>();

	if (bookingTagsResult.data) {
		for (const bt of bookingTagsResult.data) {
			bookingIds.add(bt.booking_id);
		}
	}

	if (guestTagsResult.data && guestTagsResult.data.length > 0) {
		const guestIds = guestTagsResult.data.map(gt => gt.guest_id);

		const { data: guests } = await supabase
			.from('guests')
			.select('ownerrez_guest_id')
			.in('id', guestIds);

		if (guests && guests.length > 0) {
			const ownerrezGuestIds = guests
				.map(g => g.ownerrez_guest_id)
				.filter(Boolean);

			if (ownerrezGuestIds.length > 0) {
				const { data: guestBookings } = await supabase
					.from('bookings')
					.select('id')
					.eq('tenant_id', tenantId)
					.in('ownerrez_guest_id', ownerrezGuestIds);

				if (guestBookings) {
					for (const b of guestBookings) {
						bookingIds.add(b.id);
					}
				}
			}
		}
	}

	return bookingIds.size > 0 ? Array.from(bookingIds) : null;
}
