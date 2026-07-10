# CLAUDE.md — Cardstock Project Context

> **Standing Instructions:** At the end of every session where architectural changes were made
> (new screens, new components, new libraries, auth/backend changes, navigation changes, or
> resolved known issues), update this file before closing. Minor bug fixes, style tweaks, and
> copy changes do NOT require an update.

---

## What Is Cardstock?

Cardstock is a family of three standalone MTG web apps sharing a brand, a Supabase backend,
and a crystal color palette. Each app deploys independently but they are designed to eventually
hand off to each other.

**Builder context:** Solo PM vibe-coding. Not a developer. Prioritize working code over perfect
code. Always explain what you're doing and why. Never silently restructure files or rename things
without flagging it.

---

## The Three Apps

### Deck Stack — `deck-stack.vercel.app`
- **Repo:** `commander-zen/deck-stack`
- **What it does:** Scryfall-powered card swipe deck builder. Search → swipe right to keep /
  left to pass → export pile to Moxfield.
- **Core flow:** Search screen → SwipeStack → Pile (saved cards) → Export
- **Multi-deck system:** "Brews" — users can manage multiple decks via QuiverDrawer
- **Nav:** BottomNav with three tabs: SWIPE, PILE, BREWS
- **Auth:** Supabase passwordless email OTP
- **Backend:** Supabase for auth, deck persistence, and cross-device sync
- **Key files:**
  - `src/screens/` — active screens (NOT `src/pages/` which is legacy/dead)
  - `src/lib/auth.js` — Supabase auth helpers
  - `src/lib/db.js` — database operations
  - `src/lib/supabase.js` — Supabase client init
  - `src/components/QuiverDrawer.jsx` — multi-deck drawer
  - `src/components/BottomNav.jsx` — tab navigation
  - `src/components/AuthSheet.jsx` — auth modal

### Pod Check — `pod-check.vercel.app`
- **Repo:** `commander-zen/pod-check`
- **What it does:** Commander power balance checker. Players join a session, submit their
  Archidekt/Moxfield deck URL, the app analyzes it via the official ScryCheck API, produces a
  power bracket verdict.
- **Flow ends** at BigVerdict screen — clean stop, no Life Check CTA in UI
- **ScryCheck API:** `api/scrape.js` is a server-side proxy that POSTs the deck URL to the
  official ScryCheck private-beta API (`/api/v1/analyze`) using `SCRYCHECK_API_KEY` (Vercel env
  var + local `.env.local`, never the tracked `.env`). It accepts public Archidekt/Moxfield deck
  URLs (NOT `scrycheck.com/deck/` result URLs) and normalizes the JSON into the app's `deckData`
  shape. Shared URL validator: `isSupportedDeckUrl()` in `src/lib/pods.js`.
- **Escape hatch:** "Skip analysis — I know my bracket" available throughout onboarding
- **Offline players:** Host-side manual entry supported

### Life Check — `life-check.vercel.app`
- **Repo:** `commander-zen/life-check`
- **What it does:** Personal-device life tracker for Commander. Each player uses their own phone.
- **Entry:** Deep link `life-check.vercel.app/session/:id` for future Pod Check handoff
- **Features:** Commander art backgrounds, spring-animated life totals, turn order with current
  player row sliding to bottom third of screen
- **Real-time sync:** Supabase

---

## Shared Infrastructure

| Thing | Value |
|---|---|
| Supabase project ID | `lkmhatjrikbcquaeyrft` |
| Color: background | `#06040f` |
| Color: primary blue | `#5b8fff` |
| Color: secondary purple | `#a78bfa` |
| Color: ice cyan | `#00c9ff` |
| Color: aurora white | `#e0f2ff` |
| Font: display | IBM Plex Mono (mono) |
| Stack | Vite + React 18 |
| Deploy | Vercel (per app) |
| Tracking | Linear (`cardstock_` prefix, `BB-` tickets) |

**Palette inspiration:** GBA Pokémon Crystal / Suicune aesthetic.

---

## Scryfall API Rules (Do Not Violate)
- 500ms minimum between `/cards/search` calls
- 30s backoff on 429 responses
- 24hr sessionStorage cache for search results
- Images from `*.scryfall.io` are rate-limit free — load them directly

---

## Known Issues / Open Gaps
<!-- Update this section as issues are resolved or discovered -->
- `pages/` folder in Deck Stack is likely dead code — pending cleanup
- WREC scoring: `_deckCategory` not being set on swiped cards, so scoring doesn't complete end-to-end
- Crystal palette rollout (BB-132) still pending full rollout across all apps
- BB-134: Logo/favicon — elongated oval pod with oversized checkmark bursting out (hand sketch saved to Linear)

---

## Active Backlog (Snapshot)
<!-- Keep this loosely updated — Linear is source of truth -->
- BB-132: Crystal palette rollout
- BB-134: Logo/favicon
- BB-135: Archidekt API deck picker (post-MVP)
- BB-136: Deck re-submit after bad verdict
- BB-137: iPhone Live Activity

---

## Conventions & Decisions
- **One Supabase project** for all three apps — simpler ops, free tier fits
- **Separate GitHub repo + Vercel project** per app — independent deploys
- **`src/screens/`** is active code; **`src/pages/`** is legacy — never touch pages/
- **No automatic file restructuring** — ask before renaming or moving files
- **Mobile-first** — use `100dvh`, measure `offsetTop` dynamically for slide math
- **No `gh` CLI** — GitHub repos created manually at github.com/new
