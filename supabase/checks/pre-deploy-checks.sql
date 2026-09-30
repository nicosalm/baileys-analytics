-- Read-only pre-deploy checks, as one statement so the SQL editor shows every result.
-- Checks the live schema directly rather than supabase_migrations.schema_migrations,
-- which only records migrations applied through the CLI.
-- Rows that need attention sort first within each section (anything not "ok"/"info").
with
expected_uniques(tbl, cols, used_by) as (values
  ('billing_history', 'stripe_invoice_id',             'stripe invoice webhooks'),
  ('blocks',          'ownerrez_block_id,tenant_id',   'block sync + webhooks'),
  ('booking_charges', 'booking_id,position',           'booking webhooks'),
  ('booking_tags',    'booking_id,tag_id',             'booking tag sync'),
  ('bookings',        'ownerrez_booking_id,tenant_id', 'booking sync + webhooks'),
  ('goals',           'metric_key,tenant_id',          'saving goals'),
  ('guest_tags',      'guest_id,tag_id',               'guest tag sync'),
  ('guests',          'ownerrez_guest_id,tenant_id',   'guest sync + webhooks'),
  ('inquiries',       'ownerrez_inquiry_id,tenant_id', 'inquiry sync + webhooks'),
  ('oauth_tokens',    'provider,tenant_id',            'OwnerRez connect (oauth callback)'),
  ('properties',      'ownerrez_id,tenant_id',         'property sync + webhooks'),
  ('property_tags',   'property_id,tag_id',            'property tag sync'),
  ('quotes',          'ownerrez_quote_id,tenant_id',   'quote webhooks'),
  ('subscriptions',   'tenant_id',                     'stripe subscription webhooks'),
  ('sync_status',     'sync_type,tenant_id',           'oauth callback + sync progress'),
  ('tags',            'name,tenant_id',                'tag sync')
),
actual_uniques as (
  select c.relname as tbl,
         string_agg(a.attname, ',' order by a.attname) as cols
  from pg_index i
  join pg_class c on c.oid = i.indrelid
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  join pg_attribute a on a.attrelid = c.oid and a.attnum = any(i.indkey)
  where i.indisunique and i.indpred is null
  group by c.relname, i.indexrelid
),
expected_fns(sig) as (values
  ('get_overall_occupancy(uuid, date, date, uuid[], uuid[])'),
  ('get_property_occupancy(uuid, date, date, uuid[], uuid[])'),
  ('get_periodic_occupancy(uuid, date, date, text, uuid[], uuid[])'),
  ('get_repeat_guest_count(uuid, date, date, uuid[], uuid[])'),
  ('delete_tenant_data(uuid)'),
  ('increment_usage_metric(uuid, text, timestamptz, timestamptz, integer)'),
  ('replace_expense_templates(uuid, uuid, jsonb)'),
  ('replace_operating_expenses(uuid, uuid, integer, integer, jsonb)'),
  ('replace_platform_fees(uuid, uuid, integer, integer, jsonb)'),
  ('replace_active_tax_config(uuid, uuid, text, jsonb, jsonb, timestamptz)')
),
sensitive as (
  select c.oid, c.relname, c.relrowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where c.relkind = 'r'
    and c.relname in ('oauth_tokens', 'oauth_states', 'account_deletions', 'tenants', 'subscriptions')
),
results(section, item, status, detail) as (
  -- 1. every upsert's ON CONFLICT target needs a matching unique index
  select '1 upsert target', e.tbl || ' (' || e.cols || ')',
         case when exists (select 1 from actual_uniques x where x.tbl = e.tbl and x.cols = e.cols)
              then 'ok' else 'MISSING' end,
         e.used_by
  from expected_uniques e

  union all
  -- 2. functions the new migration revokes; MISSING means that line of the migration fails
  select '2 function signature', e.sig,
         case when to_regprocedure('public.' || e.sig) is not null then 'ok' else 'MISSING' end,
         null
  from expected_fns e

  union all
  -- 3. who can read the sensitive tables today
  select '3 table exposure', s.relname,
         case when not s.relrowsecurity
                   and (has_table_privilege('anon', s.oid, 'select')
                        or has_table_privilege('authenticated', s.oid, 'select'))
              then 'EXPOSED' else 'info' end,
         'rls=' || s.relrowsecurity
           || ' anon_select=' || has_table_privilege('anon', s.oid, 'select')
           || ' authed_select=' || has_table_privilege('authenticated', s.oid, 'select')
           || coalesce((
                select ' authed_can_read_access_token='
                       || has_column_privilege('authenticated', s.oid, a.attnum, 'select')
                from pg_attribute a
                where a.attrelid = s.oid and a.attname = 'access_token' and not a.attisdropped
              ), '')
  from sensitive s

  union all
  -- 4. RLS policies on the OAuth tables; the browser's "connected" check needs a SELECT policy
  select '4 policy', p.tablename || ': ' || p.policyname, 'info',
         p.cmd || ' to ' || array_to_string(p.roles, ',') || ' using ' || coalesce(p.qual, '-')
  from pg_policies p
  where p.schemaname = 'public' and p.tablename in ('oauth_tokens', 'oauth_states', 'account_deletions')

  union all
  select '4 policy', 'oauth_tokens', 'MISSING',
         'no SELECT policy: connected users will show as not connected after a reload'
  where not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'oauth_tokens' and cmd in ('SELECT', 'ALL')
  )

  union all
  -- 5. a user should never have more than one tenant
  select '5 duplicate tenants', t.user_id::text, 'DUPLICATE', count(*)::text || ' tenants'
  from tenants t
  group by t.user_id
  having count(*) > 1

  union all
  -- 6. is account deletion currently broken? (the 20260412 regression)
  select '6 delete_tenant_data', 'junction table deletes',
         case when to_regprocedure('public.delete_tenant_data(uuid)') is null then 'MISSING'
              when pg_get_functiondef(to_regprocedure('public.delete_tenant_data(uuid)'))
                   ~* 'delete from booking_charges\s+where tenant_id' then 'BROKEN'
              else 'ok' end,
         'BROKEN means every account delete fails; apply 20260611_fix_delete_tenant_data_junction_tables.sql'
)
select section, item, status, detail
from results
order by section, status in ('ok', 'info'), item;
