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

type GroceryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function GroceryContent({ searchParams }: GroceryPageProps) {
  await connection();
  const params = (await searchParams) ?? {};
  const visitKey = firstParam(params.fresh) ?? "grocery";
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
        key={visitKey}
        existingItems={existingItems}
        locationById={locationById}
      />
    </AppShell>
  );
}

export default function GroceryPage(props: GroceryPageProps) {
  return (
    <Suspense
      fallback={
        <AppShell>
          <p className="hb-empty">Loading grocery import…</p>
        </AppShell>
      }
    >
      <GroceryContent searchParams={props.searchParams} />
    </Suspense>
  );
}
