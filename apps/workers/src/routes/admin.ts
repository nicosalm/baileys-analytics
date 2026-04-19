import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { authMiddleware } from '../middleware/auth';
import { OwnerRezService } from '../services/ownerrez';
import { getValidOwnerRezToken } from '../services/ownerrez-token';
import { mapToBlockRow } from '../utils/blocks';

const admin = new Hono<{ Bindings: Env; Variables: { user: any; tenantId: string } }>();

// admin middleware - check if user is admin
const adminMiddleware = async (c: any, next: any) => {
  const user = c.get('user');

  // check if user email is in admin whitelist (case-insensitive)
  const adminEmails = c.env.ADMIN_EMAILS?.split(',').map((e: string) => e.trim().toLowerCase()) || [];
  const userEmail = user.email?.toLowerCase() || '';

  if (!adminEmails.includes(userEmail)) {
    return c.json({ error: 'Not found' }, 404);
  }

  await next();
};

// verify admin status endpoint
admin.get('/verify', authMiddleware, async (c) => {
  const user = c.get('user');
  const adminEmails = c.env.ADMIN_EMAILS?.split(',').map((e: string) => e.trim().toLowerCase()) || [];
  const userEmail = user.email?.toLowerCase() || '';

  return c.json({ isAdmin: adminEmails.includes(userEmail) });
});

// get system metrics
admin.get('/metrics', authMiddleware, adminMiddleware, async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  try {
    // db counts + exempt tenants
    const [
      { count: totalTenants },
      { count: totalProperties },
      { count: totalBookings },
      { count: exemptCount },
    ] = await Promise.all([
      supabase.from('tenants').select('id', { count: 'exact', head: true }),
      supabase.from('properties').select('id', { count: 'exact', head: true }),
      supabase.from('bookings').select('id', { count: 'exact', head: true }),
      supabase.from('tenants').select('id', { count: 'exact', head: true }).eq('subscription_exempt', true),
    ]);

    // fetch active subscriptions from stripe for accurate MRR + tier breakdown
    let mrr = 0;
    const tierCounts: Record<string, number> = {};
    let activeSubCount = 0;

    if (c.env.STRIPE_SECRET_KEY) {
      const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
        apiVersion: '2025-10-29.clover',
        httpClient: Stripe.createFetchHttpClient()
      });

      const subs = await stripe.subscriptions.list({ status: 'active', limit: 100 });

      for (const sub of subs.data) {
        const priceObj = sub.items.data[0]?.price;
        const cents = priceObj?.unit_amount ?? 0;
        const interval = priceObj?.recurring?.interval;
        const tier = (priceObj?.metadata?.tier as string) || 'legacy';

        if (interval === 'month') {
          mrr += cents / 100;
        } else if (interval === 'year') {
          mrr += cents / 100 / 12;
        }

        tierCounts[tier] = (tierCounts[tier] || 0) + 1;
        activeSubCount++;
      }
    }

    const inactive = Math.max(0, (totalTenants || 0) - activeSubCount - (exemptCount || 0));

    const subscriptionMix = [
      ...Object.entries(tierCounts).map(([tier, count]) => ({ tier, count })),
      ...(exemptCount ? [{ tier: 'exempt', count: exemptCount }] : []),
      ...(inactive > 0 ? [{ tier: 'inactive', count: inactive }] : []),
    ];

    // recent signups (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { count: recentSignups } = await supabase
      .from('tenants')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString());

    return c.json({
      metrics: {
        totalUsers: totalTenants || 0,
        totalTenants: totalTenants || 0,
        totalProperties: totalProperties || 0,
        totalBookings: totalBookings || 0,
        activeSubscriptions: activeSubCount,
        mrr: Math.round(mrr),
        recentSignups: recentSignups || 0,
        subscriptionMix,
      }
    });
  } catch (error) {
    console.error('Failed to get admin metrics:', error);
    return c.json({ error: 'Failed to get metrics' }, 500);
  }
});

