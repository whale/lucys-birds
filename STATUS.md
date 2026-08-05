# Status — Lucy's Birds

Last updated: 2026-08-05

## Where things stand

**Live and working: https://lucys-birds.vercel.app**

A public showcase of Lucy's bird collection with playable songs. Everything in the current scope is built, deployed and verified in production.

Branch: `feat/upload-first-rebuild`. **Not merged** — still needs a PR.

## What it does

- Public collection page, illustrated, two-up on a phone
- Tap a bird with a song to hear it; one plays at a time
- Add a bird: type-ahead over 7,058 species, optional audio in the same step
- Passcode to add, nothing to read
- Lucy's bookmarked link unlocks her without typing
- Share card showing her real birds and count, so the link previews properly
- Installs to a homescreen

## Verified in production

- Added a bird with a song end to end; it appears and plays
- Audio streams publicly with no auth — a visitor can hear it
- Share card renders with real illustrations (253 KB PNG)
- Valid link key unlocks and strips itself from the URL; the old passcode no longer works as a key; a cold visit still gets the gate; the key is refused on APIs
- Collection page is public

## Contents right now

26 birds. **25 are placeholder** — common North American species I seeded so the page wasn't empty. One is a Eurasian Magpie carrying a real 30-second recording, which is what demonstrates playback.

Clear them whenever Lucy wants to start properly:

```sql
delete from bird_recordings; delete from birds;
```

## Next up

- **Merge the branch.** Everything is on `feat/upload-first-rebuild`.
- **A real name**, and a domain if it should live under whale.fyi.
- **Import from eBird.** *Download My Data* gives a CSV of everything she's ever logged — her collection could start full instead of empty. Genuinely easy and probably the highest-value next thing.
- **Generate missing illustrations.** Only 329 of 7,058 species have art. `avian/scripts/` is the Gemini pipeline that makes more in the same style; worth running for whatever she actually collects.
- **Editing.** No way to remove a bird, replace a song, or fix a mistake except in SQL.
- **Repo size.** `.git` is ~624 MB, mostly dead Pi-era history. Reclaimable, not urgent.

## Decisions worth remembering

- **No identification here, ever.** Merlin and eBird do it better. BirdNET was tried on Vercel and failed twice (no `tflite-runtime` build for Vercel's Python versions; then TensorFlow broke on Vercel's bytecode compilation). Recorded in git history — don't relitigate.
- **Collection, not log.** One row per bird. Dates order things and stay out of the UI.
- **Audio uploads as recorded.** Converting made it bigger for no gain.
- **Public audio bucket** so visitors can press play with no round trip.
- **Link key ≠ passcode.** The link skips rate limiting, so it's long and random and separately rotatable.
- **Supabase costs $10/month** — the `hi-whalefyi's projects` org is Pro and this is its fourth project. Accepted deliberately.
