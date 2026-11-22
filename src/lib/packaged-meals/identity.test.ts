import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { productIdentityKey } from "./identity";

describe("productIdentityKey", () => {
  it("treats different pack sizes as distinct catalog identities", () => {
    const small = productIdentityKey({
      brand: "Mingle",
      displayName: "Satay Recipe Base",
      packSize: "30g",
    });
    const large = productIdentityKey({
      brand: "Mingle",
      displayName: "Satay Recipe Base",
      packSize: "40g",
    });
    assert.notEqual(small, large);
  });

  it("keeps the same pack size stable", () => {
    const a = productIdentityKey({
      brand: "Mingle",
      displayName: "Satay Recipe Base",
      packSize: "30g",
    });
    const b = productIdentityKey({
      brand: "Mingle",
      displayName: "Satay Recipe Base",
      packSize: "30g",
    });
    assert.equal(a, b);
  });
});
