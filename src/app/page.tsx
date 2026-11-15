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
import type {
  InventoryActivity,
  InventoryItemView,
  InventoryMode,
  InventorySnapshot,
  LocationType,
} from "@/lib/inventory/types";

type LoadedInventory = {
  kind: "ok";
  snapshot: InventorySnapshot;
  initialItemsByLocation: Record<LocationType, InventoryItemView[]>;
  recentActivity: InventoryActivity[];
  mode: InventoryMode;
};

type LoadedState =
  | LoadedInventory
  | { kind: "no-household" }
  | { kind: "no-snapshot" }
  | { kind: "error"; message: string };

/**
 * Request-time inventory loader.
 *
 * `await connection()` opts this subtree into dynamic rendering so expiry
 * labels can use the real current time under Next.js Cache Components.
 */
async function loadInventory(): Promise<LoadedState> {
  await connection();

  try {
    const mode = getInventoryMode();
    const repo = getInventoryRepository();

    const householdId =
      mode === "live" ? await getCurrentHouseholdId() : getDemoHouseholdId();

    if (!householdId) {
      return { kind: "no-household" };
    }

    const snapshot = await repo.getSnapshot(householdId);

    if (!snapshot) {
      return { kind: "no-snapshot" };
    }

    const now = new Date();
    const initialItemsByLocation = {} as Record<
      LocationType,
      InventoryItemView[]
    >;

    for (const location of LOCATION_ORDER) {
      const items = await repo.listItemsByLocation(householdId, location);
      initialItemsByLocation[location] = toItemViews(items, now);
    }

    const recentActivity = await repo.listRecentActivity(householdId);

    return {
      kind: "ok",
      snapshot,
      initialItemsByLocation,
      recentActivity,
      mode,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown inventory error";
    return { kind: "error", message };
  }
}

async function InventoryPageContent() {
  const state = await loadInventory();

  if (state.kind === "no-household") {
    return (
      <p className="inventory-empty">
        No household is linked to your account yet. Sign out and sign up again,
        or check that the Supabase migration ran.
      </p>
    );
  }

  if (state.kind === "no-snapshot") {
    return <p className="inventory-empty">No household inventory found.</p>;
  }

  if (state.kind === "error") {
    return (
      <div className="auth-card">
        <p className="inventory-kicker">HomeBase</p>
        <h2 className="add-item-form__title">Couldn’t load inventory</h2>
        <p className="auth-error">{state.message}</p>
        <p className="inventory-demo-note">
          Check that SUPABASE_URL is your Project URL and SUPABASE_ANON_KEY is
          the publishable/anon key (not the secret service-role key).
        </p>
      </div>
    );
  }

  return (
    <InventoryView
      snapshot={state.snapshot}
      initialItemsByLocation={state.initialItemsByLocation}
      recentActivity={state.recentActivity}
      mode={state.mode}
      showSignOut={state.mode === "live"}
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
