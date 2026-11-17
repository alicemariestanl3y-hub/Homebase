import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contentHashFromCandidates, mapGroceryItems } from "./extract";
import { hashGroceryContent } from "./hash";

describe("grocery extract mapping", () => {
  it("maps visible lines without inventing missing brands or pack sizes", () => {
    const items = mapGroceryItems([
      {
        name: "Full cream milk",
        originalName: "Woolworths Full Cream Milk\n2L",
        standardizedName: "Full Cream Milk",
        quantity: 2,
        unit: "L",
        unitPrice: 3.1,
        linePrice: 6.2,
        suggestedLocation: "fridge",
        lineFulfillment: "delivered",
        isFood: true,
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
    assert.equal(items[0]?.originalName?.includes("2L"), true);
    assert.equal(items[0]?.standardizedName, "Full Cream Milk");
    assert.equal(items[0]?.unitPrice, 3.1);
    assert.equal(items[0]?.linePrice, 6.2);
    assert.equal(items[0]?.brand, null);
    assert.equal(items[1]?.quantity, 1);
    assert.equal(items[1]?.unit, "pieces");
    assert.equal(items[1]?.needsReview, true);
  });

  it("defaults non-food lines to unselected", () => {
    const items = mapGroceryItems([
      {
        name: "Laundry Liquid",
        isFood: false,
        quantity: 1,
        unit: "bottles",
        confidence: "high",
      },
    ]);
    assert.equal(items[0]?.selected, false);
  });

  it("builds a stable content hash including prices for duplicate detection", () => {
    const a = contentHashFromCandidates([
      {
        id: "1",
        name: "Milk",
        originalName: "Milk",
        standardizedName: "Milk",
        brand: null,
        packageSize: "2L",
        quantity: 1,
        unit: "L",
        unitPrice: 3,
        linePrice: 3,
        currency: "AUD",
        suggestedLocation: "fridge",
        lineFulfillment: "delivered",
        isFood: true,
        wasSubstituted: false,
        substitutionNote: null,
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
        originalName: "Milk",
        standardizedName: "Milk",
        brand: null,
        packageSize: "2L",
        quantity: 1,
        unit: "L",
        unitPrice: 3,
        linePrice: 3,
        currency: "AUD",
        suggestedLocation: "fridge",
        lineFulfillment: "delivered",
        isFood: true,
        wasSubstituted: false,
        substitutionNote: null,
        confidence: "high",
        needsReview: false,
        notes: null,
        ingredientKey: "milk",
      },
    ]);
    assert.equal(a, b);
    assert.equal(hashGroceryContent(["milk|1|l|3|2l"]), a);
  });
});
