import { SAMPLE_INVENTORY } from "./sample-data";
import type {
  InventoryActivity,
  InventoryItem,
  InventorySnapshot,
  InventoryUnit,
  Location,
  LocationType,
} from "./types";

/**
 * InventoryRepository is the controlled boundary for inventory reads/writes.
 *
 * AI agent tools and the UI should both go through this interface — never raw
 * SQL — so household RLS rules and activity history stay consistent.
 */
export interface InventoryRepository {
  getSnapshot(householdId: string): Promise<InventorySnapshot | null>;
  listItemsByLocation(
    householdId: string,
    locationType: LocationType,
  ): Promise<InventoryItem[]>;
  listRecentActivity(
    householdId: string,
    limit?: number,
  ): Promise<InventoryActivity[]>;
  addItem(input: AddInventoryItemInput): Promise<InventoryItem>;
  updateItem(input: UpdateInventoryItemInput): Promise<InventoryItem>;
  consumeItem(input: ConsumeInventoryItemInput): Promise<InventoryItem | null>;
  deleteItem(input: DeleteInventoryItemInput): Promise<void>;
}

export type AddInventoryItemInput = {
  householdId: string;
  locationType: LocationType;
  name: string;
  quantity: number;
  unit: InventoryUnit;
  expiresOn?: string | null;
  notes?: string | null;
  catalogProductId?: string | null;
};

export type UpdateInventoryItemInput = {
  householdId: string;
  itemId: string;
  name: string;
  quantity: number;
  unit: InventoryUnit;
  locationType: LocationType;
  expiresOn?: string | null;
  notes?: string | null;
};

export type ConsumeInventoryItemInput = {
  householdId: string;
  itemId: string;
  /** Amount to use/consume; must be > 0. */
  amount: number;
  note?: string | null;
};

export type DeleteInventoryItemInput = {
  householdId: string;
  itemId: string;
  note?: string | null;
};

function sortForExpiryPriority(items: InventoryItem[]): InventoryItem[] {
  return [...items].sort((a, b) => {
    if (a.expiresOn && b.expiresOn) {
      const byExpiry = a.expiresOn.localeCompare(b.expiresOn);
      if (byExpiry !== 0) return byExpiry;
    } else if (a.expiresOn && !b.expiresOn) {
      return -1;
    } else if (!a.expiresOn && b.expiresOn) {
      return 1;
    }
    return a.name.localeCompare(b.name);
  });
}

function findLocationType(
  data: InventorySnapshot,
  locationId: string,
): LocationType {
  const location = data.locations.find((entry) => entry.id === locationId);
  if (!location) throw new Error("Location not found for item.");
  return location.type;
}

export class SampleInventoryRepository implements InventoryRepository {
  private data = structuredClone(SAMPLE_INVENTORY);

  async getSnapshot(householdId: string): Promise<InventorySnapshot | null> {
    if (this.data.household.id !== householdId) return null;
    return this.data;
  }

  async listItemsByLocation(
    householdId: string,
    locationType: LocationType,
  ): Promise<InventoryItem[]> {
    const location = this.data.locations.find(
      (entry) =>
        entry.householdId === householdId && entry.type === locationType,
    );
    if (!location) return [];

    const items = this.data.items.filter(
      (item) =>
        item.householdId === householdId && item.locationId === location.id,
    );
    return sortForExpiryPriority(items);
  }

