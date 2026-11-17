import { ensureHouseholdForCurrentUser } from "@/lib/inventory/ensure-household";
import {
  getDemoHouseholdId,
  getInventoryMode,
} from "@/lib/inventory/get-repository";
import { getCurrentHouseholdId } from "@/lib/inventory/supabase-repository";

export async function resolveHouseholdIdForRequest(): Promise<{
  householdId: string | null;
  error: string | null;
}> {
  const mode = getInventoryMode();
  if (mode !== "live") {
    return { householdId: getDemoHouseholdId(), error: null };
  }

  let householdId = await getCurrentHouseholdId();
  if (!householdId) {
    const ensured = await ensureHouseholdForCurrentUser();
    householdId = ensured.householdId;
    if (!householdId) {
      return {
        householdId: null,
        error: ensured.error ?? "No household found for your account.",
      };
    }
  }
  return { householdId, error: null };
}
