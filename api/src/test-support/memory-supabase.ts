// a small in-memory stand-in for the supabase-js query builder, for tests that need to read
// back what the code under test wrote. it covers the filters and terminals this codebase uses.
type Row = Record<string, any>;
type Tables = Record<string, Row[]>;

class Query {
	private filters: Array<(row: Row) => boolean> = [];
	private mode: 'select' | 'update' | 'insert' | 'upsert' | 'delete' = 'select';
	private payload: any;
	private conflictKey: string | undefined;
	private head = false;
	private returning = false;

	constructor(
		private tables: Tables,
		private table: string,
	) {}

	select(_columns?: string, options?: { count?: string; head?: boolean }) {
		if (this.mode !== 'select') this.returning = true;
		if (options?.head) this.head = true;
		return this;
	}
	update(patch: Row) {
		this.mode = 'update';
		this.payload = patch;
		return this;
	}
	insert(rows: Row | Row[]) {
		this.mode = 'insert';
		this.payload = rows;
		return this;
	}
	upsert(rows: Row | Row[], options?: { onConflict?: string }) {
		this.mode = 'upsert';
		this.payload = rows;
		this.conflictKey = options?.onConflict;
		return this;
	}
	delete() {
		this.mode = 'delete';
		return this;
	}

	eq(column: string, value: unknown) {
		this.filters.push((r) => r[column] === value);
		return this;
	}
	neq(column: string, value: unknown) {
		this.filters.push((r) => r[column] !== value);
		return this;
	}
	in(column: string, values: unknown[]) {
		this.filters.push((r) => values.includes(r[column]));
		return this;
	}
	gte(column: string, value: any) {
		this.filters.push((r) => r[column] != null && r[column] >= value);
		return this;
	}
	lte(column: string, value: any) {
		this.filters.push((r) => r[column] != null && r[column] <= value);
		return this;
	}
	is(column: string, value: null | boolean) {
		this.filters.push((r) => (r[column] ?? null) === value);
		return this;
	}
	not(column: string, operator: 'is', value: null) {
		if (operator !== 'is') throw new Error(`memory-supabase: not(${operator}) is not supported`);
		this.filters.push((r) => (r[column] ?? null) !== value);
		return this;
	}

	private run(): { data: any; error: null; count?: number } {
		if (!this.tables[this.table]) this.tables[this.table] = [];
		const rows = this.tables[this.table];
		const matches = () => rows.filter((r) => this.filters.every((f) => f(r)));

		switch (this.mode) {
			case 'update': {
				const matched = matches();
				for (const row of matched) Object.assign(row, this.payload);
				return { data: this.returning ? matched.map((r) => ({ ...r })) : null, error: null };
			}
			case 'insert': {
				const added = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((r: Row) => ({ ...r }));
				rows.push(...added);
				return { data: added, error: null };
			}
			case 'upsert': {
				const key = this.conflictKey;
				const written = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((incoming: Row) => {
					const existing = key ? rows.find((r) => r[key] === incoming[key]) : undefined;
					if (existing) return Object.assign(existing, incoming);
					rows.push({ ...incoming });
					return incoming;
				});
				return { data: written, error: null };
			}
			case 'delete': {
				const doomed = new Set(matches());
				this.tables[this.table] = rows.filter((r) => !doomed.has(r));
				return { data: null, error: null };
			}
			default: {
				const matched = matches();
				return this.head
					? { data: null, error: null, count: matched.length }
					: { data: matched.map((r) => ({ ...r })), error: null, count: matched.length };
			}
		}
	}

	async single() {
		const { data } = this.run();
		const row = Array.isArray(data) ? (data[0] ?? null) : data;
		return { data: row, error: row ? null : { message: 'no rows' } };
	}
	async maybeSingle() {
		const { data } = this.run();
		return { data: Array.isArray(data) ? (data[0] ?? null) : data, error: null };
	}
	// awaiting the builder runs the query, as supabase-js does
	// biome-ignore lint/suspicious/noThenProperty: mirrors the thenable supabase-js builder
	then(resolve?: (value: any) => unknown, reject?: (reason: unknown) => unknown) {
		return Promise.resolve(this.run()).then(resolve, reject);
	}
}

export function memorySupabase(tables: Tables) {
	return { from: (table: string) => new Query(tables, table) } as any;
}
