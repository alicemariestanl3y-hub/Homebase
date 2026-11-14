import { Suspense } from "react";
import { connection } from "next/server";
import { InventoryView } from "@/components/inventory/InventoryView";
import { LOCATION_ORDER } from "@/lib/inventory/labels";
import { toItemViews } from "@/lib/inventory/present";
import {
  getDemoHouseholdId,
  getInventoryMode,
  getInventoryRepository,
} from "@/lib/inventory/get-repository";
import { getCurrentHouseholdId } from "@/lib/inventory/supabase-repository";
import type { InventoryItemView, LocationType } from "@/lib/inventory/types";

/**
 * Request-time inventory loader.
 *
 * `await connection()` opts this subtree into dynamic rendering so expiry
 * labels can use the real current time under Next.js Cache Components.
 */
async function InventoryPageContent() {
  await connection();

  const mode = getInventoryMode();
  const repo = getInventoryRepository();

  const householdId =
    mode === "live" ? await getCurrentHouseholdId() : getDemoHouseholdId();

  if (!householdId) {
    return (
      <p className="inventory-empty">
        No household is linked to your account yet. Sign out and sign up again,
        or check that the Supabase migration ran.
      </p>
    );
  }

  const snapshot = await repo.getSnapshot(householdId);

  if (!snapshot) {
    return <p className="inventory-empty">No household inventory found.</p>;
  }

  const now = new Date();
  const initialItemsByLocation = {} as Record<LocationType, InventoryItemView[]>;

  for (const location of LOCATION_ORDER) {
    const items = await repo.listItemsByLocation(householdId, location);
    initialItemsByLocation[location] = toItemViews(items, now);
  }

  const recentActivity = await repo.listRecentActivity(householdId);

  return (
    <InventoryView
      snapshot={snapshot}
      initialItemsByLocation={initialItemsByLocation}
      recentActivity={recentActivity}
      mode={mode}
      showSignOut={mode === "live"}
    />
  );
}

function InventoryFallback() {
  return (
    <div className="inventory-shell" aria-busy="true">
      <header className="inventory-hero">
        <p className="inventory-kicker">Household food</p>
        <h1 className="inventory-brand">HomeBase</h1>
        <p className="inventory-tagline">Loading your inventory…</p>
      </header>
    </div>
  );
}

/**
 * Home / inventory page (Server Component).
 * Switches between sample data and live Supabase via getInventoryRepository().
 */
export default function HomePage() {
  return (
    <main className="inventory-page">
      <Suspense fallback={<InventoryFallback />}>
        <InventoryPageContent />
      </Suspense>
    </main>
  );
}
