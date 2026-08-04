-- Two fixes from the correctness review.

-- ------------------------------------------------------------- local_date
--
-- recorded_at is a timestamptz — an instant, stored in UTC. The calendar date
-- Lucy experienced can't be recovered from it: a 9:30pm recording in Mountain
-- Time is already the next day in UTC. BirdNET uses the date to decide which
-- species are plausible that week of the year, so feeding it a UTC date quietly
-- skews what it will recognise on any recording made late in the evening.
--
-- Nullable because rows created before this existed don't have one, and because
-- falling back to the UTC date is still better than refusing to analyse.

alter table recordings add column if not exists local_date date;

comment on column recordings.local_date is
  'Calendar date as Lucy''s phone saw it. Feeds BirdNET''s seasonal filter; do not derive from recorded_at.';

-- ------------------------------------------------- stuck analysing recordings
--
-- Vercel kills a function at the OS level when it hits maxDuration, so
-- analyze.py's except block never runs and its status stays 'analyzing'
-- forever. An in-progress state masking a dead one is worse than a failure —
-- it offers no retry and no explanation.
--
-- Anything still 'analyzing' well past the function's own 300s ceiling is not
-- in progress, it's dead.

create or replace function reap_stuck_recordings()
returns integer
language sql
security definer
set search_path = public
as $$
  with dead as (
    update recordings
       set status = 'failed',
           error  = 'Analysis timed out. The recording is safe — try adding it again.'
     where status = 'analyzing'
       and created_at < now() - interval '10 minutes'
    returning 1
  )
  select count(*)::integer from dead;
$$;
