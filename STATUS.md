# Status — Lucy's Birds

Last updated: 2026-08-05

## Where things stand

**Live and working: https://lucys-birds.vercel.app**

A public showcase of Lucy's bird collection with playable songs. Everything in the current scope is built, deployed and verified in production.

Branch: `feat/upload-first-rebuild`. **Not merged** — still needs a PR.

## What it does

- Public collection page — full width, illustrated, fluid from phone to desktop
- **A page per bird**: large illustration with a perched / in-flight toggle, a
  Wikipedia summary, genus, links out to Wikipedia and eBird, and every
  recording with playback
- Add a bird: type-ahead over 7,058 species, each result showing its
  illustration, plus optional audio in the same step
- Passcode to add, nothing to read. Six digits, numeric, centred, self-submitting
- Lucy's bookmarked link unlocks her without typing
- Share card showing her real birds and count, so the link previews properly
- Installs to a homescreen
- Pinterest's hover-to-save overlay suppressed site-wide

## Design

Tokens taken from the original AvianVisitors stylesheet so it reads as the same
object: near-white paper (`#fcfcfb`), serif display with an italic eyebrow,
monospace labels with wide letterspacing, and the original's three depth recipes
(`--edge`, `--recess`, `--raised`) instead of flat borders. Full width with a
56px gutter that shrinks fluidly.

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

## Views

Grid, collage, and map — switched by the original's recessed pill control, and
remembered in localStorage.

The **collage** is the overlapping, size-varied arrangement the original is
built around. Positions are computed from the container width using each
illustration's real aspect ratio (carried in `data/species.json`, from the
original's `dims.json`); scale comes from a hash of the species name so it
varies but stays stable across renders. Smaller birds sit in front.

The **map has no data.** Nothing captures a location, so it says so rather than
pretending. See below.

## Still missing from the original

- **Mask-based packing.** The original uses per-species silhouette masks
  (`masks.json`, 795 KB) to interlock birds precisely. Ours overlaps by
  computed offset — good, but not the real packing.
- **Dark theme.** The original is fully variable-driven and flips cleanly.
- **Spectrograms** on recordings.

## Next up

- **Merge the branch.** Everything is on `feat/upload-first-rebuild`.
- **A real name**, and a domain if it should live under whale.fyi.
- **Import from eBird.** *Download My Data* gives a CSV of everything she's ever logged — her collection could start full instead of empty. Genuinely easy and probably the highest-value next thing.
- **Generate missing illustrations.** Only 329 of 7,058 species have art. `avian/scripts/` is the Gemini pipeline that makes more in the same style; worth running for whatever she actually collects.
- **Locations, for the map view.** Needs a `lat`/`lon` on `birds` and a way to
  capture it when adding — either the phone's location at the time, or a place
  picker. Until then the map tab is an empty state.
- **Editing.** No way to remove a bird, replace a song, or fix a mistake except in SQL.
- **Repo size.** `.git` is ~624 MB, mostly dead Pi-era history. Reclaimable, not urgent.

## Decisions worth remembering

- **No identification here, ever.** Merlin and eBird do it better. BirdNET was tried on Vercel and failed twice (no `tflite-runtime` build for Vercel's Python versions; then TensorFlow broke on Vercel's bytecode compilation). Recorded in git history — don't relitigate.
- **Collection, not log.** One row per bird. Dates order things and stay out of the UI.
- **Audio uploads as recorded.** Converting made it bigger for no gain.
- **Public audio bucket** so visitors can press play with no round trip.
- **Link key ≠ passcode.** The link skips rate limiting, so it's long and random and separately rotatable.
- **Supabase costs $10/month** — the `hi-whalefyi's projects` org is Pro and this is its fourth project. Accepted deliberately.
