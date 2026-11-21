import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import type { User } from '@supabase/supabase-js';
import type { AppEnv } from '../types';
import { rateLimit } from './rate-limit';

function memoryKV() {
	const store = new Map<string, string>();
	return {
		get: async (k: string, type?: string) => {
			const v = store.get(k);
			return v === undefined ? null : type === 'json' ? JSON.parse(v) : v;
		},
		put: async (k: string, v: string) => {
			store.set(k, v);
		},
	} as unknown as KVNamespace;
}

// mirrors index.ts; x-test-user stands in for authMiddleware
function buildApp() {
	const app = new Hono<AppEnv>();
	app.use('*', async (c, next) => {
		const id = c.req.header('x-test-user');
		if (id) c.set('user', { id } as User);
		await next();
	});
	app.use('/api/billing/create-checkout-session', rateLimit({ max: 20, windowMs: 60000 }));
	app.use('/api/sync/*', rateLimit({ max: 50, windowMs: 300000 }));
	app.use('/api/account/delete', rateLimit({ max: 3, windowMs: 300000 }));
	app.post('/api/sync/*', (c) => c.text('ok'));
	app.post('/api/account/delete', (c) => c.text('ok'));
	app.post('/api/billing/create-checkout-session', (c) => c.text('ok'));
	return app;
}

describe('rateLimit', () => {
	const headers = { 'CF-Connecting-IP': '1.2.3.4' };

	it("sync traffic doesn't consume the checkout or account-delete budgets", async () => {
		const app = buildApp();
		const env = { CACHE: memoryKV() } as Env;
		for (let i = 0; i < 40; i++) {
			await app.request(`/api/sync/bookings?offset=${i}`, { method: 'POST', headers }, env);
		}
		expect((await app.request('/api/billing/create-checkout-session', { method: 'POST', headers }, env)).status).toBe(200);
		expect((await app.request('/api/account/delete', { method: 'POST', headers }, env)).status).toBe(200);
	});

	it('still enforces each limit on its own route', async () => {
		const app = buildApp();
		const env = { CACHE: memoryKV() } as Env;
		const statuses = [];
		for (let i = 0; i < 4; i++) {
			statuses.push((await app.request('/api/account/delete', { method: 'POST', headers }, env)).status);
		}
		expect(statuses).toEqual([200, 200, 200, 429]);
	});

	it('counts all sync steps against one shared sync budget', async () => {
		const app = buildApp();
		const env = { CACHE: memoryKV() } as Env;
		let last = 0;
		for (let i = 0; i < 51; i++) {
			const step = ['properties', 'bookings', 'guests'][i % 3];
			last = (await app.request(`/api/sync/${step}`, { method: 'POST', headers }, env)).status;
		}
		expect(last).toBe(429);
	});

	it('gives each signed-in user their own budget behind a shared IP', async () => {
		const app = buildApp();
		const env = { CACHE: memoryKV() } as Env;
		const as = (user: string) => ({ method: 'POST', headers: { ...headers, 'x-test-user': user } });
		for (let i = 0; i < 3; i++) {
			await app.request('/api/account/delete', as('user-a'), env);
		}
		expect((await app.request('/api/account/delete', as('user-a'), env)).status).toBe(429);
		expect((await app.request('/api/account/delete', as('user-b'), env)).status).toBe(200);
	});
});
