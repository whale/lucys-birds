-- Two hardening changes.

-- ---------------------------------------------------------- row level security
--
-- The app only ever talks to Postgres with the service role key, which bypasses
-- RLS, so enabling it changes nothing today. It matters for the day someone adds
-- a browser-side Supabase client: the anon key would ship to the phone, and with
-- RLS off that key is unrestricted insert/update/delete on both tables — around
-- the passcode gate, around every check in the app.
--
-- Enabled with no policies at all, which denies anon and authenticated outright.
-- A landmine defused before anyone steps on it.

alter table recordings enable row level security;
alter table sightings  enable row level security;

-- --------------------------------------------------------------- unlock attempts
--
-- Replaces an in-memory counter that couldn't actually limit anything: serverless
-- instances each held their own Map, so spreading guesses across enough concurrent
-- requests reset the count every time.
--
-- A six-digit passcode is a million guesses. Unthrottled that's hours of work for
-- a script, and the prize is write access to a child's app.

create table if not exists unlock_attempts (
  id         bigserial   primary key,
  ip         text        not null,
  ok         boolean     not null,
  created_at timestamptz not null default now()
);

create index if not exists unlock_attempts_ip_time on unlock_attempts (ip, created_at desc);
create index if not exists unlock_attempts_time    on unlock_attempts (created_at desc);

alter table unlock_attempts enable row level security;

-- Counts failures in the window. Two limits, because either one alone fails:
-- per-IP alone is beaten by rotating IPs, and global alone lets one attacker
-- lock Lucy out of her own app. Global is set high enough that it only trips
-- during an actual attack.
create or replace function unlock_is_blocked(p_ip text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from unlock_attempts
      where ip = p_ip and not ok and created_at > now() - interval '15 minutes') >= 10
    or
    (select count(*) from unlock_attempts
      where not ok and created_at > now() - interval '15 minutes') >= 200;
$$;

-- Housekeeping: nothing here is worth keeping for long.
create or replace function unlock_attempts_prune()
returns void
language sql
security definer
set search_path = public
as $$
  delete from unlock_attempts where created_at < now() - interval '1 day';
$$;
