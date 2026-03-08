-- occupancy computation via SQL: replaces JS date-expansion loops
-- called from cloudflare workers with service role key (no RLS)

-- 1. overall occupancy: count distinct (property_id, date) pairs
create or replace function public.get_overall_occupancy(
  p_tenant_id uuid,
  p_from date,
  p_to date,
  p_property_ids uuid[] default null,
  p_booking_ids uuid[] default null
)
returns table(booked_nights bigint, available_nights bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with occupied as (
    select count(distinct (b.property_id, d::date)) as nights
    from public.bookings b,
      generate_series(
        greatest(b.arrival::date, p_from),
        least(b.departure::date - 1, p_to),
        '1 day'::interval
      ) as d
    where b.tenant_id = p_tenant_id
      and b.status != 'canceled'
      and b.arrival::date <= p_to
      and b.departure::date > p_from
      and (p_property_ids is null or b.property_id = any(p_property_ids))
      and (p_booking_ids is null or b.id = any(p_booking_ids))
  ),
  avail as (
    select (p_to - p_from + 1) * count(*)::bigint as nights
    from public.properties
    where tenant_id = p_tenant_id
      and active = true
      and (p_property_ids is null or id = any(p_property_ids))
  )
  select occupied.nights as booked_nights, avail.nights as available_nights
  from occupied, avail;
$$;

-- 2. per-property occupancy: booked nights + revenue per property
create or replace function public.get_property_occupancy(
  p_tenant_id uuid,
  p_from date,
  p_to date,
  p_property_ids uuid[] default null,
  p_booking_ids uuid[] default null
)
returns table(property_id uuid, booked_nights bigint, revenue numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.property_id,
    count(distinct d::date) as booked_nights,
    -- sum revenue only once per booking (on the first generated day)
    sum(b.total_amount) filter (
      where d::date = greatest(b.arrival::date, p_from)
    ) as revenue
  from public.bookings b,
    generate_series(
      greatest(b.arrival::date, p_from),
      least(b.departure::date - 1, p_to),
      '1 day'::interval
    ) as d
  where b.tenant_id = p_tenant_id
    and b.status != 'canceled'
    and b.arrival::date <= p_to
    and b.departure::date > p_from
    and (p_property_ids is null or b.property_id = any(p_property_ids))
    and (p_booking_ids is null or b.id = any(p_booking_ids))
  group by b.property_id;
$$;

-- 3. periodic occupancy: booked nights bucketed by granularity
-- granularity: 'daily', 'weekly', 'monthly'
-- weekly uses sunday-start to match JS convention
create or replace function public.get_periodic_occupancy(
  p_tenant_id uuid,
  p_from date,
  p_to date,
  p_granularity text default 'monthly',
  p_property_ids uuid[] default null,
  p_booking_ids uuid[] default null
)
returns table(period text, booked_nights bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case p_granularity
      when 'daily' then d::date::text
      -- sunday-start week: subtract day-of-week to get sunday
      when 'weekly' then (d::date - extract(dow from d::date)::int)::text
      else to_char(d::date, 'YYYY-MM')
    end as period,
    count(distinct (b.property_id, d::date)) as booked_nights
  from public.bookings b,
    generate_series(
      greatest(b.arrival::date, p_from),
      least(b.departure::date - 1, p_to),
      '1 day'::interval
    ) as d
  where b.tenant_id = p_tenant_id
    and b.status != 'canceled'
    and b.arrival::date <= p_to
    and b.departure::date > p_from
    and (p_property_ids is null or b.property_id = any(p_property_ids))
    and (p_booking_ids is null or b.id = any(p_booking_ids))
  group by period
  order by period;
$$;

-- 4. repeat guest count: guests in current period who also booked before
-- p_property_ids and p_booking_ids filter the current-period set to match
-- the same filters applied to the JS uniqueGuests set
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
    select lower(nullif(guest_email, '')) as email,
           lower(guest_name) as name,
           coalesce(lower(nullif(guest_email, '')), lower(guest_name)) as guest_identifier
    from public.bookings
    where tenant_id = p_tenant_id
      and arrival::date <= p_to
      and departure::date >= p_from
      and status != 'canceled'
      and coalesce(nullif(guest_email, ''), guest_name) is not null
      and (p_property_ids is null or property_id = any(p_property_ids))
      and (p_booking_ids is null or id = any(p_booking_ids))
  ) current_guests
  where exists (
    select 1 from public.bookings prior
    where prior.tenant_id = p_tenant_id
      and prior.arrival::date < p_from
      and prior.status != 'canceled'
      and coalesce(lower(nullif(prior.guest_email, '')), lower(prior.guest_name))
        = current_guests.guest_identifier
  );
$$;
