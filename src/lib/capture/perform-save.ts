import type { CapturedCandidate, SavedCaptureItem } from "@/lib/capture/types";
import { LOCATION_ORDER } from "@/lib/inventory/labels";
import {
  getDemoHouseholdId,
  getInventoryMode,
  getInventoryRepository,
} from "@/lib/inventory/get-repository";
import { ensureHouseholdForCurrentUser } from "@/lib/inventory/ensure-household";
import { getCurrentHouseholdId } from "@/lib/inventory/supabase-repository";
import { INVENTORY_UNITS } from "@/lib/inventory/units";
import type { InventoryUnit, LocationType } from "@/lib/inventory/types";
import { toDbError } from "@/lib/inventory/db-error";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { normalizeCaptureCandidate } from "@/lib/packaged-meals/normalize-capture";
import {
  linkInventoryItemToCatalog,
  upsertCatalogProduct,
} from "@/lib/packaged-meals/repository";
import type { ProductKind } from "@/lib/packaged-meals/types";

export type { SavedCaptureItem };

export type SaveCaptureResult = {
  error: string | null;
  savedCount: number;
  savedItems: SavedCaptureItem[];
};

async function requireCaptureAccess(): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { error: null };
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return { error: "Sign in to save captured items." };
    }
    return { error: null };
  } catch {
    return { error: "Sign in to save captured items." };
  }
}

export async function performSaveCapturedItems(
  candidates: CapturedCandidate[],
): Promise<SaveCaptureResult> {
  const access = await requireCaptureAccess();
  if (access.error) return { error: access.error, savedCount: 0, savedItems: [] };

  const selected = candidates.filter((item) => item.selected !== false);
  if (selected.length === 0) {
    return {
      error: "Select at least one item to save.",
      savedCount: 0,
      savedItems: [],
    };
  }

  const mode = getInventoryMode();
  let householdId =
    mode === "live" ? await getCurrentHouseholdId() : getDemoHouseholdId();

  if (mode === "live" && !householdId) {
    const ensured = await ensureHouseholdForCurrentUser();
    householdId = ensured.householdId;
    if (!householdId) {
      return {
        error:
          ensured.error ??
          "No household found for your account. Run the ensure_my_household migration, then sign in again.",
        savedCount: 0,
        savedItems: [],
      };
    }
  }

  if (!householdId) {
    return {
      error: "No household found for your account.",
      savedCount: 0,
      savedItems: [],
    };
  }

  const repo = getInventoryRepository();
  let savedCount = 0;
  let skipped = 0;
  const savedItems: SavedCaptureItem[] = [];

  try {
    for (const raw of selected) {
      const item = normalizeCaptureCandidate(raw);
      if (!item.name.trim()) {
        skipped += 1;
        continue;
      }
      if (!INVENTORY_UNITS.includes(item.unit)) {
        skipped += 1;
        continue;
      }
      if (!LOCATION_ORDER.includes(item.suggestedLocation as LocationType)) {
        skipped += 1;
        continue;
      }
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
        skipped += 1;
        continue;
      }

      const expiresOn =
        item.expiresOn && /^\d{4}-\d{2}-\d{2}$/.test(item.expiresOn)
          ? item.expiresOn
          : null;

      let catalogProductId: string | null = null;
      let productKind: ProductKind | null = item.suggestedProductKind;
      try {
        const product = await upsertCatalogProduct({
          householdId,
          brand: item.brand,
          displayName: item.name.trim(),
          packSize: item.packageSize,
          originalName: item.name.trim(),
          notes: item.notes,
          sourceType: "capture",
          productKind: item.isPackagedMealProduct
            ? item.suggestedProductKind
            : undefined,
          kindConfirmed: false,
        });
        catalogProductId = product.id;
        productKind = product.productKind;
      } catch (catalogError) {
        console.error("catalog upsert on capture save failed:", catalogError);
      }

      let inventoryItemId: string | null = null;

      if (item.mergeWithItemId) {
        const snapshot = await repo.getSnapshot(householdId);
        const existing = snapshot?.items.find(
          (row) => row.id === item.mergeWithItemId,
        );
        if (!existing) {
          throw new Error(
            `Could not find inventory item to merge: ${item.name}`,
          );
        }
        const locationType =
          snapshot?.locations.find((loc) => loc.id === existing.locationId)
            ?.type ?? item.suggestedLocation;

        // Prefer packets when merging into a weight row for the same packet product.
        const nextUnit =
          item.isPackagedMealProduct && existing.unit !== "packets"
            ? item.unit
            : existing.unit;
        const nextQuantity =
          item.isPackagedMealProduct && existing.unit !== "packets"
            ? item.quantity
            : existing.quantity + item.quantity;

        const updated = await repo.updateItem({
          householdId,
          itemId: existing.id,
          name: existing.name,
          quantity: nextQuantity,
          unit: nextUnit,
          locationType,
          expiresOn: existing.expiresOn,
          notes: existing.notes,
          catalogProductId: catalogProductId ?? existing.catalogProductId,
        });
        inventoryItemId = updated.id;
        if (catalogProductId) {
          try {
            await linkInventoryItemToCatalog(
              householdId,
              updated.id,
              catalogProductId,
            );
          } catch (linkError) {
            console.error("catalog link on merge failed:", linkError);
          }
        }
      } else {
        const noteParts = [
          item.brand ? `Brand: ${item.brand}` : null,
          item.packageSize ? `Pack: ${item.packageSize}` : null,
          item.isPackagedMealProduct
            ? `Stocked as ${item.quantity} packet${item.quantity === 1 ? "" : "s"}`
            : null,
          item.notes,
          "Added via Smart Capture",
        ].filter(Boolean);

        const created = await repo.addItem({
          householdId,
          locationType: item.suggestedLocation,
          name: item.name.trim(),
          quantity: item.quantity,
          unit: item.unit as InventoryUnit,
          expiresOn,
          notes: noteParts.join(" · ") || null,
          catalogProductId,
        });
        inventoryItemId = created.id;
      }

      if (inventoryItemId) {
        savedItems.push({
          inventoryItemId,
          catalogProductId,
          name: item.name.trim(),
          productKind,
          isPackagedMealProduct: item.isPackagedMealProduct,
          packageSize: item.packageSize,
          brand: item.brand,
        });
        savedCount += 1;
      }
    }
  } catch (error) {
    return {
      error: toDbError(error, "Could not save captured items.").message,
      savedCount,
      savedItems,
    };
  }

  if (savedCount === 0) {
    return {
      error:
        skipped > 0
          ? "None of the selected items could be saved. Check name, unit, location and quantity."
          : "No items were saved.",
      savedCount: 0,
      savedItems: [],
    };
  }

  return { error: null, savedCount, savedItems };
}
