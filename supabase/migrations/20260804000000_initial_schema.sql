-- Lucy's Birds — database schema
--
-- Three ideas:
--   recordings  audio Lucy uploaded. Kept forever. Optional.
--   sightings   a bird on Lucy's list. The core record.
--   life_list   one row per species, for the collage.
--
-- A sighting can arrive two ways: BirdNET heard it in a recording, or Lucy
-- added it herself because she saw or heard it. Both land in the same table
-- with `source` saying which, because it's one list — hers — however each bird
-- got onto it. A separate table per source would mean two collages and no
-- single answer to "how many birds does Lucy have?".

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- recordings

create table if not exists recordings (
  id               uuid primary key default gen_random_uuid(),
  storage_path     text        not null unique,   -- path inside the `recordings` storage bucket
  original_name    text,                          -- e.g. "Backyard morning.m4a"
  recorded_at      timestamptz not null,          -- when Lucy recorded it, not when she uploaded it
  duration_seconds real,
  lat              double precision,              -- improves accuracy: BirdNET filters to plausible species
  lon              double precision,
  note             text,
  status           text        not null default 'pending'
                   check (status in ('pending','analyzing','done','failed')),
  error            text,                          -- populated on failure and shown in the UI. Never swallow this.
  created_at       timestamptz not null default now()
);

create index if not exists recordings_recorded_at on recordings (recorded_at desc);
create index if not exists recordings_status      on recordings (status);

-- ----------------------------------------------------------------- sightings

create table if not exists sightings (
  id             bigserial   primary key,

  source         text        not null check (source in ('heard','spotted')),
  -- 'heard'   BirdNET found it in a recording
  -- 'spotted' Lucy added it herself

  -- Null for anything Lucy added by hand. A sighting is a first-class record;
  -- it does not need audio to exist.
  recording_id   uuid        references recordings(id) on delete cascade,

  sci_name       text        not null,   -- "Cyanocitta cristata"
  com_name       text        not null,   -- "Blue Jay"
  seen_at        timestamptz not null,   -- for 'heard': recorded_at + start_seconds

  -- Model-only fields. Null on anything Lucy added — she doesn't come with a
  -- confidence score, and shouldn't be shown one.
  confidence     real,
  start_seconds  real,
  end_seconds    real,

  note           text,       -- Lucy's own words
  confirmed      boolean,    -- her call on a machine guess: true yes, false no, null untouched
  created_at     timestamptz not null default now(),

  -- Keep the two shapes honest: a heard sighting must point at a recording and
  -- carry a score; a spotted one must do neither.
  constraint sightings_shape check (
    (source = 'heard'   and recording_id is not null and confidence is not null)
    or
    (source = 'spotted' and recording_id is null     and confidence is null)
  )
);

create index if not exists sightings_sci_name  on sightings (sci_name);
create index if not exists sightings_seen_at   on sightings (seen_at desc);
create index if not exists sightings_recording on sightings (recording_id);
create index if not exists sightings_source    on sightings (source);

-- ----------------------------------------------------------------- life list

-- One row per species Lucy has. The collage's main query.
create or replace view life_list as
select
  s.sci_name,
  min(s.com_name)                                        as com_name,
  count(*)                                               as times_seen,
  count(*) filter (where s.source = 'spotted')           as times_spotted,
  count(*) filter (where s.source = 'heard')             as times_heard,
  min(s.seen_at)                                         as first_seen,
  max(s.seen_at)                                         as last_seen,
  max(s.confidence)                                      as best_confidence,
  bool_or(s.source = 'spotted')                          as ever_spotted
from sightings s
where s.confirmed is distinct from false   -- hide machine guesses Lucy has rejected
group by s.sci_name;

-- ------------------------------------------------------------------ storage

-- Private bucket for Lucy's audio. Private because there are no accounts on
-- this app yet: a public bucket would make every recording readable by anyone
-- who guessed a URL. The server reads and writes it with the service role key,
-- and the browser only ever gets short-lived signed URLs.
insert into storage.buckets (id, name, public)
values ('recordings', 'recordings', false)
on conflict (id) do nothing;
