import Stripe from 'stripe';
import { SupabaseClient } from '@supabase/supabase-js';

const PURGE_BATCH = 2000;
// stay well inside the 30s request timeout; whatever is left is finished by the cron
const INLINE_PURGE_BUDGET_MS = 20_000;

export class StripeCancellationError extends Error {}

// Cancels billing, records the audit row, and detaches the tenant so the user is gone
// immediately: login removed, OwnerRez link cleared (webhooks resolve tenants by
// ownerrez_user_id), and deletion_requested_at set so purgePendingDeletions picks it up.
// The bulk data is purged afterwards in small batches by purgeTenant.
export async function requestTenantDeletion(
  env: Env,
  supabase: SupabaseClient,
  tenantId: string,
  deletedBy: string
): Promise<void> {
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('user_id, email, company_name, deletion_requested_at')
    .eq('id', tenantId)
    .single();
  if (tenantError || !tenant) throw new Error(`Tenant ${tenantId} not found`);
  if (tenant.deletion_requested_at) return;

  await cancelStripeSubscriptions(env, supabase, tenantId);

  const [{ count: propCount }, { count: bookCount }, { data: sub }] = await Promise.all([
    supabase.from('properties').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('subscriptions').select('status').eq('tenant_id', tenantId).maybeSingle(),
  ]);

  const { error: markError } = await supabase
    .from('tenants')
    .update({
      deletion_requested_at: new Date().toISOString(),
      user_id: null,
      ownerrez_user_id: null,
      ownerrez_connected: false,
    })
    .eq('id', tenantId);
  if (markError) throw new Error(`Failed to mark tenant for deletion: ${markError.message}`);

  await supabase.from('oauth_tokens').delete().eq('tenant_id', tenantId);

  await supabase.from('account_deletions').insert({
    tenant_id: tenantId,
    email: tenant.email,
    company_name: tenant.company_name,
    deleted_by: deletedBy,
    property_count: propCount || 0,
    booking_count: bookCount || 0,
    had_active_subscription: sub?.status === 'active',
  });

  if (tenant.user_id) {
    const { error } = await supabase.auth.admin.deleteUser(tenant.user_id);
    if (error) console.error(`Failed to delete auth user for tenant ${tenantId}:`, error);
  }
}

// Purges in batches until the tenant is gone or the time budget runs out.
// Returns true once the tenants row is deleted.
export async function purgeTenant(
  supabase: SupabaseClient,
  tenantId: string,
  budgetMs = INLINE_PURGE_BUDGET_MS
): Promise<boolean> {
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    const { data: done, error } = await supabase.rpc('purge_tenant_data', {
      p_tenant_id: tenantId,
      p_batch: PURGE_BATCH,
    });
    if (error) {
      // lock_timeout (55P03) or statement timeout (57014): a concurrent writer held a row;
      // the next batch or the next cron run retries
      console.warn(`purge_tenant_data(${tenantId}) failed, will retry:`, error.message);
      return false;
    }
    if (done) return true;
  }
  return false;
}

export async function purgePendingDeletions(supabase: SupabaseClient, budgetMs: number): Promise<void> {
  const { data: pending, error } = await supabase
    .from('tenants')
    .select('id')
    .not('deletion_requested_at', 'is', null)
    .order('deletion_requested_at', { ascending: true })
    .limit(20);
  if (error) {
    console.error('Failed to list tenants pending deletion:', error);
    return;
  }

  const deadline = Date.now() + budgetMs;
  for (const { id } of pending || []) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await purgeTenant(supabase, id, remaining);
  }
}

// Throws StripeCancellationError so the deletion aborts while the customer could still
// be billed. A customer that no longer exists in Stripe has nothing to cancel.
async function cancelStripeSubscriptions(env: Env, supabase: SupabaseClient, tenantId: string): Promise<void> {
  if (!env.STRIPE_SECRET_KEY) return;

  const { data: customer } = await supabase
    .from('stripe_customers')
    .select('stripe_customer_id')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!customer?.stripe_customer_id) return;

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-10-29.clover',
    httpClient: Stripe.createFetchHttpClient(),
  });

  try {
    for (const status of ['active', 'trialing', 'past_due'] as const) {
      const subscriptions = await stripe.subscriptions.list({ customer: customer.stripe_customer_id, status });
      for (const sub of subscriptions.data) {
        await stripe.subscriptions.cancel(sub.id);
      }
    }
  } catch (err) {
    if (err instanceof Stripe.errors.StripeInvalidRequestError && err.code === 'resource_missing') {
      console.warn(`Stripe customer ${customer.stripe_customer_id} not found; proceeding with deletion.`);
      return;
    }
    console.error(`Failed to cancel Stripe subscriptions for tenant ${tenantId}:`, err);
    throw new StripeCancellationError('Stripe cancellation failed');
  }
}
