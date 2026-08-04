# Lucy's Birds

*A place for Lucy to keep the birds she's heard.*

Record a bird on an iPhone. Send it here. A model called BirdNET (from the Cornell Lab of Ornithology) works out what it was, and the bird joins a collage of everything she's collected. The recording is kept — it's hers, not just raw material for the machine.

Working name. It'll get a better one.

---

## How it works

```
Voice Memos on the iPhone
  -> share to this site
  -> the browser converts the audio to WAV
  -> uploaded straight to storage
  -> BirdNET identifies what's in it
  -> results saved to the database
  -> the collage redraws
```

Nobody types in a bird name. Lucy picks a recording; everything after that is automatic. She can reject a wrong guess afterwards.

### Where each piece lives

| Piece | What it does | File |
|---|---|---|
| Collage | The page of birds | `app/page.tsx` |
| Add page | What Lucy uses on her phone | `app/add/page.tsx` |
| Audio conversion | `.m4a` to WAV, in the browser | `lib/audio.ts` |
| Upload | Hands out a direct-to-storage link | `app/api/upload-url/route.ts` |
| Analyzer | Runs BirdNET on one recording | `api/analyze.py` |
| Read API | Feeds the collage | `app/api/birds/route.ts` |
| Database shape | Two tables and a view | `supabase/schema.sql` |

### Two design decisions worth knowing

**The audio is converted in the browser, not on the server.** Vercel has no `ffmpeg`, but Safari already decodes the iPhone's own audio format. Converting on the phone costs nothing and removes a whole dependency.

**The upload skips the server entirely.** Vercel refuses request bodies over 4.5 MB, which a long recording exceeds. The phone gets a one-time signed link and sends the file straight to storage.

---

## Running it locally

You need a free [Supabase](https://supabase.com) project first — that's the database and the file storage.

1. Install the dependencies:
   ```bash
   pnpm install
   ```
2. Build the bird pictures (one time, takes a few minutes):
   ```bash
   pnpm illustrations
   ```
3. Copy `.env.example` to `.env.local` and fill in the two Supabase values.
4. In Supabase, open the SQL editor and run everything in `supabase/schema.sql`.
5. In Supabase, create a **storage bucket** named `recordings`, set to private.
6. Start it:
   ```bash
   pnpm dev
   ```

The analyzer (`api/analyze.py`) only runs on Vercel — it needs the Python runtime. Locally, uploads will save but not identify. Use `vercel dev` if you need the full loop on your machine.

---

## Where this came from

Forked from [AvianVisitors](https://github.com/Twarner491/AvianVisitors) by Theodore Warner, which is itself a fork of [BirdNET-Pi](https://github.com/Nachtzuster/BirdNET-Pi).

The original is a Raspberry Pi with a microphone in a window, listening around the clock. This version has no Pi and no microphone — the recordings come from a phone, on purpose, so that Lucy is the one choosing what gets collected.

What's kept from the original:

- `avian/assets/` — 666 hand-styled illustrations (333 species, perched and in flight) and 157 photo cutouts
- `avian/frontend/` — the original collage engine, kept as reference for the layout port
- `avian/scripts/` — the pipeline that generates new illustrations in the same style
- `model/*_Labels.txt` — the species lists that pipeline reads

Everything Pi-shaped — the recording daemon, the folder watcher, SQLite, PHP, Caddy, the systemd services, the installer, the e-ink frame — was removed. It's all still in the git history if it's ever wanted.

**Licence: CC-BY-NC-SA-4.0**, inherited from BirdNET-Pi. Non-commercial only, attribution required, share alike. See `README.upstream.md` and `LICENSE`.

BirdNET is by the [K. Lisa Yang Center for Conservation Bioacoustics](https://birdnet.cornell.edu/) at the Cornell Lab of Ornithology and Chemnitz University of Technology.
