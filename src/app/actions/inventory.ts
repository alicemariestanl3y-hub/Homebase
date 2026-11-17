"use server";

/**
 * Inventory mutations now go through /api/inventory/* Route Handlers.
 * These thin wrappers remain for any leftover server-side callers / tests.
 */
import {
  performAddInventoryItem,
  performConsumeInventoryItem,
  performDeleteInventoryItem,
  performUpdateInventoryItem,
  type MutationResult,
} from "@/lib/inventory/perform-mutations";

export type MutationState = MutationResult;

export async function addInventoryItem(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  return performAddInventoryItem({
    name: String(formData.get("name") ?? ""),
    quantity: String(formData.get("quantity") ?? ""),
    unit: String(formData.get("unit") ?? ""),
    locationType: String(formData.get("locationType") ?? ""),
    expiresOn: String(formData.get("expiresOn") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });
}

export async function updateInventoryItem(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  return performUpdateInventoryItem({
    itemId: String(formData.get("itemId") ?? ""),
    name: String(formData.get("name") ?? ""),
    quantity: String(formData.get("quantity") ?? ""),
    unit: String(formData.get("unit") ?? ""),
    locationType: String(formData.get("locationType") ?? ""),
    expiresOn: String(formData.get("expiresOn") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });
}

export async function consumeInventoryItem(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  return performConsumeInventoryItem({
    itemId: String(formData.get("itemId") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
}

export async function deleteInventoryItem(
  _prev: MutationState,
  formData: FormData,
): Promise<MutationState> {
  return performDeleteInventoryItem({
    itemId: String(formData.get("itemId") ?? ""),
  });
}