// list all users
admin.get('/users', authMiddleware, adminMiddleware, async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '50');
  const search = c.req.query('search') || '';

  try {
    let query = supabase
      .from('tenants')
      .select(`
        id,
        email,
        company_name,
        created_at,
        subscription_status,
        subscription_exempt,
        ownerrez_connected,
        first_subscription_at
      `)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (search) {
      // sanitize search input to prevent postgrest filter injection
      const sanitized = search.replace(/[^a-zA-Z0-9@._\-+\s]/g, '');
      if (sanitized) {
        query = query.ilike('email', `%${sanitized}%`);
      }
    }

    const { data: users, error } = await query;

    if (error) throw error;

    // get subscription details for each user
    const enrichedUsers = await Promise.all(
      (users || []).map(async (user) => {
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('billing_cycle, status, current_period_end')
          .eq('tenant_id', user.id)
          .single();

        return {
          ...user,
          subscription
        };
      })
    );

    return c.json({ users: enrichedUsers });
  } catch (error) {
    console.error('Failed to list users:', error);
    return c.json({ error: 'Failed to list users' }, 500);
  }
});

// get single user details
admin.get('/users/:tenantId', authMiddleware, adminMiddleware, async (c) => {
  const tenantId = c.req.param('tenantId');
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  try {
    const [
      { data: tenant },
      { data: subscription },
      { count: propertiesCount },
      { count: bookingsCount },
      { data: syncStatus }
    ] = await Promise.all([
      supabase.from('tenants').select('*').eq('id', tenantId).single(),
      supabase.from('subscriptions').select('*').eq('tenant_id', tenantId).single(),
      supabase.from('properties').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('sync_status').select('*').eq('tenant_id', tenantId)
    ]);

    return c.json({
      tenant,
      subscription,
      stats: {
        properties: propertiesCount || 0,
        bookings: bookingsCount || 0
      },
      syncStatus
    });
  } catch (error) {
    console.error('Failed to get user details:', error);
    return c.json({ error: 'Failed to get user details' }, 500);
  }
});

