-- Sharing — initial schema
--
-- Postgres + PostGIS on Supabase. Three principles run through this file:
--
--   1. Money is `bigint` paise. Never numeric, never float. A float rounding
--      error that loses a driver ten paise a ride loses him ₹70 a year.
--   2. The seat cap is a database constraint, not an application rule. Three
--      passengers is a legal seating limit and a safety floor; it must be
--      impossible to exceed even with a buggy client or a bad migration.
--   3. The ledger is append-only. Corrections are new rows, never UPDATEs.
--      When a driver asks why he was paid ₹138 you need the history, not the
--      current state.

create extension if not exists postgis;
create extension if not exists pgcrypto;

-- ── Enums ───────────────────────────────────────────────────────────────────

create type role_kind        as enum ('passenger', 'driver', 'admin');
create type hotspot_kind     as enum ('station', 'society', 'college', 'office', 'market', 'other');
create type ride_mode        as enum ('now', 'later', 'daily');
create type pool_status      as enum ('forming', 'locked', 'assigned', 'boarding', 'running', 'completed', 'cancelled');
create type seat_status      as enum ('held', 'booked', 'cancelled', 'reseated', 'boarded', 'completed', 'no_show');
create type pass_plan        as enum ('weekly', 'monthly');
create type pass_status      as enum ('active', 'paused', 'expired', 'cancelled');
create type fuel_kind        as enum ('cng', 'petrol', 'electric');
create type ledger_direction as enum ('credit', 'debit');
create type ledger_account   as enum ('passenger', 'driver', 'platform', 'guarantee_fund');

-- ── People ──────────────────────────────────────────────────────────────────

create table profiles (
  id            uuid primary key references auth.users on delete cascade,
  display_name  text not null,
  phone         text unique,
  -- Stored so we can offer women-only pools. Nullable, never required, and
  -- never shown to other users — only used as a matching filter.
  gender        text check (gender in ('f', 'm', 'x')),
  preferred_language text not null default 'en' check (preferred_language in ('en', 'hi', 'mr')),
  roles         role_kind[] not null default array['passenger']::role_kind[],
  -- 0–100. Exposed to users only as a badge; raw numbers invite gaming.
  reliability   int not null default 70 check (reliability between 0 and 100),
  created_at    timestamptz not null default now()
);

create table drivers (
  id              uuid primary key references profiles(id) on delete cascade,
  -- MVAG 2025 requires police verification, a medical, and a psychological
  -- assessment before onboarding. No driver may be matched until all three
  -- are recorded — enforced in `driver_is_eligible()` below.
  police_verified_at   timestamptz,
  medical_cleared_at   timestamptz,
  psych_cleared_at     timestamptz,
  induction_done_at    timestamptz,
  licence_number       text not null,
  licence_expires_on   date not null,
  registered_plate     text not null,
  vehicle_fuel         fuel_kind not null,
  vehicle_permit_no    text,
  insurance_expires_on date,
  suspended_until      timestamptz,
  created_at           timestamptz not null default now()
);

create index on drivers (suspended_until) where suspended_until is not null;

-- ── Geography ───────────────────────────────────────────────────────────────

create table hotspots (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  name_hi     text,
  name_mr     text,
  kind        hotspot_kind not null,
  centre      geography(point, 4326) not null,
  geofence_m  int not null default 150 check (geofence_m between 30 and 1000),
  active      boolean not null default true
);

create index hotspots_centre_idx on hotspots using gist (centre);

create table corridors (
  id             uuid primary key default gen_random_uuid(),
  from_hotspot   uuid not null references hotspots(id),
  to_hotspot     uuid not null references hotspots(id),
  -- The full rickshaw fare for the whole trip, in paise. Fixed and published;
  -- there is no surge column here and adding one would break the product.
  full_fare      bigint not null check (full_fare > 0),
  distance_km    numeric(5,2) not null,
  duration_min   int not null,
  active         boolean not null default false,
  committed_drivers int not null default 0,
  created_at     timestamptz not null default now(),
  constraint corridor_endpoints_differ check (from_hotspot <> to_hotspot),
  unique (from_hotspot, to_hotspot)
);

