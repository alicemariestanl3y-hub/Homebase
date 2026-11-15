# HomeBase

Persistent household food management — shopping and pantry organising.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase Auth (email/password) + Postgres + Row Level Security
- Domain inventory types shared by UI, repository, and (later) AI agent tools

## Modes

| Mode | When | Behaviour |
|------|------|-----------|
| **Demo** | Supabase URL/key missing | Sample inventory, no login required |
| **Live** | `SUPABASE_URL` + publishable/anon key set | Auth required; household inventory via RLS |

## Security rules

- Use **Project URL** + **publishable / anon** key only
- **Never** put the **secret service-role** key in the app, frontend, or git
- All data access runs as the signed-in user under Postgres RLS

## Develop

```bash
npm install
cp .env.example .env.local   # fill in Supabase values
npm run dev
```

## Supabase setup (iPhone-friendly)

1. Create a project at [supabase.com](https://supabase.com)
2. In **SQL Editor**, run  
   `supabase/migrations/20261114000000_household_inventory.sql`  
   (raw file on the PR branch if you need to copy-paste)
3. Open **Connect → Server API** (not MCP)
4. Copy **Project URL** and **anon / publishable** key
5. Add Cursor secrets (do not paste into chat):
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` (paste the publishable/anon key here)
6. In Supabase **Authentication → Providers / Email**, disable **Confirm email** while testing on your phone
7. Sign up in the app — a household + pantry/fridge/freezer are created automatically

Until steps 4–5 are done, the app stays in **demo mode**. Do not treat the database as connected until auth + secrets work.

## Features in this increment

- Household-scoped schema + RLS
- Email/password sign up / sign in / sign out
- Inventory tabs: Pantry / Fridge / Freezer
- Add, edit, consume (use), and remove items
- Optional expiry dates; soon-to-expire sorting
- Activity history for adds / uses / adjustments

## Project map

| Path | Role |
|------|------|
| `src/app/` | Routes, Server Actions |
| `src/components/` | UI |
| `src/lib/inventory/` | Types, repository, sample + Supabase adapters |
| `src/lib/supabase/` | Env, server client, auth proxy helper |
| `src/proxy.ts` | Next.js 16 session refresh + auth gating |
| `supabase/migrations/` | Database schema + RLS |
