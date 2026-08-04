# Status — Lucy's Birds

Last updated: 2026-08-04

## Where things stand

Working app, live database, both ways of adding a bird verified end to end. Not deployed yet.

Branch: `feat/upload-first-rebuild`. Not merged.

## Done

**The fork**
- `Twarner491/AvianVisitors` → `whale/lucys-birds`
- Removed the Pi engine: recording daemon, folder watcher, SQLite, PHP API, Caddy, systemd templates, bash installer, e-ink frame, tflite models. Recoverable from git history.
- Kept the art: 666 illustrations, 157 cutouts, the original collage frontend as reference, the Gemini illustration pipeline, the BirdNET labels.

**Infrastructure**
- Supabase project `lucys-birds` (ref `elmxrscgpdtiqgpltchm`, us-east-1, in `hi-whalefyi's projects`)
- Schema applied via migration — `recordings`, `sightings`, `life_list` view
- Private storage bucket `recordings` created in the same migration
- `.env.local` written and gitignored; DB password in `.db-password.txt`, also gitignored

**The app**
- Collage page showing the life list with illustrations
- "Add a bird you saw" — type-ahead over 7,058 species, illustrated ones first
- "Add a recording" — browser-side `.m4a` → WAV, signed direct-to-storage upload
- BirdNET analyzer as a Vercel Python function
- Illustration build: 417 MB → 56 MB

## Verified

- `pnpm build` passes, 8 routes
- Searched "blue jay", picked it, saved it — wrote to the live database, appeared on the collage with its illustration and "spotted 1×". Test row deleted afterwards.
- `/add` renders correctly at 430 px
- Missing config fails loud with the specific variable name, not a blank page

**Not verified:** the analyzer. It only runs on Vercel and nothing is deployed, so no recording has been through BirdNET yet. That's the biggest open risk.

## Next up

1. **Deploy to Vercel and put a real recording through it.** Until that happens the audio half is written, not working.
   - The Python bundle (birdnetlib + librosa + tflite-runtime) is chunky. If the deploy fails on size, set `VERCEL_SUPPORT_LARGE_FUNCTIONS=1` — raises the ceiling from 500 MB to 5 GB.
2. **Port the real collage.** Birds are a plain grid right now. The original packs them into an overlapping collage via `avian/frontend/apt.js` + `masks.json`/`dims.json`. That's the whole visual point and it isn't done.
3. **Fallback for species with no illustration.** Only 329 of 7,058 have art; currently a broken image.
4. **Let Lucy reject a wrong guess.** Schema and view already support it, no UI.
5. **Play recordings back.** Stored, but nothing plays them.
6. **Set lat/lon** in `.env.local` — meaningfully improves BirdNET accuracy.
7. **Favicon.** 404s.
8. **Decide on a gate.** No auth at all. On a public URL, anything uploaded is world-readable.

## Decisions worth remembering

- **One list, two sources.** Spotted and heard birds share the `sightings` table. Splitting them would fork the collage.
- **Audio converts in the browser.** Vercel has no ffmpeg; Safari has an AAC decoder. Don't move it server-side.
- **Uploads bypass the server.** Vercel caps bodies at 4.5 MB; long recordings exceed it.
- **Supabase org choice cost $10/month.** `hi-whalefyi's projects` is Pro and already had three projects; Pro covers only the first. Matthew accepted the cost. Worth checking the org before creating a project anywhere.

## Open questions

- Real name for the project
- Rough lat/lon (two decimals is plenty — not the exact address)
- whale.fyi domain? If so, does it join the `/stuff` menu?
- The other two Supabase orgs hold `buddy` and five older projects — Matthew mentioned deleting them, nothing has been touched.
