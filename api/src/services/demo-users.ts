import type { SupabaseClient } from '@supabase/supabase-js';

// every "try the demo" click creates an anonymous auth user, and nothing else removes
// them. matches the cutoff in supabase's anonymous sign-in guide; a visitor who comes
// back later is signed out and can start the demo again.
const DEMO_USER_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const PAGE_SIZE = 1000;

// the admin API can't filter by is_anonymous, so this pages through every user.
// anonymous users own no rows outside the auth schema, which cascades on delete.
export async function purgeStaleDemoUsers(supabase: SupabaseClient, budgetMs: number): Promise<number> {
	const deadline = Date.now() + budgetMs;
	const cutoff = Date.now() - DEMO_USER_MAX_AGE_MS;
	const stale: string[] = [];

	for (let page = 1; Date.now() < deadline; page++) {
		const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
		if (error) {
			console.error('Failed to list users for demo cleanup:', error);
			return 0;
		}
		for (const user of data.users) {
			if (user.is_anonymous && Date.parse(user.created_at) < cutoff) stale.push(user.id);
		}
		if (data.users.length < PAGE_SIZE) break;
	}

	let deleted = 0;
	for (const id of stale) {
		if (Date.now() >= deadline) break;
		const { error } = await supabase.auth.admin.deleteUser(id);
		if (error) console.error(`Failed to delete demo user ${id}:`, error);
		else deleted++;
	}
	return deleted;
}
