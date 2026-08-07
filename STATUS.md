# Status — Lucy's Birds

Last updated: 2026-08-07

## Where things stand

**Live: https://lucys-birds.vercel.app** — public collection, passcode-gated adding.

Loaded with Lucy's **real** collection: 71 species imported from her eBird export, with her own first-seen dates and locations.

- Branch: `feat/upload-first-rebuild` — **pushed**, 28 commits, **not merged, no PR opened**
- Latest commit: `9dfd36b feat: let an iOS Shortcut authenticate with a header`

## What it does

**Three views**, switched by a pill control, remembered in localStorage:
- **Grid** — illustrated cards, two-up on a phone
- **Collage** — the original project's silhouette-packed cluster (see below)
- **Map** — Leaflet + OpenStreetMap, pins are the illustrations, nearby birds cluster

**Detail tray** slides in from the right at 50% width, full height. Prev/next paging (wraps), close, Escape and arrow keys. Mirrors to `?bird=slug` via pushState so deep links and the back button work. `/bird/[sci]` also exists as a standalone shareable page.

Each bird shows a perched / in-flight toggle, a Wikipedia summary, genus, links to Wikipedia and eBird, and its recordings with playback.

**Adding** — type-ahead over 7,058 species with illustrations beside each name, optional audio, optional location (phone GPS or a typed place name).

**Sharing from Merlin** — `POST /api/share` takes a `merlinbirds.org/species/<code>` link (or any text containing one) and adds the bird. Authenticates by cookie or an `x-lb-key` header.

Plus: share card showing her real birds and count, homescreen manifest, Lucy's keyed link that unlocks without typing, six-digit numeric passcode screen.

## Verified in production this session

- Collection page public (200); `/add` gated (307 to `/unlock`)
- 71 species, **71 with locations**, 0 with songs
- Merlin share endpoint: both example links resolve and add; text-with-link works; no-link returns a clear 400
- Header auth: correct key 200, wrong key 401
- Collage, map clustering, and the tray all checked visually at 1440px

## Not verified / known gaps

- **No audio anywhere.** The demo recording was removed during the real import, so playback is currently untested against real data. The code path was verified earlier with a test file.
- **`/api/birds` no longer exists** (404). Nothing calls it; the rewrite replaced it. `README.md` may still mention it.
- **The iOS Shortcut has not been built or tested on a real phone.** Steps were given; nobody has run them.
- **Nothing checked below 1440px this session.** The layout is fluid and was verified at 375/768/1440 in an earlier session, but the tray, collage and map have not been re-checked on a phone.

## Design

Tokens taken from the original AvianVisitors stylesheet: near-white paper (`#fcfcfb`), serif display with an italic eyebrow, monospace labels, and the original's three depth recipes (`--edge`, `--recess`, `--raised`). Full width with a 56px gutter that shrinks fluidly.

**The collage is a real port**, not an approximation — per-species 1-bit silhouette masks (`public/collage-masks.json`) drive an occupancy grid, so birds nest into each other's concavities. The largest bird anchors the centre and each next one spirals outward in elliptical rings, stopping at the first ring with a free spot and picking the position nearest the centre of mass of what's placed. Total area is budgeted against the canvas and the cluster shrinks until it packs. Sizes are random per mount, so a refresh rearranges it. 15% of birds show their flight pose. See `lib/collage-pack.ts`.

## Decisions worth remembering

- **No bird identification here, ever.** Lucy uses Merlin and eBird. BirdNET was tried on Vercel and failed twice — no `tflite-runtime` build for Vercel's Python versions, then TensorFlow broke on Vercel's bytecode compilation stripping librosa's stubs. In git history. Don't relitigate.
- **Coordinates are fuzzed to a 0.1° grid** (~4.3 miles max). Her export has metre-accurate coordinates for "Mimi's House" and "Neighborhood"; this page is public and carries her name. See `CLAUDE.md`.
- **Illustrations render as CSS backgrounds, never `<img>`.** That's what actually stops Pinterest's extension — it needs a real image element. `app/bird-art.tsx`.
- **Species names come from our own list**, never from a request body — anything stored is rendered publicly.
- **Collection, not log.** One row per bird.
- **Supabase costs $10/month** — 4th project in a Pro org. Accepted deliberately.

## Next likely work

1. **Open a PR and merge.** 28 commits sitting on a branch.
2. **Build the iOS Shortcut on Lucy's phone** — the endpoint is live and tested, nothing else needed, no accounts. Steps are in `HANDOFF.md`.
3. **Get a real song onto a bird** so playback is proven with real data.
4. **Inbound email** (optional) — Postmark's free tier gives an inbound address with no domain; save it as a contact called "Birds" on her phone so the address never needs typing. Needs a two-minute browser signup that can't be done from the CLI. Its real advantage over the Shortcut is audio attachments.
5. **Generate missing illustrations** — 9 of her 71 species have none. `avian/scripts/` is the Gemini pipeline that makes more in the same style.
6. **A real name**, and a domain if it should live under whale.fyi.

## Open questions

- Merge to `main`, or keep iterating on the branch?
- Is `place` safe to display publicly? Names like "Mimi's House" are stored and shown. Coordinates are fuzzed; the labels are not.
- Editing: no way to remove a bird, replace a song or fix a mistake except in SQL.
