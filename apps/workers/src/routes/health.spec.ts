import { describe, it, expect, vi } from 'vitest';

vi.mock('../services/supabase', () => ({
  createSupabaseClient: () => ({
    from: () => ({ select: () => ({ limit: async () => ({ error: null }) }) })
  })
}));

const { health } = await import('./health');

// mimics KV's documented limits: TTL >= 60s, one write per key per second
function kv(opts: { rateLimited?: boolean } = {}) {
  const store = new Map<string, string>();
  return {
    put: async (k: string, v: string, o?: { expirationTtl?: number }) => {
      if (o?.expirationTtl !== undefined && o.expirationTtl < 60) {
        throw new Error('KV PUT failed: 400 Invalid expiration_ttl of 10. Expiration TTL must be at least 60.');
      }
      if (opts.rateLimited) throw new Error('KV PUT failed: 429 Too Many Requests');
      store.set(k, v);
    },
    get: async (k: string) => store.get(k) ?? null
  } as unknown as KVNamespace;
}

describe('GET /health', () => {
  it('reports healthy with a working cache', async () => {
    const res = await health.request('/', {}, { CACHE: kv() } as Env);
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).cache).toBe('healthy');
  });

  it('treats a per-key write rate limit as healthy', async () => {
    const res = await health.request('/', {}, { CACHE: kv({ rateLimited: true }) } as Env);
    expect(res.status).toBe(200);
  });

  it('returns 503 when a dependency is actually down', async () => {
    const broken = { put: async () => { throw new Error('KV PUT failed: 500'); }, get: async () => null };
    const res = await health.request('/', {}, { CACHE: broken as unknown as KVNamespace } as Env);
    expect(res.status).toBe(503);
    expect(((await res.json()) as any).cache).toBe('unhealthy');
  });
});
