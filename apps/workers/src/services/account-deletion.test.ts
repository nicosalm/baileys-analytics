import { describe, it, expect, vi, afterEach } from 'vitest';
import { requestTenantDeletion, purgeTenant } from './account-deletion';

const env = {} as Env;

function fakeSupabase(rpcResults: Array<{ data?: boolean; error?: { message: string } }>) {
	const calls: string[] = [];
	const q = (table: string): any => {
		const chain: any = {
			select: () => chain,
			eq: () => chain,
			single: async () => ({ data: { user_id: 'u1', email: 'a@x', company_name: null, deletion_requested_at: null }, error: null }),
			maybeSingle: async () => ({ data: null, error: null }),
			update: (patch: any) => {
				calls.push(`update ${table} ${Object.keys(patch).sort().join(',')}`);
				return chain;
			},
			delete: () => {
				calls.push(`delete ${table}`);
				return chain;
			},
			insert: async () => {
				calls.push(`insert ${table}`);
				return { error: null };
			},
			then: (resolve: any) => resolve({ count: 0, error: null }),
		};
		return chain;
	};
	return {
		calls,
		from: q,
		rpc: vi.fn(async () => rpcResults.shift() ?? { data: true }),
		auth: {
			admin: {
				deleteUser: async () => {
					calls.push('deleteUser');
					return { error: null };
				},
			},
		},
	} as any;
}

describe('account deletion', () => {
	afterEach(() => vi.restoreAllMocks());

	it('detaches the tenant (login, OwnerRez link, tokens) without touching bulk data', async () => {
		const supabase = fakeSupabase([]);
		await requestTenantDeletion(env, supabase, 't1', 'self');
		expect(supabase.calls).toEqual([
			'update tenants deletion_requested_at,ownerrez_connected,ownerrez_user_id,user_id',
			'delete oauth_tokens',
			'insert account_deletions',
			'deleteUser',
		]);
		expect(supabase.rpc).not.toHaveBeenCalled();
	});

	it('keeps calling purge_tenant_data until the tenant is gone', async () => {
		const supabase = fakeSupabase([{ data: false }, { data: false }, { data: true }]);
		expect(await purgeTenant(supabase, 't1')).toBe(true);
		expect(supabase.rpc).toHaveBeenCalledTimes(3);
	});

	it('stops on a lock or timeout error and leaves the rest for the cron', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const supabase = fakeSupabase([{ data: false }, { error: { message: 'canceling statement due to lock timeout' } }]);
		expect(await purgeTenant(supabase, 't1')).toBe(false);
		expect(supabase.rpc).toHaveBeenCalledTimes(2);
	});
});
