import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  displayProductName,
  matchesProductQuery,
  originalRetailerName,
} from "./product-names";

describe("product names", () => {
  it("cleans Woolworths house-brand prefixes for display", () => {
    assert.equal(
      displayProductName("Woolworths Full Cream Milk 2L"),
      "Full Cream Milk 2L",
    );
  });

  it("keeps retailer original from notes for search", () => {
    const notes = "Woolworths: Woolworths Full Cream Milk\n2L · Brand: Woolworths";
    assert.match(originalRetailerName(notes) ?? "", /Full Cream Milk/i);
    assert.equal(
      matchesProductQuery("Full Cream Milk 2L", notes, "woolworths"),
      true,
    );
    assert.equal(matchesProductQuery("Full Cream Milk 2L", notes, "milk"), true);
    assert.equal(matchesProductQuery("Full Cream Milk 2L", notes, "bread"), false);
  });
});
