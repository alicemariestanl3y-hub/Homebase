import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  DEMO_HOUSEHOLD_ID,
  sampleInventoryRepository,
  type InventoryRepository,
} from "./repository";
import { SupabaseInventoryRepository } from "./supabase-repository";
import type { InventoryMode } from "./types";

export type { InventoryMode };

export function getInventoryMode(): InventoryMode {
  return isSupabaseConfigured() ? "live" : "demo";
}

/**
 * Pick the live Supabase repo when secrets exist; otherwise sample data.
 * Keeping this switch in one place makes agent tools easy later.
 */
export function getInventoryRepository(): InventoryRepository {
  if (isSupabaseConfigured()) {
    return new SupabaseInventoryRepository();
  }
  return sampleInventoryRepository;
}

export function getDemoHouseholdId(): string {
  return DEMO_HOUSEHOLD_ID;
}
