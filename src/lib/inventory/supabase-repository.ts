import { createClient } from "@/lib/supabase/server";
import {
  mapActivity,
  mapHousehold,
  mapItem,
  mapLocation,
  type DbHousehold,
  type DbInventoryActivity,
  type DbInventoryItem,
  type DbLocation,
} from "./mappers";
import {
  sortForExpiryPriority,
  type AddInventoryItemInput,
  type ConsumeInventoryItemInput,
  type DeleteInventoryItemInput,
  type InventoryRepository,
  type UpdateInventoryItemInput,
} from "./repository";
import type {
  InventoryActivity,
  InventoryItem,
  InventorySnapshot,
  LocationType,
} from "./types";

const ITEM_SELECT =
  "id, household_id, location_id, name, quantity, unit, expires_on, notes, updated_at";

/**
 * Live inventory backed by Supabase + RLS.
 * Every query runs as the signed-in user; Postgres enforces household access.
 * Never uses the service-role key — only the publishable/anon key + user JWT.
 */
export class SupabaseInventoryRepository implements InventoryRepository {
  async getSnapshot(householdId: string): Promise<InventorySnapshot | null> {
    const supabase = await createClient();

    const { data: householdRow, error: householdError } = await supabase
      .from("households")
      .select("id, name")
      .eq("id", householdId)
      .maybeSingle();

    if (householdError) throw householdError;
    if (!householdRow) return null;

    const [
      { data: locations, error: locationsError },
      { data: items, error: itemsError },
      { data: activity, error: activityError },
    ] = await Promise.all([
      supabase
        .from("locations")
        .select("id, household_id, type, name")
        .eq("household_id", householdId)
        .order("type"),
      supabase
        .from("inventory_items")
        .select(ITEM_SELECT)
        .eq("household_id", householdId),
      supabase
        .from("inventory_activity")
        .select(
          "id, household_id, item_id, item_name, location_type, action, quantity_delta, unit, note, created_at",
        )
        .eq("household_id", householdId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (locationsError) throw locationsError;
    if (itemsError) throw itemsError;
    if (activityError) throw activityError;

    return {
      household: mapHousehold(householdRow as DbHousehold),
      locations: ((locations ?? []) as DbLocation[]).map(mapLocation),
      items: ((items ?? []) as DbInventoryItem[]).map(mapItem),
      activity: ((activity ?? []) as DbInventoryActivity[]).map(mapActivity),
    };
  }

  async listItemsByLocation(
    householdId: string,
    locationType: LocationType,
  ): Promise<InventoryItem[]> {
    const supabase = await createClient();

    const { data: location, error: locationError } = await supabase
      .from("locations")
      .select("id")
      .eq("household_id", householdId)
      .eq("type", locationType)
      .maybeSingle();

    if (locationError) throw locationError;
    if (!location) return [];

    const { data, error } = await supabase
      .from("inventory_items")
      .select(ITEM_SELECT)
      .eq("household_id", householdId)
      .eq("location_id", location.id);

    if (error) throw error;
    return sortForExpiryPriority(
      ((data ?? []) as DbInventoryItem[]).map(mapItem),
    );
  }

  async listRecentActivity(
    householdId: string,
    limit = 8,
  ): Promise<InventoryActivity[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("inventory_activity")
      .select(
        "id, household_id, item_id, item_name, location_type, action, quantity_delta, unit, note, created_at",
      )
      .eq("household_id", householdId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return ((data ?? []) as DbInventoryActivity[]).map(mapActivity);
  }

  async addItem(input: AddInventoryItemInput): Promise<InventoryItem> {
    const supabase = await createClient();
    const user = await requireUser(supabase);
    const location = await requireLocation(
      supabase,
      input.householdId,
      input.locationType,
    );

    const { data: inserted, error: insertError } = await supabase
      .from("inventory_items")
      .insert({
        household_id: input.householdId,
        location_id: location.id,
        name: input.name.trim(),
        quantity: input.quantity,
        unit: input.unit,
        expires_on: input.expiresOn || null,
        notes: input.notes?.trim() || null,
      })
      .select(ITEM_SELECT)
      .single();

    if (insertError) throw insertError;

    const item = mapItem(inserted as DbInventoryItem);

    const { error: activityError } = await supabase
      .from("inventory_activity")
      .insert({
        household_id: input.householdId,
        item_id: item.id,
        item_name: item.name,
        location_type: input.locationType,
        action: "added",
        quantity_delta: item.quantity,
        unit: item.unit,
        note: "Added from HomeBase",
        actor_user_id: user.id,
      });

    if (activityError) throw activityError;
    return item;
  }

  async updateItem(input: UpdateInventoryItemInput): Promise<InventoryItem> {
    const supabase = await createClient();
    const user = await requireUser(supabase);
    const existing = await requireItem(supabase, input.householdId, input.itemId);
    const location = await requireLocation(
      supabase,
      input.householdId,
      input.locationType,
    );

    const { data: updatedRow, error: updateError } = await supabase
      .from("inventory_items")
      .update({
        location_id: location.id,
        name: input.name.trim(),
        quantity: input.quantity,
        unit: input.unit,
        expires_on: input.expiresOn || null,
        notes: input.notes?.trim() || null,
      })
      .eq("id", input.itemId)
      .eq("household_id", input.householdId)
      .select(ITEM_SELECT)
      .single();

    if (updateError) throw updateError;

    const item = mapItem(updatedRow as DbInventoryItem);

    const { error: activityError } = await supabase
      .from("inventory_activity")
      .insert({
        household_id: input.householdId,
        item_id: item.id,
        item_name: item.name,
        location_type: input.locationType,
        action: "adjusted",
        quantity_delta: item.quantity - existing.quantity,
        unit: item.unit,
        note: "Edited from HomeBase",
        actor_user_id: user.id,
      });

    if (activityError) throw activityError;
    return item;
  }

  async consumeItem(
    input: ConsumeInventoryItemInput,
  ): Promise<InventoryItem | null> {
    const supabase = await createClient();
    const user = await requireUser(supabase);
    if (input.amount <= 0) throw new Error("Consume amount must be positive.");

    const existing = await requireItem(supabase, input.householdId, input.itemId);
    if (input.amount > existing.quantity) {
      throw new Error("Cannot use more than the quantity on hand.");
    }

    const locationType = await requireLocationTypeForItem(
      supabase,
      existing.locationId,
    );
    const remaining = existing.quantity - input.amount;

    const { error: activityError } = await supabase
      .from("inventory_activity")
      .insert({
        household_id: input.householdId,
        item_id: existing.id,
        item_name: existing.name,
        location_type: locationType,
        action: "consumed",
        quantity_delta: -input.amount,
        unit: existing.unit,
        note: input.note?.trim() || "Used from HomeBase",
        actor_user_id: user.id,
      });

    if (activityError) throw activityError;

    if (remaining <= 0) {
      const { error: deleteError } = await supabase
        .from("inventory_items")
        .delete()
        .eq("id", input.itemId)
        .eq("household_id", input.householdId);
      if (deleteError) throw deleteError;
      return null;
    }

    const { data: updatedRow, error: updateError } = await supabase
      .from("inventory_items")
      .update({ quantity: remaining })
      .eq("id", input.itemId)
      .eq("household_id", input.householdId)
      .select(ITEM_SELECT)
      .single();

    if (updateError) throw updateError;
    return mapItem(updatedRow as DbInventoryItem);
  }

  async deleteItem(input: DeleteInventoryItemInput): Promise<void> {
    const supabase = await createClient();
    const user = await requireUser(supabase);
    const existing = await requireItem(supabase, input.householdId, input.itemId);
    const locationType = await requireLocationTypeForItem(
      supabase,
      existing.locationId,
    );

    const { error: activityError } = await supabase
      .from("inventory_activity")
      .insert({
        household_id: input.householdId,
        item_id: existing.id,
        item_name: existing.name,
        location_type: locationType,
        action: "adjusted",
        quantity_delta: -existing.quantity,
        unit: existing.unit,
        note: input.note?.trim() || "Removed from HomeBase",
        actor_user_id: user.id,
      });

    if (activityError) throw activityError;

    const { error: deleteError } = await supabase
      .from("inventory_items")
      .delete()
      .eq("id", input.itemId)
      .eq("household_id", input.householdId);

    if (deleteError) throw deleteError;
  }
}

type AuthedClient = Awaited<ReturnType<typeof createClient>>;

async function requireUser(supabase: AuthedClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("You must be signed in.");
  return user;
}

async function requireLocation(
  supabase: AuthedClient,
  householdId: string,
  locationType: LocationType,
) {
  const { data, error } = await supabase
    .from("locations")
    .select("id, type")
    .eq("household_id", householdId)
    .eq("type", locationType)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error(`Unknown location ${locationType}`);
  return data;
}

async function requireItem(
  supabase: AuthedClient,
  householdId: string,
  itemId: string,
): Promise<InventoryItem> {
  const { data, error } = await supabase
    .from("inventory_items")
    .select(ITEM_SELECT)
    .eq("id", itemId)
    .eq("household_id", householdId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Item not found.");
  return mapItem(data as DbInventoryItem);
}

async function requireLocationTypeForItem(
  supabase: AuthedClient,
  locationId: string,
): Promise<LocationType> {
  const { data, error } = await supabase
    .from("locations")
    .select("type")
    .eq("id", locationId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Location not found for item.");
  return data.type as LocationType;
}

/** Resolve the caller's first household (v1: one household per user). */
export async function getCurrentHouseholdId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.household_id ?? null;
}
