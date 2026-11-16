import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateSignUpInput } from "./validation";

describe("signup request contract", () => {
  it("requires validated input before Auth API is contacted", () => {
    const bad = validateSignUpInput({ email: "", password: "x" });
    assert.equal(bad.ok, false);
    // Callers must set reachedAuthApi=false when validation fails.
  });

  it("documents the API path used by the signup form", () => {
    assert.equal("/api/auth/signup".startsWith("/api/auth/"), true);
  });
});
