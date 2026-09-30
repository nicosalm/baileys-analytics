-- RLS policies for the Data API
-- allows authenticated users to SELECT their own data via the REST API
-- all policies use the same tenant lookup: tenant_id = (select id from tenants where user_id = auth.uid())

-- helper: reusable function so we don't repeat the subquery in every policy
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.tenants where user_id = auth.uid()
$$;

-- properties
create policy "api_select_own_properties"
  on properties for select to authenticated
  using (tenant_id = public.current_tenant_id());

-- bookings
create policy "api_select_own_bookings"
  on bookings for select to authenticated
  using (tenant_id = public.current_tenant_id());

-- guests
create policy "api_select_own_guests"
  on guests for select to authenticated
  using (tenant_id = public.current_tenant_id());

-- blocks: covered by blocks_access policy

-- booking_charges (no tenant_id, join through bookings)
create policy "api_select_own_booking_charges"
  on booking_charges for select to authenticated
  using (booking_id in (select id from bookings where tenant_id = public.current_tenant_id()));

-- tags
create policy "api_select_own_tags"
  on tags for select to authenticated
  using (tenant_id = public.current_tenant_id());

-- operating_expenses: covered by tenant_isolation policy

-- season_configurations
create policy "api_select_own_season_configurations"
  on season_configurations for select to authenticated
  using (tenant_id = public.current_tenant_id());

-- goals: covered by tenant_goals_select policy

-- junction tables (no tenant_id, scoped through foreign keys)
create policy "api_select_own_booking_tags"
  on booking_tags for select to authenticated
  using (booking_id in (select id from bookings where tenant_id = public.current_tenant_id()));

create policy "api_select_own_property_tags"
  on property_tags for select to authenticated
  using (property_id in (select id from properties where tenant_id = public.current_tenant_id()));

-- guest_tags: covered by guest_tags_access policy
