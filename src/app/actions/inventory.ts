"use server";

import { revalidatePath } from "next/cache";
import { LOCATION_ORDER } from "@/lib/inventory/labels";
import {
  getDemoHouseholdId,
  getInventoryMode,
  getInventoryRepository,
} from "@/lib/inventory/get-repository";
import { getCurrentHouseholdId } from "@/lib/inventory/supabase-repository";
import { INVENTORY_UNITS } from "@/lib/inventory/units";
import type { InventoryUnit, LocationType } from "@/lib/inventory/types";

export type MutationState = {
  error: string | null;
  ok: boolean;
};

async function resolveHouseholdId(): Promise<string | null> {
  const mode = getInventoryMode();
  return mode === "live" ? getCurrentHouseholdId() : getDemoHouseholdId();
}

function parsePositiveQuantity(raw: string): number | null {
  const quantity = Number(raw);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  return quantity;
}

export async function addInventoryItem(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const name = String(formData.get("name") ?? "").trim();
  const quantity = parsePositiveQuantity(
    String(formData.get("quantity") ?? "").trim(),
  );
  const unit = String(formData.get("unit") ?? "") as InventoryUnit;
  const locationType = String(
    formData.get("locationType") ?? "",
  ) as LocationType;
  const expiresOn = String(formData.get("expiresOn") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

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

  const householdId = await resolveHouseholdId();
  if (!householdId) {
    return { error: "No household found for your account.", ok: false };
  }

  try {
    await getInventoryRepository().addItem({
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

export async function updateInventoryItem(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const itemId = String(formData.get("itemId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const quantity = parsePositiveQuantity(
    String(formData.get("quantity") ?? "").trim(),
  );
  const unit = String(formData.get("unit") ?? "") as InventoryUnit;
  const locationType = String(
    formData.get("locationType") ?? "",
  ) as LocationType;
  const expiresOn = String(formData.get("expiresOn") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

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

  const householdId = await resolveHouseholdId();
  if (!householdId) {
    return { error: "No household found for your account.", ok: false };
  }

  try {
    await getInventoryRepository().updateItem({
      householdId,
      itemId,
      name,
      quantity,
      unit,
      locationType,
      expiresOn,
      notes,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update item.";
    return { error: message, ok: false };
  }

  revalidatePath("/");
  return { error: null, ok: true };
}

export async function consumeInventoryItem(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const itemId = String(formData.get("itemId") ?? "").trim();
  const amount = parsePositiveQuantity(
    String(formData.get("amount") ?? "").trim(),
  );
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!itemId) return { error: "Missing item.", ok: false };
  if (amount === null) {
    return { error: "Enter how much you used.", ok: false };
  }

  const householdId = await resolveHouseholdId();
  if (!householdId) {
    return { error: "No household found for your account.", ok: false };
  }

  try {
    await getInventoryRepository().consumeItem({
      householdId,
      itemId,
      amount,
      note,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update quantity.";
    return { error: message, ok: false };
  }

  revalidatePath("/");
  return { error: null, ok: true };
}

export async function deleteInventoryItem(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  const itemId = String(formData.get("itemId") ?? "").trim();
  if (!itemId) return { error: "Missing item.", ok: false };

  const householdId = await resolveHouseholdId();
  if (!householdId) {
    return { error: "No household found for your account.", ok: false };
  }

  try {
    await getInventoryRepository().deleteItem({
      householdId,
      itemId,
      note: "Removed from HomeBase",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not remove item.";
    return { error: message, ok: false };
  }

  revalidatePath("/");
  return { error: null, ok: true };
}
