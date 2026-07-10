# Pod Check

> Commander power balance checker for your LGS table.  
> Powered by [ScryCheck](https://scrycheck.com) — the best Commander deck analysis tool out there.

## How it works

1. **Host** opens the app, creates a session, gets a QR code
2. **Players** scan the QR → land on a join page → pick a seat → paste their Archidekt/Moxfield deck URL (analyzed automatically via the ScryCheck API)
3. Everyone watches a live lobby as each player submits
4. Once all 4 are ready → results push to every screen simultaneously

---

## Setup (one-time)

### 1. Supabase

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to **SQL Editor** and run everything in `supabase-setup.sql`
4. Go to **Project Settings → API** and copy:
   - `Project URL`
   - `anon public` key

### 2. Environment variables

```bash
cp .env.example .env
```

Fill in your `.env` (safe to commit — anon key is public):
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

The **ScryCheck API secret is server-side only and must NOT be committed.** Put it in a
git-ignored `.env.local` (used by `vercel dev`), never in `.env`:
```
SCRYCHECK_API_KEY=your-scrycheck-private-beta-secret
```

### 3. Install and run locally

```bash
npm install
vercel dev   # serves the /api/scrape function too — plain `npm run dev` won't
```

Open the URL Vercel prints (usually [http://localhost:3000](http://localhost:3000)).

> **Note:** The `/api/scrape` serverless function (the ScryCheck API proxy) only runs under
> `vercel dev` or on Vercel. With plain `npm run dev` the UI loads but deck analysis will fail.

---

## Deploy to Vercel

### First deploy

```bash
npm install -g vercel
vercel
```

Follow the prompts. When asked about the framework, select **Vite**.

### Add environment variables in Vercel

Go to your Vercel project → **Settings → Environment Variables** and add:

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | your Supabase anon key |
| `SCRYCHECK_API_KEY` | your ScryCheck private-beta secret (server-side only — do **not** prefix with `VITE_`) |

### Redeploy after adding env vars

```bash
vercel --prod
```

---

## Supabase Realtime

Make sure realtime is enabled on the `sessions` table:

1. Go to **Supabase Dashboard → Database → Replication**
2. Find the `sessions` table and toggle it on

This is what makes all 4 players' screens update simultaneously.

---

## Project structure

```
pod-check/
├── index.html
├── vite.config.js
├── package.json
├── vercel.json              ← SPA routing + API config
├── supabase-setup.sql       ← run once in Supabase dashboard
├── .env.example
├── api/
│   └── scrape.js            ← Vercel serverless: proxies the ScryCheck API (holds the secret)
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── lib/
    │   ├── supabase.js
    │   └── ui.jsx           ← shared tokens + tiny components
    ├── pages/
    │   ├── HostPage.jsx     ← session creation, QR, live lobby
    │   └── JoinPage.jsx     ← player join flow + results
    └── components/
        ├── PlayerCard.jsx
        └── BalanceVerdict.jsx
```

---

## Credits

Deck analysis is entirely powered by **[ScryCheck](https://scrycheck.com)**, via their official
API. Please support them — each verdict links back to the full analysis on ScryCheck.

Magic: The Gathering and all related trademarks are property of Wizards of the Coast LLC.  
Pod Check is an unofficial fan project.
