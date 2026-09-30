-- fix duplicate permissive SELECT policies and tighten role grants

begin;

-- 1. drop duplicate SELECT policies (keep the broader one from each pair)
drop policy if exists "api_select_own_blocks" on blocks;
drop policy if exists "api_select_own_goals" on goals;
drop policy if exists "api_select_own_guest_tags" on guest_tags;
drop policy if exists "api_select_own_operating_expenses" on operating_expenses;

-- 2. tighten {public} -> {authenticated} on billing/sensitive tables
--    these were created with TO public, meaning the anon role can attempt them

-- billing_history
drop policy if exists "Users can view their own billing history" on billing_history;
create policy "Users can view their own billing history"
  on billing_history for select to authenticated
  using (tenant_id in (select id from tenants where user_id = (select auth.uid())));

-- payment_methods
drop policy if exists "Users can view their own payment methods" on payment_methods;
create policy "Users can view their own payment methods"
  on payment_methods for select to authenticated
  using (tenant_id in (select id from tenants where user_id = (select auth.uid())));

-- stripe_customers
drop policy if exists "Users can view their own billing data" on stripe_customers;
create policy "Users can view their own billing data"
  on stripe_customers for select to authenticated
  using (tenant_id in (select id from tenants where user_id = (select auth.uid())));

-- subscriptions
drop policy if exists "Users can view their own subscriptions" on subscriptions;
create policy "Users can view their own subscriptions"
  on subscriptions for select to authenticated
  using (tenant_id in (select id from tenants where user_id = (select auth.uid())));

-- 3. service-role-only tables: restrict to authenticated role
--    the qual already checks for service_role, but granting to {public}
--    means anon can hit the policy check unnecessarily

-- background_jobs
drop policy if exists "Service role can manage background_jobs" on background_jobs;
create policy "Service role can manage background_jobs"
  on background_jobs for all to authenticated
  using ((select auth.role()) = 'service_role');

-- webhook_events
drop policy if exists "Service role can manage webhook_events" on webhook_events;
create policy "Service role can manage webhook_events"
  on webhook_events for all to authenticated
  using ((select auth.role()) = 'service_role');

commit;
