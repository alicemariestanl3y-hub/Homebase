# HomeBase

Persistent household food management — shopping and pantry organising.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase Auth (email/password) + Postgres + Row Level Security
- Domain inventory types shared by UI, repository, and (later) AI agent tools

## Modes

| Mode | When | Behaviour |
|------|------|-----------|
| **Demo** | `SUPABASE_URL` / `SUPABASE_ANON_KEY` missing | Sample inventory, no login required |
| **Live** | Secrets present | Auth required; household inventory via RLS |

## Develop

```bash
npm install
cp .env.example .env.local   # fill in Supabase values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. In **SQL Editor**, run `supabase/migrations/20261114000000_household_inventory.sql`
3. In **Project Settings → API**, copy **Project URL** and **anon public** key
4. Set secrets:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
5. In **Authentication → Providers**, keep Email enabled
6. Sign up in the app — a household + pantry/fridge/freezer locations are created automatically

## Project map

| Path | Role |
|------|------|
| `src/app/` | Routes, Server Actions |
| `src/components/` | UI |
| `src/lib/inventory/` | Types, repository, sample + Supabase adapters |
| `src/lib/supabase/` | Env, server client, auth proxy helper |
| `src/proxy.ts` | Next.js 16 session refresh + auth gating |
| `supabase/migrations/` | Database schema + RLS |

## Next increments

1. Consume / adjust item mutations with richer activity notes
2. Shopping list linked to inventory
3. Controlled AI agent tools over the same repository
