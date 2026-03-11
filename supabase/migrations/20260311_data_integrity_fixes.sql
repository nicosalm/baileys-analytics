-- data integrity fixes: unique constraints and atomic helpers

-- fix #2: billing_history_stripe_invoice_id_key already exists in DB

-- fix #3: atomic usage metric increment (avoids read-then-write race)
create or replace function increment_usage_metric(
  p_tenant_id uuid,
  p_metric_type text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_count int default 1
) returns void as $$
begin
  insert into usage_metrics (tenant_id, metric_type, count, period_start, period_end)
  values (p_tenant_id, p_metric_type, p_count, p_period_start, p_period_end)
  on conflict (tenant_id, metric_type, period_start, period_end)
  do update set count = usage_metrics.count + p_count;
end;
$$ language plpgsql;

-- fix #1a: atomic replace for expense_templates
create or replace function replace_expense_templates(
  p_tenant_id uuid,
  p_property_id uuid,
  p_rows jsonb
) returns void as $$
begin
  delete from expense_templates
    where tenant_id = p_tenant_id and property_id = p_property_id;

  insert into expense_templates (tenant_id, property_id, category, amount, description)
  select
    p_tenant_id,
    p_property_id,
    r->>'category',
    (r->>'amount')::numeric,
    r->>'description'
  from jsonb_array_elements(p_rows) as r;
end;
$$ language plpgsql;

-- fix #1b: atomic replace for operating_expenses
create or replace function replace_operating_expenses(
  p_tenant_id uuid,
  p_property_id uuid,
  p_year int,
  p_month int,
  p_rows jsonb
) returns void as $$
begin
  delete from operating_expenses
    where tenant_id = p_tenant_id
      and property_id = p_property_id
      and year = p_year
      and month = p_month;

  insert into operating_expenses (tenant_id, property_id, year, month, category, amount, description, notes)
  select
    p_tenant_id,
    p_property_id,
    p_year,
    p_month,
    r->>'category',
    (r->>'amount')::numeric,
    r->>'description',
    null
  from jsonb_array_elements(p_rows) as r;
end;
$$ language plpgsql;

-- fix #1c: atomic replace for platform_guest_fees (monthly bulk)
create or replace function replace_platform_fees(
  p_tenant_id uuid,
  p_property_id uuid,
  p_year int,
  p_month int,
  p_rows jsonb
) returns void as $$
begin
  delete from platform_guest_fees
    where tenant_id = p_tenant_id
      and property_id = p_property_id
      and year = p_year
      and month = p_month
      and booking_id is null;

  insert into platform_guest_fees (tenant_id, property_id, platform, amount, year, month, notes, booking_id)
  select
    p_tenant_id,
    p_property_id,
    r->>'platform',
    (r->>'amount')::numeric,
    p_year,
    p_month,
    r->>'notes',
    null
  from jsonb_array_elements(p_rows) as r;
end;
$$ language plpgsql;

-- fix #1d: atomic deactivate + insert for tax configs
create or replace function replace_active_tax_config(
  p_tenant_id uuid,
  p_property_id uuid,
  p_config_name text,
  p_jurisdictions jsonb,
  p_platform_settings jsonb,
  p_effective_from timestamptz
) returns uuid as $$
declare
  new_id uuid;
begin
  update property_tax_configs
    set is_active = false
    where tenant_id = p_tenant_id and property_id = p_property_id;

  insert into property_tax_configs
    (tenant_id, property_id, config_name, jurisdictions, platform_settings, effective_from, is_active, created_at, updated_at)
  values
    (p_tenant_id, p_property_id, p_config_name, p_jurisdictions, p_platform_settings, p_effective_from, true, now(), now())
  returning id into new_id;

  return new_id;
end;
$$ language plpgsql;

-- fix #7: atomic account deletion
-- deletes all tenant data in FK-safe order within a single transaction
-- uses IF EXISTS pattern so missing tables don't break the function
create or replace function delete_tenant_data(p_tenant_id uuid) returns void as $$
begin
  -- junction / child tables first
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
