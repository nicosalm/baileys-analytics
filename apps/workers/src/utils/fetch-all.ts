import { SUPABASE_MAX_ROWS } from '../constants';

// paginates a supabase query past the postgrest db-max-rows cap (10 000).
// the caller passes a factory that returns a fresh query builder on each
// invocation — the helper applies .range() and loops until a page comes
// back smaller than pageSize.
//
// usage:
//   const rows = await fetchAllRows(() =>
//     supabase.from('bookings').select('...').eq('tenant_id', id).order('id')
//   );

interface PageResult<T> {
	data: T[] | null;
	error: { message: string } | null;
}

type QueryBuilder<T> = {
	range: (from: number, to: number) => PromiseLike<PageResult<T>>;
};

export async function fetchAllRows<T>(
	buildQuery: () => QueryBuilder<T>,
	pageSize = SUPABASE_MAX_ROWS
): Promise<T[]> {
	const allRows: T[] = [];
	let offset = 0;
	for (;;) {
		const { data, error } = await buildQuery().range(offset, offset + pageSize - 1);
		if (error) throw new Error(`fetchAllRows: ${error.message}`);
		if (!data || data.length === 0) break;
		allRows.push(...data);
		if (data.length < pageSize) break;
		offset += pageSize;
	}
	return allRows;
}

// fetches rows filtered by a large .in() array that would exceed the
// postgrest URL length limit. splits the ids into chunks and runs
// parallel queries, then concatenates the results.
//
// usage:
//   const charges = await fetchChunked(bookingIds, ids =>
//     supabase.from('booking_charges').select('amount').in('booking_id', ids).eq('type', 'tax')
//   );

const IN_CHUNK_SIZE = 300;

export async function fetchChunked<T>(
	ids: string[],
	buildQuery: (chunkIds: string[]) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
	if (ids.length === 0) return [];
	if (ids.length <= IN_CHUNK_SIZE) {
		const { data, error } = await buildQuery(ids);
		if (error) throw new Error(`fetchChunked: ${error.message}`);
		return data || [];
	}
	const chunks: string[][] = [];
	for (let i = 0; i < ids.length; i += IN_CHUNK_SIZE) {
		chunks.push(ids.slice(i, i + IN_CHUNK_SIZE));
	}
	const results = await Promise.all(
		chunks.map(async chunk => {
			const { data, error } = await buildQuery(chunk);
			if (error) throw new Error(`fetchChunked: ${error.message}`);
			return data || [];
		})
	);
	return results.flat();
}
