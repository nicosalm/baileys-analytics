-- supersedes 20260611: keeps the junction-table subquery fix and also deletes every
-- table that references properties/bookings/expense_categories before its parent,
-- so the function no longer depends on the live FKs being ON DELETE CASCADE.
-- expense_allocations has no tenant_id and was never cleaned up.
-- create or replace keeps the service_role-only grants from 20260930.

create or replace function delete_tenant_data(p_tenant_id uuid) returns void as $$
begin
  -- junction / child tables first, scoped via parent row ids
  delete from property_group_members where tenant_id = p_tenant_id;
  delete from property_groups where tenant_id = p_tenant_id;
  delete from booking_charges
    where booking_id in (select id from bookings where tenant_id = p_tenant_id);
  delete from booking_tags
    where booking_id in (select id from bookings where tenant_id = p_tenant_id);
  delete from property_tags
    where property_id in (select id from properties where tenant_id = p_tenant_id);
  delete from guest_tags
    where guest_id in (select id from guests where tenant_id = p_tenant_id);
  begin
    delete from expense_allocations
      where property_id in (select id from properties where tenant_id = p_tenant_id)
         or expense_id in (select id from expenses where tenant_id = p_tenant_id);
  exception when undefined_table then null; end;
  -- tables referencing properties / bookings / expense_categories
  begin delete from budgets where tenant_id = p_tenant_id; exception when undefined_table then null; end;
  begin delete from expenses where tenant_id = p_tenant_id; exception when undefined_table then null; end;
  begin delete from expense_categories where tenant_id = p_tenant_id; exception when undefined_table then null; end;
  delete from platform_fee_entries where tenant_id = p_tenant_id;
  delete from platform_guest_fees where tenant_id = p_tenant_id;
  delete from operating_expenses where tenant_id = p_tenant_id;
  delete from expense_templates where tenant_id = p_tenant_id;
  delete from property_tax_configs where tenant_id = p_tenant_id;
  -- core data
  delete from blocks where tenant_id = p_tenant_id;
  delete from bookings where tenant_id = p_tenant_id;
  delete from guests where tenant_id = p_tenant_id;
  delete from properties where tenant_id = p_tenant_id;
  delete from tags where tenant_id = p_tenant_id;
  -- remaining tenant-scoped tables
  delete from season_configurations where tenant_id = p_tenant_id;
  begin delete from goals where tenant_id = p_tenant_id; exception when undefined_table then null; end;
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
$$ language plpgsql set search_path = public;
