-- fix search_path on functions flagged by supabase linter
alter function public.delete_tenant_data(uuid) set search_path = public;
alter function public.increment_usage_metric(uuid, text, timestamptz, timestamptz, integer) set search_path = public;
alter function public.replace_expense_templates(uuid, uuid, jsonb) set search_path = public;
alter function public.replace_operating_expenses(uuid, uuid, integer, integer, jsonb) set search_path = public;
alter function public.replace_platform_fees(uuid, uuid, integer, integer, jsonb) set search_path = public;
alter function public.replace_active_tax_config(uuid, uuid, text, jsonb, jsonb, timestamptz) set search_path = public;

-- fix RLS initplan: wrap auth.uid() in (select ...) so postgres evaluates it
-- once per query instead of per row
drop policy if exists "tenant isolation" on property_groups;
create policy "tenant isolation" on property_groups
  for all using (tenant_id = (select id from tenants where user_id = (select auth.uid())));

drop policy if exists "tenant isolation" on property_group_members;
create policy "tenant isolation" on property_group_members
  for all using (tenant_id = (select id from tenants where user_id = (select auth.uid())));

-- drop duplicate index on guests (the constraint-backed one stays)
alter table guests drop constraint if exists guests_tenant_ownerrez_guest_id_unique;
