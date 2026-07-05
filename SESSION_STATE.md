# Pod Check — Session State

## Cold Start Prompt
**Priority:** Verify classic single-pod "HOST A POD" create works end-to-end — the classic
`sessions` insert was dropped in an earlier refactor and may need restoring (see Known Issues).

---

## Recently Completed
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

---

## Notes
- `sessions` shape (source of truth = `supabase-setup.sql`): `id text PK`, `data jsonb not null`,
  `created_at timestamptz default now()`. Both classic and event flows store the whole session
  object as one JSON blob in `data`.
- Realtime on `sessions` must stay enabled — every screen subscribes to `postgres_changes`.
