# Handoff — Lucy's Birds

Practical detail for picking this up cold. Read `STATUS.md` first for what's done.

## Where things are

| | |
|---|---|
| Live site | https://lucys-birds.vercel.app |
| Repo | https://github.com/whale/lucys-birds (**public** — forks of public repos always are) |
| Branch | `feat/upload-first-rebuild`, pushed, no PR |
| Vercel | project `lucys-birds`, team `hi-whalefyi's projects` |
| Supabase | project `lucys-birds`, ref `elmxrscgpdtiqgpltchm`, us-east-1 |
| Local | `~/Projects/lucys-birds` |

## Running it

```bash
cd ~/Projects/lucys-birds
pnpm install
pnpm illustrations   # only if public/illustrations is missing
pnpm dev             # http://localhost:3000
```

`.env.local` already exists locally and is gitignored. If it's ever lost, `.env.example` lists every variable; the Supabase values come from the project's API settings, and `GATE_PASSCODE` is `708600`.

## Links you'll want

- **Lucy's no-typing add link** — `https://lucys-birds.vercel.app/add?key=<GATE_LINK_KEY>`. Read the key from `.env.local`. It unlocks on arrival and strips itself from the address bar.
- **Deep link to one bird** — `https://lucys-birds.vercel.app/?bird=cyanocitta-cristata`

## Reviewing it yourself

1. Open the site. You should see **71 species**.
2. Click **collage** — an overlapping, centred cluster. Refresh; it rearranges.
3. Click **map** — clusters over Maine, Colorado, the Carolinas. Zoom in; pins become illustrations.
4. Click any bird — a tray slides in from the right. Arrow keys page through it.
5. Open `/add` in a private window — it should send you to the passcode screen.

## The iOS Shortcut (next task, ~2 minutes on her phone)

The endpoint is live and tested. No accounts, no domain, no email service.

1. Shortcuts app → **+**
2. Add Action → **Get Contents of URL**
3. URL: `https://lucys-birds.vercel.app/api/share`
4. Expand it (⌄): **Method** → POST
5. **Headers** → add `x-lb-key` with the `GATE_LINK_KEY` value from `.env.local`
6. **Request Body** → JSON → add a Text field named `url`, value = **Shortcut Input**
7. ⓘ → turn on **Show in Share Sheet**
8. Rename it **Add to my birds** → Done

Then in Merlin: open a bird → Share → **Add to my birds**.

Optional: add a **Show Notification** action at the end. The endpoint returns a `message` field reading e.g. `"Blue Jay added to Lucy's birds"`.

If her phone is ever lost, rotate `GATE_LINK_KEY` in `.env.local` and in Vercel's env, then redeploy.

## Data operations

Postgres ports were intermittently blocked from this machine during the last session — `supabase db push` hung and `psql` timed out, then both recovered. If that happens again, wait rather than debugging credentials.

```bash
# direct SQL (password is in .db-password.txt, gitignored)
PW=$(cat .db-password.txt)
psql "postgresql://postgres.elmxrscgpdtiqgpltchm:${PW}@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
```

Her eBird import lives in the session scratchpad, not the repo — it's her personal data and doesn't belong in a public repo. To redo an import, ask her to export again (`ebird.org` → My eBird → Download My Data) and re-run the collapse-to-species logic, **snapping coordinates to a 0.1° grid** as `CLAUDE.md` requires.

## Gotchas already paid for

- `public/` is **not** in a serverless function's file bundle — the share card fetches illustrations over HTTP, not from disk.
- Folders starting with `_` are excluded from Next routing.
- `vercel env add` via a heredoc appends a newline and the value silently never matches. Use `printf '%s' "$VAL" | vercel env add`.
- `create or replace view` can't insert a column mid-list — drop the view first.
- Don't name columns in a `.select()` that a pending migration hasn't added yet; PostgREST fails the whole query and blanks the page. `app/page.tsx` uses `select("*")` for exactly this reason.
- Never import `lib/species.ts` from a client component — it pulls a 588 KB JSON into the browser bundle. Client code wants `lib/species-paths.ts`.
