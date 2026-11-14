import type { InventoryActivityAction, LocationType } from "./types";

export const LOCATION_LABELS: Record<LocationType, string> = {
  pantry: "Pantry",
  fridge: "Fridge",
  freezer: "Freezer",
};

export const LOCATION_ORDER: LocationType[] = ["pantry", "fridge", "freezer"];

export const ACTIVITY_LABELS: Record<InventoryActivityAction, string> = {
  added: "Added",
  consumed: "Used",
  adjusted: "Adjusted",
};
