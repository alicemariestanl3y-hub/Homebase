import type {
  Household,
  InventoryActivity,
  InventoryActivityAction,
  InventoryItem,
  InventoryUnit,
  Location,
  LocationType,
} from "./types";

/** Raw row shapes from Supabase (snake_case). */
export type DbHousehold = { id: string; name: string };
export type DbLocation = {
  id: string;
  household_id: string;
  type: LocationType;
  name: string;
};
export type DbInventoryItem = {
  id: string;
  household_id: string;
  location_id: string;
  name: string;
  quantity: number | string;
  unit: InventoryUnit;
  expires_on: string | null;
  notes: string | null;
  updated_at: string;
};
export type DbInventoryActivity = {
  id: string;
  household_id: string;
  item_id: string | null;
  item_name: string;
  location_type: LocationType;
  action: InventoryActivityAction;
  quantity_delta: number | string;
  unit: InventoryUnit;
  note: string | null;
  created_at: string;
};

export function mapHousehold(row: DbHousehold): Household {
  return { id: row.id, name: row.name };
}

export function mapLocation(row: DbLocation): Location {
  return {
    id: row.id,
    householdId: row.household_id,
    type: row.type,
    name: row.name,
  };
}

export function mapItem(row: DbInventoryItem): InventoryItem {
  return {
    id: row.id,
    householdId: row.household_id,
    locationId: row.location_id,
    name: row.name,
    quantity: Number(row.quantity),
    unit: row.unit,
    expiresOn: row.expires_on,
    notes: row.notes,
    updatedAt: row.updated_at,
  };
}

export function mapActivity(row: DbInventoryActivity): InventoryActivity {
  return {
    id: row.id,
    householdId: row.household_id,
    itemId: row.item_id ?? "",
    itemName: row.item_name,
    locationType: row.location_type,
    action: row.action,
    quantityDelta: Number(row.quantity_delta),
    unit: row.unit,
    note: row.note,
    createdAt: row.created_at,
  };
}