// grant subscription exemption
admin.post('/users/:tenantId/exempt', authMiddleware, adminMiddleware, async (c) => {
  const tenantId = c.req.param('tenantId');
  const body = await c.req.json();
  const exempt = body.exempt;

  // validate exempt is a boolean
  if (typeof exempt !== 'boolean') {
    return c.json({ error: 'Invalid request: exempt must be a boolean' }, 400);
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  try {
    const { error } = await supabase
      .from('tenants')
      .update({
        subscription_exempt: exempt,
        updated_at: new Date().toISOString()
      })
      .eq('id', tenantId);

    if (error) throw error;

    return c.json({ success: true, message: exempt ? 'Exemption granted' : 'Exemption revoked' });
  } catch (error) {
    console.error('Failed to update exemption:', error);
    return c.json({ error: 'Failed to update exemption' }, 500);
  }
});

// delete user account (admin only)
admin.delete('/users/:tenantId', authMiddleware, adminMiddleware, async (c) => {
  const tenantId = c.req.param('tenantId');
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  try {
    // get the user_id from tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('user_id, email, company_name')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      return c.json({ error: 'Tenant not found' }, 404);
    }

    const userId = tenant.user_id;

    // 1. cancel stripe subscription FIRST — if this fails we must abort the
    // deletion so the customer is not left being billed for a wiped account.
    // runs before the audit log and before any destructive db work.
    if (c.env.STRIPE_SECRET_KEY) {
      const { data: customer } = await supabase
        .from('stripe_customers')
        .select('stripe_customer_id')
        .eq('tenant_id', tenantId)
        .single();

      if (customer?.stripe_customer_id) {
        try {
          const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
            apiVersion: '2025-10-29.clover',
            httpClient: Stripe.createFetchHttpClient()
          });

          const subscriptions = await stripe.subscriptions.list({
            customer: customer.stripe_customer_id,
          });

          // cancel all non-terminal subscriptions
          const cancelable = subscriptions.data.filter(s =>
            ['active', 'trialing', 'past_due'].includes(s.status)
          );

          for (const sub of cancelable) {
            await stripe.subscriptions.cancel(sub.id);
          }
        } catch (stripeError) {
          // If the customer itself no longer exists in Stripe (test-mode wipe,
          // env swap, manual deletion), there's nothing being billed, so we can
          // proceed with the deletion. Any other Stripe error still aborts so
          // we never leave a live customer being charged for a wiped tenant.
          const isMissingResource = stripeError instanceof Stripe.errors.StripeInvalidRequestError
            && stripeError.code === 'resource_missing';
          if (!isMissingResource) {
            console.error('Failed to cancel stripe subscription during admin account deletion:', stripeError);
            return c.json({
              error: 'Could not cancel the tenant\'s Stripe subscription. The account was not deleted to prevent continued billing. Retry in a few minutes or cancel the subscription manually in Stripe first.',
              code: 'STRIPE_CANCELLATION_FAILED'
            }, 500);
          }
          console.warn(`Stripe customer ${customer.stripe_customer_id} not found; proceeding with deletion.`);
        }
      }
    }

    // 2. audit log — snapshot before deletion (after stripe cancel so we only
    // record deletions we are actually going to complete)
    const adminEmail = c.get('user').email || 'unknown';
    const [{ count: propCount }, { count: bookCount }, { data: sub }] = await Promise.all([
      supabase.from('properties').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('subscriptions').select('status').eq('tenant_id', tenantId).single(),
    ]);

    await supabase.from('account_deletions').insert({
      tenant_id: tenantId,
      email: tenant.email,
      company_name: tenant.company_name,
      deleted_by: adminEmail,
      property_count: propCount || 0,
      booking_count: bookCount || 0,
      had_active_subscription: sub?.status === 'active',
    });

    // 3. delete all tenant data atomically via RPC
    const { error: deleteDataError } = await supabase.rpc('delete_tenant_data', {
      p_tenant_id: tenantId
    });

    if (deleteDataError) {
      console.error('Failed to delete tenant data:', deleteDataError);
      return c.json({ error: 'Failed to delete tenant data' }, 500);
    }

    // 4. delete auth user
    if (userId) {
      const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);
      if (deleteUserError) {
        console.error('Failed to delete auth user:', deleteUserError);
      }
    }

    return c.json({
      success: true,
      message: `Account ${tenant.email} deleted successfully`
    });
  } catch (error) {
    console.error('Failed to delete account:', error);
    return c.json({
      error: 'Failed to delete account',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// signup trend — daily signups for last N days
admin.get('/signup-trend', authMiddleware, adminMiddleware, async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const days = Math.min(parseInt(c.req.query('days') || '30'), 90);

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: tenants } = await supabase
      .from('tenants')
      .select('created_at')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    // bucket by date
    const buckets: Record<string, number> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      buckets[d.toISOString().slice(0, 10)] = 0;
    }

    for (const t of tenants || []) {
      const day = t.created_at.slice(0, 10);
      if (buckets[day] !== undefined) buckets[day]++;
    }

    const trend = Object.entries(buckets).map(([date, count]) => ({ date, count }));
    return c.json({ trend });
  } catch (error) {
    console.error('Failed to get signup trend:', error);
    return c.json({ error: 'Failed to get signup trend' }, 500);
  }
});

