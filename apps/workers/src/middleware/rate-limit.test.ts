import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { rateLimit } from './rate-limit';

function memoryKV() {
  const store = new Map<string, string>();
  return {
    get: async (k: string, type?: string) => {
      const v = store.get(k);
      return v === undefined ? null : type === 'json' ? JSON.parse(v) : v;
    },
    put: async (k: string, v: string) => { store.set(k, v); }
  } as unknown as KVNamespace;
}

// mirrors index.ts
function buildApp() {
  const app = new Hono<{ Bindings: Env }>();
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
});
