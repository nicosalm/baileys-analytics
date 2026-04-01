-- fix get_repeat_guest_count to match guests dashboard definition:
-- repeat = guest has more than one non-cancelled booking all-time
-- (previously used arrival < p_from which returned ~0 for all-time queries)
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
  where (
    select count(*)
    from public.bookings all_time
    where all_time.tenant_id = p_tenant_id
      and all_time.status != 'canceled'
      and coalesce(all_time.ownerrez_guest_id, lower(all_time.guest_name))
        = current_guests.guest_identifier
  ) > 1;
$$;
