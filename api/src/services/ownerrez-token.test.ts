import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let rows: any[];
const updates: any[] = [];

vi.mock('./supabase', () => ({
	createSupabaseClient: () => ({
		from: () => {
			const q: any = {
				select: () => q,
				eq: () => q,
				single: async () => {
					const row = rows.shift();
					return row ? { data: row, error: null } : { data: null, error: { message: 'none' } };
				},
				update: (patch: any) => {
					updates.push(patch);
					return { eq: () => ({ eq: async () => ({ error: null }) }) };
				},
			};
			return q;
		},
	}),
}));

const { getValidOwnerRezToken } = await import('./ownerrez-token');

const env = { OWNERREZ_CLIENT_ID: 'c_id', OWNERREZ_CLIENT_SECRET: 's_secret' } as Env;
const inMs = (ms: number) => new Date(Date.now() + ms).toISOString();
const DAY = 24 * 60 * 60 * 1000;

describe('getValidOwnerRezToken', () => {
	beforeEach(() => {
		updates.length = 0;
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});
	afterEach(() => vi.restoreAllMocks());

	it('returns an unexpired token without calling OwnerRez', async () => {
		rows = [{ access_token: 'at_1', refresh_token: 'rt_1', expires_at: inMs(10 * DAY) }];
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		expect(await getValidOwnerRezToken(env, 't')).toEqual({ accessToken: 'at_1' });
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('returns a legacy permanent token (no refresh token) as-is', async () => {
		rows = [{ access_token: 'at_1', refresh_token: null, expires_at: inMs(-DAY) }];
		expect(await getValidOwnerRezToken(env, 't')).toEqual({ accessToken: 'at_1' });
	});

	it('refreshes an expired token and persists the rotated pair', async () => {
		rows = [{ access_token: 'at_old', refresh_token: 'rt_old', expires_at: inMs(-DAY) }];
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response(JSON.stringify({ access_token: 'at_new', refresh_token: 'rt_new', expires_in: 2592000 })));

		expect(await getValidOwnerRezToken(env, 't')).toEqual({ accessToken: 'at_new' });

		const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
		expect(url).toBe('https://api.ownerrez.com/oauth/access_token');
		expect(init.body).toBe('grant_type=refresh_token&refresh_token=rt_old');
		expect((init.headers as any).Authorization).toBe(`Basic ${btoa('c_id:s_secret')}`);
		expect(updates[0]).toMatchObject({ access_token: 'at_new', refresh_token: 'rt_new' });
		expect(new Date(updates[0].expires_at).getTime()).toBeGreaterThan(Date.now() + 29 * DAY);
	});

	it('keeps the current token when refresh fails before expiry', async () => {
		rows = [
			{ access_token: 'at_1', refresh_token: 'rt_1', expires_at: inMs(60 * 1000) },
			{ access_token: 'at_1', refresh_token: 'rt_1', expires_at: inMs(60 * 1000) },
		];
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('down', { status: 503 }));
		expect(await getValidOwnerRezToken(env, 't')).toEqual({ accessToken: 'at_1' });
	});

	it('uses a token rotated by a concurrent request when its own refresh loses the race', async () => {
		rows = [
			{ access_token: 'at_old', refresh_token: 'rt_old', expires_at: inMs(-DAY) },
			{ access_token: 'at_rotated', refresh_token: 'rt_rotated', expires_at: inMs(30 * DAY) },
		];
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('invalid_grant', { status: 400 }));
		expect(await getValidOwnerRezToken(env, 't')).toEqual({ accessToken: 'at_rotated' });
	});

	it('asks the user to reconnect when an expired token cannot be refreshed', async () => {
		rows = [
			{ access_token: 'at_1', refresh_token: 'rt_1', expires_at: inMs(-DAY) },
			{ access_token: 'at_1', refresh_token: 'rt_1', expires_at: inMs(-DAY) },
		];
		vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));
		const result = await getValidOwnerRezToken(env, 't');
		expect(result.error?.message).toMatch(/reconnect/);
	});

	it('reports a missing connection', async () => {
		rows = [];
		const result = await getValidOwnerRezToken(env, 't');
		expect(result.error?.message).toMatch(/No OwnerRez connection/);
	});
});
