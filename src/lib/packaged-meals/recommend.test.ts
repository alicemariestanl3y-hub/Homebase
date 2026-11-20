import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMealRecommendations } from "./recommend";
import type { CatalogProduct, PackagedMealDef } from "./types";
import type { InventoryItem } from "@/lib/inventory/types";
import type { Recipe } from "@/lib/recipes/types";

describe("buildMealRecommendations", () => {
  it("prefers in-stock verified Mingle base over bare traditional recipe", () => {
    const product: CatalogProduct = {
      id: "prod_1",
      householdId: "hh",
      brand: "Mingle",
      displayName: "Butter Chicken Recipe Base",
      variant: null,
      packSize: "30g",
      originalName: "Mingle Butter Chicken Recipe Base",
      productKind: "recipe_base",
      kindSuggested: "recipe_base",
      kindConfirmed: true,
      ingredientKey: "base_butter_chicken_mingle_recipe",
      identityKey: "mingle|butter chicken recipe base||30g",
      allergenStatus: "unverified",
      allergens: [],
      allergenNotes: null,
      allergenVerifiedAt: null,
      allergenSource: null,
      sourceType: "manual",
      sourceUrl: null,
      sourceCapturedAt: null,
      notes: null,
      createdAt: "",
      updatedAt: "",
    };

    const recipe: Recipe = {
      id: "rec_1",
      householdId: "hh",
      title: "Butter Chicken (Mingle)",
      sourceUrl: null,
      sourceName: "Mingle packet",
      attribution: null,
      servings: 4,
      prepMinutes: null,
      cookMinutes: null,
      cuisine: "Indian",
      cookingMethod: "Packet meal",
      instructions: "From packet",
      notes: null,
      isFavourite: false,
      freezerSuitable: false,
      leftoverFriendly: false,
      dietaryTags: [],
      variationOfRecipeId: null,
      recipeType: "recipe_base",
      catalogProductId: "prod_1",
      ingredients: [
        {
          id: "i1",
          name: "Chicken thigh",
          quantity: 500,
          unit: "g",
          notes: null,
          optional: false,
          ingredientKey: "chicken_thigh",
          sortOrder: 0,
        },
      ],
      createdAt: "",
      updatedAt: "",
    };

    const def: PackagedMealDef = {
      id: "def_1",
      householdId: "hh",
      catalogProductId: "prod_1",
      recipeId: "rec_1",
      servingsPerPacket: 4,
      packetsRequired: 1,
      instructions: "From packet",
      instructionsVerified: true,
      instructionsSource: "user_typed",
      instructionsCapturedAt: "",
      sourceReference: null,
      notes: null,
      included: [
        {
          id: "inc1",
          name: "Spice sachet",
          quantity: 1,
          unit: "packets",
          ingredientKey: "sachet_spice",
          notes: null,
          sortOrder: 0,
        },
      ],
      createdAt: "",
      updatedAt: "",
    };

    const inventory: InventoryItem[] = [
      {
        id: "inv1",
        householdId: "hh",
        locationId: "loc",
        name: "Mingle Butter Chicken Recipe Base",
        quantity: 2,
        unit: "packets",
        expiresOn: null,
        notes: null,
        catalogProductId: "prod_1",
        updatedAt: "",
      },
    ];

    const results = buildMealRecommendations({
      recipes: [recipe],
      products: [product],
      defs: [def],
      inventory,
    });

    assert.equal(results[0]?.recipeId, "rec_1");
    assert.equal(results[0]?.missingCount, 1);
    assert.match(results[0]?.productLabel ?? "", /Mingle/i);
  });
});
