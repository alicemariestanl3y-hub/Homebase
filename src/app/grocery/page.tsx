import { Suspense } from "react";
import { connection } from "next/server";
import { GroceryImportFlow } from "@/components/grocery/GroceryImportFlow";
import { AppShell } from "@/components/layout/AppShell";
import {
  getDemoHouseholdId,
  getInventoryMode,
  getInventoryRepository,
} from "@/lib/inventory/get-repository";
import { getCurrentHouseholdId } from "@/lib/inventory/supabase-repository";
import type { InventoryItem, LocationType } from "@/lib/inventory/types";

async function GroceryContent() {
  await connection();
  const mode = getInventoryMode();
  const householdId =
    mode === "live" ? await getCurrentHouseholdId() : getDemoHouseholdId();

  let existingItems: InventoryItem[] = [];
  const locationById: Record<string, LocationType> = {};

  if (householdId) {
    try {
      const snapshot = await getInventoryRepository().getSnapshot(householdId);
      existingItems = snapshot?.items ?? [];
      for (const location of snapshot?.locations ?? []) {
        locationById[location.id] = location.type;
      }
    } catch {
      existingItems = [];
    }
  }

  return (
    <AppShell showSignOut={mode === "live"}>
      <GroceryImportFlow
        existingItems={existingItems}
        locationById={locationById}
      />
    </AppShell>
  );
}

export default function GroceryPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <p className="hb-empty">Loading grocery import…</p>
        </AppShell>
      }
    >
      <GroceryContent />
    </Suspense>
  );
}