  async listRecentActivity(
    householdId: string,
    limit = 8,
  ): Promise<InventoryActivity[]> {
    return this.data.activity
      .filter((entry) => entry.householdId === householdId)
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async addItem(input: AddInventoryItemInput): Promise<InventoryItem> {
    const location = this.data.locations.find(
      (entry) =>
        entry.householdId === input.householdId &&
        entry.type === input.locationType,
    );
    if (!location) {
      throw new Error(`Unknown location ${input.locationType}`);
    }

    const now = new Date().toISOString();
    const item: InventoryItem = {
      id: `item_${crypto.randomUUID()}`,
      householdId: input.householdId,
      locationId: location.id,
      name: input.name.trim(),
      quantity: input.quantity,
      unit: input.unit,
      expiresOn: input.expiresOn ?? null,
      notes: input.notes ?? null,
      catalogProductId: input.catalogProductId ?? null,
      updatedAt: now,
    };

    this.data.items.push(item);
    this.data.activity.unshift({
      id: `act_${crypto.randomUUID()}`,
      householdId: input.householdId,
      itemId: item.id,
      itemName: item.name,
      locationType: input.locationType,
      action: "added",
      quantityDelta: item.quantity,
      unit: item.unit,
      note: "Added from HomeBase",
      createdAt: now,
    });

    return item;
  }

  async updateItem(input: UpdateInventoryItemInput): Promise<InventoryItem> {
    const index = this.data.items.findIndex(
      (item) =>
        item.id === input.itemId && item.householdId === input.householdId,
    );
    if (index < 0) throw new Error("Item not found.");

    const location = this.data.locations.find(
      (entry) =>
        entry.householdId === input.householdId &&
        entry.type === input.locationType,
    );
    if (!location) throw new Error(`Unknown location ${input.locationType}`);

    const existing = this.data.items[index];
    const now = new Date().toISOString();
    const updated: InventoryItem = {
      ...existing,
      locationId: location.id,
      name: input.name.trim(),
      quantity: input.quantity,
      unit: input.unit,
      expiresOn: input.expiresOn ?? null,
      notes: input.notes ?? null,
      catalogProductId: existing.catalogProductId,
      updatedAt: now,
    };

    this.data.items[index] = updated;
    this.data.activity.unshift({
      id: `act_${crypto.randomUUID()}`,
      householdId: input.householdId,
      itemId: updated.id,
      itemName: updated.name,
      locationType: input.locationType,
      action: "adjusted",
      quantityDelta: updated.quantity - existing.quantity,
      unit: updated.unit,
      note: "Edited from HomeBase",
      createdAt: now,
    });

    return updated;
  }

  async consumeItem(
    input: ConsumeInventoryItemInput,
  ): Promise<InventoryItem | null> {
    const index = this.data.items.findIndex(
      (item) =>
        item.id === input.itemId && item.householdId === input.householdId,
    );
    if (index < 0) throw new Error("Item not found.");
    if (input.amount <= 0) throw new Error("Consume amount must be positive.");

    const existing = this.data.items[index];
    if (input.amount > existing.quantity) {
      throw new Error("Cannot use more than the quantity on hand.");
    }

    const now = new Date().toISOString();
    const locationType = findLocationType(this.data, existing.locationId);
    const remaining = existing.quantity - input.amount;

    this.data.activity.unshift({
      id: `act_${crypto.randomUUID()}`,
      householdId: input.householdId,
      itemId: existing.id,
      itemName: existing.name,
      locationType,
      action: "consumed",
      quantityDelta: -input.amount,
      unit: existing.unit,
      note: input.note?.trim() || "Used from HomeBase",
      createdAt: now,
    });

    if (remaining <= 0) {
      this.data.items.splice(index, 1);
      return null;
    }

    const updated: InventoryItem = {
      ...existing,
      quantity: remaining,
      updatedAt: now,
    };
    this.data.items[index] = updated;
    return updated;
  }

  async deleteItem(input: DeleteInventoryItemInput): Promise<void> {
    const index = this.data.items.findIndex(
      (item) =>
        item.id === input.itemId && item.householdId === input.householdId,
    );
    if (index < 0) throw new Error("Item not found.");

    const existing = this.data.items[index];
    const now = new Date().toISOString();
    const locationType = findLocationType(this.data, existing.locationId);

    this.data.activity.unshift({
      id: `act_${crypto.randomUUID()}`,
      householdId: input.householdId,
      itemId: existing.id,
      itemName: existing.name,
      locationType,
      action: "adjusted",
      quantityDelta: -existing.quantity,
      unit: existing.unit,
      note: input.note?.trim() || "Removed from HomeBase",
      createdAt: now,
    });

    this.data.items.splice(index, 1);
  }
}

/** Default demo household — used until auth + real households exist. */
export const DEMO_HOUSEHOLD_ID = SAMPLE_INVENTORY.household.id;

export const sampleInventoryRepository: InventoryRepository =
  new SampleInventoryRepository();

/** @deprecated Prefer getInventoryRepository() — kept for older imports. */
export const inventoryRepository = sampleInventoryRepository;

export function getLocationByType(
  locations: Location[],
  type: LocationType,
): Location | undefined {
  return locations.find((location) => location.type === type);
}

export { sortForExpiryPriority };
