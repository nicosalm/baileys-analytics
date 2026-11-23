-- the OwnerRez webhook handler writes processing_error when an event fails, and the admin
-- dashboard lists failures from it, but the column never existed: failed events went
-- unrecorded and the admin error list was always empty.
alter table public.webhook_events add column if not exists processing_error text;

-- the overview reads each tenant's latest webhook; 56k rows by late 2026
create index if not exists idx_webhook_events_tenant_created on public.webhook_events (tenant_id, created_at desc);
-- the overview's 7-day error count only ever looks at failed events
create index if not exists idx_webhook_events_failed on public.webhook_events (tenant_id, created_at desc) where processing_error is not null;

-- one row per real tenant with everything the Admin Dashboard shows, so every widget is computed
-- from the same rows as the user table. the demo tenant and tenants being deleted are left out.
-- security_invoker keeps it subject to the caller's rights; only the worker's service role reads
-- it (browser roles hold no grants, see 20261121).
create or replace view public.admin_tenant_overview with (security_invoker = true) as
select
  t.id as tenant_id,
  t.email,
  t.company_name,
  t.created_at,
  t.subscription_exempt as exempt,
  t.ownerrez_connected,
  t.first_subscription_at,
  s.status as subscription_status,
  s.tier,
  s.billing_cycle,
  s.unit_amount,
  s.current_period_end,
  s.cancel_at,
  s.pending_tier,
  s.pending_effective_at,
  s.pending_notified_at,
  s.preferred_billing_cycle,
  (select count(*) from public.properties p where p.tenant_id = t.id and p.active and p.deleted_at is null)::int as property_count,
  exists (
    select 1 from public.sync_status ss
    where ss.tenant_id = t.id and ss.sync_type = 'initial_sync_completed' and ss.status = 'success'
  ) as imported,
  exists (select 1 from public.sync_status ss where ss.tenant_id = t.id and ss.status = 'failure') as sync_failing,
  greatest(
    (select max(w.created_at) from public.webhook_events w where w.tenant_id = t.id),
    (select max(ss.last_sync) from public.sync_status ss where ss.tenant_id = t.id)
  ) as last_data_at,
  (
    (select count(*) from public.webhook_events w
      where w.tenant_id = t.id and w.processing_error is not null and w.created_at > now() - interval '7 days')
    + (select count(*) from public.stripe_webhook_events e
      where e.tenant_id = t.id and e.processing_error is not null and e.created_at > now() - interval '7 days')
  )::int as errors_7d
from public.tenants t
left join public.subscriptions s on s.tenant_id = t.id
where t.deletion_requested_at is null
  and t.email <> 'demo@baileysanalytics.com';

revoke all on public.admin_tenant_overview from anon, authenticated;
