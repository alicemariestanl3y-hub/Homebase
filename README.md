# HomeBase

Persistent household food management — shopping and pantry organising.

## Current increment

Mobile-first **pantry / fridge / freezer** inventory UI backed by **sample data**.

- Next.js (App Router) + TypeScript + Tailwind
- Domain types and an `InventoryRepository` boundary (ready for Supabase later)
- No live database or authentication yet

## Develop

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project map

| Path | Role |
|------|------|
| `src/app/` | Routes and layout |
| `src/components/inventory/` | Inventory UI |
| `src/lib/inventory/` | Types, units, sample data, repository |

## Next increments

1. Create a Supabase project and apply the household-scoped schema + RLS
2. Wire auth (email/password) and replace sample data with live queries
3. Add/consume/adjust item mutations with activity history writes
4. Expose the same repository operations as controlled AI agent tools
