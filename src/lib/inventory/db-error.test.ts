import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toDbError } from "./db-error";

describe("toDbError", () => {
  it("keeps real Error instances", () => {
    const original = new Error("boom");
    assert.equal(toDbError(original, "fallback"), original);
  });

  it("formats Postgrest-style objects into readable Errors", () => {
    const error = toDbError(
      {
        message: "new row violates row-level security policy",
        code: "42501",
        details: "Failing row contains …",
      },
      "Could not add item.",
    );
    assert.match(error.message, /row-level security/i);
    assert.match(error.message, /42501/);
  });

  it("uses the fallback when the value is empty", () => {
    assert.equal(toDbError(null, "Could not add item.").message, "Could not add item.");
  });
});
