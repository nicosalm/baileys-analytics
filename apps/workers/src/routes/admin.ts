import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { authMiddleware } from '../middleware/auth';

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
    // get counts
    const [
      { count: totalTenants },
      { count: totalProperties },
      { count: totalBookings },
      { data: activeSubscriptions }
    ] = await Promise.all([
      supabase.from('tenants').select('id', { count: 'exact', head: true }),
      supabase.from('properties').select('id', { count: 'exact', head: true }),
      supabase.from('bookings').select('id', { count: 'exact', head: true }),
      supabase
        .from('subscriptions')
        .select('billing_cycle, status')
        .in('status', ['active', 'trialing'])
    ]);

    // calculate MRR
    let mrr = 0;
    activeSubscriptions?.forEach(sub => {
      if (sub.billing_cycle === 'monthly') {
        mrr += 20;
      } else if (sub.billing_cycle === 'yearly') {
        mrr += 16; // $192/year = $16/month
      }
    });

    // recent signups (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { count: recentSignups } = await supabase
      .from('tenants')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString());

    return c.json({
      metrics: {
        totalUsers: totalTenants || 0, // tenants are users
        totalTenants: totalTenants || 0,
        totalProperties: totalProperties || 0,
        totalBookings: totalBookings || 0,
        activeSubscriptions: activeSubscriptions?.length || 0,
        mrr: Math.round(mrr),
        recentSignups: recentSignups || 0
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
      query = query.or(`email.ilike.%${search}%,company_name.ilike.%${search}%`);
    }

    const { data: users, error } = await query;

    if (error) throw error;

    // get subscription details for each user
    const enrichedUsers = await Promise.all(
      (users || []).map(async (user) => {
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('billing_cycle, status, trial_end, current_period_end')
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
      .select('user_id, email')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      return c.json({ error: 'Tenant not found' }, 404);
    }

    const userId = tenant.user_id;

    // 1. cancel stripe subscription if exists
    if (c.env.STRIPE_SECRET_KEY) {
      try {
        const { data: customer } = await supabase
          .from('stripe_customers')
          .select('stripe_customer_id')
          .eq('tenant_id', tenantId)
          .single();

        if (customer?.stripe_customer_id) {
          const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
            apiVersion: '2025-09-30.clover',
            httpClient: Stripe.createFetchHttpClient()
          });

          const subscriptions = await stripe.subscriptions.list({
            customer: customer.stripe_customer_id,
            status: 'active'
          });

          for (const sub of subscriptions.data) {
            await stripe.subscriptions.cancel(sub.id);
          }
        }
      } catch (stripeError) {
        console.error('Failed to cancel stripe subscription:', stripeError);
      }
    }

    // 2. delete all tenant data (order matters for FK constraints)
    const tablesToDelete = [
      { table: 'booking_charges', key: 'tenant_id', value: tenantId },
      { table: 'booking_tags', key: 'tenant_id', value: tenantId },
      { table: 'property_tags', key: 'tenant_id', value: tenantId },
      { table: 'guest_tags', key: 'tenant_id', value: tenantId },
      { table: 'blocks', key: 'tenant_id', value: tenantId },
      { table: 'bookings', key: 'tenant_id', value: tenantId },
      { table: 'guests', key: 'tenant_id', value: tenantId },
      { table: 'properties', key: 'tenant_id', value: tenantId },
      { table: 'tags', key: 'tenant_id', value: tenantId },
      { table: 'season_configurations', key: 'tenant_id', value: tenantId },
      { table: 'property_tax_configs', key: 'tenant_id', value: tenantId },
      { table: 'platform_fee_entries', key: 'tenant_id', value: tenantId },
      { table: 'generated_reports', key: 'tenant_id', value: tenantId },
      { table: 'sync_status', key: 'tenant_id', value: tenantId },
      { table: 'webhook_events', key: 'tenant_id', value: tenantId },
      { table: 'billing_history', key: 'tenant_id', value: tenantId },
      { table: 'usage_metrics', key: 'tenant_id', value: tenantId },
      { table: 'subscriptions', key: 'tenant_id', value: tenantId },
      { table: 'stripe_customers', key: 'tenant_id', value: tenantId },
      { table: 'oauth_tokens', key: 'tenant_id', value: tenantId },
      { table: 'oauth_states', key: 'tenant_id', value: tenantId },
      { table: 'tenants', key: 'id', value: tenantId },
    ];

    for (const { table, key, value } of tablesToDelete) {
      const { error } = await supabase.from(table).delete().eq(key, value);
      if (error) {
        console.error(`Failed to delete from ${table}:`, error);
      }
    }

    // 3. delete auth user
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

export { admin };