-- ── Pools and seats ─────────────────────────────────────────────────────────

create table pools (
  id            uuid primary key default gen_random_uuid(),
  corridor_id   uuid not null references corridors(id),
  departure_at  timestamptz not null,
  status        pool_status not null default 'forming',
  driver_id     uuid references drivers(id),
  women_only    boolean not null default false,
  -- Denormalised for the seat-cap constraint below; kept honest by trigger.
  seats_taken   int not null default 0 check (seats_taken between 0 and 3),
  created_at    timestamptz not null default now()
);

create index pools_open_idx on pools (corridor_id, departure_at)
  where status in ('forming', 'locked');

create table seats (
  id            uuid primary key default gen_random_uuid(),
  pool_id       uuid not null references pools(id) on delete cascade,
  passenger_id  uuid not null references profiles(id),
  pass_id       uuid,
  mode          ride_mode not null,
  status        seat_status not null default 'held',
  fare_paid     bigint not null default 0 check (fare_paid >= 0),
  held_until    timestamptz,
  created_at    timestamptz not null default now(),
  -- One passenger cannot hold two seats in the same rickshaw.
  unique (pool_id, passenger_id)
);

create index seats_passenger_idx on seats (passenger_id, created_at desc);

-- The seat cap, enforced in the database.
--
-- Serialised on the pool row so two concurrent bookings can never both see
-- two seats taken and both insert a third. This is the one race in the system
-- that would put four people in a three-person rickshaw.
create or replace function enforce_seat_cap() returns trigger
language plpgsql as $$
declare
  taken int;
begin
  perform 1 from pools where id = new.pool_id for update;

  select count(*) into taken
  from seats
  where pool_id = new.pool_id
    and status in ('held', 'booked', 'boarded', 'completed');

  if taken > 3 then
    raise exception 'Pool % already has % seats; the cap is 3', new.pool_id, taken
      using errcode = 'check_violation';
  end if;

  update pools set seats_taken = taken where id = new.pool_id;
  return new;
end;
$$;

create constraint trigger seats_cap_trigger
  after insert or update of status on seats
  deferrable initially immediate
  for each row execute function enforce_seat_cap();

-- ── Passes ──────────────────────────────────────────────────────────────────

create table passes (
  id                uuid primary key default gen_random_uuid(),
  passenger_id      uuid not null references profiles(id),
  corridor_id       uuid not null references corridors(id),
  plan              pass_plan not null,
  departure_minute  int not null check (departure_minute between 0 and 1439),
  service_weekdays  int[] not null check (array_length(service_weekdays, 1) between 1 and 7),
  start_date        date not null,
  -- Moves forward as credit days accrue. This column *is* the credit balance,
  -- which is why users see a date and never a number.
  end_date          date not null,
  -- Locked for the life of the pass. A published fare revision never touches
  -- a running pass.
  seat_fare         bigint not null check (seat_fare > 0),
  grace_days_total  int not null check (grace_days_total >= 0),
  grace_days_used   int not null default 0 check (grace_days_used >= 0),
  credit_days_banked numeric(4,2) not null default 0 check (credit_days_banked >= 0),
  women_only        boolean not null default false,
  status            pass_status not null default 'active',
  created_at        timestamptz not null default now(),
  constraint grace_not_overspent check (grace_days_used <= grace_days_total),
  constraint pass_dates_ordered check (end_date >= start_date)
);

alter table seats add constraint seats_pass_fk
  foreign key (pass_id) references passes(id) on delete set null;

create index passes_active_idx on passes (passenger_id, status)
  where status = 'active';

-- ── The money ledger ────────────────────────────────────────────────────────

