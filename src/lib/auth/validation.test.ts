import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateSignInInput, validateSignUpInput } from "./validation";

describe("validateSignUpInput", () => {
  it("accepts a normal signup", () => {
    const result = validateSignUpInput({
      email: " alice@example.com ",
      password: "secret1",
      householdName: " Stanley Kitchen ",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.email, "alice@example.com");
      assert.equal(result.householdName, "Stanley Kitchen");
    }
  });

  it("defaults household name", () => {
    const result = validateSignUpInput({
      email: "a@b.co",
      password: "secret1",
      householdName: "   ",
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.householdName, "My Kitchen");
  });

  it("rejects short passwords", () => {
    const result = validateSignUpInput({
      email: "a@b.co",
      password: "123",
    });
    assert.equal(result.ok, false);
  });

  it("rejects missing email", () => {
    const result = validateSignUpInput({
      email: "not-an-email",
      password: "secret1",
    });
    assert.equal(result.ok, false);
  });
});

describe("validateSignInInput", () => {
  it("requires both fields", () => {
    assert.equal(
      validateSignInInput({ email: "", password: "x" }).ok,
      false,
    );
    assert.equal(
      validateSignInInput({ email: "a@b.co", password: "" }).ok,
      false,
    );
  });

  it("accepts email + password", () => {
    const result = validateSignInInput({
      email: "a@b.co",
      password: "secret1",
    });
    assert.equal(result.ok, true);
  });
});
