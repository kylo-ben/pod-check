# Pod Check — Session State

## Cold Start Prompt
**Priority:** Verify classic single-pod "HOST A POD" create works end-to-end — the classic
`sessions` insert was dropped in an earlier refactor and may need restoring (see Known Issues).

---

## Recently Completed
- ✅ 2026-07-05 — Diagnosed & fixed the live `sessions` table schema drift that broke CREATE EVENT.
  - **Symptom:** CREATE EVENT failed with `Could not find the 'data' column of 'sessions' in the schema cache` (not a stale cache — real schema mismatch).
  - **Root cause:** Live `sessions` table did not match the repo schema ([supabase-setup.sql](supabase-setup.sql)). Live table had `id uuid` + `created_at` only; the code needs `id text` (5-char codes from `makeSessionId()`), a `data jsonb` blob column, and realtime enabled.
  - **Fix (run by Ben in Supabase SQL editor):** dropped & recreated `sessions` per repo schema (table was empty, 0 rows), restored the 3 permissive RLS policies, and added the table to `supabase_realtime`. Migration succeeded.
  - No code changes this session; DB-only.

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
