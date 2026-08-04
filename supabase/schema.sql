-- Lucy's Birds — database schema
--
-- Two tables. `recordings` is what Lucy uploaded (kept forever, it's hers).
-- `detections` is what BirdNET heard inside each recording (many per recording).
--
-- This replaces BirdNET-Pi's single flat `detections` table in SQLite. The
-- shape is deliberately close to it so the collage frontend's queries port
-- over with minimal change, but split in two so the original audio survives
-- independently of what the model did or didn't recognise.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- recordings

create table if not exists recordings (
  id               uuid primary key default gen_random_uuid(),
  storage_path     text        not null unique,   -- path inside the `recordings` storage bucket
  original_name    text,                          -- e.g. "Backyard morning.m4a"
  recorded_at      timestamptz not null,          -- when Lucy actually recorded it, not when uploaded
  duration_seconds real,
  lat              double precision,              -- improves accuracy: BirdNET filters to plausible species
  lon              double precision,
  note             text,                          -- Lucy's own words about the recording
  status           text        not null default 'pending'
                   check (status in ('pending','analyzing','done','failed')),
  error            text,                          -- populated on failure, shown in the UI. Never swallow this.
  created_at       timestamptz not null default now()
);

create index if not exists recordings_recorded_at on recordings (recorded_at desc);
create index if not exists recordings_status      on recordings (status);

-- ---------------------------------------------------------------- detections

create table if not exists detections (
  id             bigserial   primary key,
  recording_id   uuid        not null references recordings(id) on delete cascade,
  sci_name       text        not null,   -- "Cyanocitta cristata"
  com_name       text        not null,   -- "Blue Jay"
  confidence     real        not null,   -- 0..1
  start_seconds  real        not null,   -- offset into the recording
  end_seconds    real        not null,
  detected_at    timestamptz not null,   -- recorded_at + start_seconds
  confirmed      boolean,                -- Lucy's call: true = yes that's right, false = nope. null = untouched.
  created_at     timestamptz not null default now()
);

create index if not exists detections_sci_name    on detections (sci_name);
create index if not exists detections_detected_at on detections (detected_at desc);
create index if not exists detections_recording   on detections (recording_id);

-- ---------------------------------------------------------------- life list

-- One row per species ever heard. This is the collage's main query, so it's a
-- view rather than something the frontend has to assemble.
create or replace view life_list as
select
  d.sci_name,
  min(d.com_name)      as com_name,
  count(*)             as times_heard,
  min(d.detected_at)   as first_heard,
  max(d.detected_at)   as last_heard,
  max(d.confidence)    as best_confidence
from detections d
where d.confirmed is distinct from false   -- hide anything Lucy has rejected
group by d.sci_name;
