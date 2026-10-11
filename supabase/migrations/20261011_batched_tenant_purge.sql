-- Account deletion now detaches the tenant up front (deletion_requested_at set, login and
-- OwnerRez link cleared) and purges its data in small batches afterwards. A single
-- delete_tenant_data call holds every row lock for the whole tenant in one transaction, so
-- on large tenants it ran past the API statement timeout or queued behind sync/webhook
-- writes until it did.

alter table tenants add column if not exists deletion_requested_at timestamptz;

create index if not exists idx_tenants_deletion_requested_at
  on tenants (deletion_requested_at) where deletion_requested_at is not null;

-- Deletes up to p_batch rows of the tenant's data, children before parents, and returns
-- true once the tenants row itself is gone. Each call is one short transaction; callers
-- loop until it returns true. lock_timeout makes a call blocked by a concurrent writer
-- fail fast so the next call (or the next cron run) retries it.
create or replace function purge_tenant_data(p_tenant_id uuid, p_batch integer default 2000)
returns boolean
language plpgsql
set search_path = public
set lock_timeout = '3s'
as $$
declare
  steps constant text[][] := array[
    ['property_group_members', 't.tenant_id = $1'],
    ['property_groups',        't.tenant_id = $1'],
    ['booking_charges',        't.booking_id in (select id from bookings where tenant_id = $1)'],
    ['booking_tags',           't.booking_id in (select id from bookings where tenant_id = $1)'],
    ['property_tags',          't.property_id in (select id from properties where tenant_id = $1)'],
    ['guest_tags',             't.guest_id in (select id from guests where tenant_id = $1)'],
    ['expense_allocations',    't.property_id in (select id from properties where tenant_id = $1)
                                or t.expense_id in (select id from expenses where tenant_id = $1)'],
    ['budgets',                't.tenant_id = $1'],
    ['expenses',               't.tenant_id = $1'],
    ['expense_categories',     't.tenant_id = $1'],
    ['platform_fee_entries',   't.tenant_id = $1'],
    ['platform_guest_fees',    't.tenant_id = $1'],
    ['operating_expenses',     't.tenant_id = $1'],
    ['expense_templates',      't.tenant_id = $1'],
    ['property_tax_configs',   't.tenant_id = $1'],
    ['blocks',                 't.tenant_id = $1'],
    ['bookings',               't.tenant_id = $1'],
    ['guests',                 't.tenant_id = $1'],
    ['properties',             't.tenant_id = $1'],
    ['tags',                   't.tenant_id = $1'],
    ['season_configurations',  't.tenant_id = $1'],
    ['goals',                  't.tenant_id = $1'],
    ['quotes',                 't.tenant_id = $1'],
    ['inquiries',              't.tenant_id = $1'],
    ['tenant_platform_configs','t.tenant_id = $1'],
    ['sync_status',            't.tenant_id = $1'],
    ['sync_progress',          't.tenant_id = $1'],
    ['background_jobs',        't.tenant_id = $1'],
    ['webhook_events',         't.tenant_id = $1'],
    ['stripe_webhook_events',  't.tenant_id = $1'],
    ['billing_history',        't.tenant_id = $1'],
    ['usage_metrics',          't.tenant_id = $1'],
    ['payment_methods',        't.tenant_id = $1'],
    ['subscriptions',          't.tenant_id = $1'],
    ['stripe_customers',       't.tenant_id = $1'],
    ['oauth_tokens',           't.tenant_id = $1'],
    ['oauth_states',           't.tenant_id = $1']
  ];
  budget integer := p_batch;
  deleted integer;
begin
  -- expense_categories references itself; unlink it so batches can delete in any order
  if to_regclass('expense_categories') is not null then
    update expense_categories set parent_category_id = null
      where tenant_id = p_tenant_id and parent_category_id is not null;
  end if;

  for i in 1 .. array_length(steps, 1) loop
    continue when to_regclass(steps[i][1]) is null;
    execute format(
      'delete from %1$I where ctid = any(array(select t.ctid from %1$I t where %2$s limit $2))',
      steps[i][1], steps[i][2]
    ) using p_tenant_id, budget;
    get diagnostics deleted = row_count;
    budget := budget - deleted;
    if budget <= 0 then
      return false;
    end if;
  end loop;

  delete from tenants where id = p_tenant_id;
  return true;
end;
$$;

revoke execute on function purge_tenant_data(uuid, integer) from public, anon, authenticated;
grant execute on function purge_tenant_data(uuid, integer) to service_role;
