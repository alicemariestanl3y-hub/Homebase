import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contentHashFromCandidates, mapGroceryItems } from "./extract";
import { hashGroceryContent } from "./hash";

describe("grocery extract mapping", () => {
  it("maps visible lines without inventing missing brands", () => {
    const items = mapGroceryItems([
      {
        name: "Full cream milk",
        quantity: 2,
        unit: "L",
        suggestedLocation: "fridge",
        lineFulfillment: "delivered",
        confidence: "high",
      },
      {
        name: "Mystery tin",
        quantity: null,
        unit: null,
        confidence: "low",
        needsReview: true,
      },
    ]);
    assert.equal(items.length, 2);
    assert.equal(items[0]?.brand, null);
    assert.equal(items[0]?.unit, "L");
    assert.equal(items[1]?.quantity, 1);
    assert.equal(items[1]?.unit, "pieces");
    assert.equal(items[1]?.needsReview, true);
  });

  it("builds a stable content hash for duplicate import detection", () => {
    const a = contentHashFromCandidates([
      {
        id: "1",
        name: "Milk",
        brand: null,
        packageSize: "2L",
        quantity: 1,
        unit: "L",
        suggestedLocation: "fridge",
        lineFulfillment: "delivered",
        confidence: "high",
        needsReview: false,
        notes: null,
        ingredientKey: "milk",
      },
    ]);
    const b = contentHashFromCandidates([
      {
        id: "2",
        name: "Milk",
        brand: null,
        packageSize: "2L",
        quantity: 1,
        unit: "L",
        suggestedLocation: "fridge",
        lineFulfillment: "delivered",
        confidence: "high",
        needsReview: false,
        notes: null,
        ingredientKey: "milk",
      },
    ]);
    assert.equal(a, b);
    assert.equal(hashGroceryContent(["milk|1|l||2l"]), a);
  });
});