// sync health — aggregate sync status across all tenants
admin.get('/sync-health', authMiddleware, adminMiddleware, async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  try {
    const { data: syncRows } = await supabase
      .from('sync_status')
      .select('tenant_id, sync_type, status, last_sync, records_synced');

    // group by tenant
    const byTenant: Record<string, { statuses: string[]; lastSync: string | null; totalRecords: number }> = {};
    for (const row of syncRows || []) {
      if (!byTenant[row.tenant_id]) {
        byTenant[row.tenant_id] = { statuses: [], lastSync: null, totalRecords: 0 };
      }
      byTenant[row.tenant_id].statuses.push(row.status);
      byTenant[row.tenant_id].totalRecords += row.records_synced || 0;
      if (!byTenant[row.tenant_id].lastSync || row.last_sync > byTenant[row.tenant_id].lastSync!) {
        byTenant[row.tenant_id].lastSync = row.last_sync;
      }
    }

    // classify each tenant
    let healthy = 0;
    let partial = 0;
    let failing = 0;
    let noSync = 0;
    let stale = 0;

    const now = Date.now();
    const staleThreshold = 48 * 60 * 60 * 1000; // 48 hours

    // get total tenants with ownerrez connected
    const { count: connectedTenants } = await supabase
      .from('tenants')
      .select('id', { count: 'exact', head: true })
      .eq('ownerrez_connected', true);

    const tenantsWithSync = new Set(Object.keys(byTenant));

    for (const [, info] of Object.entries(byTenant)) {
      const hasFailure = info.statuses.includes('failure');
      const hasPartial = info.statuses.includes('partial');
      const isStale = info.lastSync && (now - new Date(info.lastSync).getTime()) > staleThreshold;

      if (isStale) stale++;
      else if (hasFailure) failing++;
      else if (hasPartial) partial++;
      else healthy++;
    }

    // tenants with ownerrez connected but no sync records
    noSync = Math.max(0, (connectedTenants || 0) - tenantsWithSync.size);

    return c.json({
      syncHealth: { healthy, partial, failing, stale, noSync },
      totalConnected: connectedTenants || 0
    });
  } catch (error) {
    console.error('Failed to get sync health:', error);
    return c.json({ error: 'Failed to get sync health' }, 500);
  }
});

// get recent errors (from logs or webhook events)
admin.get('/errors', authMiddleware, adminMiddleware, async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  try {
    // get failed webhook events as proxy for errors
    const { data: errors } = await supabase
      .from('webhook_events')
      .select('*')
      .not('processing_error', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);

    return c.json({ errors: errors || [] });
  } catch (error) {
    console.error('Failed to get errors:', error);
    return c.json({ error: 'Failed to get errors' }, 500);
  }
});

// reset initial sync state for a tenant and return an impersonation link.
// the impersonated tab will auto-run the client-side sync flow because
// initial_sync_needed is marked pending.
admin.post('/users/:tenantId/reset-sync', authMiddleware, adminMiddleware, async (c) => {
  const tenantId = c.req.param('tenantId');
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  try {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('email')
      .eq('id', tenantId)
      .single();

    if (!tenant?.email) {
      return c.json({ error: 'Tenant not found' }, 404);
    }

    await supabase
      .from('sync_status')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('sync_type', 'initial_sync_completed');

    await supabase
      .from('sync_status')
      .upsert({
        tenant_id: tenantId,
        sync_type: 'initial_sync_needed',
        last_sync: new Date().toISOString(),
        status: 'pending',
        records_synced: 0
      }, { onConflict: 'tenant_id,sync_type' });

    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: tenant.email,
      options: {
        redirectTo: `${c.env.FRONTEND_URL}/auth/callback?impersonate=1&sync=initial`,
      },
    });

    if (error || !data?.properties?.action_link) {
      console.error('Failed to generate impersonation link for resync:', error);
      return c.json({ error: 'Sync reset, but failed to generate impersonation link' }, 500);
    }

    return c.json({ success: true, url: data.properties.action_link });
  } catch (error) {
    console.error('Failed to reset sync:', error);
    return c.json({ error: 'Failed to reset sync' }, 500);
  }
});

// impersonate user — generate a magic link to log in as them
admin.post('/users/:tenantId/impersonate', authMiddleware, adminMiddleware, async (c) => {
  const tenantId = c.req.param('tenantId');
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  try {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('email')
      .eq('id', tenantId)
      .single();

    if (!tenant?.email) {
      return c.json({ error: 'Tenant not found' }, 404);
    }

    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: tenant.email,
      options: {
        redirectTo: `${c.env.FRONTEND_URL}/auth/callback?impersonate=1`,
      },
    });

    if (error || !data?.properties?.action_link) {
      console.error('Failed to generate impersonation link:', error);
      return c.json({ error: 'Failed to generate link' }, 500);
    }

    return c.json({ url: data.properties.action_link });
  } catch (error) {
    console.error('Failed to impersonate user:', error);
    return c.json({ error: 'Failed to impersonate' }, 500);
  }
});

