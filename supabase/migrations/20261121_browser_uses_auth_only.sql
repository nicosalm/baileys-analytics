-- apply after deploying the worker and web app from the same commit: the previous web
-- build reads tenants and oauth_tokens directly and stops working once this runs.
--
-- the browser now talks to supabase for auth only. every table read and write goes
-- through the worker, which uses the service role. before this, authenticated held
-- insert/update on every column of tenants, so any signed-in user could set
-- subscription_exempt = true on their own row and skip billing, or insert extra tenant
-- rows carrying another user's user_id. the Data API select policies are gone with the
-- feature they served.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

drop policy if exists "Users can create own tenant" on public.tenants;
drop policy if exists "Block anonymous tenant creation" on public.tenants;
drop policy if exists "Users can update own tenant" on public.tenants;

drop policy if exists api_select_own_properties on public.properties;
drop policy if exists api_select_own_bookings on public.bookings;
drop policy if exists api_select_own_guests on public.guests;
drop policy if exists api_select_own_booking_charges on public.booking_charges;
drop policy if exists api_select_own_tags on public.tags;
drop policy if exists api_select_own_season_configurations on public.season_configurations;
drop policy if exists api_select_own_booking_tags on public.booking_tags;
drop policy if exists api_select_own_property_tags on public.property_tags;

-- one tenant per user. the signup trigger and the worker's auth middleware can race on a
-- first request; detached tenants have a null user_id, which a unique index allows.
create unique index if not exists tenants_user_id_key on public.tenants (user_id);
