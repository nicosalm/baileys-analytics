-- Read-only pre-deploy checks. Paste into the Supabase SQL editor and run each
-- block separately; none of these modify anything.

-- 1. Upsert conflict targets.
--    Every row must say "ok". A "MISSING" row means that upsert fails at runtime with
--    "there is no unique or exclusion constraint matching the ON CONFLICT specification".
with expected(tbl, cols, used_by) as (values
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
actual as (
  select c.relname as tbl,
         string_agg(a.attname, ',' order by a.attname) as cols
  from pg_index i
  join pg_class c on c.oid = i.indrelid
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  join pg_attribute a on a.attrelid = c.oid and a.attnum = any(i.indkey)
  where i.indisunique and i.indpred is null
  group by c.relname, i.indexrelid
)
select e.tbl, e.cols, e.used_by,
       case when exists (select 1 from actual x where x.tbl = e.tbl and x.cols = e.cols)
            then 'ok' else 'MISSING' end as status
from expected e
order by status, e.tbl;

-- 2. Signature check for the new migration (20260930_lock_down_rpcs_and_oauth_tables.sql).
--    Every row must say "ok". A "MISSING" row means the live function has a different
--    argument list and the migration will fail on that line; send me the output.
with expected(sig) as (values
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
)
select e.sig,
       case when to_regprocedure('public.' || e.sig) is not null then 'ok' else 'MISSING' end as status
from expected e
order by status, e.sig;

-- 3. Current exposure: RLS status and browser-role access on the sensitive tables.
--    Before the migration, anything with anon/authenticated privileges here is reachable
--    with the public key (subject to RLS policies, listed in block 4).
select c.relname as tbl,
       c.relrowsecurity as rls_enabled,
       has_table_privilege('anon', c.oid, 'select')          as anon_select,
       has_table_privilege('authenticated', c.oid, 'select') as authed_select,
       case when c.relname = 'oauth_tokens'
            then has_column_privilege('authenticated', c.oid, 'access_token', 'select')
       end as authed_can_read_token
from pg_class c
join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
where c.relname in ('oauth_tokens', 'oauth_states', 'account_deletions', 'tenants', 'subscriptions')
  and c.relkind = 'r'
order by 1;

-- 4. RLS policies on the OAuth tables. The browser's "is OwnerRez connected" check reads
--    oauth_tokens as the logged-in user, so there must be a SELECT policy scoped to the
--    user's own tenant. If this returns no oauth_tokens row, connected users will see
--    "Connect OwnerRez" after a reload.
select tablename, policyname, cmd, roles, qual
from pg_policies
where schemaname = 'public' and tablename in ('oauth_tokens', 'oauth_states', 'account_deletions');

-- 5. Duplicate tenants per user (nothing in the repo makes tenants.user_id unique, and
--    three code paths create tenants). Should return zero rows.
select user_id, count(*) as tenant_count, array_agg(id) as tenant_ids
from tenants
group by user_id
having count(*) > 1;

-- 6. Migration history, to see which repo migrations are actually applied.
select * from supabase_migrations.schema_migrations order by version;