// Refresh blocks for a single tenant by re-fetching from OwnerRez.
// Covers cases where the blocks table drifts from OwnerRez: dropped webhooks,
// retry ceiling exceeded, interrupted initial sync. Default window is 1y back
// to 2y forward; large tenants can narrow via ?from=YYYY-MM-DD&to=YYYY-MM-DD
// to stay under the cloudflare edge timeout.
admin.post('/users/:tenantId/refresh-blocks', authMiddleware, adminMiddleware, async (c) => {
  const tenantId = c.req.param('tenantId');
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  const tokenResult = await getValidOwnerRezToken(c.env, tenantId);
  if (tokenResult.error) {
    return c.json({ error: tokenResult.error.message }, tokenResult.error.status);
  }

  const { data: properties, error: propError } = await supabase
    .from('properties')
    .select('ownerrez_id')
    .eq('tenant_id', tenantId);

  if (propError) {
    console.error('Failed to load properties for block refresh:', propError);
    return c.json({ error: 'Failed to load properties' }, 500);
  }

  const orPropertyIds = (properties || [])
    .map(p => p.ownerrez_id)
    .filter((id): id is string => !!id);

  if (orPropertyIds.length === 0) {
    return c.json({ error: 'Tenant has no OwnerRez-linked properties' }, 400);
  }

  // integer set so we can reject orphan blocks that reference properties
  // we no longer have (deleted / deactivated since last property sync)
  const knownIntIds = new Set(
    orPropertyIds.map(id => parseInt(id, 10)).filter(n => !Number.isNaN(n))
  );

  // default window: 1y back, 2y forward. Overridable via ?from=YYYY-MM-DD&to=YYYY-MM-DD
  // for large tenants that would otherwise exceed the cloudflare edge timeout.
  const now = new Date();
  const qFrom = c.req.query('from');
  const qTo = c.req.query('to');
  const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  const from = qFrom && isValidDate(qFrom)
    ? qFrom
    : new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const to = qTo && isValidDate(qTo)
    ? qTo
    : new Date(Date.UTC(now.getUTCFullYear() + 2, now.getUTCMonth(), 1)).toISOString().slice(0, 10);

  const ownerRez = new OwnerRezService(tokenResult.accessToken, c.env.CACHE);

  let items: any[];
  try {
    items = await ownerRez.fetchBookings(orPropertyIds, from, to);
  } catch (err) {
    console.error('OwnerRez fetch failed during block refresh:', err);
    return c.json({ error: 'Failed to fetch from OwnerRez' }, 502);
  }

  const nowIso = new Date().toISOString();
  const blocks = items
    .filter(b => (b.is_block || b.type === 'block') && knownIntIds.has(Number(b.property_id)))
    .map(b => mapToBlockRow(b, tenantId, nowIso));

  if (blocks.length === 0) {
    return c.json({
      success: true,
      fetched: items.length,
      blocks: 0,
      propertiesScanned: orPropertyIds.length,
      range: { from, to }
    });
  }

  const CHUNK_SIZE = 500;
  let upserted = 0;
  for (let i = 0; i < blocks.length; i += CHUNK_SIZE) {
    const chunk = blocks.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase
      .from('blocks')
      .upsert(chunk, { onConflict: 'ownerrez_block_id,tenant_id' });
    if (error) {
      console.error('Block upsert failed during admin refresh:', error);
      return c.json({ error: 'Upsert failed', upserted, fetched: items.length }, 500);
    }
    upserted += chunk.length;
  }

  return c.json({
    success: true,
    fetched: items.length,
    blocks: upserted,
    propertiesScanned: orPropertyIds.length,
    range: { from, to }
  });
});

export { admin };
