"use server";

import { revalidatePath } from "next/cache";
import type { CapturedCandidate } from "@/lib/capture/types";
import { LOCATION_ORDER } from "@/lib/inventory/labels";
import {
  getDemoHouseholdId,
  getInventoryMode,
  getInventoryRepository,
} from "@/lib/inventory/get-repository";
import { getCurrentHouseholdId } from "@/lib/inventory/supabase-repository";
import { INVENTORY_UNITS } from "@/lib/inventory/units";
import type { InventoryUnit, LocationType } from "@/lib/inventory/types";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type SaveCaptureState = {
  error: string | null;
  savedCount: number;
};

async function requireCaptureAccess(): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) {
    // Demo mode is allowed for local/sample testing only.
    return { error: null };
  }
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: "Sign in to save captured items." };
  }
  return { error: null };
}

export async function saveCapturedItems(
  candidates: CapturedCandidate[],
): Promise<SaveCaptureState> {
  const access = await requireCaptureAccess();
  if (access.error) return { error: access.error, savedCount: 0 };

  const selected = candidates.filter((item) => item.selected !== false);
  if (selected.length === 0) {
    return { error: "Select at least one item to save.", savedCount: 0 };
  }

  const mode = getInventoryMode();
  const householdId =
    mode === "live" ? await getCurrentHouseholdId() : getDemoHouseholdId();
  if (!householdId) {
    return { error: "No household found for your account.", savedCount: 0 };
  }

  const repo = getInventoryRepository();
  let savedCount = 0;

  try {
    for (const item of selected) {
      if (!item.name.trim()) continue;
      if (!INVENTORY_UNITS.includes(item.unit)) continue;
      if (!LOCATION_ORDER.includes(item.suggestedLocation as LocationType)) {
        continue;
      }
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) continue;

      // Never invent expiry — only persist if the model/user supplied YYYY-MM-DD.
      const expiresOn =
        item.expiresOn && /^\d{4}-\d{2}-\d{2}$/.test(item.expiresOn)
          ? item.expiresOn
          : null;

      if (item.mergeWithItemId) {
        const snapshot = await repo.getSnapshot(householdId);
        const existing = snapshot?.items.find(
          (row) => row.id === item.mergeWithItemId,
        );
        if (!existing) {
          throw new Error(`Could not find inventory item to merge: ${item.name}`);
        }
        const locationType =
          snapshot?.locations.find((loc) => loc.id === existing.locationId)
            ?.type ?? item.suggestedLocation;

        await repo.updateItem({
          householdId,
          itemId: existing.id,
          name: existing.name,
          quantity: existing.quantity + item.quantity,
          unit: existing.unit,
          locationType,
          expiresOn: existing.expiresOn,
          notes: existing.notes,
        });
      } else {
        const noteParts = [
          item.brand ? `Brand: ${item.brand}` : null,
          item.packageSize ? `Pack: ${item.packageSize}` : null,
          item.notes,
          "Added via Smart Capture",
        ].filter(Boolean);

        await repo.addItem({
          householdId,
          locationType: item.suggestedLocation,
          name: item.name.trim(),
          quantity: item.quantity,
          unit: item.unit as InventoryUnit,
          expiresOn,
          notes: noteParts.join(" · ") || null,
        });
      }

      savedCount += 1;
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not save captured items.";
    return { error: message, savedCount };
  }

  revalidatePath("/");
  return { error: null, savedCount };
}
