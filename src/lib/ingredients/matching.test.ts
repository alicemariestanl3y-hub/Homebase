import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compareQuantities,
  findIngredientMatches,
  ingredientSimilarity,
  scaleQuantity,
  toIngredientKey,
} from "./matching";

describe("ingredient matching", () => {
  it("normalizes equivalent grocery / recipe names to the same key", () => {
    assert.equal(toIngredientKey("Full Cream Milk"), toIngredientKey("milk full cream"));
    assert.equal(toIngredientKey("Eggs"), "eggs");
    assert.ok(ingredientSimilarity("organic free-range eggs", "Eggs") >= 0.45);
  });

  it("scores close product names as duplicates", () => {
    assert.ok(ingredientSimilarity("Coles full cream milk 2L", "Full cream milk") >= 0.45);
    assert.ok(ingredientSimilarity("Basmati rice", "Greek yoghurt") < 0.45);
  });

  it("only converts compatible units", () => {
    const ok = compareQuantities(2, "L", "ml");
    assert.equal(ok.comparable, true);
    assert.equal(ok.convertedQuantity, 2000);

    const bad = compareQuantities(1, "packets", "g");
    assert.equal(bad.comparable, false);
  });

  it("scales recipe quantities without inventing missing amounts", () => {
    assert.equal(scaleQuantity(200, 4, 2), 100);
    assert.equal(scaleQuantity(null, 4, 8), null);
  });

  it("finds inventory matches for a grocery line", () => {
    const matches = findIngredientMatches(
      { name: "Chopped tomatoes" },
      [
        {
          id: "1",
          name: "Chopped tomatoes can",
          quantity: 2,
          unit: "cans",
          ingredientKey: toIngredientKey("Chopped tomatoes can"),
        },
        {
          id: "2",
          name: "Butter",
          quantity: 250,
          unit: "g",
        },
      ],
    );
    assert.ok(matches.length >= 1);
    assert.equal(matches[0]?.id, "1");
  });
});
