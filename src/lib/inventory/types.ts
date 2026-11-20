/**
 * Domain types for HomeBase inventory.
 *
 * These mirror the future Supabase schema so UI, sample data, and (later)
 * AI agent tools share one vocabulary. Every record is scoped by householdId
 * even though v1 is single-user — that keeps multi-member access controls easy.
 */

/** Fixed storage zones for the first feature. */
export type LocationType = "pantry" | "fridge" | "freezer";

/**
 * Units we allow in the UI and (later) in the database.
 * Packets/bottles/cans are countable containers — they do NOT convert to
 * a standard weight/volume without an explicit package size.
 */
export type InventoryUnit =
  | "g"
  | "kg"
  | "ml"
  | "L"
  | "pieces"
  | "packets"
  | "bottles"
  | "cans";

/** Mass and volume can convert within their family; containers cannot. */
export type UnitDimension = "mass" | "volume" | "count" | "container";

export type Household = {
  id: string;
  name: string;
};

export type Location = {
  id: string;
  householdId: string;
  type: LocationType;
  /** Optional display override; defaults to the type label. */
  name: string;
};

export type InventoryItem = {
  id: string;
  householdId: string;
  locationId: string;
  name: string;
  quantity: number;
  unit: InventoryUnit;
  /** ISO date (YYYY-MM-DD) when set — used to prioritise use-before-expiry. */
  expiresOn: string | null;
  notes: string | null;
  /** Link to reusable catalog product identity (recipe bases / kits). */
  catalogProductId: string | null;
  updatedAt: string;
};

/**
 * Append-only activity log. Agents and humans will write through the same
 * controlled operations (add / consume / adjust) so history stays trustworthy.
 */
export type InventoryActivityAction = "added" | "consumed" | "adjusted";

export type InventoryActivity = {
  id: string;
  householdId: string;
  itemId: string;
  itemName: string;
  locationType: LocationType;
  action: InventoryActivityAction;
  /** Signed quantity change in the item's unit (e.g. +2, -1, +0.5). */
  quantityDelta: number;
  unit: InventoryUnit;
  /** Human- or agent-readable reason. */
  note: string | null;
  createdAt: string;
};

export type InventorySnapshot = {
  household: Household;
  locations: Location[];
  items: InventoryItem[];
  activity: InventoryActivity[];
};

/** Item plus server-computed expiry presentation for the UI. */
export type InventoryItemView = InventoryItem & {
  expiryLabel: string | null;
  urgency: "expired" | "soon" | "ok" | "none";
};

/** demo = sample data; live = Supabase + Auth. */
export type InventoryMode = "live" | "demo";
