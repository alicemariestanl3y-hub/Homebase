import { toDbError } from "@/lib/inventory/db-error";
import { ensureHouseholdForCurrentUser } from "@/lib/inventory/ensure-household";
import {
  getDemoHouseholdId,
  getInventoryMode,
  getInventoryRepository,
} from "@/lib/inventory/get-repository";
import { getCurrentHouseholdId } from "@/lib/inventory/supabase-repository";
import { INVENTORY_UNITS } from "@/lib/inventory/units";
import { LOCATION_ORDER } from "@/lib/inventory/labels";
import type { InventoryUnit, LocationType } from "@/lib/inventory/types";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { GrocerySavePayload } from "./types";

export type GrocerySaveResult = {
  error: string | null;
  savedCount: number;
  importId: string | null;
  duplicate: boolean;
};

async function resolveHousehold(): Promise<{
  householdId: string | null;
  error: string | null;
}> {
  const mode = getInventoryMode();
  if (mode !== "live") {
    return { householdId: getDemoHouseholdId(), error: null };
  }
  let householdId = await getCurrentHouseholdId();
  if (!householdId) {
    const ensured = await ensureHouseholdForCurrentUser();
    householdId = ensured.householdId;
    if (!householdId) {
      return {
        householdId: null,
        error: ensured.error ?? "No household found for your account.",
      };
    }
  }
  return { householdId, error: null };
}

