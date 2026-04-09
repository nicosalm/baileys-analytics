-- fix: delete_tenant_data was trying to filter junction/child tables by a
-- tenant_id column that does not exist on them. booking_charges, booking_tags,
-- property_tags, and guest_tags only carry a foreign key to their parent row
-- (bookings/properties/guests), so they have to be scoped via a subquery
-- through the parent table's tenant_id.
--
-- the previous version aborted on the very first statement with
-- "column tenant_id does not exist", which left every account delete
-- (self-serve and admin) permanently broken regardless of which tenant was
-- being deleted.

create or replace function delete_tenant_data(p_tenant_id uuid) returns void as $$
begin
  -- junction / child tables first, scoped via parent row ids
  delete from booking_charges
    where booking_id in (select id from bookings where tenant_id = p_tenant_id);
  delete from booking_tags
    where booking_id in (select id from bookings where tenant_id = p_tenant_id);
  delete from property_tags
    where property_id in (select id from properties where tenant_id = p_tenant_id);
  delete from guest_tags
    where guest_id in (select id from guests where tenant_id = p_tenant_id);
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
