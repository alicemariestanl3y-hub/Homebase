import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractRecipesFromHtml,
  mapJsonLdToRecipeInput,
  parseIngredientLine,
} from "./parse-url";

describe("recipe URL / ingredient parsing", () => {
  it("parses inventory-compatible quantities and leaves cups unspecified", () => {
    const milk = parseIngredientLine("2 L full cream milk");
    assert.equal(milk.quantity, 2);
    assert.equal(milk.unit, "L");
    assert.equal(milk.name, "full cream milk");

    const cups = parseIngredientLine("1 cup flour");
    assert.equal(cups.quantity, null);
    assert.equal(cups.unit, null);
    assert.equal(cups.name, "1 cup flour");
  });

  it("extracts schema.org Recipe JSON-LD without inventing ingredients", () => {
    const html = `
      <html><head>
      <script type="application/ld+json">
      {
        "@type": "Recipe",
        "name": "Easy Pasta",
        "recipeYield": "4",
        "prepTime": "PT15M",
        "cookTime": "PT20M",
        "author": { "name": "RecipeTin Eats" },
        "recipeIngredient": ["400 g pasta", "1 handful basil"],
        "recipeInstructions": ["Boil pasta.", "Toss with basil."]
      }
      </script>
      </head></html>`;
    const recipes = extractRecipesFromHtml(html);
    assert.equal(recipes.length, 1);
    const mapped = mapJsonLdToRecipeInput(
      recipes[0],
      "https://www.recipetineats.com/easy-pasta/",
    );
    assert.ok(mapped);
    assert.equal(mapped?.title, "Easy Pasta");
    assert.equal(mapped?.servings, 4);
    assert.equal(mapped?.prepMinutes, 15);
    assert.equal(mapped?.ingredients.length, 2);
    assert.equal(mapped?.ingredients[0]?.unit, "g");
    assert.equal(mapped?.ingredients[1]?.quantity, null);
    assert.match(mapped?.attribution ?? "", /RecipeTin Eats/);
  });
});