export async function performSaveGroceryImport(
  payload: GrocerySavePayload,
): Promise<GrocerySaveResult> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error || !user) {
        return {
          error: "Sign in to save a grocery import.",
          savedCount: 0,
          importId: null,
          duplicate: false,
        };
      }
    } catch {
      return {
        error: "Sign in to save a grocery import.",
        savedCount: 0,
        importId: null,
        duplicate: false,
      };
    }
  }

  const selected = (payload.candidates ?? []).filter(
    (item) => item.selected !== false,
  );
  if (selected.length === 0) {
    return {
      error: "Select at least one item to import.",
      savedCount: 0,
      importId: null,
      duplicate: false,
    };
  }

  const household = await resolveHousehold();
  if (!household.householdId) {
    return {
      error: household.error ?? "No household found.",
      savedCount: 0,
      importId: null,
      duplicate: false,
    };
  }

  const mode = getInventoryMode();
  const repo = getInventoryRepository();
  let savedCount = 0;
  let importId: string | null = null;

  try {
    if (mode === "live") {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: existing } = await supabase
        .from("grocery_imports")
        .select("id, status")
        .eq("household_id", household.householdId)
        .eq("content_hash", payload.contentHash)
        .maybeSingle();

      if (existing?.status === "imported") {
        return {
          error:
            "This Woolworths/order list looks like it was already imported. Avoid double-counting stock.",
          savedCount: 0,
          importId: existing.id,
          duplicate: true,
        };
      }

      const { data: insertedImport, error: importError } = await supabase
        .from("grocery_imports")
        .upsert(
          {
            id: existing?.id,
            household_id: household.householdId,
            source_type: payload.sourceType,
            source_label: payload.sourceLabel ?? null,
            content_hash: payload.contentHash,
            status: "imported",
            fulfillment: payload.fulfillment,
            retailer: payload.retailer ?? null,
            retailer_code: payload.retailerCode ?? null,
            order_reference: payload.orderReference ?? null,
            currency: payload.currency ?? "AUD",
            order_total: payload.orderTotal ?? null,
            email_message_id: payload.emailMessageId ?? null,
            requires_approval: Boolean(payload.requiresApproval),
            approved_at: new Date().toISOString(),
            actor_user_id: user?.id ?? null,
            imported_at: new Date().toISOString(),
          },
          { onConflict: "household_id,content_hash" },
        )
        .select("id")
        .single();

      if (importError) {
        throw toDbError(importError, "Could not record grocery import.");
      }
      importId = insertedImport.id;

      await supabase
        .from("grocery_import_lines")
        .delete()
        .eq("import_id", importId);
    }

    for (const [index, item] of selected.entries()) {
      if (!item.name.trim()) continue;
      if (!INVENTORY_UNITS.includes(item.unit)) continue;
      if (!LOCATION_ORDER.includes(item.suggestedLocation as LocationType)) {
        continue;
      }
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) continue;

      const shouldStock = item.lineFulfillment !== "ordered";
      const inventoryName = (
        item.standardizedName ||
        item.originalName ||
        item.name
      ).trim();

      if (mode === "live" && importId) {
        const supabase = await createClient();
        const { error: lineError } = await supabase
          .from("grocery_import_lines")
          .insert({
            import_id: importId,
            household_id: household.householdId,
            name: item.name.trim(),
            original_name: item.originalName ?? item.name.trim(),
            standardized_name: item.standardizedName ?? inventoryName,
            brand: item.brand,
            package_size: item.packageSize,
            quantity: item.quantity,
            unit: item.unit,
            unit_price: item.unitPrice,
            line_price: item.linePrice,
            currency: item.currency || "AUD",
            suggested_location: item.suggestedLocation,
            line_fulfillment: item.lineFulfillment,
            is_food: item.isFood !== false,
            was_substituted: Boolean(item.wasSubstituted),
            substitution_note: item.substitutionNote,
            confidence: item.confidence,
            needs_review: item.needsReview,
            selected: true,
            merge_with_item_id: item.mergeWithItemId ?? null,
            ingredient_key: item.ingredientKey,
            notes: item.notes,
            sort_order: index,
          });
        if (lineError) {
          throw toDbError(lineError, "Could not save import line.");
        }
      }

      if (!shouldStock) continue;

      if (item.mergeWithItemId) {
        const snapshot = await repo.getSnapshot(household.householdId);
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
        await repo.updateItem({
          householdId: household.householdId,
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
          item.originalName && item.originalName !== inventoryName
            ? `Woolworths: ${item.originalName}`
            : null,
          item.brand ? `Brand: ${item.brand}` : null,
          item.packageSize ? `Pack: ${item.packageSize}` : null,
          item.linePrice != null
            ? `Paid $${item.linePrice.toFixed(2)} ${item.currency || "AUD"}`
            : null,
          item.wasSubstituted
            ? `Substitution${item.substitutionNote ? `: ${item.substitutionNote}` : ""}`
            : null,
          item.notes,
          "Added via Grocery Import",
        ].filter(Boolean);
        let catalogProductId: string | null = null;
        try {
          const { upsertCatalogProduct } = await import(
            "@/lib/packaged-meals/repository"
          );
          const product = await upsertCatalogProduct({
            householdId: household.householdId,
            brand: item.brand,
            displayName: inventoryName,
            packSize: item.packageSize,
            originalName: item.originalName ?? item.name,
            notes: noteParts.join(" · ") || null,
            sourceType: "import",
          });
          catalogProductId = product.id;
        } catch (catalogError) {
          console.error("catalog upsert on grocery save failed:", catalogError);
        }

        await repo.addItem({
          householdId: household.householdId,
          locationType: item.suggestedLocation,
          name: inventoryName,
          quantity: item.quantity,
          unit: item.unit as InventoryUnit,
          expiresOn: null,
          notes: noteParts.join(" · ") || null,
          catalogProductId,
        });
      }
      savedCount += 1;
    }
  } catch (error) {
    return {
      error: toDbError(error, "Could not save grocery import.").message,
      savedCount,
      importId,
      duplicate: false,
    };
  }

  if (savedCount === 0) {
    return {
      error:
        "No delivered items were saved. Include food lines marked delivered, or check name/unit/location.",
      savedCount: 0,
      importId,
      duplicate: false,
    };
  }

  return { error: null, savedCount, importId, duplicate: false };
}

export async function findDuplicateGroceryImport(
  householdId: string,
  contentHash: string,
): Promise<string | null> {
  if (getInventoryMode() !== "live") return null;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("grocery_imports")
      .select("id")
      .eq("household_id", householdId)
      .eq("content_hash", contentHash)
      .eq("status", "imported")
      .maybeSingle();
    return data?.id ?? null;
  } catch {
    return null;
  }
}
