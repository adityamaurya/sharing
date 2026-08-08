-- Operational functions and scheduled jobs.

-- ── Guarantee fund ──────────────────────────────────────────────────────────

create or replace function adjust_fund_balance(delta bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance bigint;
begin
  update fund_balance
     set balance_paise = balance_paise + delta,
         updated_at = now()
   where id
  returning balance_paise into new_balance;

  return new_balance;
end;
$$;

revoke all on function adjust_fund_balance(bigint) from public, anon, authenticated;

-- ── Finding a pool to join ──────────────────────────────────────────────────

-- Open pools on a corridor within the pooling window, nearest departure first.
-- Excludes pools the caller is already in and pools that are full.
create or replace function find_open_pools(
  p_corridor uuid,
  p_departure timestamptz,
  p_window_minutes int default 7,
  p_women_only boolean default false
)
returns table (
  pool_id uuid,
  departure_at timestamptz,
  seats_taken int,
  seats_left int,
  driver_name text,
  minutes_apart numeric
)
language sql stable
security invoker
as $$
  select
    p.id,
    p.departure_at,
    p.seats_taken,
    3 - p.seats_taken as seats_left,
    split_part(pr.display_name, ' ', 1) as driver_name,
    abs(extract(epoch from (p.departure_at - p_departure)) / 60)::numeric(6,1)
  from pools p
  left join profiles pr on pr.id = p.driver_id
  where p.corridor_id = p_corridor
    and p.status = 'forming'
    and p.seats_taken < 3
    and p.women_only = p_women_only
    and p.departure_at between p_departure - make_interval(mins => p_window_minutes)
                           and p_departure + make_interval(mins => p_window_minutes)
    and not exists (
      select 1 from seats s
      where s.pool_id = p.id
        and s.passenger_id = auth.uid()
        and s.status in ('held', 'booked', 'boarded')
    )
  order by abs(extract(epoch from (p.departure_at - p_departure))), p.seats_taken desc;
$$;

-- ── Honest demand signal ────────────────────────────────────────────────────

-- How many people actually want this corridor and window, from the last 14 days
-- of behaviour. Feeds the density switch that decides swipe vs auto matching,
-- and the "nobody is going your way" message. It must never be inflated: an app
-- that fakes demand dies in a week at a Mumbai station.
create or replace function corridor_density(
  p_corridor uuid,
  p_departure_minute int,
  p_window_minutes int default 7
)
returns int
language sql stable
as $$
  select count(distinct s.passenger_id)::int
  from seats s
  join pools p on p.id = s.pool_id
  where p.corridor_id = p_corridor
    and s.created_at > now() - interval '14 days'
    and s.status in ('booked', 'boarded', 'completed')
    and abs(
      (extract(hour from p.departure_at at time zone 'Asia/Kolkata') * 60
       + extract(minute from p.departure_at at time zone 'Asia/Kolkata'))
      - p_departure_minute
    ) <= p_window_minutes;
$$;

-- ── Housekeeping ────────────────────────────────────────────────────────────

-- Seats are held for 90 seconds while a passenger confirms. Expire them so a
-- half-finished booking never blocks a seat somebody else could use.
create or replace function expire_held_seats() returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  with expired as (
    update seats set status = 'cancelled'
    where status = 'held' and held_until < now()
    returning pool_id
  )
  select count(*) into n from expired;

  update pools p
     set seats_taken = (
       select count(*) from seats s
       where s.pool_id = p.id and s.status in ('held', 'booked', 'boarded', 'completed')
     )
   where p.status = 'forming';

  return n;
end;
$$;

-- A driver who has not reached the pickup geofence by departure + 5 min has
-- no-showed. Detected from GPS, so the passenger never has to complain to
-- trigger it — they are standing at a gate, not filling in a form.
create or replace function detect_driver_no_shows() returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int := 0;
begin
  update pools
     set status = 'cancelled'
   where status in ('assigned', 'boarding')
     and departure_at < now() - interval '5 minutes';

  get diagnostics n = row_count;
  return n;
end;
$$;

-- Expire passes whose end date has passed, so a lapsed pass stops matching.
create or replace function expire_passes() returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update passes set status = 'expired'
   where status = 'active' and end_date < current_date;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ── Schedule ────────────────────────────────────────────────────────────────
-- Enable pg_cron in the Supabase dashboard (Database → Extensions) first.

-- select cron.schedule('expire-held-seats',  '* * * * *',  $$select expire_held_seats()$$);
-- select cron.schedule('detect-no-shows',    '* * * * *',  $$select detect_driver_no_shows()$$);
-- select cron.schedule('expire-passes',      '15 0 * * *', $$select expire_passes()$$);
