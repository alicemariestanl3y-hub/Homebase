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

export type MutationResult = {
  error: string | null;
  ok: boolean;
};

function parsePositiveQuantity(raw: string): number | null {
  const quantity = Number(raw);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  return quantity;
}

async function resolveHouseholdId(): Promise<{
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
        error:
          ensured.error ??
          "No household found for your account. Run the ensure_my_household migration, then sign in again.",
      };
    }
  }
  return { householdId, error: null };
}

export async function performAddInventoryItem(input: {
  name: string;
  quantity: string;
  unit: string;
  locationType: string;
  expiresOn?: string;
  notes?: string;
}): Promise<MutationResult> {
  const name = input.name.trim();
  const quantity = parsePositiveQuantity(input.quantity.trim());
  const unit = input.unit as InventoryUnit;
  const locationType = input.locationType as LocationType;
  const expiresOn = input.expiresOn?.trim() || null;
  const notes = input.notes?.trim() || null;

  if (!name) return { error: "Item name is required.", ok: false };
  if (quantity === null) {
    return { error: "Quantity must be a positive number.", ok: false };
  }
  if (!INVENTORY_UNITS.includes(unit)) {
    return { error: "Choose a valid unit.", ok: false };
  }
  if (!LOCATION_ORDER.includes(locationType)) {
    return { error: "Choose a storage location.", ok: false };
  }

  const household = await resolveHouseholdId();
  if (!household.householdId) {
    return { error: household.error ?? "No household found.", ok: false };
  }

  try {
    let catalogProductId: string | null = null;
    try {
      const { upsertCatalogProduct } = await import(
        "@/lib/packaged-meals/repository"
      );
      const product = await upsertCatalogProduct({
        householdId: household.householdId,
        displayName: name,
        originalName: name,
        notes,
        sourceType: "manual",
      });
      catalogProductId = product.id;
    } catch (catalogError) {
      console.error("catalog upsert on add failed:", catalogError);
    }

    await getInventoryRepository().addItem({
      householdId: household.householdId,
      locationType,
      name,
      quantity,
      unit,
      expiresOn,
      notes,
      catalogProductId,
    });
    return { error: null, ok: true };
  } catch (error) {
    return {
      error: toDbError(error, "Could not add item.").message,
      ok: false,
    };
  }
}

export async function performUpdateInventoryItem(input: {
  itemId: string;
  name: string;
  quantity: string;
  unit: string;
  locationType: string;
  expiresOn?: string;
  notes?: string;
}): Promise<MutationResult> {
  const itemId = input.itemId.trim();
  const name = input.name.trim();
  const quantity = parsePositiveQuantity(input.quantity.trim());
  const unit = input.unit as InventoryUnit;
  const locationType = input.locationType as LocationType;
  const expiresOn = input.expiresOn?.trim() || null;
  const notes = input.notes?.trim() || null;

  if (!itemId) return { error: "Missing item.", ok: false };
  if (!name) return { error: "Item name is required.", ok: false };
  if (quantity === null) {
    return { error: "Quantity must be a positive number.", ok: false };
  }
  if (!INVENTORY_UNITS.includes(unit)) {
    return { error: "Choose a valid unit.", ok: false };
  }
  if (!LOCATION_ORDER.includes(locationType)) {
    return { error: "Choose a storage location.", ok: false };
  }

  const household = await resolveHouseholdId();
  if (!household.householdId) {
    return { error: household.error ?? "No household found.", ok: false };
  }

  try {
    await getInventoryRepository().updateItem({
      householdId: household.householdId,
      itemId,
      name,
      quantity,
      unit,
      locationType,
      expiresOn,
      notes,
    });
    return { error: null, ok: true };
  } catch (error) {
    return {
      error: toDbError(error, "Could not update item.").message,
      ok: false,
    };
  }
}

export async function performConsumeInventoryItem(input: {
  itemId: string;
  amount: string;
  note?: string;
}): Promise<MutationResult> {
  const itemId = input.itemId.trim();
  const amount = parsePositiveQuantity(input.amount.trim());
  const note = input.note?.trim() || null;

  if (!itemId) return { error: "Missing item.", ok: false };
  if (amount === null) {
    return { error: "Enter how much you used.", ok: false };
  }

  const household = await resolveHouseholdId();
  if (!household.householdId) {
    return { error: household.error ?? "No household found.", ok: false };
  }

  try {
    await getInventoryRepository().consumeItem({
      householdId: household.householdId,
      itemId,
      amount,
      note,
    });
    return { error: null, ok: true };
  } catch (error) {
    return {
      error: toDbError(error, "Could not update quantity.").message,
      ok: false,
    };
  }
}

export async function performDeleteInventoryItem(input: {
  itemId: string;
}): Promise<MutationResult> {
  const itemId = input.itemId.trim();
  if (!itemId) return { error: "Missing item.", ok: false };

  const household = await resolveHouseholdId();
  if (!household.householdId) {
    return { error: household.error ?? "No household found.", ok: false };
  }

  try {
    await getInventoryRepository().deleteItem({
      householdId: household.householdId,
      itemId,
      note: "Removed from HomeBase",
    });
    return { error: null, ok: true };
  } catch (error) {
    return {
      error: toDbError(error, "Could not remove item.").message,
      ok: false,
    };
  }
}
