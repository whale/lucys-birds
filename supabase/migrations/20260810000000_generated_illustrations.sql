-- Artwork generated when Lucy adds a species that is not part of the bundled
-- illustration set. The public URLs live on the bird so every view can use the
-- same asset without teaching the static species catalogue about runtime data.

alter table birds add column if not exists art_url text;
alter table birds add column if not exists flight_art_url text;
alter table birds add column if not exists art_status text not null default 'missing'
  check (art_status in ('missing', 'generating', 'ready', 'failed'));

insert into storage.buckets (id, name, public)
values ('illustrations', 'illustrations', true)
on conflict (id) do update set public = true;

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
  b.art_url,
  b.flight_art_url,
  b.art_status,
  r.storage_path as audio_path,
  r.duration_seconds as audio_seconds,
  (select count(*) from bird_recordings br where br.bird_id = b.id) as recording_count
from birds b
left join bird_recordings r
  on r.bird_id = b.id
 and r.is_primary
order by b.added_at desc;

