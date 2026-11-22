import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { recognizePackagedMealProduct } from "./recognize";

describe("recognizePackagedMealProduct", () => {
  it("flags Mingle butter chicken as a recipe base", () => {
    const result = recognizePackagedMealProduct({
      name: "Mingle Butter Chicken Recipe Base",
      brand: "Mingle",
    });
    assert.equal(result.suggestedKind, "recipe_base");
    assert.notEqual(result.confidence, "low");
  });

  it("flags Mingle Satay Recipe Base as a recipe base", () => {
    const result = recognizePackagedMealProduct({
      name: "Satay Recipe Base",
      brand: "Mingle",
    });
    assert.equal(result.suggestedKind, "recipe_base");
  });

  it("flags simmer sauces as cooking sauce", () => {
    const result = recognizePackagedMealProduct({
      name: "Butter Chicken Simmer Sauce",
      brand: "Passage Foods",
    });
    assert.equal(result.suggestedKind, "cooking_sauce");
  });

  it("flags taco kits as meal kits", () => {
    const result = recognizePackagedMealProduct({
      name: "Old El Paso Soft Taco Kit",
    });
    assert.equal(result.suggestedKind, "meal_kit");
  });

  it("does not treat soy sauce as a recipe base", () => {
    const result = recognizePackagedMealProduct({
      name: "Obento Soy Sauce 250ml",
    });
    assert.equal(result.suggestedKind, "standard");
  });

  it("leaves ambiguous pantry items unclassified", () => {
    const result = recognizePackagedMealProduct({
      name: "Tomato Passata 500g",
    });
    assert.equal(result.suggestedKind, "unclassified");
  });
});
