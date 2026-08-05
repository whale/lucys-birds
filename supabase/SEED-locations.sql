-- ============================================================
--  Lucy's Birds — add locations, and fake some so the map works
--  Paste this whole thing into the Supabase SQL editor and Run.
--  Safe to run more than once.
-- ============================================================

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


-- ---------------------------------------------------------------
-- DEMO DATA ONLY. These are invented coordinates around Boulder,
-- Colorado, grouped into a few spots so the map's clustering is
-- visible. Delete with:  update birds set lat = null, lon = null, place = null;
-- ---------------------------------------------------------------

update birds set lat = 40.01340, lon = -105.26992, place = 'the backyard' where com_name = 'Northern Flicker';
update birds set lat = 40.01575, lon = -105.27076, place = 'the backyard' where com_name = 'Canada Goose';
update birds set lat = 40.01460, lon = -105.27097, place = 'the backyard' where com_name = 'Great Horned Owl';
update birds set lat = 40.01652, lon = -105.26996, place = 'the backyard' where com_name = 'Ruby-throated Hummingbird';
update birds set lat = 40.01510, lon = -105.27078, place = 'the backyard' where com_name = 'Baltimore Oriole';
update birds set lat = 40.01374, lon = -105.26899, place = 'the backyard' where com_name = 'Eastern Bluebird';
update birds set lat = 40.01628, lon = -105.27015, place = 'the backyard' where com_name = 'Belted Kingfisher';
update birds set lat = 40.01419, lon = -105.27081, place = 'the backyard' where com_name = 'Red-tailed Hawk';
update birds set lat = 40.01400, lon = -105.27057, place = 'the backyard' where com_name = 'Great Blue Heron';
update birds set lat = 40.03162, lon = -105.29216, place = 'the park' where com_name = 'Barn Swallow';
update birds set lat = 40.03421, lon = -105.29193, place = 'the park' where com_name = 'Cedar Waxwing';
update birds set lat = 40.03542, lon = -105.29653, place = 'the park' where com_name = 'Red-bellied Woodpecker';
update birds set lat = 40.03423, lon = -105.29621, place = 'the park' where com_name = 'Tufted Titmouse';
update birds set lat = 40.03618, lon = -105.29421, place = 'the park' where com_name = 'Song Sparrow';
update birds set lat = 40.03383, lon = -105.29430, place = 'the park' where com_name = 'Red-winged Blackbird';
update birds set lat = 40.03240, lon = -105.29693, place = 'the park' where com_name = 'American Goldfinch';
update birds set lat = 40.06723, lon = -105.21306, place = 'the reservoir' where com_name = 'House Finch';
update birds set lat = 40.07615, lon = -105.21514, place = 'the reservoir' where com_name = 'White-breasted Nuthatch';
update birds set lat = 40.07271, lon = -105.21531, place = 'the reservoir' where com_name = 'Downy Woodpecker';
update birds set lat = 40.07324, lon = -105.21956, place = 'the reservoir' where com_name = 'Mourning Dove';
update birds set lat = 40.07076, lon = -105.22033, place = 'the reservoir' where com_name = 'American Crow';
update birds set lat = 39.98533, lon = -105.36246, place = 'the canyon trail' where com_name = 'Black-capped Chickadee';
update birds set lat = 39.98555, lon = -105.37305, place = 'the canyon trail' where com_name = 'Northern Cardinal';
update birds set lat = 39.98852, lon = -105.37116, place = 'the canyon trail' where com_name = 'American Robin';
update birds set lat = 39.74082, lon = -104.98768, place = 'grandma’s garden' where com_name = 'Blue Jay';
update birds set lat = 39.73977, lon = -104.98874, place = 'grandma’s garden' where com_name = 'Eurasian Magpie';
