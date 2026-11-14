"use server";

import { revalidatePath } from "next/cache";
import {
  getDemoHouseholdId,
  getInventoryMode,
  getInventoryRepository,
} from "@/lib/inventory/get-repository";
import { getCurrentHouseholdId } from "@/lib/inventory/supabase-repository";
import { INVENTORY_UNITS } from "@/lib/inventory/units";
import type { InventoryUnit, LocationType } from "@/lib/inventory/types";
import { LOCATION_ORDER } from "@/lib/inventory/labels";

export type AddItemState = {
  error: string | null;
  ok: boolean;
};

export async function addInventoryItem(
  _prev: AddItemState,
  formData: FormData,
): Promise<AddItemState> {
  const name = String(formData.get("name") ?? "").trim();
  const quantityRaw = String(formData.get("quantity") ?? "").trim();
  const unit = String(formData.get("unit") ?? "") as InventoryUnit;
  const locationType = String(formData.get("locationType") ?? "") as LocationType;
  const expiresOn = String(formData.get("expiresOn") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const quantity = Number(quantityRaw);

  if (!name) return { error: "Item name is required.", ok: false };
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { error: "Quantity must be a positive number.", ok: false };
  }
  if (!INVENTORY_UNITS.includes(unit)) {
    return { error: "Choose a valid unit.", ok: false };
  }
  if (!LOCATION_ORDER.includes(locationType)) {
    return { error: "Choose a storage location.", ok: false };
  }

  const mode = getInventoryMode();
  const householdId =
    mode === "live" ? await getCurrentHouseholdId() : getDemoHouseholdId();

  if (!householdId) {
    return { error: "No household found for your account.", ok: false };
  }

  const repo = getInventoryRepository();
  if (!repo.addItem) {
    return { error: "Adding items is not available.", ok: false };
  }

  try {
    await repo.addItem({
      householdId,
      locationType,
      name,
      quantity,
      unit,
      expiresOn,
      notes,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not add item.";
    return { error: message, ok: false };
  }

  revalidatePath("/");
  return { error: null, ok: true };
}
