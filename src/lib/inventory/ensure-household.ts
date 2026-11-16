import { createClient } from "@/lib/supabase/server";

/**
 * Ensure the signed-in user has a household (+ locations).
 * Prefers the DB RPC (security definer). Falls back to reading membership.
 */
export async function ensureHouseholdForCurrentUser(
  householdName = "My Kitchen",
): Promise<{ householdId: string | null; error: string | null }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { householdId: null, error: "You must be signed in." };
    }

    const { data: rpcId, error: rpcError } = await supabase.rpc(
      "ensure_my_household",
      { desired_name: householdName },
    );

    if (!rpcError && typeof rpcId === "string" && rpcId.length > 0) {
      return { householdId: rpcId, error: null };
    }

    // RPC missing (migration not applied) — fall back to a read-only lookup.
    const { data, error } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      return {
        householdId: null,
        error:
          rpcError?.message ||
          error.message ||
          "Could not load your household. Run the latest Supabase migration.",
      };
    }

    if (data?.household_id) {
      return { householdId: data.household_id, error: null };
    }

    return {
      householdId: null,
      error:
        "No household is linked to your account yet. In the Supabase SQL editor, run migration 20261116000000_ensure_my_household.sql, then sign in again.",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Household setup failed.";
    return { householdId: null, error: message };
  }
}
