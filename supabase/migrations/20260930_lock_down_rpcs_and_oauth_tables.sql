-- These functions trust a caller-supplied tenant id and are only ever called by the
-- workers with the service key. Without this, anyone holding the public anon key could
-- call them over PostgREST for another tenant (the occupancy/repeat-guest ones are
-- security definer and bypass RLS outright).
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.get_overall_occupancy(uuid, date, date, uuid[], uuid[])',
    'public.get_property_occupancy(uuid, date, date, uuid[], uuid[])',
    'public.get_periodic_occupancy(uuid, date, date, text, uuid[], uuid[])',
    'public.get_repeat_guest_count(uuid, date, date, uuid[], uuid[])',
    'public.delete_tenant_data(uuid)',
    'public.increment_usage_metric(uuid, text, timestamptz, timestamptz, integer)',
    'public.replace_expense_templates(uuid, uuid, jsonb)',
    'public.replace_operating_expenses(uuid, uuid, integer, integer, jsonb)',
    'public.replace_platform_fees(uuid, uuid, integer, integer, jsonb)',
    'public.replace_active_tax_config(uuid, uuid, text, jsonb, jsonb, timestamptz)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;

-- oauth_states is only touched by the workers (service key). A leaked state token lets
-- an attacker bind their own OwnerRez account to a victim's tenant via /oauth/callback.
alter table oauth_states enable row level security;
revoke all on oauth_states from anon, authenticated;

-- The browser checks connection status with `select id ... where tenant_id, provider`
-- (apps/web/src/contexts/auth.tsx). Keep exactly those columns readable and hide the
-- tokens themselves; RLS filters rows but cannot hide columns.
revoke select on oauth_tokens from anon, authenticated;
grant select (id, tenant_id, provider) on oauth_tokens to authenticated;

-- account_deletions (20260308) was created without RLS, so deleted users' emails were
-- readable over the Data API. Only the workers write it, with the service key.
alter table account_deletions enable row level security;
revoke all on account_deletions from anon, authenticated;
