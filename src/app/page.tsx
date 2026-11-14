import { Suspense } from "react";
import { connection } from "next/server";
import { InventoryView } from "@/components/inventory/InventoryView";
import { LOCATION_ORDER } from "@/lib/inventory/labels";
import { toItemViews } from "@/lib/inventory/present";
import {
  DEMO_HOUSEHOLD_ID,
  inventoryRepository,
} from "@/lib/inventory/repository";
import type { InventoryItemView, LocationType } from "@/lib/inventory/types";

/**
 * Request-time inventory loader.
 *
 * `await connection()` opts this subtree into dynamic rendering so expiry
 * labels can use the real current time under Next.js Cache Components.
 */
async function InventoryPageContent() {
  await connection();

  const snapshot = await inventoryRepository.getSnapshot(DEMO_HOUSEHOLD_ID);

  if (!snapshot) {
    return <p>No household inventory found.</p>;
  }

  const now = new Date();
  const initialItemsByLocation = {} as Record<LocationType, InventoryItemView[]>;

  for (const location of LOCATION_ORDER) {
    const items = await inventoryRepository.listItemsByLocation(
      DEMO_HOUSEHOLD_ID,
      location,
    );
    initialItemsByLocation[location] = toItemViews(items, now);
  }

  const recentActivity = await inventoryRepository.listRecentActivity(
    DEMO_HOUSEHOLD_ID,
  );

  return (
    <InventoryView
      snapshot={snapshot}
      initialItemsByLocation={initialItemsByLocation}
      recentActivity={recentActivity}
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
 *
 * Data is loaded through InventoryRepository. When we connect Supabase later,
 * this page stays the same — only the repository implementation changes.
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
