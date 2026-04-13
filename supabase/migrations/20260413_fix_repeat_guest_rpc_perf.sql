-- rewrite get_repeat_guest_count to use a CTE instead of a correlated subquery.
-- the old version ran a per-guest scan of the entire bookings table (O(guests * bookings)),
-- taking 14+ seconds on a 20k-booking tenant. this version scans bookings twice (O(bookings))
-- and joins, completing in under 1 second.

create or replace function get_repeat_guest_count(
  p_tenant_id uuid,
  p_from date,
  p_to date,
  p_property_ids uuid[] default null,
  p_booking_ids uuid[] default null
) returns bigint
language sql
stable
security definer
set search_path = public
as $$
  with all_time_counts as (
    select coalesce(ownerrez_guest_id, lower(trim(guest_name))) as gid, count(*) as cnt
    from bookings
    where tenant_id = p_tenant_id
      and status != 'canceled'
      and coalesce(ownerrez_guest_id, guest_name) is not null
    group by 1
  ),
  current_guests as (
    select distinct coalesce(ownerrez_guest_id, lower(trim(guest_name))) as gid
    from bookings
    where tenant_id = p_tenant_id
      and status != 'canceled'
      and arrival::date <= p_to
      and departure::date >= p_from
      and coalesce(ownerrez_guest_id, guest_name) is not null
      and (p_property_ids is null or property_id = any(p_property_ids))
      and (p_booking_ids is null or id = any(p_booking_ids))
  )
  select count(*)::bigint
  from current_guests c
  join all_time_counts a on c.gid = a.gid
  where a.cnt > 1;
$$;
