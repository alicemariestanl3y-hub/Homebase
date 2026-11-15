import { Suspense } from "react";
import { connection } from "next/server";
import { SmartCaptureFlow } from "@/components/capture/SmartCaptureFlow";
import { AppShell } from "@/components/layout/AppShell";
import {
  getDemoHouseholdId,
  getInventoryMode,
  getInventoryRepository,
} from "@/lib/inventory/get-repository";
import { getCurrentHouseholdId } from "@/lib/inventory/supabase-repository";
import type { InventoryItem, LocationType } from "@/lib/inventory/types";

async function CaptureContent() {
  await connection();
  const mode = getInventoryMode();
  const householdId =
    mode === "live" ? await getCurrentHouseholdId() : getDemoHouseholdId();

  const locationById: Record<string, LocationType> = {};
  let existingItems: InventoryItem[] = [];

  if (householdId) {
    const snapshot = await getInventoryRepository().getSnapshot(householdId);
    if (snapshot) {
      existingItems = snapshot.items;
      for (const location of snapshot.locations) {
        locationById[location.id] = location.type;
      }
    }
  }

  return (
    <AppShell showSignOut={mode === "live"}>
      <SmartCaptureFlow
        existingItems={existingItems}
        locationById={locationById}
      />
    </AppShell>
  );
}

export default function CapturePage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <p className="hb-empty">Loading capture…</p>
        </AppShell>
      }
    >
      <CaptureContent />
    </Suspense>
  );
}
