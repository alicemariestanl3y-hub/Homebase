import { SAMPLE_INVENTORY } from "./sample-data";
import type {
  InventoryActivity,
  InventoryItem,
  InventorySnapshot,
  Location,
  LocationType,
} from "./types";

/**
 * InventoryRepository is the controlled boundary for reading inventory.
 *
 * Today it returns sample data. Later:
 *  - a Supabase implementation will query Postgres under RLS
 *  - AI agent tools will call the same methods (never raw SQL)
 *
 * Keeping reads behind this interface is how we make agent access reliable.
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
}

function sortForExpiryPriority(items: InventoryItem[]): InventoryItem[] {
  return [...items].sort((a, b) => {
    // Items with an expiry date come first; sooner expiry ranks higher.
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

export class SampleInventoryRepository implements InventoryRepository {
  constructor(private readonly data: InventorySnapshot = SAMPLE_INVENTORY) {}

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
}

/** Default demo household — used until auth + real households exist. */
export const DEMO_HOUSEHOLD_ID = SAMPLE_INVENTORY.household.id;

export const inventoryRepository: InventoryRepository =
  new SampleInventoryRepository();

export function getLocationByType(
  locations: Location[],
  type: LocationType,
): Location | undefined {
  return locations.find((location) => location.type === type);
}
