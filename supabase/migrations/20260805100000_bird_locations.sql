-- Where each bird was spotted, for the map view.
--
-- On the bird rather than on a sighting: this is a collection, one row per
-- species, so the location is "where I found this one". If a species is later
-- found somewhere better, the location is updated rather than appended.
--
-- Nullable throughout — a bird added without a location is still a bird, and
-- the map simply doesn't show it.

alter table birds add column if not exists lat double precision;
alter table birds add column if not exists lon double precision;
alter table birds add column if not exists place text;

comment on column birds.place is
  'Optional human label for the spot, e.g. "the pond at the park". Shown instead of coordinates.';

-- Rebuilt to carry the location through to the page.
-- Dropped first: `create or replace view` cannot add a column in the middle of
-- an existing view's column list, only append or change definitions.
drop view if exists collection;
create view collection as
select
  b.id,
  b.sci_name,
  b.com_name,
  b.added_at,
  b.lat,
  b.lon,
  b.place,
  r.storage_path as audio_path,
  r.duration_seconds as audio_seconds,
  (select count(*) from bird_recordings br where br.bird_id = b.id) as recording_count
from birds b
left join bird_recordings r
  on r.bird_id = b.id
 and r.is_primary
order by b.added_at desc;