-- Append-only, double-entry. Every rupee that moves leaves two rows: one debit
-- and one credit, sharing an `entry_group`. If the two sides of a group don't
-- sum to zero, something is wrong and `assert_ledger_balanced()` will say so.
create table ledger (
  id            bigserial primary key,
  entry_group   uuid not null,
  account       ledger_account not null,
  -- Whose account, when the account type is per-person.
  subject_id    uuid references profiles(id),
  direction     ledger_direction not null,
  amount_paise  bigint not null check (amount_paise > 0),
  seat_id       uuid references seats(id),
  pool_id       uuid references pools(id),
  pass_id       uuid references passes(id),
  reason        text not null,
  created_at    timestamptz not null default now()
);

create index ledger_group_idx   on ledger (entry_group);
create index ledger_subject_idx on ledger (subject_id, created_at desc);

-- The ledger never changes after the fact. Corrections are new rows.
create rule ledger_no_update as on update to ledger do instead nothing;
create rule ledger_no_delete as on delete to ledger do instead nothing;

create or replace function assert_ledger_balanced(group_id uuid) returns void
language plpgsql as $$
declare
  net bigint;
begin
  select coalesce(sum(case when direction = 'credit' then amount_paise else -amount_paise end), 0)
    into net
  from ledger where entry_group = group_id;

  if net <> 0 then
    raise exception 'Ledger group % is out of balance by % paise', group_id, net;
  end if;
end;
$$;

-- ── Cancellations ───────────────────────────────────────────────────────────

create table cancellations (
  id              uuid primary key default gen_random_uuid(),
  seat_id         uuid not null references seats(id),
  pass_id         uuid references passes(id),
  actor           text not null check (actor in ('passenger', 'driver', 'system')),
  cancelled_at    timestamptz not null default now(),
  departure_at    timestamptz not null,
  notice_hours    numeric(6,2) not null,
  notice_tier     text not null,
  reseated        boolean not null default false,
  grace_day_used  boolean not null default false,
  credit_days     numeric(3,2) not null,
  driver_payout   bigint not null,
  fund_outflow    bigint not null default 0,
  passenger_forfeit bigint not null default 0,
  -- Deliberately absent: any column for *why*. We never ask, so we never store
  -- it, so it can never be subpoenaed, leaked, or used to judge anybody.
  -- See docs/01-fairness-engine.md §1. Do not add one.
  created_at      timestamptz not null default now()
);

create index cancellations_seat_idx on cancellations (seat_id);

-- ── Guarantee fund ──────────────────────────────────────────────────────────

create table fund_balance (
  id              boolean primary key default true check (id),
  balance_paise   bigint not null default 0,
  updated_at      timestamptz not null default now()
);

insert into fund_balance (id, balance_paise) values (true, 0);

-- ── Fuel programme ──────────────────────────────────────────────────────────

create table fuel_stations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  location     geography(point, 4326) not null,
  geofence_m   int not null default 60,
  sells        fuel_kind[] not null
);

create index fuel_stations_loc_idx on fuel_stations using gist (location);

create table fuel_logs (
  id             uuid primary key default gen_random_uuid(),
  driver_id      uuid not null references drivers(id),
  station_id     uuid not null references fuel_stations(id),
  fuel_type      fuel_kind not null,
  quantity       numeric(6,2) not null check (quantity > 0),
  amount_paise   bigint not null check (amount_paise > 0),
  ocr_plate      text,
  substitute_vehicle boolean not null default false,
  dwell_seconds  int not null,
  -- Rewarded logs are the ones that count against the weekly rate limit.
  -- Unrewarded logs are still stored: the data is useful and rejecting it
  -- teaches drivers to stop logging, which makes the programme worthless.
  reward_paise   bigint not null default 0 check (reward_paise >= 0),
  held_for_review boolean not null default false,
  rejection_codes text[] not null default '{}',
  logged_at      timestamptz not null default now()
);

create index fuel_logs_driver_idx  on fuel_logs (driver_id, logged_at desc);
create index fuel_logs_rewarded_idx on fuel_logs (driver_id, logged_at desc)
  where reward_paise > 0;

