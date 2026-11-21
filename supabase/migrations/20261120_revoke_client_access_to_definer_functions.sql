-- security definer functions bypass RLS. these were executable by anon and authenticated
-- through /rest/v1/rpc, and several accept an arbitrary p_tenant_id, so any holder of the
-- public anon key could read another tenant's revenue, properties, and guests.
-- the app calls none of them from a client; the worker uses the service role.

revoke execute on function public.get_financial_summary(uuid, date, date, uuid[]) from public, anon, authenticated;
revoke execute on function public.get_guest_analytics(uuid, date, date) from public, anon, authenticated;
revoke execute on function public.get_property_metrics(uuid, date, date) from public, anon, authenticated;
revoke execute on function public.calculate_occupancy(uuid, date, date, uuid, uuid[]) from public, anon, authenticated;
revoke execute on function public.sum_all_booking_revenue() from public, anon, authenticated;
revoke execute on function public.get_database_stats() from public, anon, authenticated;
revoke execute on function public.cleanup_expired_oauth_states() from public, anon, authenticated;

-- trigger and event trigger functions: privilege is checked when the trigger is created, not when it fires
revoke execute on function public.create_tenant_for_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.update_platform_guest_fees_updated_at() from public, anon, authenticated;
revoke execute on function public.update_updated_at_column() from public, anon, authenticated;

-- used inside RLS policies, so signed-in users keep it
revoke execute on function public.current_tenant_id() from public, anon;
grant execute on function public.current_tenant_id() to authenticated;

-- the frontend only reads tables after sign-in. anonymous (demo) sessions use the
-- authenticated role, so anon needs no table access at all. this also hides the
-- schema from unauthenticated GraphQL introspection.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon;
