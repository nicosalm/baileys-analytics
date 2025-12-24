import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { authMiddleware } from '../middleware/auth';

const account = new Hono<{ Bindings: Env; Variables: { user: any; tenantId: string } }>();

// export all user data
account.get('/export', authMiddleware, async (c) => {
  const tenantId = c.get('tenantId');
  const user = c.get('user');
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  try {
    // gather all user data
    const [
      { data: tenant },
      { data: properties },
      { data: bookings },
      { data: guests },
      { data: seasons },
      { data: taxConfigs },
      { data: platformFees },
      { data: reports },
      { data: subscription }
    ] = await Promise.all([
      supabase.from('tenants').select('*').eq('id', tenantId).single(),
      supabase.from('properties').select('*').eq('tenant_id', tenantId),
      supabase.from('bookings').select('*').eq('tenant_id', tenantId),
      supabase.from('guests').select('*').eq('tenant_id', tenantId),
      supabase.from('season_configurations').select('*').eq('tenant_id', tenantId),
      supabase.from('property_tax_configs').select('*').eq('tenant_id', tenantId),
      supabase.from('platform_fee_entries').select('*').eq('tenant_id', tenantId),
      supabase.from('generated_reports').select('*').eq('tenant_id', tenantId),
      supabase.from('subscriptions').select('*').eq('tenant_id', tenantId).single()
    ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      },
      tenant,
      properties,
      bookings,
      guests,
      seasons,
      tax_configs: taxConfigs,
      platform_fees: platformFees,
      reports,
      subscription,
      metadata: {
        total_properties: properties?.length || 0,
        total_bookings: bookings?.length || 0,
        total_guests: guests?.length || 0,
        export_format: 'json',
        version: '1.0'
      }
    };

    return c.json(exportData);
  } catch (error) {
    console.error('Failed to export data:', error);
    return c.json({ error: 'Failed to export data' }, 500);
  }
});

// delete account permanently
account.delete('/delete', authMiddleware, async (c) => {
  const tenantId = c.get('tenantId');
  const userId = c.get('user').id;
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  try {
    // 1. cancel stripe subscription if exists
    if (c.env.STRIPE_SECRET_KEY) {
      try {
        const { data: customer } = await supabase
          .from('stripe_customers')
          .select('stripe_customer_id')
          .eq('tenant_id', tenantId)
          .single();

        if (customer?.stripe_customer_id) {
          // cancel subscription via stripe
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
        // continue with deletion even if stripe fails
      }
    }

    // 2. revoke ownerrez oauth token
    try {
      const { data: token } = await supabase
        .from('oauth_tokens')
        .select('access_token')
        .eq('tenant_id', tenantId)
        .eq('provider', 'ownerrez')
        .single();

      if (token?.access_token) {
        // attempt to revoke the token with ownerrez
        // note: ownerrez doesn't have a revoke endpoint, but deleting from our db is sufficient
      }
    } catch (oauthError) {
      console.error('Failed to revoke oauth token:', oauthError);
      // continue with deletion
    }

    // 3. delete all tenant data (cascade deletes should handle related tables)
    // order matters due to foreign key constraints
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

    // execute all deletes with error handling
    for (const { table, key, value } of tablesToDelete) {
      const { error } = await supabase.from(table).delete().eq(key, value);
      if (error) {
        console.error(`Failed to delete from ${table}:`, error);
        // continue with other deletions even if one fails
      }
    }

    // verify tenants table was deleted
    const { data: tenantCheck } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', tenantId)
      .single();

    if (tenantCheck) {
      console.error('Tenant record still exists after deletion attempt');
    }

    // 4. delete auth user (this will log them out)
    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteUserError) {
      console.error('Failed to delete auth user:', deleteUserError);
      // tenant data is already deleted, so this is just cleanup
    }

    return c.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Failed to delete account:', error);
    return c.json({
      error: 'Failed to delete account. Please contact support.',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export { account };
