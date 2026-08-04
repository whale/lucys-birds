# Status — Lucy's Birds

Last updated: 2026-08-04

## Where things stand

Forked AvianVisitors, stripped the Raspberry Pi architecture out of it, and scaffolded an upload-first app on Next.js + Supabase + Vercel. Builds clean, both pages render, nothing is connected to a database yet.

Branch: `feat/upload-first-rebuild`. Not merged, not deployed.

## Done

- Forked `Twarner491/AvianVisitors` → `whale/lucys-birds`
- Removed the Pi engine: recording daemon, folder watcher, SQLite, PHP API, Caddy, systemd templates, bash installer, e-ink frame, tflite models. All recoverable from git history.
- Kept the art: 666 illustrations, 157 cutouts, the original collage frontend as reference, the Gemini illustration pipeline, the BirdNET label lists.
- Schema written (`supabase/schema.sql`) — `recordings`, `detections`, `life_list` view
- Browser-side audio conversion (`lib/audio.ts`) — `.m4a` → 48 kHz mono WAV
- Signed direct-to-storage upload (`app/api/upload-url/route.ts`)
- BirdNET analyzer as a Vercel Python function (`api/analyze.py`)
- Read API replacing `birdnet-api.php` (`app/api/birds/route.ts`)
- Collage page and Lucy's add-a-recording page
- Illustration build script: 417 MB → 56 MB (`pnpm illustrations`)
- `pnpm build` passes; both pages verified in the browser at mobile width

## Verified

- Build compiles, types check, 5 routes generated
- `/add` renders correctly at 430 px
- `/` fails loud with a specific message when Supabase env vars are absent — the intended behaviour, not a blank page

## Not yet done — needs Matthew

Nothing can be tested end to end until these exist:

1. A Supabase project (free tier is fine)
2. `supabase/schema.sql` run in its SQL editor
3. A private storage bucket named `recordings`
4. `.env.local` filled in from `.env.example`
5. A Vercel project connected to the repo, with the same env vars

## Next up after that

- **Confirm the analyzer deploys.** The Python bundle (birdnetlib + librosa + tflite-runtime) is chunky. If Vercel rejects it on size, set `VERCEL_SUPPORT_LARGE_FUNCTIONS=1` — that raises the ceiling from 500 MB to 5 GB.
- **Port the real collage.** Right now the birds are a plain grid. The original packs them into an overlapping collage using `avian/frontend/apt.js` plus `masks.json`/`dims.json`. That's the whole visual point of the project and it isn't done.
- **Fallback for species with no illustration.** Only 333 have art; BirdNET knows 6,000. Currently a broken image.
- **Let Lucy reject a wrong guess.** The `confirmed` column and the `life_list` view already support it; there's no UI.
- **Play the audio back.** Recordings are stored but nothing plays them yet.
- **Favicon.** 404s at the moment.
- **Decide on a gate.** No auth at all right now. If it goes to a public URL, anything uploaded is world-readable.

## Open questions

- Real name for the project
- Rough lat/lon for accuracy filtering (two decimal places is enough — not the exact address)
- Should this live under a whale.fyi domain, and if so does it join the `/stuff` menu?
