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
  type InventoryRepository,
} from "./repository";
import type {
  InventoryActivity,
  InventoryItem,
  InventorySnapshot,
  LocationType,
} from "./types";

/**
 * Live inventory backed by Supabase + RLS.
 * Every query runs as the signed-in user; Postgres enforces household access.
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

    const [{ data: locations, error: locationsError }, { data: items, error: itemsError }, { data: activity, error: activityError }] =
      await Promise.all([
        supabase
          .from("locations")
          .select("id, household_id, type, name")
          .eq("household_id", householdId)
          .order("type"),
        supabase
          .from("inventory_items")
          .select(
            "id, household_id, location_id, name, quantity, unit, expires_on, notes, updated_at",
          )
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
      .select(
        "id, household_id, location_id, name, quantity, unit, expires_on, notes, updated_at",
      )
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

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error("You must be signed in to add items.");

    const { data: location, error: locationError } = await supabase
      .from("locations")
      .select("id, type")
      .eq("household_id", input.householdId)
      .eq("type", input.locationType)
      .maybeSingle();

    if (locationError) throw locationError;
    if (!location) throw new Error(`Unknown location ${input.locationType}`);

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
      .select(
        "id, household_id, location_id, name, quantity, unit, expires_on, notes, updated_at",
      )
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
