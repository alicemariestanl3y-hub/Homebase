import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createRecipe,
  getRecipe,
  listRecipes,
  updateRecipe,
} from "./repository";

describe("recipe library (demo mode)", () => {
  it("creates, scales via update, and lists recipes", async () => {
    const householdId = "hh_demo_home";
    const created = await createRecipe(householdId, {
      title: "Packet fried rice",
      servings: 2,
      cookingMethod: "Packet meal",
      ingredients: [
        { name: "Packet fried rice", quantity: 1, unit: "packets" },
        { name: "Frozen peas", quantity: 100, unit: "g" },
      ],
      notes: "Add extra peas for the kids.",
      isFavourite: true,
    });

    assert.equal(created.title, "Packet fried rice");
    assert.equal(created.ingredients.length, 2);

    const listed = await listRecipes(householdId);
    assert.ok(listed.some((recipe) => recipe.id === created.id));

    const updated = await updateRecipe(householdId, created.id, {
      title: created.title,
      servings: 4,
      cookingMethod: created.cookingMethod,
      notes: created.notes,
      isFavourite: true,
      ingredients: created.ingredients.map((ingredient) => ({
        name: ingredient.name,
        quantity:
          ingredient.quantity == null ? null : ingredient.quantity * 2,
        unit: ingredient.unit,
      })),
    });
    assert.equal(updated.servings, 4);
    assert.equal(updated.ingredients[1]?.quantity, 200);

    const loaded = await getRecipe(householdId, created.id);
    assert.equal(loaded?.ingredients[1]?.quantity, 200);
  });
});