-- ── Eligibility ─────────────────────────────────────────────────────────────

-- A driver may only be matched when every MVAG 2025 check is on file, the
-- licence and insurance are current, and no suspension is running.
create or replace function driver_is_eligible(d_id uuid) returns boolean
language sql stable as $$
  select
    d.police_verified_at is not null
    and d.medical_cleared_at is not null
    and d.psych_cleared_at is not null
    and d.induction_done_at is not null
    and d.licence_expires_on > current_date
    and (d.insurance_expires_on is null or d.insurance_expires_on > current_date)
    and (d.suspended_until is null or d.suspended_until < now())
  from drivers d where d.id = d_id;
$$;

-- ── Row level security ──────────────────────────────────────────────────────
--
-- Default deny. Every table is locked and opened deliberately.

alter table profiles      enable row level security;
alter table drivers       enable row level security;
alter table hotspots      enable row level security;
alter table corridors     enable row level security;
alter table pools         enable row level security;
alter table seats         enable row level security;
alter table passes        enable row level security;
alter table ledger        enable row level security;
alter table cancellations enable row level security;
alter table fuel_logs     enable row level security;
alter table fuel_stations enable row level security;
alter table fund_balance  enable row level security;

-- Hotspots, corridors and fuel stations are public reference data.
create policy hotspots_read  on hotspots      for select using (true);
create policy corridors_read on corridors     for select using (true);
create policy stations_read  on fuel_stations for select using (true);

-- You can read and edit only your own profile.
create policy profiles_self on profiles
  for select using (id = auth.uid());
create policy profiles_update_self on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy drivers_self on drivers
  for select using (id = auth.uid());

-- You can see a pool if you have a seat in it, or if it is still forming and
-- therefore joinable. Note what this does NOT expose: who else is in it. Names
-- of co-riders come from a view that returns first name and badge only.
create policy pools_visible on pools
  for select using (
    status = 'forming'
    or driver_id = auth.uid()
    or exists (select 1 from seats s where s.pool_id = pools.id and s.passenger_id = auth.uid())
  );

-- Your seats are yours. Drivers see the seats on pools they are driving.
create policy seats_own on seats
  for select using (
    passenger_id = auth.uid()
    or exists (select 1 from pools p where p.id = seats.pool_id and p.driver_id = auth.uid())
  );
create policy seats_insert_own on seats
  for insert with check (passenger_id = auth.uid());

create policy passes_own on passes
  for all using (passenger_id = auth.uid()) with check (passenger_id = auth.uid());

-- Money is readable by the person it belongs to, and writable by nobody.
-- Every ledger write goes through a security-definer function, so a stolen
-- client key cannot mint credit.
create policy ledger_own on ledger
  for select using (subject_id = auth.uid());

create policy cancellations_own on cancellations
  for select using (
    exists (select 1 from seats s where s.id = cancellations.seat_id and s.passenger_id = auth.uid())
  );

create policy fuel_logs_own on fuel_logs
  for select using (driver_id = auth.uid());

-- Fund balance is operational data, not user data. Service role only; no
-- policy is created, so RLS denies everyone else by default.

-- ── Co-rider view: the minimum a passenger needs to trust a pool ────────────

create view pool_co_riders
with (security_invoker = true) as
select
  s.pool_id,
  split_part(p.display_name, ' ', 1) as first_name,
  case
    when p.reliability >= 85 then 'gold'
    when p.reliability >= 65 then 'silver'
    else 'new'
  end as reliability_badge
from seats s
join profiles p on p.id = s.passenger_id
where s.status in ('held', 'booked', 'boarded');

comment on view pool_co_riders is
  'First name and reliability badge only. Never surnames, phone numbers, exact '
  'reliability scores, or home pickup points — a pooling app that leaks where a '
  'woman is picked up every morning is a safety incident waiting to happen.';
