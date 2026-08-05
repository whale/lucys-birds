-- Reshape around what this actually is: a public showcase of Lucy's collection.
--
-- She identifies birds in Merlin and eBird. Nothing here identifies anything.
-- This is the place she sends people to see — and hear — what she's got.
--
-- The old shape recorded *sightings*: one row per occurrence, with confidence
-- scores and confirm/reject flags, built for a model logging repeatedly. She
-- wants a list of bird types. One row per bird, audio attached to the bird.

-- --------------------------------------------------------------------- birds

create table if not exists birds (
  id        bigserial   primary key,
  sci_name  text        not null unique,   -- unique: a bird is on the list once
  com_name  text        not null,
  added_at  timestamptz not null default now()
);

create index if not exists birds_added_at on birds (added_at desc);

-- Carry across anything already collected so the page doesn't go blank.
insert into birds (sci_name, com_name, added_at)
select sci_name, min(com_name), min(seen_at)
from sightings
group by sci_name
on conflict (sci_name) do nothing;

-- ---------------------------------------------------------- bird recordings

-- Audio belongs to the bird, not to a moment. Several are allowed — she might
-- catch a better one later — and one is marked primary as the one that plays.
create table if not exists bird_recordings (
  id               bigserial   primary key,
  bird_id          bigint      not null references birds(id) on delete cascade,
  storage_path     text        not null unique,
  original_name    text,
  duration_seconds real,
  is_primary       boolean     not null default false,
  created_at       timestamptz not null default now()
);

create index if not exists bird_recordings_bird on bird_recordings (bird_id);

-- At most one primary per bird, enforced by the database rather than by
-- remembering to do it right in every code path that touches this.
create unique index if not exists bird_recordings_one_primary
  on bird_recordings (bird_id) where is_primary;

alter table birds           enable row level security;
alter table bird_recordings enable row level security;

-- ------------------------------------------------------------------ the view

-- What the collage reads. One row per bird, with its song if it has one.
create or replace view collection as
select
  b.id,
  b.sci_name,
  b.com_name,
  b.added_at,
  r.storage_path   as audio_path,
  r.duration_seconds as audio_seconds,
  (select count(*) from bird_recordings br where br.bird_id = b.id) as recording_count
from birds b
left join bird_recordings r
  on r.bird_id = b.id
 and r.is_primary
order by b.added_at desc;

-- ------------------------------------------------------------------- cleanup

-- Everything below existed to serve BirdNET: confidence scores, per-occurrence
-- rows, the confirm/reject workflow, the analysis status machine. She
-- identifies elsewhere, so none of it has a job any more.
drop view if exists life_list;
drop table if exists sightings;
drop table if exists recordings;
drop function if exists reap_stuck_recordings();

-- ------------------------------------------------------------------- storage

-- The bucket goes public. This is a showcase — the whole point is that people
-- Lucy sends the link to can press play. Signed URLs would mean every visitor
-- needs a round trip to the server before any audio can start.
update storage.buckets set public = true where id = 'recordings';
