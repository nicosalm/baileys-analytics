import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { authMiddleware } from '../middleware/auth';

const account = new Hono<{ Bindings: Env; Variables: { user: any; tenantId: string } }>();

// get company name
account.get('/company-name', authMiddleware, async (c) => {
  const tenantId = c.get('tenantId');
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  const { data, error } = await supabase
    .from('tenants')
    .select('company_name')
    .eq('id', tenantId)
    .single();

  if (error) return c.json({ error: 'Failed to get company name' }, 500);
  return c.json({ company_name: data?.company_name || null });
});

// update company name
account.patch('/company-name', authMiddleware, async (c) => {
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const companyName = body.company_name;

  if (companyName !== null && typeof companyName !== 'string') {
    return c.json({ error: 'company_name must be a string or null' }, 400);
  }

  const trimmed = companyName?.trim() || null;
  if (trimmed && trimmed.length > 100) {
    return c.json({ error: 'Company name must be 100 characters or fewer' }, 400);
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  const { error } = await supabase
    .from('tenants')
    .update({ company_name: trimmed, updated_at: new Date().toISOString() })
    .eq('id', tenantId);

  if (error) return c.json({ error: 'Failed to update company name' }, 500);
  return c.json({ success: true, company_name: trimmed });
});

// delete account permanently
account.delete('/delete', authMiddleware, async (c) => {
  const tenantId = c.get('tenantId');
  const userId = c.get('user').id;
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  try {
    // 1. cancel stripe subscription FIRST — if this fails we must abort the
    // deletion so we never leave a customer being billed for an account whose
    // data we already wiped. this runs before the audit log and before any
    // destructive db work.
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

          // cancel all non-terminal subscriptions
          for (const status of ['active', 'trialing', 'past_due'] as const) {
            const subscriptions = await stripe.subscriptions.list({
              customer: customer.stripe_customer_id,
              status
            });
            for (const sub of subscriptions.data) {
              await stripe.subscriptions.cancel(sub.id);
            }
          }
        } catch (stripeError) {
          console.error('Failed to cancel stripe subscription during account deletion:', stripeError);
          return c.json({
            error: 'We could not cancel your Stripe subscription. Your account was not deleted to prevent continued billing. Please try again in a few minutes or contact support.',
            code: 'STRIPE_CANCELLATION_FAILED'
          }, 500);
        }
      }
    }

    // 2. audit log — snapshot before deletion (after stripe cancel so we only
    // record deletions we are actually going to complete)
    const [{ data: tenant }, { count: propCount }, { count: bookCount }, { data: sub }] = await Promise.all([
      supabase.from('tenants').select('email, company_name').eq('id', tenantId).single(),
      supabase.from('properties').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('subscriptions').select('status').eq('tenant_id', tenantId).maybeSingle(),
    ]);

    if (tenant) {
      await supabase.from('account_deletions').insert({
        tenant_id: tenantId,
        email: tenant.email,
        company_name: tenant.company_name,
        deleted_by: 'self',
        property_count: propCount || 0,
        booking_count: bookCount || 0,
        had_active_subscription: sub?.status === 'active',
      });
    }

    // 3. revoke ownerrez oauth token
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

    // 4. delete all tenant data atomically via RPC
    const { error: deleteDataError } = await supabase.rpc('delete_tenant_data', {
      p_tenant_id: tenantId
    });

    if (deleteDataError) {
      console.error('Failed to delete tenant data:', deleteDataError);
      return c.json({ error: 'Failed to delete account data. Please contact support.' }, 500);
    }

    // 5. delete auth user (this will log them out)
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
