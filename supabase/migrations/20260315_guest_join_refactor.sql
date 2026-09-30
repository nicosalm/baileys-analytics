-- guest join refactor: stop denormalizing guest_email/guest_phone onto bookings
-- instead, JOIN to the guests table via (tenant_id, ownerrez_guest_id)
--
-- this migration:
-- 1. converts guests.ownerrez_guest_id from bigint to text (matches bookings)
-- 2. backfills missing guest records from bookings data
-- 3. adds a composite index for JOIN performance
-- 4. updates get_repeat_guest_count RPC to use ownerrez_guest_id
--
-- note: we do NOT drop guest_email/guest_phone from bookings yet (safe rollback window).
-- the FK is DEFERRABLE INITIALLY DEFERRED so bulk sync can insert bookings before
-- the referenced guest exists (constraint checked at transaction commit).

-- 1. convert guests.ownerrez_guest_id to text to match bookings.ownerrez_guest_id
alter table public.guests
  alter column ownerrez_guest_id type text using ownerrez_guest_id::text;

-- 2. backfill: create stub guest records for any booking ownerrez_guest_id
--    that doesn't have a corresponding guests row
insert into public.guests (tenant_id, ownerrez_guest_id, full_name, email, phone, updated_at)
select distinct on (b.tenant_id, b.ownerrez_guest_id)
  b.tenant_id,
  b.ownerrez_guest_id,
  b.guest_name,
  b.guest_email,
  b.guest_phone,
  now()
from public.bookings b
where b.ownerrez_guest_id is not null
  and not exists (
    select 1 from public.guests g
    where g.tenant_id = b.tenant_id
      and g.ownerrez_guest_id = b.ownerrez_guest_id
  )
order by b.tenant_id, b.ownerrez_guest_id, b.updated_at desc;

-- 3. also backfill contact info from bookings into guests where guests record
--    exists but is missing email/phone
update public.guests g
set
  email = coalesce(g.email, sub.guest_email),
  phone = coalesce(g.phone, sub.guest_phone)
from (
  select distinct on (tenant_id, ownerrez_guest_id)
    tenant_id, ownerrez_guest_id, guest_email, guest_phone
  from public.bookings
  where ownerrez_guest_id is not null
    and (guest_email is not null or guest_phone is not null)
  order by tenant_id, ownerrez_guest_id, updated_at desc
) sub
where g.tenant_id = sub.tenant_id
  and g.ownerrez_guest_id = sub.ownerrez_guest_id
  and (g.email is null or g.phone is null);

-- 4. index for efficient JOIN from bookings to guests
create index if not exists idx_guests_tenant_ownerrez_id
  on public.guests (tenant_id, ownerrez_guest_id);

create index if not exists idx_bookings_tenant_guest_ownerrez_id
  on public.bookings (tenant_id, ownerrez_guest_id)
  where ownerrez_guest_id is not null;

-- 5. ensure unique constraint on guests(tenant_id, ownerrez_guest_id) exists
--    (required for the FK; the upserts already rely on this, so it should exist)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'guests_tenant_ownerrez_guest_id_unique'
  ) then
    alter table public.guests
      add constraint guests_tenant_ownerrez_guest_id_unique
      unique (tenant_id, ownerrez_guest_id);
  end if;
end $$;

-- 6. add FK from bookings to guests (enables Supabase/PostgREST automatic JOINs)
alter table public.bookings
  add constraint bookings_guest_fk
  foreign key (tenant_id, ownerrez_guest_id)
  references public.guests (tenant_id, ownerrez_guest_id)
  deferrable initially deferred;

-- 7. update get_repeat_guest_count to use ownerrez_guest_id instead of guest_email
create or replace function public.get_repeat_guest_count(
  p_tenant_id uuid,
  p_from date,
  p_to date,
  p_property_ids uuid[] default null,
  p_booking_ids uuid[] default null
)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct guest_identifier)::bigint
  from (
    select coalesce(ownerrez_guest_id, lower(guest_name)) as guest_identifier
    from public.bookings
    where tenant_id = p_tenant_id
      and arrival::date <= p_to
      and departure::date >= p_from
      and status != 'canceled'
      and coalesce(ownerrez_guest_id, guest_name) is not null
      and (p_property_ids is null or property_id = any(p_property_ids))
      and (p_booking_ids is null or id = any(p_booking_ids))
  ) current_guests
  where exists (
    select 1 from public.bookings prior
    where prior.tenant_id = p_tenant_id
      and prior.arrival::date < p_from
      and prior.status != 'canceled'
      and coalesce(prior.ownerrez_guest_id, lower(prior.guest_name))
        = current_guests.guest_identifier
  );
$$;
