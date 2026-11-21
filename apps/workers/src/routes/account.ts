import { Hono } from 'hono';
import { createSupabaseClient } from '../services/supabase';
import { authMiddleware } from '../middleware/auth';
import { requestTenantDeletion, purgeTenant, StripeCancellationError } from '../services/account-deletion';
import type { AppEnv } from '../types';

const account = new Hono<AppEnv>();

// get company name
account.get('/company-name', authMiddleware, async (c) => {
  const tenantId = c.get('tenantId');
  const supabase = createSupabaseClient(c.env);

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

  const supabase = createSupabaseClient(c.env);

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
  const supabase = createSupabaseClient(c.env);

  try {
    await requestTenantDeletion(c.env, supabase, tenantId, 'self');
  } catch (error) {
    if (error instanceof StripeCancellationError) {
      return c.json({
        error: 'We could not cancel your Stripe subscription. Your account was not deleted to prevent continued billing. Please try again in a few minutes or contact support.',
        code: 'STRIPE_CANCELLATION_FAILED'
      }, 500);
    }
    console.error('Failed to delete account:', error);
    return c.json({ error: 'Failed to delete account. Please contact support.' }, 500);
  }

  c.executionCtx.waitUntil(purgeTenant(supabase, tenantId));
  return c.json({ success: true, message: 'Account deleted successfully' });
});

export { account };
