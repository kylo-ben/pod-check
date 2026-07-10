# Pod Check — Session State

## Cold Start Prompt
**Priority:** Smoke-test the ScryCheck integration in the live Vercel deploy — single-pod join →
verdict, event signup, deck swap — using a real Moxfield/Archidekt URL. Key is in Vercel and code
is pushed to `master` (deploy auto-triggered). Confirm `/api/scrape` returns 200 in prod.

---

## Recently Completed
- ✅ 2026-07-10 — Removed the "just checking one table? use classic pod check" trapdoor link from
  Home per Ben (legacy, unused). `/classic` route + `PersistentShell`/`HostPage`/`JoinPage` code
  kept intentionally (chose "hide the link", not full removal) — now unreachable from the UI.
- ✅ 2026-07-10 — **Heavy ScryCheck credit rollout.** Strengthened `ScryCheckCredit` (POWERED BY +
  big link + "best in the biz" endorsement) and added a compact `ScryCheckBadge` ("Scores by
  ScryCheck — the best EDH deck grader in the biz"). Credit now appears on Home (front door), the
  BigVerdict score screen (inline badge + footer), the Event lobby, and Host page. Both in
  `src/lib/ui.jsx`. Prod integration confirmed working by Ben.
- ✅ 2026-07-10 — **Hooked Pod Check into the official ScryCheck private-beta API** (replaces the
  fragile HTML scraper).
  - `api/scrape.js` rewritten as a server-side proxy: POSTs the deck URL to
    `https://scrycheck.com/api/v1/analyze` with `Authorization: Bearer $SCRYCHECK_API_KEY`, maps
    the ScryCheck error codes to friendly messages, and normalizes the rich JSON back into the
    existing `deckData` shape (kept the load-bearing misspelled `scrychecUrl` key). Route/filename
    unchanged so `vercel.json` + the three callers still work.
  - **Input changed:** users now paste a public **Archidekt/Moxfield deck URL** directly (no more
    pre-run `scrycheck.com/deck/` result URL). Shared validator `isSupportedDeckUrl()` added to
    `src/lib/pods.js`; wired into `JoinPage` (ThreeBarOnboarding — dropped the ScryCheck detour),
    `EventSignup`, and `SwapPanel`, with updated copy/placeholders throughout.
  - **PlayerCard:** vector bars relabeled to the API's real names (Velocity/Consistency/
    Interaction/Efficiency/Lethality); combos/game-changers (not in the API) replaced with the
    API's `themes` chips + `warnings` (rendered defensively via `asText()` in case they're objects).
  - Docs: `.gitignore` now ignores `.env.local`; `CLAUDE.md`, `README.md` updated for the API flow
    and the new `SCRYCHECK_API_KEY` (server-side only — must NOT go in the git-tracked `.env`).
  - Verified: `npm run build` passes; **validated against the LIVE API (HTTP 200)** with a real
    Moxfield deck — auth works (send both `Bearer` + `X-ScryCheck-API-Key`; Adam's note omitted
    "Bearer" so we send both), normalize maps correctly. Confirmed shapes: `themes` are **objects**
    (`{name,type,strength}`), `warnings` are **strings** — PlayerCard's `asText()` handles both.
    (The old "combos" signal partly survives: the API returns e.g. `"1 Infinite Combo(s) Detected!"`
    as a warning.) `scoringVersion` seen live = `v2026-07-10`.
- ✅ 2026-07-05 — Diagnosed & fixed the live `sessions` table schema drift that broke CREATE EVENT.
  **Event flow now verified working end-to-end in production** (create → multi-browser join →
  auto-built pod → live host view). No code changes this session; DB-only.
  - **Symptom:** CREATE EVENT failed with `Could not find the 'data' column of 'sessions' in the schema cache` (not a stale cache — real schema mismatch).
  - **Root cause:** Live `sessions` table did not match the repo schema ([supabase-setup.sql](supabase-setup.sql)). Three layered problems, surfaced one error at a time:
    1. Missing `data jsonb` column (code stores the whole session as one blob).
    2. `id` was `uuid`; code needs `text` (5-char codes from `makeSessionId()`).
    3. After recreate, `anon`/`authenticated` roles had no table GRANTs → `permission denied for table sessions` (403).
  - **Fix (run by Ben in Supabase SQL editor):**
    1. Dropped & recreated `sessions` per repo schema (table was empty, 0 rows), restored the 3 permissive RLS policies, added it to `supabase_realtime`.
    2. `grant usage on schema public to anon, authenticated;`
       `grant select, insert, update, delete on table sessions to anon, authenticated;`
  - **Lesson for future recreates:** a raw `create table` in the SQL editor does NOT auto-grant
    the client roles the way the dashboard Table Editor does — always follow a recreate with the
    GRANTs above, or writes 403 with "permission denied for table".

---

## Known Issues
- **Classic `sessions` insert missing:** The classic single-pod flow no longer inserts a
  `sessions` row on host-create. `PersistentShell.handleHost` only navigates to
  `/join/:id?host=1`; `JoinPage`/`HostPage` only `select`/`update`. Only `EventHostSetup.jsx`
  still does `.from("sessions").insert(...)`. Classic "HOST A POD" likely fails to create a row.
  The original insert existed at old `JoinPage` (initial commit) and was dropped during the
  shared-auth / auto-join refactor. **Needs verification + likely restore.**
- **No migration trail:** Live DB drifted from `supabase-setup.sql` with no `supabase/migrations/`
  folder to track schema. This drift is what caused today's outage. Candidate backlog item.
- **`.env` is git-tracked** (holds Supabase URL + anon key — those are public-safe, so not urgent,
  but the file being tracked is a footgun). The ScryCheck secret was deliberately kept OUT of it —
  it lives only in Vercel env vars + git-ignored `.env.local`. Consider untracking `.env` later.
- **ScryCheck API note (resolved):** `themes` = objects `{name,type,strength}`, `warnings` = strings
  (confirmed live). `combos` / `game changers` counts are gone (no API field); verdict/scoring math
  is unchanged (still uses `power` + `bracket`). Only `theme.name` is shown as a chip — `type`/
  `strength` are available if we ever want richer display.
- **Duplicate verdict logic:** `BigVerdict` (inline in `JoinPage.jsx`) and `BalanceVerdict.jsx`
  both compute the same thresholds — pre-existing, untouched this session.
- **Git remote moved:** `origin` still points at `kylo-ben/pod-check`, but GitHub now redirects it to
  `commander-zen/pod-check` (the canonical repo per CLAUDE.md). Push works via redirect; update the
  remote when convenient: `git remote set-url origin https://github.com/commander-zen/pod-check.git`.
- **Merge note:** the ScryCheck work was merged with the `reposition` PR (#2, event-first home +
  brand-voice copy sweep). Event copy now uses the new voice ("drop in a deck link… never a power
  check") with the source corrected to "Moxfield or Archidekt" (was "ScryCheck deck link").

---

## Notes
- `sessions` shape (source of truth = `supabase-setup.sql`): `id text PK`, `data jsonb not null`,
  `created_at timestamptz default now()`. Both classic and event flows store the whole session
  object as one JSON blob in `data`.
- Realtime on `sessions` must stay enabled — every screen subscribes to `postgres_changes`.
