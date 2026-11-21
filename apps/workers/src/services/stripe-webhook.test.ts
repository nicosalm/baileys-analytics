import { describe, it, expect, vi, beforeEach } from 'vitest';

// crypto.subtle.timingSafeEqual is a Workers extension; node lacks it
if (!(crypto.subtle as any).timingSafeEqual) {
  (crypto.subtle as any).timingSafeEqual = (a: Uint8Array, b: Uint8Array) =>
    a.byteLength === b.byteLength && a.every((v, i) => v === b[i]);
}

vi.mock('./tier-reconciliation', () => ({ DEFERRED_TIER_METADATA_KEY: 'deferred_tier_change' }));

const { StripeService } = await import('./stripe');

const SECRET = 'whsec_test';
const env = { STRIPE_SECRET_KEY: 'sk_test', STRIPE_WEBHOOK_SECRET: SECRET } as Env;

async function sign(payload: string) {
  const t = Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`));
  return `t=${t},v1=${Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

// Supabase fake: records writes, lets a test fail the subscriptions upsert and
// pretend an event row already exists with a given processed flag.
let existingEvent: { processed: boolean } | null;
let failSubscriptionUpsert: boolean;
let writes: string[];

function fakeSupabase(): any {
  return {
    from: (table: string) => {
      const q: any = {
        select: () => q,
        eq: () => q,
        is: () => q,
        insert: () => {
          writes.push(`insert:${table}`);
          if (table === 'stripe_webhook_events' && existingEvent) {
            return { select: () => ({ single: async () => ({ data: null, error: { code: '23505', message: 'duplicate' } }) }) };
          }
          return { select: () => ({ single: async () => ({ data: { id: 'e1' }, error: null }) }) };
        },
        upsert: async () => {
          writes.push(`upsert:${table}`);
          return { error: table === 'subscriptions' && failSubscriptionUpsert ? { message: 'db down' } : null };
        },
        update: (patch: any) => {
          writes.push(`update:${table}:${Object.keys(patch).join(',')}`);
          return q;
        },
        then: (resolve: any) => resolve({ error: null }),
        maybeSingle: async () => ({ data: table === 'stripe_webhook_events' ? existingEvent : null }),
        single: async () => ({ data: { first_subscription_at: '2026-01-01' } })
      };
      return q;
    }
  };
}

const subscriptionEvent = JSON.stringify({
  id: 'evt_1',
  type: 'customer.subscription.updated',
  data: {
    object: {
      id: 'sub_1',
      customer: 'cus_1',
      status: 'active',
      metadata: { tenant_id: 'tenant_a' },
      items: { data: [{ price: { id: 'price_1', unit_amount: 1000, recurring: { interval: 'month' }, metadata: { tier: 'starter' } } }] }
    }
  }
});

describe('Stripe webhook processing', () => {
  beforeEach(() => {
    existingEvent = null;
    failSubscriptionUpsert = false;
    writes = [];
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  const run = async (payload = subscriptionEvent) =>
    new StripeService(env, fakeSupabase()).handleWebhook(await sign(payload), payload);

  it('marks the event processed after a successful subscription write', async () => {
    await expect(run()).resolves.toEqual({ received: true });
    expect(writes).toContain('upsert:subscriptions');
    expect(writes.some(w => w.startsWith('update:stripe_webhook_events:processed'))).toBe(true);
  });

  it('throws (so Stripe retries) and leaves the event unprocessed when the subscription write fails', async () => {
    failSubscriptionUpsert = true;
    await expect(run()).rejects.toBeTruthy();
    expect(writes.some(w => w.startsWith('update:stripe_webhook_events:processed'))).toBe(false);
  });

  it('reprocesses a retried event whose first attempt failed', async () => {
    existingEvent = { processed: false };
    await run();
    expect(writes).toContain('upsert:subscriptions');
  });

  it('skips an event that was already processed', async () => {
    existingEvent = { processed: true };
    await expect(run()).resolves.toEqual({ received: true });
    expect(writes).not.toContain('upsert:subscriptions');
  });

  it('rejects a bad signature as a permanent error', async () => {
    const service = new StripeService(env, fakeSupabase());
    await expect(service.handleWebhook('t=1,v1=deadbeef', subscriptionEvent)).rejects.toThrow('Invalid signature');
  });
});
