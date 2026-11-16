# HomeBase

Persistent household food management — shopping, pantry organising, and Smart Inventory Capture.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase Auth (email/password) + Postgres + Row Level Security
- OpenAI `gpt-4o-mini` vision for Smart Inventory Capture (server-side key only)

## Modes

| Mode | When | Behaviour |
|------|------|-----------|
| **Demo** | Supabase URL/key missing | Sample inventory |
| **Live** | `SUPABASE_URL` + publishable/anon key set | Auth required; household inventory via RLS |

## Smart Inventory Capture

1. Take/upload up to 6 photos (camera or library)
2. Images are resized on-device, analysed server-side, then discarded
3. Review/edit candidates, merge duplicates, approve
4. Save into pantry / fridge / freezer inventory

### API cost (approx.)

Uses **OpenAI gpt-4o-mini** with low image detail after resize (~1024px JPEG).

- Roughly **A$0.01–0.04 per photo** depending on scene complexity
- A 3-photo shelf scan is often **under A$0.10**
- No photos are retained after analysis

Set `OPENAI_API_KEY` as a Cursor app secret (never commit it).

## Security rules

- Use **Project URL** + **publishable / anon** key only
- **Never** put the **secret service-role** key in the app, frontend, or git
- Capture analyse endpoint requires auth when Supabase is configured
- OpenAI key stays server-side only

## Auth setup (required for live signup / sign-in)

1. In Supabase SQL editor, run **both** migrations in order:
   - `supabase/migrations/20261114000000_household_inventory.sql`
   - `supabase/migrations/20261116000000_ensure_my_household.sql`
2. Authentication → URL configuration:
   - Site URL: `https://homebase.apps.grok.bot`
   - Redirect URLs: `https://homebase.apps.grok.bot/**`
3. Authentication → Providers → Email:
   - For easiest testing, disable **Confirm email**
4. Cursor App Secrets (names exact): `SUPABASE_URL`, `SUPABASE_ANON_KEY` (anon/publishable key only)

After signup/sign-in the app calls `ensure_my_household` so every user gets a pantry/fridge/freezer even if the auth trigger was missing.

## Develop

```bash
npm install
cp .env.example .env.local
npm run dev
npm test
```


## Project map

| Path | Role |
|------|------|
| `src/app/capture` | Smart Inventory Capture UI |
| `src/app/api/capture/analyze` | Authenticated vision endpoint |
| `src/components/layout` | Header, bottom nav, shell |
| `src/lib/capture` | Vision, resize helpers, duplicates |
| `src/lib/inventory` | Repository + domain types |
| `supabase/migrations` | Schema + RLS |
