# Lucy's Birds

*A collection of birds Lucy has found, and their songs.*

**Live: https://birds.lesmith.me**

Lucy identifies birds in Merlin and eBird. This isn't for that. It's the place she sends people to see what she's collected — and to hear it. Tap a bird, hear its song.

Anyone can look. Only Lucy can add.

Working name. It'll get a better one.

---

## How it works

```
Lucy identifies a bird in Merlin or eBird
  -> opens her bookmarked link (already unlocked)
  -> types the name, picks it from the list
  -> optionally attaches a recording
  -> it joins the collection

Anyone she sends the link to
  -> sees the collection
  -> taps a bird to hear it
```

There is no bird identification in this app, on purpose. That problem is solved better elsewhere by people with a research lab.

### Where each piece lives

| Piece | What it does | File |
|---|---|---|
| The collection | The public page | `app/page.tsx` |
| Views + tray | Grid, collage, map; the detail tray | `app/gallery.tsx` |
| Collage packing | Silhouette-aware layout | `lib/collage-pack.ts` |
| Map | Pins and clustering | `app/map.tsx` |
| Share from Merlin | Turns a Merlin link into a bird | `app/api/share/route.ts` |
| Add a bird | Search, pick, optional song | `app/add/page.tsx` |
| Species search | Type-ahead over 7,058 species | `app/api/species/route.ts` |
| Saving | Bird, then its song | `app/api/add/` |
| Share card | What the link previews as | `app/opengraph-image.tsx` |
| The gate | Public to read, passcode to add | `middleware.ts`, `lib/gate.ts` |
| Database shape | Two tables and a view | `supabase/migrations/` |

### Three decisions worth knowing

**Audio uploads exactly as recorded.** Converting it would only make it bigger, and every browser plays what an iPhone records.

**The audio bucket is public.** The point is that people she sends the link to can press play. A signed URL would mean a round trip before any sound.

**Lucy's link carries a long random key** so she never types the passcode. It's deliberately not the passcode itself — see `lib/gate.ts` for why.

---

## Running it locally

```bash
pnpm install
pnpm illustrations   # one time, builds the web-sized bird pictures
pnpm dev
```

Copy `.env.example` to `.env.local` and fill it in from the Supabase project's API settings.

Shared API keys are kept in `~/.config/secrets.env`, not `~/.env` and never
in this repository. Load them into a local terminal before starting the app:

```bash
set -a
source ~/.config/secrets.env
set +a
pnpm dev
```

`GEMINI_API_KEY` comes from that shared file. Production receives the same
variable through Vercel's encrypted environment settings; its value must never
be committed to GitHub.

The global Motion AI Kit is installed for Codex in `~/.codex/skills/motion`.
Its hosted `motion` and `motion-plus` tools are registered in Codex's global MCP
configuration. Motion+ requires signing in through its browser authorization.

The database schema lives in `supabase/migrations/` and is already applied. To change it, add a new migration and run `supabase db push` — don't edit an applied one.

---

## Where this came from

Forked from [AvianVisitors](https://github.com/Twarner491/AvianVisitors) by Theodore Warner, itself a fork of [BirdNET-Pi](https://github.com/Nachtzuster/BirdNET-Pi).

The original is a Raspberry Pi with a microphone in a window, listening around the clock and identifying what it hears. This kept the artwork and threw away the machine.

What's kept:

- `avian/assets/` — 666 hand-styled illustrations (333 species, perched and in flight) and 157 photo cutouts
- `avian/frontend/` — the original collage engine, kept as reference
- `avian/scripts/` — the pipeline that generates new illustrations in the same style
- `model/l18n/labels_en.json` — the species names the search reads

Only 329 species have artwork; the rest show a feather until someone generates one.

**Licence: CC-BY-NC-SA-4.0**, inherited from BirdNET-Pi. Non-commercial only, attribution required, share alike. See `README.upstream.md` and `LICENSE`.
