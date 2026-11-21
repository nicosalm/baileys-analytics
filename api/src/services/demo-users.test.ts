import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { purgeStaleDemoUsers } from './demo-users';

const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

function fakeSupabase(pages: Array<Array<{ id: string; is_anonymous: boolean; created_at: string }>>) {
	const deleted: string[] = [];
	const requested: number[] = [];
	const supabase = {
		auth: {
			admin: {
				listUsers: async ({ page }: { page: number }) => {
					requested.push(page);
					return { data: { users: pages[page - 1] ?? [] }, error: null };
				},
				deleteUser: async (id: string) => {
					deleted.push(id);
					return { data: {}, error: null };
				},
			},
		},
	} as unknown as SupabaseClient;
	return { supabase, deleted, requested };
}

describe('purgeStaleDemoUsers', () => {
	it('deletes only anonymous users older than 30 days', async () => {
		const { supabase, deleted } = fakeSupabase([
			[
				{ id: 'old-demo', is_anonymous: true, created_at: ago(45) },
				{ id: 'new-demo', is_anonymous: true, created_at: ago(2) },
				{ id: 'old-owner', is_anonymous: false, created_at: ago(400) },
			],
		]);
		expect(await purgeStaleDemoUsers(supabase, 10_000)).toBe(1);
		expect(deleted).toEqual(['old-demo']);
	});

	it('reads every page before stopping on a short one', async () => {
		const full = Array.from({ length: 1000 }, (_, i) => ({ id: `u${i}`, is_anonymous: false, created_at: ago(1) }));
		const { supabase, deleted, requested } = fakeSupabase([full, [{ id: 'last', is_anonymous: true, created_at: ago(60) }]]);
		await purgeStaleDemoUsers(supabase, 10_000);
		expect(requested).toEqual([1, 2]);
		expect(deleted).toEqual(['last']);
	});
});
