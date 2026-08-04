# Lucy's Birds — project instructions

Inherits `~/Projects/CLAUDE.md` and the global rules. This file covers what's specific here.

## What this is

An upload-first bird collage for Matthew's daughter Lucy. She records a bird on her iPhone, sends it here, BirdNET identifies it, and it joins the collage.

Forked from [AvianVisitors](https://github.com/Twarner491/AvianVisitors) (itself a fork of BirdNET-Pi), then gutted. See `README.md` for the full lineage.

**Working name.** Don't get attached to "Lucy's Birds" in copy or filenames — it's placeholder.

## The one thing to keep straight

**There is no Raspberry Pi and no microphone.** The upstream project is a listening station: a mic in a window, a daemon watching a folder, SQLite on an SD card. All of that was deliberately removed.

If a change starts reintroducing a folder watcher, a long-running process, a systemd service, PHP, or SQLite — stop. That's drifting back toward the Pi architecture, and it doesn't fit Vercel.

Everything is request-driven: one upload, one analysis, one response.

## Stack

- **Next.js 15** (App Router) on Vercel — the pages and the read API
- **Python function** (`api/analyze.py`) on Vercel — BirdNET via `birdnetlib`
- **Supabase** — Postgres for the data, Storage bucket `recordings` for the audio

Mixing a Next.js app with a root-level `api/*.py` function is intentional. Keep the Python out of `app/api/` — that's Next's router and it will not serve Python.

## Constraints that shaped the design

Don't "fix" these without knowing why they're here:

- **Vercel has no `ffmpeg`.** Audio conversion happens in the browser (`lib/audio.ts`) using the platform AAC decoder. Don't move it server-side.
- **Vercel caps request bodies at 4.5 MB.** Uploads go phone → storage via a signed URL, never through a function. Don't route file bytes through an API route.
- **Vercel has no persistent disk.** Nothing may be written to the filesystem and expected to survive. Temp files inside a single invocation are fine.
- **Python functions get 500 MB** uncompressed (5 GB with `VERCEL_SUPPORT_LARGE_FUNCTIONS=1`). The BirdNET deps are chunky; if a deploy fails on size, that env var is the lever.
- **The model load is expensive.** `get_analyzer()` caches it in a module global so warm invocations reuse it. Keep it that way.

## Data

Two tables, one view — `supabase/schema.sql`.

- `recordings` — what Lucy uploaded. **Kept forever.** The original audio outliving the model's opinion of it is the point of the project, not an optimisation.
- `detections` — what BirdNET heard, many per recording. `confirmed` is Lucy's call: `true` yes, `false` no, `null` untouched. The `life_list` view hides anything she's rejected.

`MIN_CONFIDENCE` is 0.15 — deliberately lower than a Pi-in-a-window would use. A phone in wind is noisy, and a maybe Lucy can reject beats a real bird silently dropped.

## Illustrations

`avian/assets/illustrations/` is 490 MB of print-resolution PNGs and is **not** what gets served. `pnpm illustrations` builds web-sized copies into `public/illustrations/` (gitignored).

Filename convention is the scientific name in kebab-case: `Cyanocitta cristata` → `cyanocitta-cristata.png`. A `-2` suffix is the flight pose. `app/page.tsx` has the `slug()` helper.

Only 333 species have art. Anything BirdNET identifies outside that set has no picture — needs a fallback, and `avian/scripts/` is the Gemini pipeline for generating more in the same style.

## Licence

CC-BY-NC-SA-4.0. **Non-commercial only.** Attribution to BirdNET-Pi and AvianVisitors must stay in `README.md`. Don't strip `README.upstream.md` or `LICENSE`.
