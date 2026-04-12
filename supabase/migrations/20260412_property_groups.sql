-- property groups: user-defined groupings of properties for quick filter selection
-- overlap allowed (same property can belong to multiple groups)

create table property_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, name)
);

create table property_group_members (
  id uuid primary key default gen_random_uuid(),
  property_group_id uuid not null references property_groups(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  added_at timestamptz not null default now(),
  unique(property_group_id, property_id)
);

create index idx_property_groups_tenant on property_groups(tenant_id);
create index idx_property_group_members_tenant on property_group_members(tenant_id);
create index idx_property_group_members_property on property_group_members(property_id);
create index idx_property_group_members_group on property_group_members(property_group_id);

-- RLS
alter table property_groups enable row level security;
alter table property_group_members enable row level security;

create policy "tenant isolation" on property_groups
  for all using (tenant_id = (select id from tenants where user_id = auth.uid()));

create policy "tenant isolation" on property_group_members
  for all using (tenant_id = (select id from tenants where user_id = auth.uid()));

-- extend delete_tenant_data() to clean up property groups
create or replace function delete_tenant_data(p_tenant_id uuid) returns void as $$
begin
  -- junction / child tables first
  delete from property_group_members where tenant_id = p_tenant_id;
  delete from property_groups where tenant_id = p_tenant_id;
  delete from booking_charges where tenant_id = p_tenant_id;
  delete from booking_tags where tenant_id = p_tenant_id;
  delete from property_tags where tenant_id = p_tenant_id;
  delete from guest_tags where tenant_id = p_tenant_id;
  -- core data
  delete from blocks where tenant_id = p_tenant_id;
  delete from bookings where tenant_id = p_tenant_id;
  delete from guests where tenant_id = p_tenant_id;
  delete from properties where tenant_id = p_tenant_id;
  delete from tags where tenant_id = p_tenant_id;
  -- config & expenses
  delete from season_configurations where tenant_id = p_tenant_id;
  delete from property_tax_configs where tenant_id = p_tenant_id;
  delete from platform_fee_entries where tenant_id = p_tenant_id;
  delete from platform_guest_fees where tenant_id = p_tenant_id;
  delete from operating_expenses where tenant_id = p_tenant_id;
  delete from expense_templates where tenant_id = p_tenant_id;
  -- optional tables (may not exist in all environments)
  begin delete from expenses where tenant_id = p_tenant_id; exception when undefined_table then null; end;
  begin delete from expense_categories where tenant_id = p_tenant_id; exception when undefined_table then null; end;
  begin delete from goals where tenant_id = p_tenant_id; exception when undefined_table then null; end;
  begin delete from budgets where tenant_id = p_tenant_id; exception when undefined_table then null; end;
  begin delete from quotes where tenant_id = p_tenant_id; exception when undefined_table then null; end;
  begin delete from inquiries where tenant_id = p_tenant_id; exception when undefined_table then null; end;
  begin delete from tenant_platform_configs where tenant_id = p_tenant_id; exception when undefined_table then null; end;
  -- sync & events
  delete from sync_status where tenant_id = p_tenant_id;
  begin delete from sync_progress where tenant_id = p_tenant_id; exception when undefined_table then null; end;
  begin delete from background_jobs where tenant_id = p_tenant_id; exception when undefined_table then null; end;
  delete from webhook_events where tenant_id = p_tenant_id;
  delete from stripe_webhook_events where tenant_id = p_tenant_id;
  -- billing
  delete from billing_history where tenant_id = p_tenant_id;
  delete from usage_metrics where tenant_id = p_tenant_id;
  begin delete from payment_methods where tenant_id = p_tenant_id; exception when undefined_table then null; end;
  delete from subscriptions where tenant_id = p_tenant_id;
  delete from stripe_customers where tenant_id = p_tenant_id;
  -- auth
  delete from oauth_tokens where tenant_id = p_tenant_id;
  delete from oauth_states where tenant_id = p_tenant_id;
  -- tenant last
  delete from tenants where id = p_tenant_id;
end;
$$ language plpgsql;
