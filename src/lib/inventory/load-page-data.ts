import { connection } from "next/server";
import { LOCATION_ORDER } from "@/lib/inventory/labels";
import { toItemViews } from "@/lib/inventory/present";
import { ensureHouseholdForCurrentUser } from "@/lib/inventory/ensure-household";
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

export type LoadedInventory = {
  kind: "ok";
  snapshot: InventorySnapshot;
  initialItemsByLocation: Record<LocationType, InventoryItemView[]>;
  recentActivity: InventoryActivity[];
  mode: InventoryMode;
  totalItems: number;
};

export type InventoryPageState =
  | LoadedInventory
  | { kind: "no-household"; mode: InventoryMode }
  | { kind: "no-snapshot"; mode: InventoryMode }
  | { kind: "error"; message: string; mode: InventoryMode };

/** Shared loader for Home dashboard + Inventory page (preserves existing data path). */
export async function loadInventoryPageData(): Promise<InventoryPageState> {
  await connection();
  const mode = getInventoryMode();

  try {
    const repo = getInventoryRepository();
    let householdId =
      mode === "live" ? await getCurrentHouseholdId() : getDemoHouseholdId();

    if (mode === "live" && !householdId) {
      const ensured = await ensureHouseholdForCurrentUser();
      householdId = ensured.householdId;
      if (!householdId) {
        return {
          kind: "error",
          mode,
          message:
            ensured.error ??
            "No household is linked to your account yet. Run the ensure_my_household migration in Supabase, then sign in again.",
        };
      }
    }

    if (!householdId) return { kind: "no-household", mode };

    const snapshot = await repo.getSnapshot(householdId);
    if (!snapshot) return { kind: "no-snapshot", mode };

    const now = new Date();
    const initialItemsByLocation = {} as Record<
      LocationType,
      InventoryItemView[]
    >;
    let totalItems = 0;

    for (const location of LOCATION_ORDER) {
      const items = await repo.listItemsByLocation(householdId, location);
      initialItemsByLocation[location] = toItemViews(items, now);
      totalItems += items.length;
    }

    const recentActivity = await repo.listRecentActivity(householdId);

    return {
      kind: "ok",
      snapshot,
      initialItemsByLocation,
      recentActivity,
      mode,
      totalItems,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown inventory error";
    return { kind: "error", mode, message };
  }
}
