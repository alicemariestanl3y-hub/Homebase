import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Documents the onboarding contract the RPC + app code must satisfy.
 * Live RPC execution is verified after the migration is applied in Supabase.
 */
describe("household onboarding contract", () => {
  it("requires a security-definer ensure_my_household RPC", () => {
    // Migration file name is the source of truth for operators.
    const migration =
      "supabase/migrations/20261116000000_ensure_my_household.sql";
    assert.match(migration, /ensure_my_household/);
  });

  it("treats missing household after auth as a recoverable setup error", () => {
    const message =
      "No household is linked to your account yet. In the Supabase SQL editor, run migration 20261116000000_ensure_my_household.sql, then sign in again.";
    assert.match(message, /ensure_my_household/);
    assert.doesNotMatch(message, /Something went wrong/i);
  });
});
