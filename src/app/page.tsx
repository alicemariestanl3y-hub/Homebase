import { Suspense } from "react";
import { connection } from "next/server";
import { InventoryView } from "@/components/inventory/InventoryView";
import { AppShell } from "@/components/layout/AppShell";
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

async function loadInventory(): Promise<LoadedState> {
  await connection();

  try {
    const mode = getInventoryMode();
    const repo = getInventoryRepository();
    const householdId =
      mode === "live" ? await getCurrentHouseholdId() : getDemoHouseholdId();

    if (!householdId) return { kind: "no-household" };

    const snapshot = await repo.getSnapshot(householdId);
    if (!snapshot) return { kind: "no-snapshot" };

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
  const mode = getInventoryMode();

  const hero = (
    <section className="hb-hero">
      <p className="hb-hero__kicker">— Household food —</p>
      <h1 className="hb-hero__title">What&apos;s in the kitchen</h1>
      <p className="hb-hero__sub">
        Pantry, fridge and freezer in one place.
      </p>
    </section>
  );

  if (state.kind === "no-household") {
    return (
      <AppShell showSignOut={mode === "live"} hero={hero}>
        <p className="hb-empty">
          No household is linked to your account yet. Sign out and sign up
          again, or check that the Supabase migration ran.
        </p>
      </AppShell>
    );
  }

  if (state.kind === "no-snapshot") {
    return (
      <AppShell showSignOut={mode === "live"} hero={hero}>
        <p className="hb-empty">No household inventory found.</p>
      </AppShell>
    );
  }

  if (state.kind === "error") {
    return (
      <AppShell showSignOut={mode === "live"} hero={hero}>
        <div className="auth-card" style={{ boxShadow: "none" }}>
          <h2 className="section-title">Couldn’t load inventory</h2>
          <p className="auth-error">{state.message}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell showSignOut={state.mode === "live"} hero={hero}>
      <InventoryView
        snapshot={state.snapshot}
        initialItemsByLocation={state.initialItemsByLocation}
        recentActivity={state.recentActivity}
        mode={state.mode}
      />
    </AppShell>
  );
}

function InventoryFallback() {
  return (
    <AppShell
      hero={
        <section className="hb-hero">
          <p className="hb-hero__kicker">— Household food —</p>
          <h1 className="hb-hero__title">What&apos;s in the kitchen</h1>
          <p className="hb-hero__sub">Loading your inventory…</p>
        </section>
      }
    >
      <p className="hb-empty">Loading…</p>
    </AppShell>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<InventoryFallback />}>
      <InventoryPageContent />
    </Suspense>
  );
}
